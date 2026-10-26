import { db, type PropertyRecord } from "../infrastructure/database/db";
import { LOCAL_PROFILE_ID } from "./profileService";
import { assertCanAddItem } from "./vaultLimitService";
import { deleteAttachmentsFor } from "./attachmentService";

export type CreatePropertyInput = Omit<PropertyRecord, "id" | "ownerId" | "createdAt" | "updatedAt">;

/** `id` lets a form attach files before the record is saved. */
export async function createProperty(input: CreatePropertyInput, id: string = crypto.randomUUID()): Promise<string> {
  if (!input.address?.trim()) throw new Error("Address is required.");
  await assertCanAddItem();
  const now = new Date().toISOString();
  await db.properties.add({ ...input, id, ownerId: LOCAL_PROFILE_ID, createdAt: now, updatedAt: now });
  return id;
}

export async function getProperties(): Promise<PropertyRecord[]> {
  return db.properties.where("ownerId").equals(LOCAL_PROFILE_ID).sortBy("createdAt");
}

export async function updateProperty(id: string, updates: Partial<CreatePropertyInput>): Promise<void> {
  const existing = await db.properties.get(id);
  if (!existing) throw new Error("Property not found.");
  await db.properties.update(id, { ...updates, updatedAt: new Date().toISOString() });
}

export async function deleteProperty(id: string): Promise<void> {
  await deleteAttachmentsFor(id);
  await db.properties.delete(id);
}
