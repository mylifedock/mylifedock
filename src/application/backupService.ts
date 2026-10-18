import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { db, type VaultSecurityRecord, type ProfileRecord } from "../infrastructure/database/db";
import {
  getUnlockedVaultKey,
  setUnlockedVaultKey,
  isRecoveryKeyFormat,
  unwrapVaultKeyWithPassphrase,
  unwrapVaultKeyWithRecovery,
} from "../security/vaultKeyService";
import { isTauri, showSaveDialog, writeFileDesktop } from "../platform/desktopBridge";

export interface VaultBackupSecurityHeader {
  salt: string;
  wrappedVaultKey: string;
  wrappedRecoveryVaultKey?: string;
  recoveryVersion?: number;
  keyVersion: number;
  kdf: "PBKDF2";
  kdfHash: "SHA-256";
  kdfIterations: number;
}

export interface VaultBackupPayload {
  version: number;
  timestamp: string;
  profile?: ProfileRecord;
  licenseKey?: string | null;
  preferredCurrency?: string | null;
  data: Record<string, unknown[]>;
}

export interface VaultBackupEnvelope {
  magic: "MLDV";
  version: 2;
  security: VaultBackupSecurityHeader;
  iv: string;
  ciphertext: string;
}

export interface VaultBackupLegacy {
  version: number;
  timestamp: string;
  data: Record<string, unknown[]>;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Creates an encrypted self-contained backup blob (.mldv).
 * Includes vaultSecurity, profile, license, currency preference, and all data tables.
 */
export async function createBackupBlob(): Promise<{ blob: Blob; filename: string }> {
  const vaultKey = getUnlockedVaultKey();
  if (!vaultKey) throw new Error("Vault is locked");

  const secRecord = await db.vaultSecurity.get("local-vault");
  if (!secRecord) throw new Error("Vault security record not found");

  const profile = await db.profiles.toCollection().first();
  const licenseKey = localStorage.getItem("mylifedock_license_key");
  const preferredCurrency = localStorage.getItem("mylifedock_preferred_currency");

  const exportData: Record<string, unknown[]> = {
    documents: await db.documents.toArray(),
    products: await db.products.toArray(),
    coverages: await db.coverages.toArray(),
    reminders: await db.reminders.toArray(),
    finance: await db.finance.toArray(),
    vehicles: await db.vehicles.toArray(),
    properties: await db.properties.toArray(),
    secrets: await db.secrets.toArray(),
  };

  const attachments = await db.attachments.toArray();
  exportData["attachments"] = await Promise.all(attachments.map(async (a) => {
    let blobBase64: string | undefined;
    if (a.blob) {
      const ab = await a.blob.arrayBuffer();
      blobBase64 = arrayBufferToBase64(ab);
    }
    return {
      ...a,
      blob: undefined,
      blobBase64,
      ivBase64: a.iv ? arrayBufferToBase64(a.iv) : undefined,
      iv: undefined,
    };
  }));

  const backupPayload: VaultBackupPayload = {
    version: 2,
    timestamp: new Date().toISOString(),
    profile,
    licenseKey,
    preferredCurrency,
    data: exportData,
  };

  const jsonString = JSON.stringify(backupPayload);
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(jsonString);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    vaultKey,
    plaintext
  );

  const envelope: VaultBackupEnvelope = {
    magic: "MLDV",
    version: 2,
    security: {
      salt: arrayBufferToBase64(secRecord.salt),
      wrappedVaultKey: arrayBufferToBase64(secRecord.wrappedVaultKey),
      wrappedRecoveryVaultKey: secRecord.wrappedRecoveryVaultKey
        ? arrayBufferToBase64(secRecord.wrappedRecoveryVaultKey)
        : undefined,
      recoveryVersion: secRecord.recoveryVersion,
      keyVersion: secRecord.keyVersion,
      kdf: secRecord.kdf,
      kdfHash: secRecord.kdfHash,
      kdfIterations: secRecord.kdfIterations,
    },
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
  };

  const envelopeJson = JSON.stringify(envelope, null, 2);
  const blob = new Blob([envelopeJson], { type: "application/json" });
  const filename = `MyLifeDock_Backup_${new Date().toISOString().split("T")[0]}.mldv`;

  return { blob, filename };
}

export async function exportVault(): Promise<void> {
  const { blob, filename } = await createBackupBlob();

  if (Capacitor.isNativePlatform()) {
    const base64Data = await blobToBase64(blob);

    const savedFile = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
    });

    await Share.share({
      title: "MyLifeDock Vault Backup",
      text: "Encrypted MyLifeDock Backup File (.mldv)",
      url: savedFile.uri,
      dialogTitle: "Save or Share Vault Backup",
    });
  } else if (isTauri()) {
    const arrayBuffer = await blob.arrayBuffer();
    const filePath = await showSaveDialog({
      defaultPath: filename,
      filters: [{ name: "MyLifeDock Vault Backup (*.mldv)", extensions: ["mldv"] }],
    });
    if (filePath) {
      await writeFileDesktop(filePath, new Uint8Array(arrayBuffer));
    }
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/**
 * Restores a vault from a self-contained backup (.mldv) using the Master Passphrase or Recovery Key.
 * Can be called during onboarding / fresh installation without any pre-existing vault.
 */
export async function restoreVaultFromBackup(
  fileOrBlob: File | Blob,
  passphraseOrRecoveryKey: string
): Promise<{ profileName: string; licenseRestored: boolean }> {
  const text = await fileOrBlob.text();
  let envelope: VaultBackupEnvelope | null = null;

  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.magic === "MLDV" && parsed.version === 2) {
      envelope = parsed as VaultBackupEnvelope;
    }
  } catch {
    envelope = null;
  }

  if (!envelope) {
    throw new Error(
      "Unrecognized or legacy backup format. If this is a legacy v1 backup, please unlock your vault first and import it via Settings."
    );
  }

  const salt = base64ToArrayBuffer(envelope.security.salt);
  const wrappedVaultKey = base64ToArrayBuffer(envelope.security.wrappedVaultKey);
  const wrappedRecoveryVaultKey = envelope.security.wrappedRecoveryVaultKey
    ? base64ToArrayBuffer(envelope.security.wrappedRecoveryVaultKey)
    : undefined;

  let vaultKey: CryptoKey;
  const isRecovery = isRecoveryKeyFormat(passphraseOrRecoveryKey);

  try {
    if (isRecovery) {
      if (!wrappedRecoveryVaultKey) {
        throw new Error("This backup does not contain an emergency recovery key configuration.");
      }
      vaultKey = await unwrapVaultKeyWithRecovery(
        passphraseOrRecoveryKey,
        wrappedRecoveryVaultKey
      );
    } else {
      vaultKey = await unwrapVaultKeyWithPassphrase(
        passphraseOrRecoveryKey,
        salt,
        wrappedVaultKey,
        envelope.security.kdfIterations || 600_000
      );
    }
  } catch {
    throw new Error("Incorrect passphrase or recovery key. Decryption failed.");
  }

  const iv = new Uint8Array(base64ToArrayBuffer(envelope.iv));
  const ciphertext = base64ToArrayBuffer(envelope.ciphertext);

  let plaintextBuffer: ArrayBuffer;
  try {
    plaintextBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      vaultKey,
      ciphertext
    );
  } catch {
    throw new Error("Decryption failed. The backup data appears corrupted.");
  }

  const jsonString = new TextDecoder().decode(plaintextBuffer);
  let payload: VaultBackupPayload;
  try {
    payload = JSON.parse(jsonString);
  } catch {
    throw new Error("Corrupted backup payload.");
  }

  // Restore vaultSecurity
  const now = new Date().toISOString();
  const secRecord: VaultSecurityRecord = {
    id: "local-vault",
    keyVersion: envelope.security.keyVersion || 1,
    kdf: envelope.security.kdf || "PBKDF2",
    kdfHash: envelope.security.kdfHash || "SHA-256",
    kdfIterations: envelope.security.kdfIterations || 600_000,
    salt,
    wrappedVaultKey,
    recoveryVersion: envelope.security.recoveryVersion,
    wrappedRecoveryVaultKey,
    createdAt: now,
    updatedAt: now,
  };

  await db.vaultSecurity.put(secRecord);

  // Restore profile
  if (payload.profile) {
    await db.profiles.clear();
    await db.profiles.put(payload.profile);
  }

  // Restore preferences and license
  let licenseRestored = false;
  if (payload.licenseKey) {
    localStorage.setItem("mylifedock_license_key", payload.licenseKey);
    licenseRestored = true;
  }
  if (payload.preferredCurrency) {
    localStorage.setItem("mylifedock_preferred_currency", payload.preferredCurrency);
  }

  // Restore tables
  const tables = [
    "documents",
    "products",
    "coverages",
    "reminders",
    "finance",
    "vehicles",
    "properties",
    "secrets",
    "attachments",
  ] as const;

  const dexieTables = tables.map((t) => db.table(t));

  await db.transaction("rw", dexieTables, async () => {
    for (const table of tables) {
      if (payload.data && Object.prototype.hasOwnProperty.call(payload.data, table)) {
        const tableData = payload.data[table];
        if (Array.isArray(tableData)) {
          const targetTable = db.table(table);

          if (table === 'attachments') {
            const reconstructed = tableData.map((rawItem: unknown) => {
              const item = (rawItem && typeof rawItem === 'object' ? rawItem : {}) as Record<string, unknown>;
              const record = { ...item };
              if (record.blobBase64 && typeof record.blobBase64 === 'string') {
                record.blob = new Blob([base64ToArrayBuffer(record.blobBase64)], { type: 'application/octet-stream' });
                delete record.blobBase64;
              }
              if (record.ivBase64 && typeof record.ivBase64 === 'string') {
                record.iv = base64ToArrayBuffer(record.ivBase64);
                delete record.ivBase64;
              }
              return record;
            });
            await targetTable.clear();
            await targetTable.bulkAdd(reconstructed);
            continue;
          }

          await targetTable.clear();
          await targetTable.bulkAdd(tableData);
        }
      }
    }
  });

  // Activate unlocked vault key in memory
  setUnlockedVaultKey(vaultKey);

  return {
    profileName: payload.profile?.displayName || "User",
    licenseRestored,
  };
}

/**
 * In-app import for Settings page (supports both v2 envelopes and legacy v1 binary backups).
 */
export async function importVault(file: File | Blob, optionalPassphrase?: string): Promise<void> {
  const text = await file.text().catch(() => "");
  let isV2 = false;

  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.magic === "MLDV") {
      isV2 = true;
    }
  } catch {
    isV2 = false;
  }

  if (isV2) {
    if (optionalPassphrase) {
      await restoreVaultFromBackup(file, optionalPassphrase);
      return;
    }

    // Try decrypting with currently unlocked key if available
    let activeVaultKey: CryptoKey;
    try {
      activeVaultKey = getUnlockedVaultKey();
    } catch {
      throw new Error("Master Passphrase required to restore this backup.");
    }

    const envelope = JSON.parse(text) as VaultBackupEnvelope;
    const iv = new Uint8Array(base64ToArrayBuffer(envelope.iv));
    const ciphertext = base64ToArrayBuffer(envelope.ciphertext);

    let plaintextBuffer: ArrayBuffer;
    try {
      plaintextBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        activeVaultKey,
        ciphertext
      );
    } catch {
      throw new Error(
        "Decryption failed with the current vault key. Please enter your Master Passphrase."
      );
    }

    const payload: VaultBackupPayload = JSON.parse(new TextDecoder().decode(plaintextBuffer));

    if (payload.profile) {
      await db.profiles.clear();
      await db.profiles.put(payload.profile);
    }
    if (payload.licenseKey) {
      localStorage.setItem("mylifedock_license_key", payload.licenseKey);
    }
    if (payload.preferredCurrency) {
      localStorage.setItem("mylifedock_preferred_currency", payload.preferredCurrency);
    }

    const tables = [
      "documents",
      "products",
      "coverages",
      "reminders",
      "finance",
      "vehicles",
      "properties",
      "secrets",
      "attachments",
    ] as const;

    const dexieTables = tables.map((t) => db.table(t));

    await db.transaction("rw", dexieTables, async () => {
      for (const table of tables) {
        if (payload.data && Object.prototype.hasOwnProperty.call(payload.data, table)) {
          const tableData = payload.data[table];
          if (Array.isArray(tableData)) {
            const targetTable = db.table(table);

            if (table === 'attachments') {
              const reconstructed = tableData.map((rawItem: unknown) => {
                const item = (rawItem && typeof rawItem === 'object' ? rawItem : {}) as Record<string, unknown>;
                const record = { ...item };
                if (record.blobBase64 && typeof record.blobBase64 === 'string') {
                  record.blob = new Blob([base64ToArrayBuffer(record.blobBase64)], { type: 'application/octet-stream' });
                  delete record.blobBase64;
                }
                if (record.ivBase64 && typeof record.ivBase64 === 'string') {
                  record.iv = base64ToArrayBuffer(record.ivBase64);
                  delete record.ivBase64;
                }
                return record;
              });
              await targetTable.clear();
              await targetTable.bulkAdd(reconstructed);
              continue;
            }

            await targetTable.clear();
            await targetTable.bulkAdd(tableData);
          }
        }
      }
    });

    return;
  }

  // Legacy v1 binary format fallback
  const vaultKey = getUnlockedVaultKey();
  if (!vaultKey) throw new Error("Vault is locked");

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength < 12) throw new Error("Invalid backup file: Too small");

  const iv = new Uint8Array(arrayBuffer.slice(0, 12));
  const ciphertext = arrayBuffer.slice(12);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      vaultKey,
      ciphertext
    );
  } catch (err) {
    throw new Error(
      "Decryption failed. Ensure your vault password matches the one used to create this backup.",
      { cause: err }
    );
  }

  const decoder = new TextDecoder();
  const jsonString = decoder.decode(plaintext);
  let backupPayload: VaultBackupLegacy;

  try {
    backupPayload = JSON.parse(jsonString);
  } catch (err) {
    throw new Error("Backup file is corrupted or not valid JSON.", { cause: err });
  }

  if (!backupPayload.version || !backupPayload.data) {
    throw new Error("Unrecognized backup format.");
  }

  const tables = [
    "documents",
    "products",
    "coverages",
    "reminders",
    "finance",
    "vehicles",
    "properties",
    "secrets",
    "attachments",
  ] as const;

  const dexieTables = tables.map((t) => db.table(t));

  await db.transaction("rw", dexieTables, async () => {
    for (const table of tables) {
      if (Object.prototype.hasOwnProperty.call(backupPayload.data, table)) {
        const tableData = backupPayload.data[table as keyof typeof backupPayload.data];
        if (Array.isArray(tableData)) {
          const targetTable = db.table(table);
          await targetTable.clear();
          await targetTable.bulkAdd(tableData);
        }
      }
    }
  });
}

