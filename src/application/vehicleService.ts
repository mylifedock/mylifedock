import { db, type VehicleRecord } from "../infrastructure/database/db";
import { LOCAL_PROFILE_ID } from "./profileService";
import { assertCanAddItem } from "./vaultLimitService";
import { deleteAttachmentsFor } from "./attachmentService";

export type CreateVehicleInput = Omit<VehicleRecord, "id" | "ownerId" | "createdAt" | "updatedAt">;

/** `id` lets a form attach files before the record is saved. */
export async function createVehicle(input: CreateVehicleInput, id: string = crypto.randomUUID()): Promise<string> {
  if (!input.make?.trim() || !input.model?.trim()) throw new Error("Make and model are required.");
  await assertCanAddItem();
  const now = new Date().toISOString();
  await db.vehicles.add({ ...input, id, ownerId: LOCAL_PROFILE_ID, createdAt: now, updatedAt: now });
  return id;
}

export async function getVehicles(): Promise<VehicleRecord[]> {
  return db.vehicles.where("ownerId").equals(LOCAL_PROFILE_ID).sortBy("createdAt");
}

export async function updateVehicle(id: string, updates: Partial<CreateVehicleInput>): Promise<void> {
  const existing = await db.vehicles.get(id);
  if (!existing) throw new Error("Vehicle not found.");
  await db.vehicles.update(id, { ...updates, updatedAt: new Date().toISOString() });
}

export async function deleteVehicle(id: string): Promise<void> {
  await deleteAttachmentsFor(id);
  await db.vehicles.delete(id);
}
