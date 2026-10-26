import { db, type FinanceRecord } from "../infrastructure/database/db";
import { LOCAL_PROFILE_ID } from "./profileService";
import { assertCanAddItem } from "./vaultLimitService";
import { deleteAttachmentsFor } from "./attachmentService";

export type CreateFinanceInput = Omit<FinanceRecord, "id" | "ownerId" | "createdAt" | "updatedAt">;

function assertLastFourOnly(identifier: string | undefined): void {
  if (identifier && !/^\d{1,4}$/.test(identifier)) {
    throw new Error("For security, only store the last 4 digits of financial identifiers.");
  }
}

/** `id` lets a form attach files before the record is saved. */
export async function createFinance(input: CreateFinanceInput, id: string = crypto.randomUUID()): Promise<string> {
  assertLastFourOnly(input.identifier);
  await assertCanAddItem();
  const now = new Date().toISOString();
  await db.finance.add({ ...input, id, ownerId: LOCAL_PROFILE_ID, createdAt: now, updatedAt: now });
  return id;
}

export async function getFinances(): Promise<FinanceRecord[]> {
  return db.finance.where("ownerId").equals(LOCAL_PROFILE_ID).sortBy("createdAt");
}

export async function updateFinance(id: string, updates: Partial<CreateFinanceInput>): Promise<void> {
  assertLastFourOnly(updates.identifier);
  const existing = await db.finance.get(id);
  if (!existing) throw new Error("Finance record not found.");
  if (existing.ownerId !== LOCAL_PROFILE_ID) throw new Error("Access denied.");
  await db.finance.update(id, { ...updates, updatedAt: new Date().toISOString() });
}

export async function deleteFinance(id: string): Promise<void> {
  const existing = await db.finance.get(id);
  if (!existing) return;
  if (existing.ownerId !== LOCAL_PROFILE_ID) throw new Error("Access denied.");
  await deleteAttachmentsFor(id);
  await db.finance.delete(id);
}
