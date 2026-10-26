/**
 * fileExport.ts
 *
 * One place for getting a file out of the vault on each of the three apps:
 *   - Android / iOS (Capacitor) → temporary file in the app cache + OS share sheet
 *   - Windows desktop (Tauri)    → native Save dialog
 *   - Browser (development only) → anchor download / Web Share
 *
 * Decrypted copies written for the share sheet live in a dedicated cache folder
 * that is purged on startup and whenever the vault locks.
 */
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isTauri, showSaveDialog, writeFileDesktop } from "./desktopBridge";
import { markExternalActivity, withExternalActivity } from "./externalActivity";

const SHARE_DIR = "mld-share";

/** Strips path separators and control characters so a file name cannot escape the cache folder. */
export function sanitizeFileName(fileName: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = fileName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/^\.+/, "").trim();
  return (cleaned || "file").slice(0, 120);
}

function isShareCancel(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return true;
  return /cancel/i.test(error instanceof Error ? error.message : String(error));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(blob);
  });
}

function browserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoking synchronously can abort the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function shareNative(blob: Blob, fileName: string, title: string, text?: string): Promise<boolean> {
  const saved = await Filesystem.writeFile({
    path: `${SHARE_DIR}/${sanitizeFileName(fileName)}`,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  });
  // The share promise can settle before the target app takes over, so also mark until the app returns.
  markExternalActivity();
  try {
    await withExternalActivity(() => Share.share({ title, text, url: saved.uri, dialogTitle: title }));
    return true;
  } catch (error) {
    if (isShareCancel(error)) return false;
    throw error;
  }
}

/**
 * Saves a file: share sheet on mobile, Save dialog on desktop.
 * Returns false when the user cancelled.
 */
export async function saveFile(
  blob: Blob,
  fileName: string,
  options: { title?: string; text?: string; filterName?: string } = {},
): Promise<boolean> {
  const title = options.title ?? `Save or Share ${fileName}`;

  if (Capacitor.isNativePlatform()) {
    return shareNative(blob, fileName, title, options.text);
  }

  if (isTauri()) {
    const ext = fileName.includes(".") ? fileName.split(".").pop() ?? "" : "";
    const filePath = await showSaveDialog({
      defaultPath: sanitizeFileName(fileName),
      filters: ext ? [{ name: options.filterName ?? `${ext.toUpperCase()} File`, extensions: [ext] }] : undefined,
    });
    if (!filePath) return false;
    if (!(await writeFileDesktop(filePath, new Uint8Array(await blob.arrayBuffer())))) {
      throw new Error("Could not write the file. Choose a different folder and try again.");
    }
    return true;
  }

  browserDownload(blob, fileName);
  return true;
}

/**
 * Shares a file with another app. Desktop has no share sheet, so it falls back to Save.
 * Returns false when the user cancelled.
 */
export async function shareFile(blob: Blob, fileName: string, mimeType: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    return shareNative(blob, fileName, `Share ${fileName}`);
  }
  if (isTauri()) {
    return saveFile(blob, fileName);
  }

  const file = new File([blob], fileName, { type: mimeType });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: fileName, files: [file] });
      return true;
    } catch (error) {
      if (isShareCancel(error)) return false;
      throw error;
    }
  }
  browserDownload(blob, fileName);
  return true;
}

/** Deletes decrypted copies left behind for the share sheet. Safe to call at any time. */
export async function purgeSharedFiles(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Filesystem.rmdir({ path: SHARE_DIR, directory: Directory.Cache, recursive: true });
  } catch {
    // Folder does not exist yet.
  }
}

/** Android's WebView has no built-in PDF viewer, so PDFs are handed to another app there. */
export function canPreviewPdfInApp(): boolean {
  return Capacitor.getPlatform() !== "android";
}

/** Opens an https or mailto link in the system browser / email app instead of inside the app window. */
export async function openExternalUrl(url: string): Promise<void> {
  const isMail = /^mailto:/i.test(url);
  if (!isMail && !/^https:\/\//i.test(url)) throw new Error("Only secure (https) and email links can be opened.");
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
    return;
  }
  if (isMail) {
    // The mobile WebViews hand mailto: navigations to the email app.
    window.location.assign(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
