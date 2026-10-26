import { isGoogleSignInAvailable } from "./googleAuthService";

/**
 * Drive sync is offered only where Google sign-in is configured for the
 * platform (an OAuth client ID per platform, set at build time).
 */
export function isDriveSyncAvailable(): boolean {
  return isGoogleSignInAvailable();
}

export const DRIVE_UNAVAILABLE_MESSAGE =
  "Google Drive backup is not available in this version of the app yet. Use the encrypted file export instead.";

/** Drive file IDs are opaque base64url-like strings; reject anything else before building a URL. */
function assertDriveFileId(fileId: string): void {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) throw new Error("Invalid backup file reference.");
}

export interface DriveFile {
  id: string;
  name: string;
  createdTime?: string;
  size?: string;
}

const DRIVE_API_URL = "https://www.googleapis.com/drive/v3";
const UPLOAD_API_URL = "https://www.googleapis.com/upload/drive/v3/files";

/**
 * Lists all MyLifeDock backup files in the user's hidden appDataFolder.
 */
export async function listBackups(accessToken: string): Promise<DriveFile[]> {
  const query = new URLSearchParams({
    spaces: "appDataFolder",
    q: "name contains 'MyLifeDock_Backup'",
    fields: "files(id, name, createdTime, size)",
    orderBy: "createdTime desc"
  });

  const response = await fetch(`${DRIVE_API_URL}/files?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message || errBody?.error || detail;
    } catch { /* ignore parse failure */ }
    throw new Error(`Failed to list backups: ${detail}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Uploads an encrypted backup blob to the hidden appDataFolder.
 */
export async function uploadBackup(accessToken: string, fileBlob: Blob, filename: string): Promise<void> {
  const metadata = {
    name: filename,
    parents: ["appDataFolder"],
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", fileBlob);

  const response = await fetch(`${UPLOAD_API_URL}?uploadType=multipart`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message || errBody?.error || detail;
    } catch { /* ignore parse failure */ }
    throw new Error(`Failed to upload backup: ${detail}`);
  }
}

/**
 * Downloads a backup file as a Blob.
 */
export async function downloadBackup(accessToken: string, fileId: string): Promise<Blob> {
  assertDriveFileId(fileId);
  const response = await fetch(`${DRIVE_API_URL}/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message || errBody?.error || detail;
    } catch { /* ignore parse failure */ }
    throw new Error(`Failed to download backup: ${detail}`);
  }

  return response.blob();
}
