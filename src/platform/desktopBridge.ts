/**
 * desktopBridge.ts
 * 
 * Platform abstraction layer for MyLifeDock.
 * Safely detects the current runtime environment and provides
 * the correct implementation for each platform:
 *   - Tauri (Windows/macOS Desktop) → uses @tauri-apps/api
 *   - Capacitor (Android/iOS) → uses existing Capacitor plugins (UNTOUCHED)
 *   - Browser (PWA/Web) → uses existing browser APIs (UNTOUCHED)
 */

// ── Environment Detection ─────────────────────────────────────────────────────

/**
 * Returns true when running inside a Tauri desktop window.
 * The `__TAURI_INTERNALS__` global is injected by Tauri at runtime.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Returns true when running inside a Capacitor native shell (Android/iOS).
 */
export function isCapacitor(): boolean {
  return typeof window !== "undefined" && "Capacitor" in window;
}

/**
 * Returns true when running in a plain web browser (no native wrapper).
 */
export function isWeb(): boolean {
  return !isTauri() && !isCapacitor();
}

/**
 * Returns the current platform name as a string.
 */
export function getPlatform(): "tauri-desktop" | "capacitor-native" | "web" {
  if (isTauri()) return "tauri-desktop";
  if (isCapacitor()) return "capacitor-native";
  return "web";
}

// ── Native Save File Dialog (Desktop only) ────────────────────────────────────

/**
 * Opens a native Save File dialog (Tauri only).
 * On non-Tauri platforms returns null so callers can fall back.
 */
export async function showSaveDialog(options: {
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<string | null> {
  if (!isTauri()) return null;

  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const result = await save({
      defaultPath: options.defaultPath,
      filters: options.filters,
    });
    return result ?? null;
  } catch {
    return null;
  }
}

/**
 * Write a file to an absolute path (Tauri desktop only).
 */
export async function writeFileDesktop(
  absolutePath: string,
  data: Uint8Array
): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(absolutePath, data);
    return true;
  } catch {
    return false;
  }
}

// ── Secure Store (Desktop) ────────────────────────────────────────────────────

/**
 * Tauri plugin-store backed key-value store.
 * Data is persisted in the OS app-data directory, NOT in browser storage.
 * This is the desktop equivalent of Capacitor Preferences.
 */
export async function desktopStorageSet(
  key: string,
  value: unknown
): Promise<void> {
  if (!isTauri()) return;
  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("mylifedock.dat", { autoSave: true });
    await store.set(key, value);
  } catch (e) {
    console.warn("[DesktopBridge] desktopStorageSet failed:", e);
  }
}

export async function desktopStorageGet<T>(key: string): Promise<T | null> {
  if (!isTauri()) return null;
  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("mylifedock.dat", { autoSave: false });
    const val = await store.get<T>(key);
    return val ?? null;
  } catch {
    return null;
  }
}

export async function desktopStorageDelete(key: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("mylifedock.dat", { autoSave: true });
    await store.delete(key);
  } catch (e) {
    console.warn("[DesktopBridge] desktopStorageDelete failed:", e);
  }
}

// ── Desktop Vault Lock Event ──────────────────────────────────────────────────

/**
 * Subscribes to the "vault-lock-requested" event emitted from the
 * Tauri Rust backend (e.g. via system tray "Lock Vault" menu item).
 * Returns an unsubscribe function.
 */
export async function onDesktopLockRequested(
  callback: () => void
): Promise<() => void> {
  if (!isTauri()) return () => {};

  try {
    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen("vault-lock-requested", () => {
      callback();
    });
    return unlisten;
  } catch {
    return () => {};
  }
}

// ── Desktop Notifications ─────────────────────────────────────────────────────

export async function showDesktopNotification(
  title: string,
  body: string
): Promise<void> {
  if (!isTauri()) return;
  try {
    const { isPermissionGranted, requestPermission, sendNotification } =
      await import("@tauri-apps/plugin-notification");
    let granted = await isPermissionGranted();
    if (!granted) {
      const perm = await requestPermission();
      granted = perm === "granted";
    }
    if (granted) {
      sendNotification({ title, body });
    }
  } catch (e) {
    console.warn("[DesktopBridge] showDesktopNotification failed:", e);
  }
}
