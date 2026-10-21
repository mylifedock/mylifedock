import { useState, useRef } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useToast } from "../components/Toast";
import { exportVault, importVault, createBackupBlob } from "../../application/backupService";
import { listBackups, uploadBackup, downloadBackup } from "../../application/googleDriveService";
import { sendTestNotification, requestNotificationPermissions } from "../../application/notificationService";
import { checkBiometrics, isBiometricEnabled, enableBiometricUnlock, disableBiometricUnlock, type BiometricStatus } from "../../application/biometricService";
import { unlockVault } from "../../security/vaultKeyService";
import { getLicenseStatus, activateLicense, removeLicense, __generateDevLicense } from "../../application/licenseService";
import { getPreferredCurrency, setPreferredCurrency, SUPPORTED_CURRENCIES, type SupportedCurrency } from "../../application/currencyService";

export function SettingsPage() {
  const { showToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [bioStatus, setBioStatus] = useState<BiometricStatus | null>(null);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioPassphrase, setBioPassphrase] = useState("");
  const [showBioModal, setShowBioModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [licenseStatus, setLicenseStatus] = useState(() => getLicenseStatus());
  const [licenseKeyInput, setLicenseKeyInput] = useState("");
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [currentCurrency, setCurrentCurrency] = useState<SupportedCurrency>(() => getPreferredCurrency());

  const [autoLockTimeout, setAutoLockTimeout] = useState<string>(() => {
    return localStorage.getItem("mld_autolock_timeout_min") || "30";
  });
  const [lockOnBackground, setLockOnBackground] = useState<boolean>(() => {
    return localStorage.getItem("mld_lock_on_background") !== "false";
  });

  useState(() => {
    void (async () => {
      const status = await checkBiometrics();
      const enabled = await isBiometricEnabled();
      setBioStatus(status);
      setBioEnabled(enabled);
    })();
  });

  // --- LOCAL BACKUP HANDLERS ---
  async function handleExport() {
    try {
      setIsExporting(true);
      await exportVault();
      showToast("Vault backup exported successfully", "success");
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
      try {
        await importVault(file);
      } catch {
        const pass = window.prompt("Enter your Master Passphrase or Recovery Key to decrypt this backup:");
        if (!pass) {
          showToast("Import cancelled.", "info");
          return;
        }
        await importVault(file, pass);
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
  const handleCloudSync = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/drive.appdata",
    onSuccess: async (tokenResponse) => {
      try {
        setIsSyncing(true);
        showToast("Authenticating with Google Drive...", "info");
        const token = tokenResponse.access_token;
        
        // 1. Generate encrypted backup blob locally
        const { blob, filename } = await createBackupBlob();
        
        // 2. Check if a backup already exists (to optionally handle overwrites, but for now we'll just upload a new one)
        showToast("Uploading encrypted vault to Drive...", "info");
        await uploadBackup(token, blob, filename);
        
        showToast("Cloud Sync Complete!", "success");
      } catch (err) {
        showToast("Cloud sync failed. Check console.", "error");
        console.error(err);
      } finally {
        setIsSyncing(false);
      }
    },
    onError: () => {
      showToast("Google Auth Failed", "error");
    }
  });

  const handleCloudRestore = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/drive.appdata",
    onSuccess: async (tokenResponse) => {
      try {
        setIsSyncing(true);
        showToast("Connecting to Google Drive...", "info");
        const token = tokenResponse.access_token;
        
        const files = await listBackups(token);
        if (files.length === 0) {
          showToast("No backups found in Google Drive.", "error");
          return;
        }

        // Take the most recent one (listBackups orders by createdTime desc)
        const latestBackup = files[0];
        
        if (!window.confirm(`Found backup from ${new Date(latestBackup.createdTime || "").toLocaleString()}. Restoring this will overwrite your current vault. Proceed?`)) {
          return;
        }

        showToast("Downloading encrypted backup...", "info");
        const blob = await downloadBackup(token, latestBackup.id);

        showToast("Decrypting and Restoring...", "info");
        try {
          await importVault(blob);
        } catch {
          const pass = window.prompt("Enter your Master Passphrase or Recovery Key to decrypt this backup:");
          if (!pass) {
            showToast("Restore cancelled.", "info");
            return;
          }
          await importVault(blob, pass);
        }
        showToast("Vault restored successfully from Cloud!", "success");
        setTimeout(() => window.location.reload(), 1500);

      } catch (err) {
        showToast(err instanceof Error ? err.message : "Restore failed", "error");
      } finally {
        setIsSyncing(false);
      }
    },
    onError: () => {
      showToast("Google Auth Failed", "error");
    }
  });


  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Preferences, security, and backups.</p>
        </div>
      </div>

      {/* Regional & Currency Preference */}
      <div className="card fade-in" style={{ marginBottom: "24px" }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>🌐 Vault Currency & Regional Settings</h3>
          <span style={{ fontSize: "12px", color: "#38bdf8", fontWeight: 600 }}>
            {SUPPORTED_CURRENCIES[currentCurrency].symbol} {currentCurrency}
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
                showToast(`Currency updated to ${SUPPORTED_CURRENCIES[val].label}`, "success");
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

            {/* Built-in Security Badges */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "4px" }}>
              <span style={{ background: "rgba(34, 197, 94, 0.12)", color: "#4ade80", border: "1px solid rgba(34, 197, 94, 0.25)", padding: "5px 12px", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600 }}>
                ✓ Android FLAG_SECURE Active (Screen capture & carousel thumbnail blocked)
              </span>
              <span style={{ background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.25)", padding: "5px 12px", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600 }}>
                ✓ Brute-Force Rate Limiting Active (Exponential cooldown after failed attempts)
              </span>
              <span style={{ background: "rgba(168, 85, 247, 0.12)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.25)", padding: "5px 12px", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600 }}>
                ✓ Zero-Knowledge Client Memory Isolation
              </span>
            </div>
          </div>
        </div>
      </div>

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
              const success = await enableBiometricUnlock(bioPassphrase.trim());
              if (success) {
                setBioEnabled(true);
                setShowBioModal(false);
                setBioPassphrase("");
                showToast("Fingerprint / Face ID unlock enabled!", "success");
              } else {
                showToast("Biometric authorization cancelled or failed.", "error");
              }
            }}>
              <div className="form-field" style={{ marginBottom: "16px" }}>
                <label>Master Passphrase</label>
                <input
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

      {/* --- MYLIFEDOCK PRO UPGRADE SECTION --- */}
      <div className="card fade-in" style={{ marginBottom: "24px", border: licenseStatus.tier !== "free_core" && licenseStatus.isValid ? "1px solid #eab308" : "1px solid rgba(255, 255, 255, 0.1)", background: licenseStatus.tier !== "free_core" && licenseStatus.isValid ? "linear-gradient(to right, rgba(234, 179, 8, 0.05), transparent)" : undefined }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            MyLifeDock <span style={{ padding: "3px 8px", background: licenseStatus.tier !== "free_core" && licenseStatus.isValid ? "#eab308" : "#94a3b8", color: "#111827", borderRadius: "4px", fontSize: "12.5px", fontWeight: "bold" }}>PRO</span>
          </h3>
          <span style={{ fontSize: "12.5px", color: licenseStatus.tier !== "free_core" && licenseStatus.isValid ? "#eab308" : "#94a3b8", fontWeight: 600 }}>
            {licenseStatus.tier !== "free_core" && licenseStatus.isValid ? `● ${licenseStatus.tier.toUpperCase()} ACTIVE` : "○ FREE CORE VERSION"}
          </span>
        </div>
        <div className="card-body">
          {licenseStatus.tier !== "free_core" && licenseStatus.isValid ? (
            <div>
              <p style={{ color: "#eab308", fontWeight: 600 }}>✓ {licenseStatus.message}</p>
              {licenseStatus.email && (
                <small style={{ color: "#94a3b8", display: "block", marginTop: "4px" }}>
                  Licensed to: {licenseStatus.email}
                </small>
              )}
              <div style={{ marginTop: "14px", display: "flex", gap: "10px" }}>
                <button 
                  type="button" 
                  className="secondary-button" 
                  style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)", fontSize: "13px" }}
                  onClick={() => {
                    if (window.confirm("Remove this license key and downgrade to Free Core?")) {
                      removeLicense();
                      setLicenseStatus(getLicenseStatus());
                      showToast("License removed.", "info");
                    }
                  }}
                >
                  Remove License
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p>
                The <strong>Free Core</strong> version includes 100% Zero-Knowledge security and offline access for up to 15 products and 20 documents. Upgrade to <strong>PRO</strong> for Unlimited Vault Storage, Automated Google Drive Sync, and all future updates.
              </p>
              <div style={{ marginTop: "16px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <input 
                  type="text" 
                  value={licenseKeyInput} 
                  onChange={(e) => setLicenseKeyInput(e.target.value)} 
                  placeholder="Paste your License Key (MLD-PRO-...)" 
                  style={{ flex: 1, minWidth: "240px", padding: "8px 12px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff" }}
                />
                <button 
                  type="button" 
                  className="primary-button"
                  style={{ background: "#eab308", color: "#111827", fontWeight: "bold" }}
                  onClick={() => {
                    const success = activateLicense(licenseKeyInput);
                    if (success) {
                      setLicenseStatus(getLicenseStatus());
                      setLicenseKeyInput("");
                      showToast("MyLifeDock PRO Successfully Activated!", "success");
                    } else {
                      showToast("Invalid cryptographic signature or expired key.", "error");
                    }
                  }}
                >
                  Activate Key
                </button>
              </div>
              <div style={{ marginTop: "12px", display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
                <button 
                  type="button"
                  className="text-button" 
                  style={{ color: "#38bdf8", padding: 0, fontWeight: 600 }}
                  onClick={() => setShowPricingModal(true)}
                >
                  💎 View Plans & Pricing Options &rarr;
                </button>
                <button
                  type="button"
                  className="text-button"
                  style={{ color: "#a78bfa", padding: 0, fontSize: "13px" }}
                  onClick={() => {
                    const sampleKey = __generateDevLicense("founder@mylifedock.com", "pro_yearly");
                    setLicenseKeyInput(sampleKey);
                    showToast("Sample 1-Year Pro key populated! Click 'Activate Key' to test.", "info");
                  }}
                >
                  🧪 Fill Sample Test Key
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pricing & Subscription Modal */}
      {showPricingModal && (
        <div className="modal-backdrop" onClick={() => setShowPricingModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0 }}>Choose your MyLifeDock PRO Plan</h3>
              <button type="button" className="text-button" onClick={() => setShowPricingModal(false)} style={{ fontSize: "18px" }}>✕</button>
            </div>
            <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "20px" }}>
              All plans include 100% Zero-Knowledge protection, Unlimited Documents & Products, Automated Cloud Sync, and Multi-Currency support.
            </p>

            <div style={{ display: "grid", gap: "12px", marginBottom: "24px" }}>
              <div style={{ padding: "16px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>6 Months Pass</strong>
                  <small style={{ display: "block", color: "#94a3b8", fontSize: "13px" }}>Billed semi-annually</small>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "18px", fontWeight: "bold" }}>₹999 / $14</div>
                </div>
              </div>

              <div style={{ padding: "16px", background: "rgba(234, 179, 8, 0.06)", border: "1px solid #eab308", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "11px", background: "#eab308", color: "#000", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold", textTransform: "uppercase" }}>Most Popular</span>
                  <strong style={{ display: "block", marginTop: "4px" }}>1 Year Subscription</strong>
                  <small style={{ color: "#94a3b8", fontSize: "13px" }}>Full access for 12 months</small>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#eab308" }}>₹1,499 / $29</div>
                </div>
              </div>

              <div style={{ padding: "16px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>Lifetime Founder License</strong>
                  <small style={{ display: "block", color: "#94a3b8", fontSize: "13px" }}>One-time payment, forever access</small>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "18px", fontWeight: "bold" }}>₹3,999 / $79</div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: "13.5px", color: "#94a3b8", marginBottom: "20px" }}>
              💡 <em>Coupon codes and discounts can be applied directly at the checkout page. Once payment completes, your license key is emailed to you instantly.</em>
            </p>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button 
                type="button" 
                className="secondary-button"
                onClick={() => {
                  const sampleKey = __generateDevLicense("founder@mylifedock.com", "pro_yearly");
                  setLicenseKeyInput(sampleKey);
                  setShowPricingModal(false);
                  showToast("Sample 1-Year Pro key populated! Click 'Activate Key' to test.", "info");
                }}
              >
                🧪 Test Sample Key
              </button>
              <a 
                href="/landing.html#pricing" 
                target="_blank" 
                className="primary-button" 
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                Go to Checkout Page &rarr;
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="card fade-in" style={{ marginBottom: "24px" }}>
        <div className="card-header">
          <h3>Cloud Sync (Google Drive)</h3>
        </div>
        <div className="card-body">
          <p>
            Securely back up your vault to your personal Google Drive. 
            The file is encrypted <strong>before</strong> it leaves your device, so Google cannot read your data.
          </p>
          <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
            <button 
              className="primary-button" 
              onClick={() => handleCloudSync()}
              disabled={isSyncing}
            >
              {isSyncing ? "Syncing..." : "Backup to Google Drive"}
            </button>
            <button 
              className="secondary-button" 
              onClick={() => handleCloudRestore()}
              disabled={isSyncing}
            >
              {isSyncing ? "Restoring..." : "Restore from Drive"}
            </button>
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

      <div className="card fade-in">
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

      {/* Zero-Knowledge & Uninstallation Safety Alert */}
      <div className="card fade-in" style={{ marginTop: "24px", background: "rgba(56, 189, 248, 0.04)", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
        <div className="card-header" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3>🛡️ Zero-Knowledge & App Uninstallation Safety</h3>
        </div>
        <div className="card-body">
          <p style={{ fontSize: "13.5px", lineHeight: "1.6", color: "#cbd5e1" }}>
            Because MyLifeDock is a 100% Zero-Knowledge sovereign vault, your data is stored locally on this device. Operating systems (Android, iOS, Windows) clear local app storage when you uninstall the app.
          </p>
          <p style={{ fontSize: "13px", color: "#94a3b8", marginTop: "8px" }}>
            💡 <strong>Best Practice:</strong> Keep your <strong>Google Drive Cloud Sync</strong> enabled or export an <strong>.mldv backup file</strong> before uninstalling the app or switching devices. You can restore your entire vault anytime upon reinstalling with your Master Passphrase.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
