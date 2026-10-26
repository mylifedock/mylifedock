/**
 * Record (field-level) encryption at rest.
 *
 * Vault records are encrypted with a random 256-bit "record key". The record
 * key is stored only wrapped (AES-256-GCM) by the non-extractable vault key,
 * and is held unwrapped in memory only while the vault is unlocked.
 *
 * Encryption itself is synchronous (@noble/ciphers AES-256-GCM) because it runs
 * inside the Dexie DBCore middleware, within IndexedDB transactions. Awaiting
 * Web Crypto there would let the transaction auto-commit mid-operation.
 *
 * Each ciphertext is bound (AAD) to its table and primary key, so encrypted
 * blobs cannot be swapped between records without detection.
 */

import { gcm } from "@noble/ciphers/aes.js";

const RECORD_KEY_BYTES = 32;
const IV_BYTES = 12;
const RECORD_KEY_WRAP_AAD = new TextEncoder().encode("mld:record-key:v1");

export const RECORD_ENCRYPTION_VERSION = 1;

/** Stored shape of the encrypted part of a record. */
export interface EncryptedFields {
  v: number;
  iv: Uint8Array;
  ct: Uint8Array;
}

let recordKey: Uint8Array | null = null;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function hasRecordKey(): boolean {
  return recordKey !== null;
}

/** Replaces the in-memory record key; the previous key bytes are zeroed. */
export function setRecordKey(key: Uint8Array | null): void {
  if (recordKey && recordKey !== key) {
    recordKey.fill(0);
  }
  recordKey = key;
}

/**
 * Swaps the record key without zeroing the old one, so a failed restore can
 * put it back. Returns the previous key.
 */
export function swapRecordKey(key: Uint8Array | null): Uint8Array | null {
  const previous = recordKey;
  recordKey = key;
  return previous;
}

export function clearRecordKey(): void {
  setRecordKey(null);
}

export function generateRecordKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(RECORD_KEY_BYTES));
}

export async function wrapRecordKey(
  vaultKey: CryptoKey,
  key: Uint8Array,
): Promise<{ wrappedRecordKey: ArrayBuffer; recordKeyIv: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const wrappedRecordKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: RECORD_KEY_WRAP_AAD },
    vaultKey,
    key as Uint8Array<ArrayBuffer>,
  );
  return { wrappedRecordKey, recordKeyIv: iv.buffer };
}

export async function unwrapRecordKey(
  vaultKey: CryptoKey,
  wrappedRecordKey: ArrayBuffer,
  recordKeyIv: ArrayBuffer,
): Promise<Uint8Array> {
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: recordKeyIv, additionalData: RECORD_KEY_WRAP_AAD },
    vaultKey,
    wrappedRecordKey,
  );
  if (raw.byteLength !== RECORD_KEY_BYTES) {
    throw new Error("Invalid record key.");
  }
  return new Uint8Array(raw);
}

function aadFor(tableName: string, primaryKey: unknown): Uint8Array {
  return encoder.encode(`mld:record:v1:${tableName}:${String(primaryKey ?? "")}`);
}

export class VaultLockedError extends Error {
  constructor() {
    super("The MyLifeDock vault is locked.");
    this.name = "VaultLockedError";
  }
}

export class RecordDecryptionError extends Error {
  constructor(tableName: string, primaryKey: unknown) {
    super(`A ${tableName} record (${String(primaryKey)}) could not be decrypted. It may be corrupted.`);
    this.name = "RecordDecryptionError";
  }
}

export function encryptFields(
  tableName: string,
  primaryKey: unknown,
  fields: Record<string, unknown>,
): EncryptedFields {
  if (!recordKey) {
    throw new VaultLockedError();
  }
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = gcm(recordKey, iv, aadFor(tableName, primaryKey)).encrypt(
    encoder.encode(JSON.stringify(fields)),
  );
  return { v: RECORD_ENCRYPTION_VERSION, iv, ct };
}

export function decryptFields(
  tableName: string,
  primaryKey: unknown,
  enc: EncryptedFields,
): Record<string, unknown> {
  if (!recordKey) {
    throw new VaultLockedError();
  }
  try {
    const plain = gcm(recordKey, enc.iv, aadFor(tableName, primaryKey)).decrypt(enc.ct);
    return JSON.parse(decoder.decode(plain));
  } catch {
    throw new RecordDecryptionError(tableName, primaryKey);
  }
}
