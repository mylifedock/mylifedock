import { db, type FinanceRecord } from "../infrastructure/database/db";
import { LOCAL_PROFILE_ID } from "./profileService";

export type CreateFinanceInput = Omit<FinanceRecord, "id" | "ownerId" | "createdAt" | "updatedAt">;

export async function createFinance(input: CreateFinanceInput): Promise<string> {
  const now = new Date().toISOString();
  
  // Enforce metadata rule (no full card numbers)
  if (input.identifier && input.identifier.length > 4) {
    throw new Error("For security, only store the last 4 digits of financial identifiers.");
  }

  const id = crypto.randomUUID();
  await db.finance.add({
    ...input,
    id,
    ownerId: LOCAL_PROFILE_ID,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function getFinances(): Promise<FinanceRecord[]> {
  return db.finance.where("ownerId").equals(LOCAL_PROFILE_ID).sortBy("createdAt");
}

export async function updateFinance(id: string, updates: Partial<CreateFinanceInput>): Promise<void> {
  if (updates.identifier && updates.identifier.length > 4) {
    throw new Error("For security, only store the last 4 digits of financial identifiers.");
  }
  await db.finance.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteFinance(id: string): Promise<void> {
  await db.finance.delete(id);
}
