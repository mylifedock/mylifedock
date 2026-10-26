/**
 * Offline Cryptographic License Engine
 *
 * License format: `MLD-PRO-<base64(payloadJson)>.<base64url(signature)>`
 *
 * The signature is RSASSA-PKCS1-v1_5 / SHA-256 over the exact UTF-8 payload
 * bytes. Only the public key ships in the app (src/config/licenseConfig.ts);
 * the private signing key stays with the founder (CLI generator and the
 * Apps Script mailer read it from local/secret storage, never from the repo).
 *
 * Note: an offline check stops forged or tampered keys. It cannot stop a user
 * who patches the client code on their own device.
 */

import { LICENSE_PUBLIC_KEY_SPKI } from "../config/licenseConfig";

export const LICENSE_STORAGE_KEY = "mld_pro_license";

/** Dispatched on window whenever the stored license changes. */
export const LICENSE_CHANGED_EVENT = "mld_license_changed";

export function notifyLicenseChanged(): void {
  window.dispatchEvent(new Event(LICENSE_CHANGED_EVENT));
}

const LICENSE_PREFIX = "MLD-PRO-";

const SIGNATURE_ALGORITHM: RsaHashedImportParams = {
  name: "RSASSA-PKCS1-v1_5",
  hash: "SHA-256",
};

export type LicenseTier = "free_core" | "pro_monthly" | "pro_yearly" | "pro_6month" | "pro_lifetime";

const PRO_TIERS: ReadonlySet<LicenseTier> = new Set([
  "pro_monthly",
  "pro_yearly",
  "pro_6month",
  "pro_lifetime",
]);

export interface LicenseStatus {
  tier: LicenseTier;
  email?: string;
  isValid: boolean;
  message: string;
  expiresAt?: string;
}

const FREE_STATUS: LicenseStatus = {
  tier: "free_core",
  isValid: true,
  message: "Free Core Vault Active",
};

export function isProLicense(status: LicenseStatus): boolean {
  return status.isValid && status.tier !== "free_core";
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  // Accepts standard and URL-safe alphabets, with or without padding.
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

const importedKeys = new Map<string, Promise<CryptoKey>>();

function importPublicKey(spkiBase64: string): Promise<CryptoKey> {
  let keyPromise = importedKeys.get(spkiBase64);
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      "spki",
      base64ToBytes(spkiBase64),
      SIGNATURE_ALGORITHM,
      false,
      ["verify"],
    );
    keyPromise.catch(() => importedKeys.delete(spkiBase64));
    importedKeys.set(spkiBase64, keyPromise);
  }
  return keyPromise;
}

async function trustedPublicKeys(): Promise<string[]> {
  const keys = LICENSE_PUBLIC_KEY_SPKI ? [LICENSE_PUBLIC_KEY_SPKI] : [];
  if (import.meta.env.DEV) {
    keys.push(await getDevPublicKey());
  }
  return keys;
}

function invalid(message: string): LicenseStatus {
  return { tier: "free_core", isValid: false, message };
}

/**
 * Verifies a license string against the given trusted public keys
 * (base64 SPKI). Exported separately so tests can supply their own key.
 */
export async function verifyLicenseKeyWithKeys(
  licenseString: string,
  publicKeysSpki: readonly string[],
): Promise<LicenseStatus> {
  const trimmed = licenseString.trim();
  if (!trimmed.startsWith(LICENSE_PREFIX)) {
    return invalid("Invalid license format.");
  }

  const parts = trimmed.slice(LICENSE_PREFIX.length).split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return invalid("Invalid license format.");
  }
  const [payloadB64, signatureB64] = parts;

  if (/^[0-9a-f]{32}$/.test(signatureB64)) {
    return invalid(
      "This license key uses a retired format. Please contact support for a replacement key.",
    );
  }

  if (publicKeysSpki.length === 0) {
    return invalid("License verification is not configured in this build.");
  }

  let payloadBytes: Uint8Array<ArrayBuffer>;
  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    payloadBytes = base64ToBytes(payloadB64);
    signatureBytes = base64ToBytes(signatureB64);
  } catch {
    return invalid("Invalid license format.");
  }

  let verified = false;
  for (const spki of publicKeysSpki) {
    try {
      const key = await importPublicKey(spki);
      if (await crypto.subtle.verify(SIGNATURE_ALGORITHM, key, signatureBytes, payloadBytes)) {
        verified = true;
        break;
      }
    } catch {
      // Malformed key or signature: try the next trusted key.
    }
  }
  if (!verified) {
    return invalid("Cryptographic signature invalid.");
  }

  let payload: { tier?: unknown; email?: unknown; expiresAt?: unknown };
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return invalid("Invalid license payload.");
  }

  const tier = payload.tier as LicenseTier;
  if (typeof payload.tier !== "string" || !PRO_TIERS.has(tier)) {
    return invalid("Unknown license tier.");
  }

  const email = typeof payload.email === "string" ? payload.email : undefined;
  const expiresAt = typeof payload.expiresAt === "string" ? payload.expiresAt : undefined;

  if (tier !== "pro_lifetime") {
    const expiry = expiresAt ? new Date(expiresAt) : null;
    if (!expiry || Number.isNaN(expiry.getTime())) {
      return invalid("License is missing a valid expiry date.");
    }
    if (Date.now() > expiry.getTime()) {
      return invalid("Your subscription has expired.");
    }
  }

  return {
    tier,
    email,
    isValid: true,
    expiresAt,
    message: tier === "pro_lifetime"
      ? "Pro Lifetime License Active"
      : `Pro Subscription Active (Valid until ${new Date(expiresAt!).toLocaleDateString()})`,
  };
}

/**
 * Verifies a cryptographic license key string against this build's trusted key(s).
 */
export async function verifyLicenseKey(licenseString: string): Promise<LicenseStatus> {
  return verifyLicenseKeyWithKeys(licenseString, await trustedPublicKeys());
}

export function getStoredLicenseKey(): string | null {
  try {
    return localStorage.getItem(LICENSE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Pro bought through Google Play or the App Store (mobile apps). Held in
 * memory only and re-read from the store on every launch (both stores answer
 * offline from their own signed cache), so it cannot be faked by editing
 * app storage. Set by storeBillingService.
 */
let storeEntitlement: LicenseStatus | null = null;

export function setStoreEntitlement(status: LicenseStatus | null): void {
  const before = JSON.stringify(storeEntitlement);
  storeEntitlement = status && isProLicense(status) ? status : null;
  if (JSON.stringify(storeEntitlement) !== before) notifyLicenseChanged();
}

/**
 * Current Pro status: a valid license key (bought on desktop) or an active
 * store purchase. Defaults to free_core.
 */
export async function getLicenseStatus(): Promise<LicenseStatus> {
  const storedLicense = getStoredLicenseKey();
  if (storedLicense) {
    const keyStatus = await verifyLicenseKey(storedLicense);
    if (isProLicense(keyStatus) || !storeEntitlement) return keyStatus;
  }
  return storeEntitlement ?? FREE_STATUS;
}

/**
 * Verifies a license key and saves it to local storage only if it grants Pro.
 */
export async function activateLicense(licenseString: string): Promise<LicenseStatus> {
  const status = await verifyLicenseKey(licenseString);
  if (isProLicense(status)) {
    localStorage.setItem(LICENSE_STORAGE_KEY, licenseString.trim());
    notifyLicenseChanged();
  }
  return status;
}

/**
 * Removes the license and downgrades back to free core.
 */
export function removeLicense(): void {
  localStorage.removeItem(LICENSE_STORAGE_KEY);
  notifyLicenseChanged();
}

// ---------------------------------------------------------------------------
// Development-only signing. Every reference sits behind import.meta.env.DEV,
// so production builds drop this code and never trust the dev key.
// ---------------------------------------------------------------------------

const DEV_KEYPAIR_STORAGE_KEY = "mld_dev_license_keypair";

let devKeyPairPromise: Promise<{ privateKey: CryptoKey; publicSpki: string }> | null = null;

function loadSavedDevKeyPair(): { privateJwk: JsonWebKey; publicJwk: JsonWebKey } | null {
  try {
    const saved = localStorage.getItem(DEV_KEYPAIR_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function getDevKeyPair() {
  if (!devKeyPairPromise) {
    devKeyPairPromise = (async () => {
      const params: RsaHashedKeyGenParams = {
        ...SIGNATURE_ALGORITHM,
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
      };

      // Persist the dev key pair so dev-signed keys survive page reloads.
      let jwks = loadSavedDevKeyPair();

      if (!jwks) {
        const pair = await crypto.subtle.generateKey(params, true, ["sign", "verify"]);
        jwks = {
          privateJwk: await crypto.subtle.exportKey("jwk", pair.privateKey),
          publicJwk: await crypto.subtle.exportKey("jwk", pair.publicKey),
        };
        try {
          localStorage.setItem(DEV_KEYPAIR_STORAGE_KEY, JSON.stringify(jwks));
        } catch {
          // Storage unavailable: the key pair lasts for this page load only.
        }
      }

      const privateKey = await crypto.subtle.importKey("jwk", jwks.privateJwk, SIGNATURE_ALGORITHM, false, ["sign"]);
      const publicKey = await crypto.subtle.importKey("jwk", jwks.publicJwk, SIGNATURE_ALGORITHM, true, ["verify"]);
      const spki = new Uint8Array(await crypto.subtle.exportKey("spki", publicKey));
      return { privateKey, publicSpki: btoa(String.fromCharCode(...spki)) };
    })();
  }
  return devKeyPairPromise;
}

async function getDevPublicKey(): Promise<string> {
  return (await getDevKeyPair()).publicSpki;
}

/**
 * DEVELOPMENT HELPER: Generates a dev-signed license key for local testing.
 * Throws outside `vite dev`; production builds never accept dev-signed keys.
 */
export async function __generateDevLicense(email: string, tier: LicenseTier = "pro_yearly"): Promise<string> {
  if (!import.meta.env.DEV) {
    throw new Error("Development-only function.");
  }
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  const payloadJson = JSON.stringify({
    email,
    tier,
    issuedAt: new Date().toISOString(),
    expiresAt: tier === "pro_lifetime" ? undefined : expires.toISOString(),
  });
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const { privateKey } = await getDevKeyPair();
  const signature = new Uint8Array(await crypto.subtle.sign(SIGNATURE_ALGORITHM, privateKey, payloadBytes));
  const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
  const signatureB64Url = toB64(signature).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${LICENSE_PREFIX}${toB64(payloadBytes)}.${signatureB64Url}`;
}
