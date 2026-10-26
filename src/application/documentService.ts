import {
  db,
  type DocumentRecord,
} from "../infrastructure/database/db";
import { createEncryptedAttachment } from "./attachmentService";
import { assertCanAddItem } from "./vaultLimitService";

const LOCAL_PROFILE_ID = "local-profile";

/** `ownerId` is the family member the document belongs to (defaults to the vault owner). */
export type CreateDocumentInput = Omit<
  DocumentRecord,
  "id" | "ownerId" | "createdAt" | "updatedAt"
> & { ownerId?: string };

export type CreateDocumentWithAttachmentInput =
  CreateDocumentInput & {
    file?: File;
  };

/** Documents belong to the vault owner or to an existing family member profile. */
async function resolveOwner(ownerId: string | undefined): Promise<string> {
  if (!ownerId || ownerId === LOCAL_PROFILE_ID) return LOCAL_PROFILE_ID;
  if (!(await db.profiles.get(ownerId))) {
    throw new Error("That family member no longer exists.");
  }
  return ownerId;
}

export async function createDocument(
  input: CreateDocumentInput,
): Promise<DocumentRecord> {
  await assertCanAddItem();
  const now = new Date().toISOString();

  const document: DocumentRecord = {
    ...input,
    id: crypto.randomUUID(),
    ownerId: await resolveOwner(input.ownerId),
    createdAt: now,
    updatedAt: now,
  };

  await db.documents.add(document);

  return document;
}

export async function createDocumentWithAttachment(
  input: CreateDocumentWithAttachmentInput,
): Promise<DocumentRecord> {
  await assertCanAddItem();
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
    ownerId: await resolveOwner(input.ownerId),
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
   * Persist the document and encrypted attachment atomically: either both
   * are committed, or neither is.
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

/** All documents of the vault owner and family members, or one person's with `ownerId`. */
export async function getDocuments(ownerId?: string): Promise<
  DocumentRecord[]
> {
  const documents = ownerId && ownerId !== "all"
    ? await db.documents.where("ownerId").equals(ownerId).toArray()
    : await db.documents.toArray();

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

  const updated: DocumentRecord = {
    ...existing,
    ...input,
    ownerId: await resolveOwner(input.ownerId ?? existing.ownerId),
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
