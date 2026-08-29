import { useState, useRef } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useToast } from "../components/Toast";
import { exportVault, importVault, createBackupBlob } from "../../application/backupService";
import { listBackups, uploadBackup, downloadBackup } from "../../application/googleDriveService";
import { sendTestNotification, requestNotificationPermissions } from "../../application/notificationService";
import { checkBiometrics, isBiometricEnabled, enableBiometricUnlock, disableBiometricUnlock, type BiometricStatus } from "../../application/biometricService";
import { unlockVault } from "../../security/vaultKeyService";

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
      await importVault(file);
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
        await importVault(blob);
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
    </div>
  );
}

export default SettingsPage;
