import { useState, useRef, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { isTauri } from "../../platform/desktopBridge";
import { Capacitor } from "@capacitor/core";
import { useToast } from "../components/Toast";
import { PageHeader, SectionTabs } from "../components/PageHeader";
import { profileAvatar } from "../profileAvatar";
import { withDriveAccess, cancelGoogleSignIn, preloadGoogleSignIn, GoogleSignInCancelledError } from "../../application/googleAuthService";
import { exportVault, importVault, createBackupBlob, PassphraseRequiredError } from "../../application/backupService";
import { PassphrasePromptModal } from "../components/PassphrasePromptModal";
import { listBackups, uploadBackup, downloadBackup, isDriveSyncAvailable, DRIVE_UNAVAILABLE_MESSAGE } from "../../application/googleDriveService";
import { sendTestNotification, requestNotificationPermissions } from "../../application/notificationService";
import { checkBiometrics, isBiometricEnabled, enableBiometricUnlock, disableBiometricUnlock, type BiometricStatus } from "../../application/biometricService";
import { unlockVault } from "../../security/vaultKeyService";
import { getLicenseStatus, getStoredLicenseKey, activateLicense, removeLicense, isProLicense, __generateDevLicense, LICENSE_CHANGED_EVENT, type LicenseStatus } from "../../application/licenseService";
import { getVaultTotalItemCount } from "../../application/vaultLimitService";
import { PRICING_CONFIG } from "../../config/pricingConfig";
import { isExternalCheckoutAllowed } from "../../config/storePolicy";
import { isStoreBillingAvailable, manageStoreSubscription, restoreStorePurchases } from "../../application/storeBillingService";
import { getCurrencyConfig, getPreferredCurrency, setPreferredCurrency, SUPPORTED_CURRENCIES, type SupportedCurrency } from "../../application/currencyService";
import { getAllProfiles, deleteDependentProfile, LOCAL_PROFILE_ID } from "../../application/profileService";
import { AddDependentModal } from "../components/FamilyProfileSwitcher";
import { ProUpgradeModal } from "../components/ProUpgradeModal";

type SettingsTab = "backup" | "security" | "family" | "preferences" | "plan";

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: "backup", label: "Backup & Sync" },
  { id: "security", label: "Security" },
  { id: "family", label: "Family" },
  { id: "preferences", label: "Preferences" },
  { id: "plan", label: "Plan" },
];

function isSettingsTab(value: string | undefined): value is SettingsTab {
  return SETTINGS_TABS.some((t) => t.id === value);
}

export function SettingsPage({ initialTab }: { initialTab?: string }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<SettingsTab>(isSettingsTab(initialTab) ? initialTab : "backup");
  const isAndroid = Capacitor.getPlatform() === "android";
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [driveAction, setDriveAction] = useState<"backup" | "restore" | null>(null);
  const isSyncing = driveAction !== null;
  // One progress label on the button instead of a toast per step.
  const [driveStatus, setDriveStatus] = useState("");
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [bioStatus, setBioStatus] = useState<BiometricStatus | null>(null);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioPassphrase, setBioPassphrase] = useState("");
  const [showBioModal, setShowBioModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>({ tier: "free_core", isValid: true, message: "" });
  const [licenseKeyInput, setLicenseKeyInput] = useState("");
  const [isActivatingLicense, setIsActivatingLicense] = useState(false);
  const [vaultItemCount, setVaultItemCount] = useState<number>();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [currentCurrency, setCurrentCurrency] = useState<SupportedCurrency>(() => getPreferredCurrency());
  const familyProfiles = useLiveQuery(() => getAllProfiles(), [], []);
  const [showAddDependent, setShowAddDependent] = useState(false);

  const [autoLockTimeout, setAutoLockTimeout] = useState<string>(() => {
    return localStorage.getItem("mld_autolock_timeout_min") || "30";
  });
  const [lockOnBackground, setLockOnBackground] = useState<boolean>(() => {
    return localStorage.getItem("mld_lock_on_background") !== "false";
  });

  const [passphrasePrompt, setPassphrasePrompt] = useState<{ resolve: (value: string | null) => void } | null>(null);

  function askForBackupPassphrase(): Promise<string | null> {
    return new Promise((resolve) => setPassphrasePrompt({ resolve }));
  }

  /** Imports with the unlocked key, asking for the backup's passphrase only if needed. */
  async function importWithPassphraseFallback(file: File | Blob): Promise<boolean> {
    try {
      await importVault(file);
      return true;
    } catch (err) {
      if (!(err instanceof PassphraseRequiredError)) throw err;
    }
    const pass = await askForBackupPassphrase();
    if (!pass) return false;
    await importVault(file, pass);
    return true;
  }

  async function refreshLicenseStatus() {
    setLicenseStatus(await getLicenseStatus());
  }

  // A store purchase, renewal or refund can change Pro while this page is open.
  useEffect(() => {
    function onChange() {
      void getLicenseStatus().then(setLicenseStatus);
    }
    window.addEventListener(LICENSE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(LICENSE_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    void (async () => {
      const [status, enabled, license, itemCount] = await Promise.all([
        checkBiometrics(),
        isBiometricEnabled(),
        getLicenseStatus(),
        getVaultTotalItemCount(),
      ]);
      setBioStatus(status);
      setBioEnabled(enabled);
      setLicenseStatus(license);
      setVaultItemCount(itemCount);
    })();
  }, []);

  const isPro = isProLicense(licenseStatus);
  const driveAvailable = isDriveSyncAvailable();
  const externalCheckout = isExternalCheckoutAllowed();
  const storeBilling = isStoreBillingAvailable();

  // --- LOCAL BACKUP HANDLERS ---
  async function handleExport() {
    try {
      setIsExporting(true);
      if (await exportVault()) {
        showToast("Vault backup exported successfully", "success");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("WARNING: Importing a backup will overwrite your current vault entirely. Ensure you have exported a copy of your current data first. Proceed?")) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      setIsImporting(true);
      if (!(await importWithPassphraseFallback(file))) {
        showToast("Import cancelled.", "info");
        return;
      }
      showToast("Vault restored successfully from backup!", "success");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Import failed", "error");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // --- CLOUD SYNC HANDLERS ---
  useEffect(() => {
    if (driveAvailable) preloadGoogleSignIn();
  }, [driveAvailable]);

  function showDriveError(err: unknown, fallback: string) {
    if (err instanceof GoogleSignInCancelledError) {
      showToast(err.message, "info");
    } else {
      showToast(err instanceof Error ? err.message : fallback, "error");
    }
  }

  async function handleCloudSync() {
    if (isSyncing) return;
    setDriveAction("backup");
    try {
      setDriveStatus(isTauri() ? "Continue in your browser..." : "Signing in...");
      await withDriveAccess(async (token) => {
        setDriveStatus("Encrypting...");
        const { blob, filename } = await createBackupBlob();
        setDriveStatus("Uploading...");
        await uploadBackup(token, blob, filename);
      });
      showToast("Backed up to Google Drive.", "success");
    } catch (err) {
      showDriveError(err, "Cloud backup failed.");
    } finally {
      setDriveAction(null);
      setDriveStatus("");
    }
  }

  async function handleCloudRestore() {
    if (isSyncing) return;
    setDriveAction("restore");
    try {
      setDriveStatus(isTauri() ? "Continue in your browser..." : "Signing in...");
      const blob = await withDriveAccess(async (token) => {
        setDriveStatus("Looking for backups...");
        const files = await listBackups(token);
        if (files.length === 0) {
          showToast("No backups found in Google Drive.", "error");
          return null;
        }
        const latestBackup = files[0];
        if (!window.confirm(`Found backup from ${new Date(latestBackup.createdTime || "").toLocaleString()}. Restoring this will overwrite your current vault. Proceed?`)) {
          return null;
        }
        setDriveStatus("Downloading...");
        return downloadBackup(token, latestBackup.id);
      });
      if (!blob) return;

      setDriveStatus("Restoring...");
      if (!(await importWithPassphraseFallback(blob))) {
        showToast("Restore cancelled.", "info");
        return;
      }
      showToast("Vault restored successfully from Cloud!", "success");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showDriveError(err, "Restore failed");
    } finally {
      setDriveAction(null);
      setDriveStatus("");
    }
  }


  return (
    <div className="page-container fade-in">
      <PageHeader title="Settings & Backup" subtitle="Backups, security, family members and your plan." />
      <SectionTabs<SettingsTab>
        label="Settings sections"
        active={tab}
        onChange={setTab}
        tabs={SETTINGS_TABS}
      />

      {tab === "backup" && (
        <>
      <div className="card fade-in" style={{ marginBottom: "24px" }}>
        <div className="card-header">
          <h3>Google Drive backup</h3>
        </div>
        <div className="card-body">
          <p>
            Securely back up your vault to your personal Google Drive. 
            The file is encrypted <strong>before</strong> it leaves your device, so Google cannot read your data.
          </p>
          <div style={{ marginTop: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => handleCloudSync()}
              disabled={isSyncing || !driveAvailable}
            >
              {driveAction === "backup" ? driveStatus || "Backing up..." : "Backup to Google Drive"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => handleCloudRestore()}
              disabled={isSyncing || !driveAvailable}
            >
              {driveAction === "restore" ? driveStatus || "Restoring..." : "Restore from Drive"}
            </button>
            {isSyncing && isTauri() && (
              <button type="button" className="text-button" onClick={() => void cancelGoogleSignIn()}>
                Cancel sign-in
              </button>
            )}
          </div>
          {!driveAvailable && (
            <p role="note" style={{ marginTop: "10px", fontSize: "13px", color: "#fbbf24" }}>{DRIVE_UNAVAILABLE_MESSAGE}</p>
          )}
        </div>
      </div>

      <div className="card fade-in" style={{ marginBottom: "24px" }}>
        <div className="card-header">
          <h3>Local Backup & Export</h3>
        </div>
        <div className="card-body">
          <p>
            Export your entire vault to an encrypted backup file (<strong>.mldv</strong>). 
            This file is secured using your AES-256-GCM vault key and cannot be opened without your passphrase.
          </p>
          <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
            <button 
              className="secondary-button" 
              onClick={handleExport}
              disabled={isExporting || isImporting}
            >
              {isExporting ? "Exporting..." : "Export File"}
            </button>
            <button 
              className="secondary-button" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isExporting || isImporting}
            >
              {isImporting ? "Restoring..." : "Import File"}
            </button>
            <input 
              type="file" 
              accept=".mldv" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              onChange={handleFileSelect}
            />
          </div>
        </div>
      </div>

          <p className="muted-text settings-footnote">
            Your vault lives only on this device. Uninstalling the app deletes it, so keep a recent backup.
          </p>
        </>
      )}

      {tab === "security" && (
        <>
      {/* Biometric Unlock Card */}
      <div className="card fade-in" style={{ marginBottom: "24px" }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>👆 Biometric Unlock (Fingerprint / Face ID)</h3>
          <span style={{ fontSize: "12px", color: bioEnabled ? "#4ade80" : "#94a3b8", fontWeight: 600 }}>
            {bioEnabled ? "● ENABLED" : "○ DISABLED"}
          </span>
        </div>
        <div className="card-body">
          <p>
            Unlock your vault instantly using your phone’s biometric sensor (Fingerprint, Touch ID, or Face ID) without typing your passphrase every time.
          </p>
          <div style={{ marginTop: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
            {bioEnabled ? (
              <button
                type="button"
                className="secondary-button"
                style={{ color: "var(--color-danger)" }}
                onClick={async () => {
                  await disableBiometricUnlock();
                  setBioEnabled(false);
                  showToast("Biometric unlock disabled", "info");
                }}
              >
                Disable Biometrics
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={() => setShowBioModal(true)}
                disabled={!bioStatus?.isAvailable}
              >
                Enable Biometric Unlock
              </button>
            )}
            <small style={{ color: "#94a3b8" }}>
              Detected Hardware: {bioStatus?.biometryType || "Checking..."}
            </small>
          </div>
        </div>
      </div>

      {/* Vault Security & Auto-Lock Card */}
      <div className="card fade-in" style={{ marginBottom: "24px" }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>🛡️ Privacy Shield & Auto-Lock Protection</h3>
          <span style={{ fontSize: "12.5px", color: "#4ade80", fontWeight: 600 }}>
            ● ACTIVE PROTECTION
          </span>
        </div>
        <div className="card-body">
          <p>
            Configure automatic locking triggers to ensure your confidential documents and financial records remain completely invisible to shoulder-surfers and unauthorized users.
          </p>

          <div style={{ marginTop: "16px", display: "grid", gap: "16px" }}>
            {/* Auto-Lock Inactivity Timeout */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", padding: "12px 14px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "8px" }}>
              <div>
                <strong style={{ fontSize: "14.5px", color: "#f8fafc", display: "block" }}>Inactivity Auto-Lock</strong>
                <small style={{ color: "#94a3b8", fontSize: "13px" }}>Automatically locks your vault when no clicks or touches are detected.</small>
              </div>
              <select
                aria-label="Inactivity auto-lock timeout"
                value={autoLockTimeout}
                onChange={(e) => {
                  const val = e.target.value;
                  setAutoLockTimeout(val);
                  localStorage.setItem("mld_autolock_timeout_min", val);
                  showToast(`Auto-lock timeout updated to ${val} minutes`, "success");
                }}
                style={{
                  padding: "8px 12px",
                  background: "#1e293b",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                <option value="1">1 Minute</option>
                <option value="5">5 Minutes</option>
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes (Recommended)</option>
                <option value="60">60 Minutes</option>
              </select>
            </div>

            {/* Lock on Recent Apps / Background */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", padding: "12px 14px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "8px" }}>
              <div style={{ maxWidth: "480px" }}>
                <strong style={{ fontSize: "14.5px", color: "#f8fafc", display: "block" }}>Lock on App Switch / Recent Apps</strong>
                <small style={{ color: "#94a3b8", fontSize: "13px" }}>
                  Instantly locks the vault whenever you press Home, switch apps, open the Recent Apps carousel, or minimize the window.
                </small>
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", gap: "8px", margin: 0 }}>
                <input
                  type="checkbox"
                  checked={lockOnBackground}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setLockOnBackground(checked);
                    localStorage.setItem("mld_lock_on_background", checked ? "true" : "false");
                    showToast(checked ? "Instant background locking enabled" : "Background locking disabled", "info");
                  }}
                  style={{ width: "20px", height: "20px", accentColor: "#a78bfa", cursor: "pointer" }}
                />
                <span style={{ fontSize: "13.5px", fontWeight: 600, color: lockOnBackground ? "#4ade80" : "#94a3b8" }}>
                  {lockOnBackground ? "Enabled" : "Disabled"}
                </span>
              </label>
            </div>

            {isAndroid && (
              <p className="muted-text">Screenshots and the Recent Apps preview are blocked while MyLifeDock is open.</p>
            )}
          </div>
        </div>
      </div>
        </>
      )}

      {tab === "family" && (
        <>
      {/* Family & Kids Profiles Management */}
      <div className="card fade-in" style={{ marginBottom: "24px" }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <span>👨‍👩‍👧‍👦</span> Family members
            </h3>
            <small style={{ color: "#94a3b8" }}>
              Keep documents, medical records and an emergency kit for each person.
            </small>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowAddDependent(true)}
            style={{ fontSize: "13px", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)" }}
          >
            <span>➕</span> Add family member
          </button>
        </div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
            {familyProfiles?.map((p) => {
              const isPrimary = p.id === LOCAL_PROFILE_ID;
              const isChild = p.role === "dependent_child";
              return (
                <div
                  key={p.id}
                  style={{
                    background: "#0b0f19",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "10px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "24px" }}>{profileAvatar(p)}</span>
                        <div>
                          <strong style={{ color: "#f8fafc", fontSize: "15px" }}>{p.displayName}</strong>
                          <div style={{ fontSize: "11px", color: isPrimary ? "#38bdf8" : isChild ? "#f472b6" : "#cbd5e1" }}>
                            {isPrimary ? "You (vault owner)" : isChild ? "Child" : p.role === "spouse" ? "Spouse" : "Parent / elder"}
                          </div>
                        </div>
                      </div>
                      {!isPrimary && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to remove ${p.displayName}? Records will be preserved under your primary vault.`)) {
                              await deleteDependentProfile(p.id);
                              showToast(`Profile ${p.displayName} removed. Records preserved.`, "info");
                            }
                          }}
                          style={{ color: "#f87171", fontSize: "12px", padding: "4px 8px" }}
                          title="Delete profile"
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>

                    <div style={{ fontSize: "12.5px", color: "#94a3b8", display: "flex", flexDirection: "column", gap: "4px", marginTop: "10px" }}>
                      {p.birthDate && <div>🎂 Born: {p.birthDate}</div>}
                      {p.bloodGroup && <div>🩸 Blood Group: <strong style={{ color: "#f8fafc" }}>{p.bloodGroup}</strong></div>}
                      {p.allergies && <div>⚠️ Allergies: <strong style={{ color: "#fca5a5" }}>{p.allergies}</strong></div>}
                      {p.pediatricianOrDoctor && <div>🩺 Doctor: {p.pediatricianOrDoctor}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showAddDependent && (
        <AddDependentModal
          onClose={() => setShowAddDependent(false)}
          onCreated={() => {
            setShowAddDependent(false);
            showToast("Family member added.", "success");
          }}
        />
      )}

        </>
      )}

      {tab === "preferences" && (
        <>
      {/* Regional & Currency Preference */}
      <div className="card fade-in" style={{ marginBottom: "24px" }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>🌐 Vault Currency & Regional Settings</h3>
          <span style={{ fontSize: "12px", color: "#38bdf8", fontWeight: 600 }}>
            {getCurrencyConfig(currentCurrency).symbol} {currentCurrency}
          </span>
        </div>
        <div className="card-body">
          <p>
            Choose your preferred currency for product values, warranties, subscriptions, and financial tracking across MyLifeDock.
          </p>
          <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <label htmlFor="currencySelect" style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>
              Display Currency:
            </label>
            <select
              id="currencySelect"
              value={currentCurrency}
              onChange={(e) => {
                const val = e.target.value as SupportedCurrency;
                setPreferredCurrency(val);
                setCurrentCurrency(val);
                showToast(`Currency updated to ${getCurrencyConfig(val).label}`, "success");
              }}
              style={{
                padding: "8px 12px",
                background: "#1e293b",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "6px",
                color: "#f8fafc",
                fontSize: "14px",
                cursor: "pointer"
              }}
            >
              {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <small style={{ color: "#94a3b8" }}>
              Formats automatically to local standards (e.g. Lakh/Crore for INR, K/M for USD/EUR).
            </small>
          </div>
        </div>
      </div>

      <div className="card fade-in" style={{ marginBottom: "24px" }}>
        <div className="card-header">
          <h3>🔔 Vault Reminders & Notifications</h3>
        </div>
        <div className="card-body">
          <p>
            Local push notifications alert you when warranties, passports, visas, or custom reminders are coming up.
          </p>
          <div style={{ marginTop: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button 
              type="button"
              className="primary-button" 
              onClick={async () => {
                try {
                  setIsTestingNotif(true);
                  const success = await sendTestNotification();
                  if (success) {
                    showToast("Test notification sent! Check your notification tray.", "success");
                  } else {
                    showToast("Please allow notification permissions in your device settings.", "error");
                  }
                } catch {
                  showToast("Notification trigger failed.", "error");
                } finally {
                  setIsTestingNotif(false);
                }
              }}
              disabled={isTestingNotif}
            >
              {isTestingNotif ? "Sending..." : "🔔 Send Test Notification"}
            </button>
            <button 
              type="button"
              className="secondary-button" 
              onClick={async () => {
                const granted = await requestNotificationPermissions();
                if (granted) {
                  showToast("Notification permissions granted!", "success");
                } else {
                  showToast("Notifications not granted on this platform.", "info");
                }
              }}
            >
              Check Permissions
            </button>
          </div>
        </div>
      </div>

        </>
      )}

      {tab === "plan" && (
        <>
      {/* --- MYLIFEDOCK PRO UPGRADE SECTION --- */}
      <div className="card fade-in" style={{ marginBottom: "24px", border: isPro ? "1px solid #eab308" : "1px solid rgba(255, 255, 255, 0.1)", background: isPro ? "linear-gradient(to right, rgba(234, 179, 8, 0.05), transparent)" : undefined }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            MyLifeDock <span style={{ padding: "3px 8px", background: isPro ? "#eab308" : "#94a3b8", color: "#111827", borderRadius: "4px", fontSize: "12.5px", fontWeight: "bold" }}>PRO</span>
          </h3>
          <span style={{ fontSize: "12.5px", color: isPro ? "#eab308" : "#94a3b8", fontWeight: 600 }}>
            {isPro ? `● ${licenseStatus.tier.replace("_", " ").toUpperCase()} ACTIVE` : "○ FREE CORE VERSION"}
          </span>
        </div>
        <div className="card-body">
          {isPro ? (
            <div>
              <p style={{ color: "#eab308", fontWeight: 600 }}>✓ {licenseStatus.message}</p>
              {licenseStatus.email && (
                <small style={{ color: "#94a3b8", display: "block", marginTop: "4px" }}>
                  Licensed to: {licenseStatus.email}
                </small>
              )}
              <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {storeBilling && licenseStatus.tier !== "pro_lifetime" && !getStoredLicenseKey() && (
                  <button type="button" className="secondary-button" onClick={() => void manageStoreSubscription()}>
                    Manage subscription
                  </button>
                )}
                {getStoredLicenseKey() && (
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)", fontSize: "13px" }}
                    onClick={() => {
                      if (window.confirm("Remove this license key from this device?")) {
                        removeLicense();
                        void refreshLicenseStatus();
                        showToast("License key removed.", "info");
                      }
                    }}
                  >
                    Remove License Key
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p style={{ marginBottom: "16px" }}>
                The free vault has every feature, including Google Drive backup, for up to {PRICING_CONFIG.freeItemLimit} items. <strong>Pro</strong> removes the item limit.
              </p>
              {storeBilling && (
                <button
                  type="button"
                  className="text-button"
                  style={{ margin: "0 0 14px", padding: 0 }}
                  onClick={async () => {
                    const restored = await restoreStorePurchases().catch(() => null);
                    await refreshLicenseStatus();
                    showToast(restored ? "Your Pro purchase was restored." : "No Pro purchase found for this store account.", restored ? "success" : "info");
                  }}
                >
                  Restore purchases
                </button>
              )}

              {/* Dedicated Upgrade to Pro Button */}
              <div style={{ marginBottom: "18px" }}>
                <button 
                  type="button" 
                  className="primary-button"
                  style={{ 
                    background: "linear-gradient(135deg, #eab308, #ca8a04)", 
                    color: "#0f172a", 
                    fontWeight: "bold",
                    fontSize: "15px",
                    padding: "13px 20px",
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 15px rgba(234, 179, 8, 0.25)",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    cursor: "pointer"
                  }}
                  onClick={() => setShowUpgradeModal(true)}
                >
                  <span>{externalCheckout ? "👑 Upgrade to Pro (unlimited items)" : "👑 Activate MyLifeDock Pro"}</span>
                  <span>&rarr;</span>
                </button>
              </div>

              <div style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.05em" }}>
                Already Purchased? Activate Your License Key:
              </div>
              <div style={{ marginTop: "16px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <input 
                  type="text" 
                  value={licenseKeyInput} 
                  onChange={(e) => setLicenseKeyInput(e.target.value)} 
                  placeholder="Paste your License Key (MLD-PRO-...)"
                  aria-label="License key"
                  style={{ flex: 1, minWidth: "240px", padding: "8px 12px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff" }}
                />
                <button
                  type="button"
                  className="primary-button"
                  style={{ background: "#eab308", color: "#111827", fontWeight: "bold" }}
                  disabled={isActivatingLicense}
                  onClick={async () => {
                    setIsActivatingLicense(true);
                    try {
                      const status = await activateLicense(licenseKeyInput);
                      if (isProLicense(status)) {
                        setLicenseStatus(status);
                        setLicenseKeyInput("");
                        showToast("MyLifeDock PRO Successfully Activated!", "success");
                      } else {
                        showToast(status.message || "Invalid cryptographic signature or expired key.", "error");
                      }
                    } finally {
                      setIsActivatingLicense(false);
                    }
                  }}
                >
                  {isActivatingLicense ? "Verifying..." : "Activate Key"}
                </button>
              </div>
              <div style={{ marginTop: "12px", display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
                {externalCheckout && (
                <button
                  type="button"
                  className="text-button"
                  style={{ color: "#38bdf8", padding: 0, fontWeight: 600 }}
                  onClick={() => setShowUpgradeModal(true)}
                >
                  💎 View Plans & Pricing Options &rarr;
                </button>
                )}
                {import.meta.env.DEV && (
                <button
                  type="button"
                  className="text-button"
                  style={{ color: "#a78bfa", padding: 0, fontSize: "13px" }}
                  onClick={async () => {
                    const sampleKey = await __generateDevLicense("mylifedock@gmail.com", "pro_yearly");
                    setLicenseKeyInput(sampleKey);
                    showToast("Sample 1-Year Pro key populated! Click 'Activate Key' to test.", "info");
                  }}
                >
                  🧪 Fill Sample Test Key
                </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

        </>
      )}

      {showBioModal && (
        <div className="product-detail-overlay">
          <div className="card" style={{ maxWidth: "420px", width: "100%", margin: "auto", padding: "24px", background: "#111827" }}>
            <h3 style={{ marginTop: 0 }}>Enable Biometric Unlock</h3>
            <p style={{ fontSize: "13px", color: "#94a3b8" }}>
              Please enter your master vault passphrase once to authorize your biometric hardware.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!bioPassphrase.trim()) return;
              try {
                await unlockVault(bioPassphrase.trim());
              } catch {
                showToast("Incorrect master passphrase. Please try again.", "error");
                return;
              }
              try {
                await enableBiometricUnlock(bioPassphrase.trim());
                setBioEnabled(true);
                setShowBioModal(false);
                setBioPassphrase("");
                showToast("Fingerprint / Face ID unlock enabled!", "success");
              } catch (err) {
                showToast(err instanceof Error ? err.message : "Biometric authorization cancelled or failed.", "error");
              }
            }}>
              <div className="form-field" style={{ marginBottom: "16px" }}>
                <label htmlFor="settings-masterPassphrase">Master Passphrase</label>
                <input id="settings-masterPassphrase"
                  type="password"
                  required
                  value={bioPassphrase}
                  onChange={(e) => setBioPassphrase(e.target.value)}
                  placeholder="Your vault passphrase"
                  autoFocus
                />
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" className="secondary-button" onClick={() => { setShowBioModal(false); setBioPassphrase(""); }}>
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Confirm & Scan Fingerprint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passphrasePrompt && (
        <PassphrasePromptModal
          title="Enter Backup Passphrase"
          description="This backup was made with a different vault key. Enter the Master Passphrase or 64-character Recovery Key used for that vault."
          onSubmit={(value) => {
            passphrasePrompt.resolve(value);
            setPassphrasePrompt(null);
          }}
          onCancel={() => {
            passphrasePrompt.resolve(null);
            setPassphrasePrompt(null);
          }}
        />
      )}

      {/* Pro Upgrade & Pricing Modal */}
      <ProUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentCount={vaultItemCount}
        onSuccess={() => {
          void refreshLicenseStatus();
          setShowUpgradeModal(false);
        }}
      />

    </div>
  );
}

export default SettingsPage;
