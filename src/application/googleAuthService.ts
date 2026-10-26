/**
 * googleAuthService.ts
 *
 * Gets a short-lived Google access token for the Drive "appDataFolder" scope,
 * the only Google permission the app asks for:
 *   - Android / iOS: native Google sign-in (@capgo/capacitor-social-login)
 *   - Windows desktop: system browser + loopback redirect + PKCE (RFC 8252),
 *     because Google blocks OAuth inside embedded webviews
 *   - Browser (development only): Google Identity Services popup
 *
 * Tokens stay in memory for one Drive operation and are never stored by the app.
 */
import { Capacitor } from "@capacitor/core";
import { isTauri } from "../platform/desktopBridge";
import { openExternalUrl } from "../platform/fileExport";
import { withExternalActivity } from "../platform/externalActivity";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

/** Web OAuth client: used by Android (Credential Manager) and the browser dev build. */
const WEB_CLIENT_ID: string =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || "350340206913-cka41qrr5efnqbi2i353c7mnb68so1hk.apps.googleusercontent.com";
/** iOS OAuth client. Its reversed ID must also be a URL scheme in ios/App/App/Info.plist. */
const IOS_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID || "";
/**
 * "Desktop app" OAuth client. Google documents that an installed app's client
 * secret is not confidential; PKCE and the state check protect the flow.
 */
const DESKTOP_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID || "";
const DESKTOP_CLIENT_SECRET: string = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_SECRET || "";

const DESKTOP_WAIT_SECONDS = 300;

/** The user closed the sign-in window or chose not to continue. */
export class GoogleSignInCancelledError extends Error {
  constructor() {
    super("Google sign-in was cancelled.");
    this.name = "GoogleSignInCancelledError";
  }
}

export function isGoogleSignInAvailable(): boolean {
  if (isTauri()) return Boolean(DESKTOP_CLIENT_ID && DESKTOP_CLIENT_SECRET);
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable("SocialLogin")) return false;
    return Capacitor.getPlatform() !== "ios" || Boolean(IOS_CLIENT_ID);
  }
  return true;
}

function isCancelMessage(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /cancel|closed|denied|dismiss|abort|12501/i.test(text);
}

/**
 * Runs `operation` with a Drive access token, then signs out of Google on
 * mobile so no Google token outlives the operation.
 */
export async function withDriveAccess<T>(operation: (accessToken: string) => Promise<T>): Promise<T> {
  if (!isGoogleSignInAvailable()) {
    throw new Error("Google Drive backup is not available in this version of the app.");
  }
  if (isTauri()) return operation(await desktopAccessToken());
  if (Capacitor.isNativePlatform()) {
    try {
      return await operation(await nativeAccessToken());
    } finally {
      await nativeSignOut();
    }
  }
  return operation(await browserAccessToken());
}

// ── Android / iOS ─────────────────────────────────────────────────────────────

let nativeInitialized: Promise<void> | null = null;

async function nativeAccessToken(): Promise<string> {
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  nativeInitialized ??= SocialLogin.initialize({
    google: {
      webClientId: WEB_CLIENT_ID,
      iOSClientId: IOS_CLIENT_ID || undefined,
      mode: "online",
    },
  }).catch((error: unknown) => {
    nativeInitialized = null;
    throw error;
  });
  await nativeInitialized;

  let response;
  try {
    response = await withExternalActivity(() =>
      SocialLogin.login({ provider: "google", options: { scopes: [DRIVE_SCOPE] } }),
    );
  } catch (error) {
    if (isCancelMessage(error)) throw new GoogleSignInCancelledError();
    throw error;
  }

  const result = response.result;
  const token = "responseType" in result && result.responseType === "online" ? result.accessToken?.token : undefined;
  if (!token) throw new Error("Google did not grant Drive access. Try again and allow access to app data.");
  return token;
}

async function nativeSignOut(): Promise<void> {
  try {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.logout({ provider: "google" });
  } catch {
    // Not signed in.
  }
}

// ── Windows desktop ───────────────────────────────────────────────────────────

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(byteLength: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

/** Parses the loopback redirect; exported for tests. */
export function parseDesktopRedirect(query: string, expectedState: string): string {
  const params = new URLSearchParams(query);
  if (params.get("state") !== expectedState) throw new Error("Google sign-in response did not match this request.");
  const error = params.get("error");
  if (error === "access_denied") throw new GoogleSignInCancelledError();
  if (error) throw new Error(`Google sign-in failed: ${error}`);
  const code = params.get("code");
  if (!code) throw new Error("Google sign-in returned no authorization code.");
  const granted = (params.get("scope") ?? DRIVE_SCOPE).split(" ");
  if (!granted.includes(DRIVE_SCOPE)) {
    throw new Error("Drive access was not granted. Try again and allow access to app data.");
  }
  return code;
}

let desktopSignInActive = false;

/** Cancels a desktop sign-in that is waiting for the browser. */
export async function cancelGoogleSignIn(): Promise<void> {
  if (!isTauri() || !desktopSignInActive) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("oauth_loopback_cancel");
}

async function desktopAccessToken(): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  const verifier = randomToken(48);
  const state = randomToken(24);
  desktopSignInActive = true;

  try {
    const port = await invoke<number>("oauth_loopback_start");
    const redirectUri = `http://127.0.0.1:${port}`;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.search = new URLSearchParams({
      client_id: DESKTOP_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: DRIVE_SCOPE,
      code_challenge: await pkceChallenge(verifier),
      code_challenge_method: "S256",
      state,
      prompt: "select_account",
    }).toString();

    await openExternalUrl(authUrl.toString());

    let query: string;
    try {
      query = await invoke<string>("oauth_loopback_wait", { timeoutSecs: DESKTOP_WAIT_SECONDS });
    } catch (error) {
      if (String(error) === "cancelled") throw new GoogleSignInCancelledError();
      if (String(error) === "timeout") throw new Error("Google sign-in timed out. Try again.", { cause: error });
      throw new Error(`Google sign-in failed: ${String(error)}`, { cause: error });
    }
    const code = parseDesktopRedirect(query, state);

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DESKTOP_CLIENT_ID,
        client_secret: DESKTOP_CLIENT_SECRET,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
    if (!response.ok || !body.access_token) {
      throw new Error(`Google sign-in failed: ${body.error_description ?? response.statusText}`);
    }
    return body.access_token;
  } finally {
    desktopSignInActive = false;
  }
}

// ── Browser (development only) ────────────────────────────────────────────────

interface GisTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken(): void;
}

interface GisWindow {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient(config: {
          client_id: string;
          scope: string;
          callback: (response: GisTokenResponse) => void;
          error_callback?: (error: { type?: string; message?: string }) => void;
        }): GisTokenClient;
      };
    };
  };
}

let gisScript: Promise<void> | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  gisScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisScript = null;
      script.remove();
      reject(new Error("Could not reach Google sign-in. Check your connection."));
    };
    document.head.appendChild(script);
  });
  return gisScript;
}

/** Loads the browser sign-in script ahead of the click so the popup is not blocked. */
export function preloadGoogleSignIn(): void {
  if (!isTauri() && !Capacitor.isNativePlatform()) void loadGoogleIdentityServices().catch(() => {});
}

async function browserAccessToken(): Promise<string> {
  await loadGoogleIdentityServices();
  const oauth2 = (window as unknown as GisWindow).google?.accounts.oauth2;
  if (!oauth2) throw new Error("Google sign-in is unavailable.");

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: WEB_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else if (response.error === "access_denied") reject(new GoogleSignInCancelledError());
        else reject(new Error(response.error_description || "Google sign-in failed."));
      },
      error_callback: (error) => {
        if (error.type === "popup_closed") {
          reject(new GoogleSignInCancelledError());
        } else if (error.type === "popup_failed_to_open") {
          reject(new Error("The Google sign-in window was blocked. Allow pop-ups and try again."));
        } else {
          reject(new Error(error.message || "Google sign-in failed."));
        }
      },
    });
    client.requestAccessToken();
  });
}
