import { db, type SecretRecord } from "../infrastructure/database/db";
import { getLocalProfile } from "./profileService";
import { getUnlockedVaultKey } from "../security/vaultKeyService";
import { arrayBufferToBase64, base64ToArrayBuffer } from "./backupService";
import { assertCanAddItem } from "./vaultLimitService";

export async function getSecrets(): Promise<SecretRecord[]> {
  const profile = await getLocalProfile();
  if (!profile) return [];

  const secrets = await db.secrets
    .where("ownerId")
    .equals(profile.id)
    .reverse()
    .sortBy("createdAt");

  const vaultKey = getUnlockedVaultKey();
  if (!vaultKey) return secrets; // Return as is if vault not unlocked, maybe caller handles error

  for (const secret of secrets) {
    if (secret.value && secret.value.startsWith('{')) {
      try {
        const parsed = JSON.parse(secret.value);
        if (parsed.ct && parsed.iv) {
          const iv = base64ToArrayBuffer(parsed.iv);
          const ct = base64ToArrayBuffer(parsed.ct);
          const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, vaultKey, ct);
          secret.value = new TextDecoder().decode(plainBuffer);
        }
      } catch {
        // legacy plaintext or parsing error
      }
    }
  }

  return secrets;
}

export async function createSecret(
  data: Omit<SecretRecord, "id" | "ownerId" | "createdAt" | "updatedAt">
): Promise<string> {
  const profile = await getLocalProfile();
  if (!profile) throw new Error("No active profile.");
  await assertCanAddItem();

  let finalValue = data.value;
  const vaultKey = getUnlockedVaultKey();
  if (vaultKey && finalValue) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(finalValue);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, encoded);
    finalValue = JSON.stringify({
      ct: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv.buffer)
    });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.secrets.add({
    ...data,
    value: finalValue,
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
  let finalValue = data.value;
  const vaultKey = getUnlockedVaultKey();
  if (vaultKey && finalValue) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(finalValue);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, encoded);
    finalValue = JSON.stringify({
      ct: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv.buffer)
    });
  }

  const updateData: Partial<SecretRecord> = { ...data, updatedAt: now };
  if (data.value !== undefined) {
    updateData.value = finalValue;
  }

  await db.secrets.update(id, updateData);
}

export async function deleteSecret(id: string): Promise<void> {
  await db.secrets.delete(id);
}
