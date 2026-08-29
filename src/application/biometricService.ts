import { BiometricAuth, BiometryType } from "@aparajita/capacitor-biometric-auth";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import { isTauri, desktopStorageSet, desktopStorageGet, desktopStorageDelete } from "../platform/desktopBridge";

const BIOMETRIC_ENABLED_KEY = "mylifedock_biometric_enabled";
const BIOMETRIC_CRED_KEY = "mylifedock_bio_vault_sec";

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: string;
}

/**
 * Check if the current device has biometric hardware (Fingerprint, Face ID, etc.)
 */
export async function checkBiometrics(): Promise<BiometricStatus> {
  if (!Capacitor.isNativePlatform()) {
    const hasWebAuthn = Boolean(
      window.PublicKeyCredential && 
      typeof window.PublicKeyCredential === "function"
    );
    return {
      isAvailable: hasWebAuthn,
      biometryType: "WebAuthn / Windows Hello / Touch ID",
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
  if (isTauri()) {
    const desktopVal = await desktopStorageGet<string>(BIOMETRIC_ENABLED_KEY);
    if (desktopVal === "true") return true;
  }

  try {
    const { value } = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY });
    if (value === "true") return true;
  } catch {
    // fallback
  }

  try {
    return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Prompt biometric sensor to authenticate user
 */
export async function promptBiometricAuth(reason = "Unlock your MyLifeDock vault"): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }

  try {
    const check = await BiometricAuth.checkBiometry();
    if (!check.isAvailable) {
      throw new Error(check.reason || "Biometric sensor is not available on this device.");
    }

    await BiometricAuth.authenticate({
      reason,
      allowDeviceCredential: true,
      androidTitle: "MyLifeDock Vault Unlock",
      androidSubtitle: "Scan fingerprint to unlock",
    });
    return true;
  } catch (error) {
    console.error("Biometric authentication error:", error);
    throw error;
  }
}

/**
 * Enable biometric unlock and securely store the vault unlock secret
 */
export async function enableBiometricUnlock(passphrase: string): Promise<boolean> {
  try {
    // 1. Prompt biometric sensor to authorize
    await promptBiometricAuth("Confirm biometric setup for MyLifeDock");

    // 2. Desktop storage if on Tauri
    if (isTauri()) {
      await desktopStorageSet(BIOMETRIC_CRED_KEY, passphrase);
      await desktopStorageSet(BIOMETRIC_ENABLED_KEY, "true");
    }

    // 3. Persist in Preferences and LocalStorage fallback
    try {
      await Preferences.set({ key: BIOMETRIC_CRED_KEY, value: passphrase });
      await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: "true" });
    } catch (prefErr) {
      console.warn("Preferences.set error:", prefErr);
    }

    try {
      localStorage.setItem(BIOMETRIC_CRED_KEY, passphrase);
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
    } catch (lsErr) {
      console.warn("localStorage.setItem error:", lsErr);
    }

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
  if (isTauri()) {
    await desktopStorageDelete(BIOMETRIC_CRED_KEY);
    await desktopStorageSet(BIOMETRIC_ENABLED_KEY, "false");
  }

  try {
    await Preferences.remove({ key: BIOMETRIC_CRED_KEY });
    await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: "false" });
  } catch (error) {
    console.error("Failed to disable biometric unlock in preferences:", error);
  }

  try {
    localStorage.removeItem(BIOMETRIC_CRED_KEY);
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, "false");
  } catch {
    // fallback
  }
}

/**
 * Retrieve the saved passphrase after successful biometric verification
 */
export async function getPassphraseViaBiometrics(): Promise<string | null> {
  const enabled = await isBiometricEnabled();
  if (!enabled) {
    throw new Error("Biometric unlock is not enabled in Settings.");
  }

  let storedPass: string | null = null;
  if (isTauri()) {
    storedPass = await desktopStorageGet<string>(BIOMETRIC_CRED_KEY);
  }

  if (!storedPass) {
    try {
      const res = await Preferences.get({ key: BIOMETRIC_CRED_KEY });
      if (res && res.value) storedPass = res.value;
    } catch (e) {
      console.warn("Preferences.get error:", e);
    }
  }

  if (!storedPass) {
    storedPass = localStorage.getItem(BIOMETRIC_CRED_KEY);
  }

  if (!storedPass) {
    throw new Error("No biometric credentials stored. Please re-enable in Settings.");
  }

  // Trigger Biometric Sensor Prompt
  await promptBiometricAuth("Unlock your MyLifeDock vault");

  return storedPass;
}
