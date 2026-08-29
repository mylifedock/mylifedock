import {
  db,
  type DocumentRecord,
} from "../infrastructure/database/db";
import { createEncryptedAttachment } from "./attachmentService";

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

  /*
   * Encrypt the attachment BEFORE starting the Dexie transaction.
   *
   * Web Crypto operations are asynchronous. Preparing the encrypted
   * attachment before the transaction prevents the transaction from
   * being left waiting while encryption completes.
   *
   * If encryption or validation fails, the transaction is never started
   * and therefore no document is created.
   */
  const attachment = input.file
    ? await createEncryptedAttachment(
        document.id,
        input.file,
        now,
      )
    : undefined;

  /*
   * Persist the document and encrypted attachment atomically.
   *
   * Either:
   *   document + attachment
   * are both committed,
   *
   * or:
   *   neither is committed.
   */
  await db.transaction(
    "rw",
    db.documents,
    db.attachments,
    async () => {
      await db.documents.add(document);

      if (attachment) {
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

export async function getDocuments(): Promise<
  DocumentRecord[]
> {
  const documents = await db.documents
    .where("ownerId")
    .equals(LOCAL_PROFILE_ID)
    .toArray();

  return documents.sort(
    (a, b) =>
      b.createdAt.localeCompare(
        a.createdAt,
      ),
  );
}

export async function getDocument(
  id: string,
): Promise<DocumentRecord | undefined> {
  return db.documents.get(id);
}

export type UpdateDocumentInput = Partial<
  Omit<
    DocumentRecord,
    | "id"
    | "ownerId"
    | "createdAt"
    | "updatedAt"
  >
>;

export async function updateDocument(
  id: string,
  input: UpdateDocumentInput,
): Promise<DocumentRecord> {
  const existing =
    await db.documents.get(id);

  if (!existing) {
    throw new Error(
      "Document not found.",
    );
  }

  if (
    existing.ownerId !== LOCAL_PROFILE_ID
  ) {
    throw new Error(
      "You cannot update this document.",
    );
  }

  const updated: DocumentRecord = {
    ...existing,
    ...input,
    updatedAt:
      new Date().toISOString(),
  };

  if (!updated.title.trim()) {
    throw new Error(
      "Document title is required.",
    );
  }

  await db.documents.put(updated);

  return updated;
}