import { db, type SecretRecord } from "../infrastructure/database/db";
import { getLocalProfile } from "./profileService";

export async function getSecrets(): Promise<SecretRecord[]> {
  const profile = await getLocalProfile();
  if (!profile) return [];

  return await db.secrets
    .where("ownerId")
    .equals(profile.id)
    .reverse()
    .sortBy("createdAt");
}

export async function createSecret(
  data: Omit<SecretRecord, "id" | "ownerId" | "createdAt" | "updatedAt">
): Promise<string> {
  const profile = await getLocalProfile();
  if (!profile) throw new Error("No active profile.");

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.secrets.add({
    ...data,
    id,
    ownerId: profile.id,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

export async function updateSecret(
  id: string,
  data: Partial<Omit<SecretRecord, "id" | "ownerId" | "createdAt" | "updatedAt">>
): Promise<void> {
  const now = new Date().toISOString();
  await db.secrets.update(id, {
    ...data,
    updatedAt: now,
  });
}

export async function deleteSecret(id: string): Promise<void> {
  await db.secrets.delete(id);
}
