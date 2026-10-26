//! Loopback redirect listener for Google sign-in on desktop.
//!
//! Google does not allow OAuth inside embedded webviews, so the desktop app
//! signs in through the system browser (RFC 8252). The frontend starts a
//! listener on 127.0.0.1, opens the browser with that redirect URI, and waits
//! here for Google to redirect back with the authorization code. The frontend
//! checks `state` and exchanges the code with PKCE, so a stray local request
//! cannot complete a sign-in.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const MAX_WAIT_SECS: u64 = 600;

const DONE_PAGE: &str = "<!doctype html><html><head><meta charset=\"utf-8\"><title>MyLifeDock</title></head>\
<body style=\"font-family:system-ui,sans-serif;background:#0a0e1a;color:#e2e8f0;display:grid;place-items:center;height:100vh;margin:0\">\
<div style=\"text-align:center\"><h1 style=\"font-size:20px\">Google sign-in finished</h1>\
<p>You can close this tab and return to MyLifeDock.</p></div></body></html>";

#[derive(Default)]
pub struct OAuthState {
    listener: Mutex<Option<TcpListener>>,
    cancelled: Arc<AtomicBool>,
}

/// Binds a listener on a free loopback port and returns the port.
#[tauri::command]
pub fn oauth_loopback_start(state: tauri::State<'_, OAuthState>) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    state.cancelled.store(false, Ordering::SeqCst);
    *state.listener.lock().map_err(|_| "Sign-in state is unavailable.")? = Some(listener);
    Ok(port)
}

/// Waits for the browser redirect and returns its query string.
#[tauri::command]
pub async fn oauth_loopback_wait(
    state: tauri::State<'_, OAuthState>,
    timeout_secs: u64,
) -> Result<String, String> {
    let listener = state
        .listener
        .lock()
        .map_err(|_| "Sign-in state is unavailable.")?
        .take()
        .ok_or("No Google sign-in is in progress.")?;
    let cancelled = Arc::clone(&state.cancelled);
    let deadline = Instant::now() + Duration::from_secs(timeout_secs.clamp(1, MAX_WAIT_SECS));

    tauri::async_runtime::spawn_blocking(move || wait_for_redirect(listener, &cancelled, deadline))
        .await
        .map_err(|e| e.to_string())?
}

fn wait_for_redirect(listener: TcpListener, cancelled: &AtomicBool, deadline: Instant) -> Result<String, String> {
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    loop {
        if cancelled.load(Ordering::SeqCst) {
            return Err("cancelled".into());
        }
        match listener.accept() {
            Ok((stream, _)) => {
                if let Some(query) = handle_connection(stream) {
                    return Ok(query);
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() >= deadline {
                    return Err("timeout".into());
                }
                std::thread::sleep(Duration::from_millis(150));
            }
            Err(e) => return Err(e.to_string()),
        }
    }
}
/// Stops a pending wait (the user closed the browser tab, for example).
#[tauri::command]
pub fn oauth_loopback_cancel(state: tauri::State<'_, OAuthState>) {
    state.cancelled.store(true, Ordering::SeqCst);
    if let Ok(mut slot) = state.listener.lock() {
        slot.take();
    }
}

/// Reads one HTTP request. Returns the query string for the redirect (`GET /?...`).
fn handle_connection(mut stream: TcpStream) -> Option<String> {
    let _ = stream.set_nonblocking(false);
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut buf = [0u8; 8192];
    let read = stream.read(&mut buf).unwrap_or(0);
    let request = String::from_utf8_lossy(&buf[..read]);

    match parse_redirect_query(&request) {
        Some(query) => {
            respond(&mut stream, "200 OK", DONE_PAGE);
            Some(query)
        }
        None => {
            respond(&mut stream, "404 Not Found", "Not found");
            None
        }
    }
}

fn parse_redirect_query(request: &str) -> Option<String> {
    let mut parts = request.lines().next()?.split_whitespace();
    if parts.next()? != "GET" {
        return None;
    }
    let target = parts.next()?;
    let query = target.strip_prefix("/?")?;
    if query.is_empty() {
        return None;
    }
    Some(query.to_string())
}

fn respond(stream: &mut TcpStream, status: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\
Cache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

#[cfg(test)]
mod tests {
    use super::parse_redirect_query;

    #[test]
    fn accepts_redirect_with_query() {
        let req = "GET /?state=abc&code=xyz HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
        assert_eq!(parse_redirect_query(req).as_deref(), Some("state=abc&code=xyz"));
    }

    #[test]
    fn rejects_other_requests() {
        assert_eq!(parse_redirect_query("GET /favicon.ico HTTP/1.1\r\n"), None);
        assert_eq!(parse_redirect_query("POST /?code=x HTTP/1.1\r\n"), None);
        assert_eq!(parse_redirect_query("GET /? HTTP/1.1\r\n"), None);
        assert_eq!(parse_redirect_query(""), None);
    }
}
