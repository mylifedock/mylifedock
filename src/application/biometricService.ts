import { BiometricAuth, BiometryType } from "@aparajita/capacitor-biometric-auth";
import { KeychainAccess, SecureStorage } from "@aparajita/capacitor-secure-storage";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import { isTauri, desktopStorageDelete } from "../platform/desktopBridge";
import { withExternalActivity } from "../platform/externalActivity";
import { arrayBufferToBase64, base64ToArrayBuffer } from "./backupService";

const BIOMETRIC_ENABLED_KEY = "mylifedock_biometric_enabled";
const BIOMETRIC_CRED_KEY = "mylifedock_bio_vault_sec";
const BIOMETRIC_WRAP_KEY = "mylifedock_bio_wrap_key";

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: string;
}

/**
 * Biometric unlock is only offered where the OS shows a real biometric
 * prompt (Capacitor Android/iOS). Web and desktop builds have no such prompt,
 * so storing an unlock secret there would let anyone with access to the
 * browser profile unlock the vault.
 */
function supportsBiometricUnlock(): boolean {
  return Capacitor.isNativePlatform();
}

/*
 * The unlock secret lives in hardware-backed secure storage: an Android
 * Keystore key encrypts it on Android, and on iOS it is a Keychain item that
 * is readable only while the device is unlocked and never synced to iCloud.
 */
async function secureSet(key: string, value: string): Promise<void> {
  await SecureStorage.set(key, value, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
}

async function secureGet(key: string): Promise<string | null> {
  const value = await SecureStorage.get(key, false, false);
  return typeof value === "string" ? value : null;
}

async function secureRemove(key: string): Promise<void> {
  try {
    await SecureStorage.remove(key, false);
  } catch {
    // Nothing stored under this key.
  }
}

/**
 * Builds before secure storage kept the secret in plain app Preferences.
 * Move it into secure storage once, then delete the Preferences copy.
 */
async function migratePreferencesCredentials(): Promise<void> {
  try {
    const legacyCred = (await Preferences.get({ key: BIOMETRIC_CRED_KEY })).value;
    const legacyWrap = (await Preferences.get({ key: BIOMETRIC_WRAP_KEY })).value;
    if (legacyCred && legacyWrap && !(await secureGet(BIOMETRIC_CRED_KEY))) {
      await secureSet(BIOMETRIC_CRED_KEY, legacyCred);
      await secureSet(BIOMETRIC_WRAP_KEY, legacyWrap);
    }
    if (legacyCred || legacyWrap) {
      await Preferences.remove({ key: BIOMETRIC_CRED_KEY });
      await Preferences.remove({ key: BIOMETRIC_WRAP_KEY });
    }
  } catch (error) {
    console.warn("Could not migrate biometric credentials to secure storage:", error);
  }
}

let insecureStoragePurged = false;

/**
 * Earlier builds also kept the encrypted passphrase *and its key* in
 * localStorage and the Tauri store. Remove those copies.
 */
async function purgeInsecureBiometricStorage(): Promise<void> {
  if (insecureStoragePurged) return;
  insecureStoragePurged = true;

  try {
    localStorage.removeItem(BIOMETRIC_CRED_KEY);
    localStorage.removeItem(BIOMETRIC_WRAP_KEY);
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  } catch {
    // Storage unavailable: nothing to purge.
  }

  if (isTauri()) {
    try {
      await desktopStorageDelete(BIOMETRIC_CRED_KEY);
      await desktopStorageDelete(BIOMETRIC_WRAP_KEY);
      await desktopStorageDelete(BIOMETRIC_ENABLED_KEY);
    } catch (error) {
      console.warn("Could not clear legacy desktop biometric data:", error);
    }
  }

  if (!supportsBiometricUnlock()) {
    try {
      await Preferences.remove({ key: BIOMETRIC_CRED_KEY });
      await Preferences.remove({ key: BIOMETRIC_WRAP_KEY });
      await Preferences.remove({ key: BIOMETRIC_ENABLED_KEY });
    } catch {
      // Preferences unavailable on this platform.
    }
  }
}

/**
 * Check if the current device has biometric hardware (Fingerprint, Face ID, etc.)
 */
export async function checkBiometrics(): Promise<BiometricStatus> {
  if (!supportsBiometricUnlock()) {
    return {
      isAvailable: false,
      biometryType: "Available in the Android and iOS apps",
    };
  }

  try {
    const info = await BiometricAuth.checkBiometry();
    let typeName = "Biometrics";
    if (info.biometryType === BiometryType.fingerprintAuthentication || info.biometryType === BiometryType.touchId) {
      typeName = "Fingerprint / Touch ID";
    } else if (info.biometryType === BiometryType.faceAuthentication || info.biometryType === BiometryType.faceId) {
      typeName = "Face ID";
    } else if (info.biometryType === BiometryType.irisAuthentication) {
      typeName = "Iris Recognition";
    }

    return {
      isAvailable: info.isAvailable,
      biometryType: typeName,
    };
  } catch (error) {
    console.warn("Biometric check error:", error);
    return {
      isAvailable: false,
      biometryType: "None",
    };
  }
}

/**
 * Check if the user has enabled biometric unlock for MyLifeDock
 */
export async function isBiometricEnabled(): Promise<boolean> {
  await purgeInsecureBiometricStorage();

  if (!supportsBiometricUnlock()) {
    return false;
  }

  try {
    const { value } = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY });
    return value === "true";
  } catch {
    return false;
  }
}

/**
 * Prompt biometric sensor to authenticate user
 */
export async function promptBiometricAuth(reason = "Unlock your MyLifeDock vault"): Promise<boolean> {
  if (!supportsBiometricUnlock()) {
    throw new Error("Biometric unlock is not supported on this platform.");
  }

  try {
    const check = await BiometricAuth.checkBiometry();
    if (!check.isAvailable) {
      throw new Error(check.reason || "Biometric sensor is not available on this device.");
    }

    // The Face ID / device-credential prompt briefly backgrounds the app on iOS.
    await withExternalActivity(() =>
      BiometricAuth.authenticate({
        reason,
        allowDeviceCredential: true,
        androidTitle: "MyLifeDock Vault Unlock",
        androidSubtitle: "Scan fingerprint to unlock",
      }),
    );
    return true;
  } catch (error) {
    console.error("Biometric authentication error:", error);
    throw error;
  }
}

/**
 * Enable biometric unlock and store the vault unlock secret in app-private
 * native storage.
 */
export async function enableBiometricUnlock(passphrase: string): Promise<boolean> {
  try {
    // 1. Prompt biometric sensor to authorize (throws on unsupported platforms)
    await promptBiometricAuth("Confirm biometric setup for MyLifeDock");

    const wrapKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const wrapKeyRaw = await crypto.subtle.exportKey("raw", wrapKey);
    const wrapKeyStr = arrayBufferToBase64(wrapKeyRaw);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedPass = new TextEncoder().encode(passphrase);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrapKey, encodedPass);

    const encryptedPassStr = JSON.stringify({
      ct: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv.buffer)
    });

    // 2. Persist the secret in hardware-backed secure storage; only the
    //    enabled flag stays in Preferences.
    await secureSet(BIOMETRIC_CRED_KEY, encryptedPassStr);
    await secureSet(BIOMETRIC_WRAP_KEY, wrapKeyStr);
    await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: "true" });

    return true;
  } catch (error) {
    console.error("Failed to enable biometric unlock:", error);
    throw error;
  }
}

/**
 * Disable biometric unlock and clear credentials
 */
export async function disableBiometricUnlock(): Promise<void> {
  if (supportsBiometricUnlock()) {
    await secureRemove(BIOMETRIC_CRED_KEY);
    await secureRemove(BIOMETRIC_WRAP_KEY);
  }
  try {
    await Preferences.remove({ key: BIOMETRIC_CRED_KEY });
    await Preferences.remove({ key: BIOMETRIC_WRAP_KEY });
    await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: "false" });
  } catch (error) {
    console.error("Failed to disable biometric unlock in preferences:", error);
  }

  insecureStoragePurged = false;
  await purgeInsecureBiometricStorage();
}

/**
 * Retrieve the saved passphrase after successful biometric verification
 */
export async function getPassphraseViaBiometrics(): Promise<string | null> {
  const enabled = await isBiometricEnabled();
  if (!enabled) {
    throw new Error("Biometric unlock is not enabled in Settings.");
  }

  await migratePreferencesCredentials();

  let storedPass: string | null = null;
  let storedWrapKey: string | null = null;

  try {
    storedPass = await secureGet(BIOMETRIC_CRED_KEY);
    storedWrapKey = await secureGet(BIOMETRIC_WRAP_KEY);
  } catch (e) {
    console.warn("Secure storage read error:", e);
  }

  if (!storedPass || !storedWrapKey) {
    throw new Error("No biometric credentials stored. Please re-enable in Settings.");
  }

  // Trigger Biometric Sensor Prompt
  await promptBiometricAuth("Unlock your MyLifeDock vault");

  try {
    const parsed = JSON.parse(storedPass);
    const wrapKey = await crypto.subtle.importKey(
      "raw",
      base64ToArrayBuffer(storedWrapKey),
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToArrayBuffer(parsed.iv) },
      wrapKey,
      base64ToArrayBuffer(parsed.ct),
    );
    return new TextDecoder().decode(plainBuffer);
  } catch {
    throw new Error("Stored biometric credentials are unreadable. Please re-enable in Settings.");
  }
}
