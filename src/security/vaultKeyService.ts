import { db } from "../infrastructure/database/db";

const VAULT_SECURITY_ID = "local-vault";

const KEY_VERSION = 1;
const RECOVERY_VERSION = 1;
const PBKDF2_ITERATIONS = 600_000;
const RECOVERY_KEY_BYTES = 32;

const encoder = new TextEncoder();

let unlockedVaultKey: CryptoKey | null = null;

function createRandomSalt(): ArrayBuffer {
  const buffer = new ArrayBuffer(16);
  const bytes = new Uint8Array(buffer);

  crypto.getRandomValues(bytes);

  return buffer;
}

function createRandomRecoveryBytes(): ArrayBuffer {
  const buffer = new ArrayBuffer(
    RECOVERY_KEY_BYTES,
  );

  const bytes = new Uint8Array(buffer);

  crypto.getRandomValues(bytes);

  return buffer;
}

/**
 * Recovery key format:
 *
 * 32 random bytes
 * -> 64 hexadecimal characters
 * -> groups of 4 for readability
 *
 * Example:
 *
 * A91F-72C4-10AB-....
 *
 * The displayed key contains no secret metadata,
 * only the 256-bit random recovery secret.
 */
function encodeRecoveryKey(
  buffer: ArrayBuffer,
): string {
  const bytes = new Uint8Array(buffer);

  let hex = "";

  for (const byte of bytes) {
    hex += byte
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  }

  return (
    hex
      .match(/.{1,4}/g)
      ?.join("-") ?? hex
  );
}

function decodeRecoveryKey(
  value: string,
): ArrayBuffer {
  const normalized = value
    .trim()
    .replace(/[\s-]/g, "");

  if (
    !/^[0-9a-fA-F]{64}$/.test(
      normalized,
    )
  ) {
    throw new Error(
      "Invalid recovery key format.",
    );
  }

  const buffer =
    new ArrayBuffer(
      RECOVERY_KEY_BYTES,
    );

  const bytes =
    new Uint8Array(buffer);

  for (
    let index = 0;
    index < RECOVERY_KEY_BYTES;
    index += 1
  ) {
    const pair =
      normalized.slice(
        index * 2,
        index * 2 + 2,
      );

    bytes[index] =
      Number.parseInt(
        pair,
        16,
      );
  }

  return buffer;
}

async function deriveWrappingKey(
  passphrase: string,
  salt: ArrayBuffer,
): Promise<CryptoKey> {
  const passwordKey =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(passphrase),
      {
        name: "PBKDF2",
      },
      false,
      ["deriveKey"],
    );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    {
      name: "AES-KW",
      length: 256,
    },
    false,
    [
      "wrapKey",
      "unwrapKey",
    ],
  );
}

async function importRecoveryWrappingKey(
  recoveryKey: ArrayBuffer,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    recoveryKey,
    {
      name: "AES-KW",
      length: 256,
    },
    false,
    ["unwrapKey"],
  );
}

async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    [
      "encrypt",
      "decrypt",
    ],
  );
}

/**
 * Converts a temporarily extractable recovered
 * vault key into the normal non-extractable key
 * used by the application.
 */
async function makeVaultKeyNonExtractable(
  extractableVaultKey: CryptoKey,
): Promise<CryptoKey> {
  const rawKey =
    await crypto.subtle.exportKey(
      "raw",
      extractableVaultKey,
    );

  try {
    return await crypto.subtle.importKey(
      "raw",
      rawKey,
      {
        name: "AES-GCM",
        length: 256,
      },
      false,
      [
        "encrypt",
        "decrypt",
      ],
    );
  } finally {
    new Uint8Array(
      rawKey,
    ).fill(0);
  }
}

async function getVaultRecord() {
  return db.vaultSecurity.get(
    VAULT_SECURITY_ID,
  );
}

export async function isVaultConfigured(): Promise<boolean> {
  const record =
    await getVaultRecord();

  return record !== undefined;
}

export async function hasRecoveryKey(): Promise<boolean> {
  const record =
    await getVaultRecord();

  return Boolean(
    record?.recoveryVersion ===
      RECOVERY_VERSION &&
      record.wrappedRecoveryVaultKey,
  );
}

async function createRecoveryProtection(
  vaultKey: CryptoKey,
): Promise<string> {
  const recoveryBytes =
    createRandomRecoveryBytes();

  try {
    const recoveryWrappingKey =
      await crypto.subtle.importKey(
        "raw",
        recoveryBytes,
        {
          name: "AES-KW",
          length: 256,
        },
        false,
        ["wrapKey"],
      );

    const wrappedRecoveryVaultKey =
      await crypto.subtle.wrapKey(
        "raw",
        vaultKey,
        recoveryWrappingKey,
        "AES-KW",
      );

    const record =
      await getVaultRecord();

    if (!record) {
      throw new Error(
        "The MyLifeDock vault has not been initialized.",
      );
    }

    await db.vaultSecurity.put({
      ...record,

      recoveryVersion:
        RECOVERY_VERSION,

      wrappedRecoveryVaultKey,

      updatedAt:
        new Date().toISOString(),
    });

    return encodeRecoveryKey(
      recoveryBytes,
    );
  } finally {
    new Uint8Array(
      recoveryBytes,
    ).fill(0);
  }
}

export async function ensureRecoveryKey(): Promise<
  string | null
> {
  if (!unlockedVaultKey) {
    throw new Error(
      "The vault must be unlocked to create a recovery key.",
    );
  }

  if (await hasRecoveryKey()) {
    return null;
  }

  return createRecoveryProtection(
    unlockedVaultKey,
  );
}

export async function initializeVault(
  passphrase: string,
): Promise<string> {
  if (passphrase.length < 12) {
    throw new Error(
      "Your vault passphrase must contain at least 12 characters.",
    );
  }

  const existing =
    await getVaultRecord();

  if (existing) {
    throw new Error(
      "The MyLifeDock vault is already initialized.",
    );
  }

  const salt =
    createRandomSalt();

  const wrappingKey =
    await deriveWrappingKey(
      passphrase,
      salt,
    );

  const vaultKey =
    await generateVaultKey();

  const wrappedVaultKey =
    await crypto.subtle.wrapKey(
      "raw",
      vaultKey,
      wrappingKey,
      "AES-KW",
    );

  const recoveryBytes =
    createRandomRecoveryBytes();

  try {
    const recoveryWrappingKey =
      await crypto.subtle.importKey(
        "raw",
        recoveryBytes,
        {
          name: "AES-KW",
          length: 256,
        },
        false,
        ["wrapKey"],
      );

    const wrappedRecoveryVaultKey =
      await crypto.subtle.wrapKey(
        "raw",
        vaultKey,
        recoveryWrappingKey,
        "AES-KW",
      );

    const now =
      new Date().toISOString();

    await db.vaultSecurity.add({
      id: VAULT_SECURITY_ID,

      keyVersion: KEY_VERSION,

      kdf: "PBKDF2",
      kdfHash: "SHA-256",
      kdfIterations:
        PBKDF2_ITERATIONS,

      salt,

      wrappedVaultKey,

      recoveryVersion:
        RECOVERY_VERSION,

      wrappedRecoveryVaultKey,

      createdAt: now,
      updatedAt: now,
    });

    /*
     * Keep the key used during normal operation
     * non-extractable.
     *
     * The original generated key was extractable
     * only because Web Crypto requires that for
     * wrapKey().
     */
    unlockedVaultKey =
      await makeVaultKeyNonExtractable(
        vaultKey,
      );

    return encodeRecoveryKey(
      recoveryBytes,
    );
  } finally {
    new Uint8Array(
      recoveryBytes,
    ).fill(0);
  }
}

export async function unlockVault(
  passphrase: string,
): Promise<void> {
  const record =
    await getVaultRecord();

  if (!record) {
    throw new Error(
      "The MyLifeDock vault has not been initialized.",
    );
  }

  const wrappingKey =
    await deriveWrappingKey(
      passphrase,
      record.salt,
    );

  try {
    const vaultKey =
      await crypto.subtle.unwrapKey(
        "raw",
        record.wrappedVaultKey,
        wrappingKey,
        "AES-KW",
        {
          name: "AES-GCM",
          length: 256,
        },
        false,
        [
          "encrypt",
          "decrypt",
        ],
      );

    unlockedVaultKey =
      vaultKey;
  } catch {
    unlockedVaultKey =
      null;

    throw new Error(
      "Unable to unlock the vault. Check your passphrase.",
    );
  }
}

export async function recoverVault(
  recoveryKey: string,
  newPassphrase: string,
): Promise<void> {
  if (newPassphrase.length < 12) {
    throw new Error(
      "Your new vault passphrase must contain at least 12 characters.",
    );
  }

  const record =
    await getVaultRecord();

  if (!record) {
    throw new Error(
      "The MyLifeDock vault has not been initialized.",
    );
  }

  if (
    record.recoveryVersion !==
      RECOVERY_VERSION ||
    !record.wrappedRecoveryVaultKey
  ) {
    throw new Error(
      "Recovery has not been configured for this vault.",
    );
  }

  let recoveryBytes: ArrayBuffer;

  try {
    recoveryBytes =
      decodeRecoveryKey(
        recoveryKey,
      );
  } catch (error) {
    throw new Error(
      "Invalid recovery key format.",
      {
        cause: error,
      },
    );
  }

  /*
   * STEP 1
   *
   * Recover the vault key using the recovery key.
   *
   * We temporarily make the recovered key
   * extractable because Web Crypto requires an
   * extractable key for wrapKey().
   */
  let recoveredVaultKey: CryptoKey;

  try {
    const recoveryWrappingKey =
      await importRecoveryWrappingKey(
        recoveryBytes,
      );

    recoveredVaultKey =
      await crypto.subtle.unwrapKey(
        "raw",
        record.wrappedRecoveryVaultKey,
        recoveryWrappingKey,
        "AES-KW",
        {
          name: "AES-GCM",
          length: 256,
        },
        true,
        [
          "encrypt",
          "decrypt",
        ],
      );
  } catch (error) {
    throw new Error(
      "The recovery key does not match this vault.",
      {
        cause: error,
      },
    );
  } finally {
    new Uint8Array(
      recoveryBytes,
    ).fill(0);
  }

  /*
   * STEP 2
   *
   * Create a new passphrase protection for
   * the same vault key.
   */
  try {
    const newSalt =
      createRandomSalt();

    const newWrappingKey =
      await deriveWrappingKey(
        newPassphrase,
        newSalt,
      );

    const newWrappedVaultKey =
      await crypto.subtle.wrapKey(
        "raw",
        recoveredVaultKey,
        newWrappingKey,
        "AES-KW",
      );

    /*
     * IMPORTANT:
     *
     * Recovery protection remains untouched.
     *
     * Only the passphrase wrapping changes.
     */
    await db.vaultSecurity.put({
      ...record,

      salt: newSalt,

      wrappedVaultKey:
        newWrappedVaultKey,

      updatedAt:
        new Date().toISOString(),
    });

    /*
     * Convert the temporarily extractable key
     * into the normal non-extractable runtime key.
     */
    unlockedVaultKey =
      await makeVaultKeyNonExtractable(
        recoveredVaultKey,
      );
  } catch (error) {
    unlockedVaultKey =
      null;

    throw new Error(
      "Recovery succeeded, but setting the new passphrase failed.",
      {
        cause: error,
      },
    );
  }
}

export async function getRecoveryCapabilities() {
  const record =
    await getVaultRecord();

  return {
    passphrase: true,

    recoveryKey: Boolean(
      record?.wrappedRecoveryVaultKey,
    ),

    trustedDevice: Boolean(
      record?.wrappedTrustedDeviceVaultKey,
    ),

    googleAccount: Boolean(
      record?.wrappedAccountVaultKey,
    ),
  };
}

export function lockVault(): void {
  unlockedVaultKey =
    null;
}

export function isVaultUnlocked(): boolean {
  return (
    unlockedVaultKey !== null
  );
}

export function getUnlockedVaultKey(): CryptoKey {
  if (!unlockedVaultKey) {
    throw new Error(
      "The MyLifeDock vault is locked.",
    );
  }

  return unlockedVaultKey;
}