import { db, type VehicleRecord } from "../infrastructure/database/db";
import { LOCAL_PROFILE_ID } from "./profileService";

export type CreateVehicleInput = Omit<VehicleRecord, "id" | "ownerId" | "createdAt" | "updatedAt">;

export async function createVehicle(input: CreateVehicleInput): Promise<string> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.vehicles.add({
    ...input,
    id,
    ownerId: LOCAL_PROFILE_ID,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function getVehicles(): Promise<VehicleRecord[]> {
  return db.vehicles.where("ownerId").equals(LOCAL_PROFILE_ID).sortBy("createdAt");
}

export async function updateVehicle(id: string, updates: Partial<CreateVehicleInput>): Promise<void> {
  await db.vehicles.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteVehicle(id: string): Promise<void> {
  await db.vehicles.delete(id);
}
