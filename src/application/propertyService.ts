import { db, type PropertyRecord } from "../infrastructure/database/db";
import { LOCAL_PROFILE_ID } from "./profileService";

export type CreatePropertyInput = Omit<PropertyRecord, "id" | "ownerId" | "createdAt" | "updatedAt">;

export async function createProperty(input: CreatePropertyInput): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.properties.add({
    ...input,
    id,
    ownerId: LOCAL_PROFILE_ID,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function getProperties(): Promise<PropertyRecord[]> {
  return db.properties.where("ownerId").equals(LOCAL_PROFILE_ID).sortBy("createdAt");
}

export async function updateProperty(id: string, updates: Partial<CreatePropertyInput>): Promise<void> {
  await db.properties.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteProperty(id: string): Promise<void> {
  await db.properties.delete(id);
}
