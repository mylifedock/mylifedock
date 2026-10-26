import { db, type VaultSecurityRecord, type ProfileRecord } from "../infrastructure/database/db";
import {
  getUnlockedVaultKey,
  setUnlockedVaultKey,
  isRecoveryKeyFormat,
  unwrapVaultKeyWithPassphrase,
  unwrapVaultKeyWithRecovery,
} from "../security/vaultKeyService";
import { saveFile } from "../platform/fileExport";
import { getLocalDateString } from "../utils/dateUtils";
import { generateRecordKey, swapRecordKey, wrapRecordKey } from "../security/recordEncryption";
import { getStoredLicenseKey, LICENSE_STORAGE_KEY, notifyLicenseChanged } from "./licenseService";
import { isSupportedCurrency, PREFERRED_CURRENCY_STORAGE_KEY } from "./currencyService";

const RESTORABLE_TABLES = [
  "documents",
  "products",
  "coverages",
  "reminders",
  "finance",
  "vehicles",
  "properties",
  "secrets",
  "medicalRecords",
  "attachments",
] as const;

/** The backup belongs to another vault (or the vault is locked): ask for its passphrase. */
export class PassphraseRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PassphraseRequiredError";
  }
}

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
  return Uint8Array.from(binaryString, (char) => char.charCodeAt(0)).buffer;
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
  const licenseKey = getStoredLicenseKey();
  const preferredCurrency = localStorage.getItem(PREFERRED_CURRENCY_STORAGE_KEY);

  const exportData: Record<string, unknown[]> = {
    documents: await db.documents.toArray(),
    products: await db.products.toArray(),
    coverages: await db.coverages.toArray(),
    reminders: await db.reminders.toArray(),
    finance: await db.finance.toArray(),
    vehicles: await db.vehicles.toArray(),
    properties: await db.properties.toArray(),
    secrets: await db.secrets.toArray(),
    medicalRecords: await db.medicalRecords.toArray(),
    profiles: await db.profiles.toArray(),
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
  const filename = `MyLifeDock_Backup_${getLocalDateString()}.mldv`;

  return { blob, filename };
}

/** Exports an encrypted backup; returns false if the user cancelled the save. */
export async function exportVault(): Promise<boolean> {
  const { blob, filename } = await createBackupBlob();
  return saveFile(blob, filename, {
    title: "Save or Share Vault Backup",
    text: "Encrypted MyLifeDock Backup File (.mldv)",
    filterName: "MyLifeDock Vault Backup (*.mldv)",
  });
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

  // The restored vault gets a fresh record key; all rows are rewritten under it.
  const recordKey = generateRecordKey();
  const wrappedRecord = await wrapRecordKey(vaultKey, recordKey);

  const now = new Date().toISOString();
  const secRecord: VaultSecurityRecord = {
    ...wrappedRecord,
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

  await writeRestoredVault(payload, secRecord, recordKey);
  const licenseRestored = restorePreferences(payload);

  // Activate unlocked vault key (and its record key) in memory
  await setUnlockedVaultKey(vaultKey);

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
      throw new PassphraseRequiredError("Master Passphrase required to restore this backup.");
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
      throw new PassphraseRequiredError(
        "Decryption failed with the current vault key. Please enter your Master Passphrase."
      );
    }

    let payload: VaultBackupPayload;
    try {
      payload = JSON.parse(new TextDecoder().decode(plaintextBuffer));
    } catch {
      throw new Error("Corrupted backup payload.");
    }

    await writeRestoredVault(payload);
    restorePreferences(payload);

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

  await writeRestoredVault(backupPayload);
}

function reviveAttachment(rawItem: unknown): Record<string, unknown> {
  const item = (rawItem && typeof rawItem === "object" ? rawItem : {}) as Record<string, unknown>;
  const record = { ...item };
  if (typeof record.blobBase64 === "string") {
    record.blob = new Blob([base64ToArrayBuffer(record.blobBase64)], { type: "application/octet-stream" });
    delete record.blobBase64;
  }
  if (typeof record.ivBase64 === "string") {
    record.iv = base64ToArrayBuffer(record.ivBase64);
    delete record.ivBase64;
  }
  return record;
}

/**
 * Replaces vault contents with a decrypted backup in a single transaction,
 * so a failed restore leaves the existing vault (and its record key) untouched.
 *
 * With `newRecordKey`, every row is rewritten under that key, including rows
 * of tables the backup does not contain.
 */
async function writeRestoredVault(
  payload: Pick<VaultBackupPayload, "data" | "profile">,
  secRecord?: VaultSecurityRecord,
  newRecordKey?: Uint8Array,
): Promise<void> {
  // A Map keeps untrusted table names in the backup from reaching object keys.
  const backupTables = new Map<string, unknown>(
    payload.data && typeof payload.data === "object" ? Object.entries(payload.data) : [],
  );
  const backupProfiles = backupTables.get("profiles");
  const profiles: ProfileRecord[] = Array.isArray(backupProfiles) && backupProfiles.length > 0
    ? (backupProfiles as ProfileRecord[])
    : payload.profile ? [payload.profile] : [];

  const tables = [
    ...RESTORABLE_TABLES.map((t) => db.table(t)),
    db.profiles,
    ...(secRecord ? [db.vaultSecurity] : []),
  ];

  let previousRecordKey: Uint8Array | null = null;
  let swapped = false;

  try {
    await db.transaction("rw", tables, async () => {
      // Read rows that the backup does not replace while the current key is active.
      const carriedOver = new Map<string, unknown[]>();
      if (newRecordKey) {
        for (const table of RESTORABLE_TABLES) {
          if (!Array.isArray(backupTables.get(table))) {
            carriedOver.set(table, await db.table(table).toArray());
          }
        }
        if (profiles.length === 0) {
          carriedOver.set("profiles", await db.profiles.toArray());
        }
        previousRecordKey = swapRecordKey(newRecordKey);
        swapped = true;
      }

      if (secRecord) {
        await db.vaultSecurity.put(secRecord);
      }

      if (profiles.length > 0) {
        await db.profiles.clear();
        await db.profiles.bulkPut(profiles);
      }

      for (const table of RESTORABLE_TABLES) {
        const tableData = backupTables.get(table);
        if (!Array.isArray(tableData)) continue;

        const targetTable = db.table(table);
        await targetTable.clear();
        await targetTable.bulkAdd(table === "attachments" ? tableData.map(reviveAttachment) : tableData);
      }

      for (const [table, rows] of carriedOver) {
        if (rows.length > 0) {
          await db.table(table).bulkPut(rows);
        }
      }
    });
  } catch (error) {
    if (swapped) {
      swapRecordKey(previousRecordKey);
    }
    throw error;
  }

  (previousRecordKey as Uint8Array | null)?.fill(0);
}

/** Restores license and currency preference; returns whether a license was restored. */
function restorePreferences(payload: VaultBackupPayload): boolean {
  let licenseRestored = false;
  if (typeof payload.licenseKey === "string" && payload.licenseKey) {
    localStorage.setItem(LICENSE_STORAGE_KEY, payload.licenseKey);
    licenseRestored = true;
    notifyLicenseChanged();
  }
  if (isSupportedCurrency(payload.preferredCurrency)) {
    localStorage.setItem(PREFERRED_CURRENCY_STORAGE_KEY, payload.preferredCurrency);
  }
  return licenseRestored;
}

