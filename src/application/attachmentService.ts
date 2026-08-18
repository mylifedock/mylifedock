import { db, type AttachmentRecord } from "../infrastructure/database/db";
import { getUnlockedVaultKey } from "../security/vaultKeyService";

const LOCAL_PROFILE_ID = "local-profile";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ENCRYPTION_VERSION = 1;
const AES_GCM_IV_LENGTH = 12;

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

function createIv(): ArrayBuffer {
  const buffer = new ArrayBuffer(AES_GCM_IV_LENGTH);
  const iv = new Uint8Array(buffer);

  crypto.getRandomValues(iv);

  return buffer;
}

async function encryptFile(
  file: File,
): Promise<{ blob: Blob; iv: ArrayBuffer }> {
  const vaultKey = getUnlockedVaultKey();

  const iv = createIv();
const plaintext = await file.arrayBuffer();

const encrypted = await crypto.subtle.encrypt(
  {
    name: "AES-GCM",
    iv,
  },
  vaultKey,
  plaintext,
);

return {
  blob: new Blob([encrypted], {
    type: "application/octet-stream",
  }),
  iv,
};
}

async function decryptAttachment(
  attachment: AttachmentRecord,
): Promise<Blob> {
  if (!attachment.blob) {
    throw new Error("Attachment data is missing.");
  }

  if (
    attachment.encryptionVersion !== ENCRYPTION_VERSION ||
    !attachment.iv
  ) {
    return attachment.blob;
  }

  const vaultKey = getUnlockedVaultKey();

  const encrypted = await attachment.blob.arrayBuffer();

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: attachment.iv,
    },
    vaultKey,
    encrypted,
  );

  return new Blob([decrypted], {
    type: attachment.mimeType,
  });
}

async function migrateLegacyAttachment(
  attachment: AttachmentRecord,
): Promise<AttachmentRecord> {
  if (
    !attachment.blob ||
    attachment.encryptionVersion === ENCRYPTION_VERSION
  ) {
    return attachment;
  }

  const vaultKey = getUnlockedVaultKey();

  const iv = createIv();
  const plaintext = await attachment.blob.arrayBuffer();

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    vaultKey,
    plaintext,
  );

  const encryptedBlob = new Blob([encrypted], {
    type: "application/octet-stream",
  });

  const updated: AttachmentRecord = {
    ...attachment,
    blob: encryptedBlob,
    iv,
    encryptionVersion: ENCRYPTION_VERSION,
  };

  await db.attachments.put(updated);

  return updated;
}

export async function createEncryptedAttachment(
  documentId: string,
  file: File,
  createdAt: string,
): Promise<AttachmentRecord> {
  validateAttachment(file);

  const id = crypto.randomUUID();
  const storageKey = crypto.randomUUID();

  const { blob, iv } = await encryptFile(file);

  return {
    id,
    ownerId: LOCAL_PROFILE_ID,
    documentId,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    storageType: "indexeddb",
    storageKey,
    blob,
    iv,
    encryptionVersion: ENCRYPTION_VERSION,
    createdAt,
  };
}

export async function addAttachment({
  documentId,
  file,
}: {
  documentId: string;
  file: File;
}) {
  const attachment = await createEncryptedAttachment(
    documentId,
    file,
    new Date().toISOString(),
  );

  await db.attachments.add(attachment);

  return attachment;
}

export async function getAttachment(id: string) {
  const attachment = await db.attachments.get(id);

  if (!attachment) {
    return undefined;
  }

  const migrated = await migrateLegacyAttachment(attachment);

  return {
    ...migrated,
    blob: await decryptAttachment(migrated),
  };
}

export async function deleteAttachment(id: string) {
  await db.attachments.delete(id);
}

export async function getAttachmentsForDocument(
  documentId: string,
) {
  const attachments = await db.attachments
    .where("documentId")
    .equals(documentId)
    .toArray();

  return Promise.all(
    attachments.map(async (attachment) => {
      const migrated = await migrateLegacyAttachment(attachment);

      return {
        ...migrated,
        blob: await decryptAttachment(migrated),
      };
    }),
  );
}