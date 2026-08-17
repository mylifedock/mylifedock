import { db } from "../infrastructure/database/db";

const LOCAL_PROFILE_ID = "local-profile";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function validateAttachment(file: File): void {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(
      "Unsupported file type. Please use PDF, JPG, PNG or WebP.",
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      "File is too large. Maximum size is 10 MB.",
    );
  }
}

export async function addAttachment({
  documentId,
  file,
}: {
  documentId: string;
  file: File;
}) {
  validateAttachment(file);

  const attachment = {
    id: crypto.randomUUID(),
    ownerId: LOCAL_PROFILE_ID,
    documentId,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    storageType: "indexeddb" as const,
    storageKey: crypto.randomUUID(),
    blob: file,
    createdAt: new Date().toISOString(),
  };

  await db.attachments.add(attachment);

  return attachment;
}

export async function getAttachment(id: string) {
  return db.attachments.get(id);
}

export async function deleteAttachment(id: string) {
  await db.attachments.delete(id);
}

export async function getAttachmentsForDocument(
  documentId: string,
) {
  return db.attachments
    .where("documentId")
    .equals(documentId)
    .toArray();
}