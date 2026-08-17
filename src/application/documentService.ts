import { db } from "../infrastructure/database/db";
import type { DocumentRecord } from "../infrastructure/database/db";

const LOCAL_PROFILE_ID = "local-profile";

export type CreateDocumentInput = Omit<
  DocumentRecord,
  "id" | "ownerId" | "createdAt" | "updatedAt"
>;

export type CreateDocumentWithAttachmentInput =
  CreateDocumentInput & {
    file?: File;
  };

export async function createDocument(
  input: CreateDocumentInput,
): Promise<DocumentRecord> {
  const now = new Date().toISOString();

  const document: DocumentRecord = {
    ...input,
    id: crypto.randomUUID(),
    ownerId: LOCAL_PROFILE_ID,
    createdAt: now,
    updatedAt: now,
  };

  await db.documents.add(document);

  return document;
}

export async function createDocumentWithAttachment(
  input: CreateDocumentWithAttachmentInput,
): Promise<DocumentRecord> {
  const now = new Date().toISOString();

  const document: DocumentRecord = {
    title: input.title,
    category: input.category,
    documentType: input.documentType,
    issuer: input.issuer,
    issueDate: input.issueDate,
    expiryDate: input.expiryDate,
    sensitivity: input.sensitivity,
    storagePolicy: input.storagePolicy,
    tags: input.tags,
    notes: input.notes,
    id: crypto.randomUUID(),
    ownerId: LOCAL_PROFILE_ID,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction(
    "rw",
    db.documents,
    db.attachments,
    async () => {
      await db.documents.add(document);

      if (input.file) {
        const attachment = {
          id: crypto.randomUUID(),
          ownerId: LOCAL_PROFILE_ID,
          documentId: document.id,
          fileName: input.file.name,
          mimeType: input.file.type,
          size: input.file.size,
          storageType: "indexeddb" as const,
          storageKey: crypto.randomUUID(),
          blob: input.file,
          createdAt: now,
        };

        await db.attachments.add(attachment);
      }
    },
  );

  return document;
}

export async function deleteDocument(
  id: string,
): Promise<void> {
  await db.transaction(
    "rw",
    db.documents,
    db.attachments,
    async () => {
      await db.attachments
        .where("documentId")
        .equals(id)
        .delete();

      await db.documents.delete(id);
    },
  );
}