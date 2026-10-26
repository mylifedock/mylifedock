import { useEffect, useRef, useState } from "react";
import { useToast } from "./components/Toast";
import PillarsSlideshow from "./components/PillarsSlideshow";
import { LegalDocModal, type LegalDoc } from "./components/LegalDocModal";
import { createLocalProfile, getLocalProfile } from "../application/profileService";
import { restoreVaultFromBackup } from "../application/backupService";
import { listBackups, downloadBackup, isDriveSyncAvailable, DRIVE_UNAVAILABLE_MESSAGE } from "../application/googleDriveService";
import { withDriveAccess, preloadGoogleSignIn, GoogleSignInCancelledError } from "../application/googleAuthService";
import { isTauri } from "../platform/desktopBridge";
import type { ProfileRecord } from "../infrastructure/database/db";

const SLIDES_SEEN_KEY = "mld_onboarding_slides_seen";

function BrandMark({ size }: { size: number }) {
  return (
    <div className="brand-logo onboarding-logo" style={{ width: size, height: size }}>
      <svg width={size / 2} height={size / 2} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    </div>
  );
}

/**
 * First-run screens: security pillars, create a vault, or restore one from
 * Google Drive or a backup file.
 */
export function OnboardingScreen({
  onProfileCreated,
  onVaultRestored,
}: {
  onProfileCreated: (profile: ProfileRecord) => void;
  onVaultRestored: (profile: ProfileRecord | undefined) => void;
}) {
  const { showToast } = useToast();
  const [slidesSeen, setSlidesSeen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SLIDES_SEEN_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [tab, setTab] = useState<"create" | "restore">("create");
  const [displayName, setDisplayName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{ blob: Blob; source: string } | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const isRestoring = restoreStatus !== null;

  useEffect(() => {
    if (tab === "restore" && isDriveSyncAvailable()) preloadGoogleSignIn();
  }, [tab]);

  function finishSlides() {
    try {
      localStorage.setItem(SLIDES_SEEN_KEY, "true");
    } catch {
      // Storage unavailable: the slides show again next time.
    }
    setSlidesSeen(true);
  }

  async function handleCreateProfile() {
    if (!displayName.trim() || !acceptedTerms) return;
    onProfileCreated(await createLocalProfile(displayName.trim()));
  }

  async function handleGoogleDriveRestore() {
    if (isRestoring) return;
    setRestoreStatus(isTauri() ? "Continue signing in to Google in your browser..." : "Signing in to Google...");
    try {
      const blob = await withDriveAccess(async (token) => {
        setRestoreStatus("Looking for backups...");
        const files = await listBackups(token);
        if (files.length === 0) return null;
        setRestoreStatus("Downloading backup...");
        return downloadBackup(token, files[0].id);
      });
      if (!blob) {
        showToast("No backups found in Google Drive.", "error");
        return;
      }
      setRestoreError("");
      setRestorePassphrase("");
      setPendingRestore({ blob, source: "Google Drive" });
    } catch (err) {
      if (err instanceof GoogleSignInCancelledError) {
        showToast(err.message, "info");
      } else {
        showToast(err instanceof Error ? err.message : "Failed to fetch cloud backup", "error");
      }
    } finally {
      setRestoreStatus(null);
    }
  }

  function handleFileRestoreSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setRestoreError("");
    setRestorePassphrase("");
    setPendingRestore({ blob: file, source: `File (${file.name})` });
  }

  async function handleExecuteRestore(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingRestore || !restorePassphrase.trim() || isRestoring) return;

    setRestoreError("");
    setRestoreStatus("Decrypting...");
    try {
      const result = await restoreVaultFromBackup(pendingRestore.blob, restorePassphrase.trim());
      showToast(`Vault restored! Welcome back, ${result.profileName}.`, "success");
      setPendingRestore(null);
      setRestorePassphrase("");
      onVaultRestored(await getLocalProfile());
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Failed to restore vault.");
    } finally {
      setRestoreStatus(null);
    }
  }

  if (!slidesSeen) {
    return (
      <main className="onboarding">
        <div className="onboarding-glow" />
        <div className="onboarding-card onboarding-card-wide">
          <BrandMark size={52} />
          <span className="eyebrow onboarding-eyebrow">SECURITY & PRIVACY PILLARS</span>
          <h1 className="onboarding-title">Our 3 Security Pillars</h1>
          <PillarsSlideshow onComplete={finishSlides} onSkip={finishSlides} />
        </div>
      </main>
    );
  }

  return (
    <main className="onboarding">
      <div className="onboarding-glow" />

      <div className="onboarding-card">
        <BrandMark size={54} />

        <span className="eyebrow">WELCOME TO MYLIFEDOCK</span>

        <h1>
          Your life.
          <br />
          <span>One private dock.</span>
        </h1>

        <div className="segmented" role="tablist" aria-label="Get started">
          <button type="button" role="tab" aria-selected={tab === "create"} className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}>
            ✨ Create New Vault
          </button>
          <button type="button" role="tab" aria-selected={tab === "restore"} className={tab === "restore" ? "active" : ""} onClick={() => setTab("restore")}>
            🔄 Restore Existing Vault
          </button>
        </div>

        {tab === "create" ? (
          <>
            <p>Keep documents, warranties, policies, health records and reminders for your whole family in one private place.</p>

            <label htmlFor="displayName">What should we call you?</label>
            <input
              id="displayName"
              value={displayName}
              maxLength={50}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleCreateProfile();
              }}
            />

            <div className="terms-box">
              <input type="checkbox" id="termsCheckbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
              <label htmlFor="termsCheckbox">
                I agree to the{" "}
                <button type="button" className="inline-link" onClick={() => setLegalDoc("terms")}>
                  Terms of Service
                </button>{" "}
                &{" "}
                <button type="button" className="inline-link" onClick={() => setLegalDoc("privacy")}>
                  Privacy Policy
                </button>
                .
                <br />
                <br />
                <strong className="danger-text">Important:</strong> MyLifeDock cannot reset your password.{" "}
                <strong>If I lose both my Master Passphrase and Recovery Key, my data cannot be recovered by anyone.</strong>
              </label>
            </div>

            <button
              className="primary-button cta-button"
              type="button"
              onClick={() => void handleCreateProfile()}
              disabled={!displayName.trim() || !acceptedTerms}
            >
              <span>Create my local vault</span>
              <span className="btn-arrow" aria-hidden="true">→</span>
            </button>
          </>
        ) : (
          <div className="onboarding-restore">
            <p className="muted-text">
              Reinstalled the app or switched devices? Restore your encrypted vault from Google Drive or a <strong>.mldv</strong> backup file.
            </p>

            {!isDriveSyncAvailable() && (
              <p role="note" className="warning-text">
                {DRIVE_UNAVAILABLE_MESSAGE}
              </p>
            )}
            <button
              type="button"
              className="primary-button google-button"
              onClick={() => void handleGoogleDriveRestore()}
              disabled={isRestoring || !isDriveSyncAvailable()}
            >
              {restoreStatus ?? "Restore from Google Drive"}
            </button>

            <button type="button" className="secondary-button" onClick={() => restoreFileInputRef.current?.click()} disabled={isRestoring}>
              📁 Restore from Backup File (.mldv)
            </button>
            <input type="file" accept=".mldv" ref={restoreFileInputRef} hidden onChange={handleFileRestoreSelected} />
          </div>
        )}

        {pendingRestore && (
          <div className="product-detail-overlay">
            <div className="card modal-card" role="dialog" aria-modal="true" aria-labelledby="restore-title">
              <h3 id="restore-title">🔐 Enter Vault Passphrase</h3>
              <p className="muted-text">
                Restoring from <strong>{pendingRestore.source}</strong>. Enter the Master Passphrase or the 64-character Recovery Key of that vault.
              </p>

              <form onSubmit={handleExecuteRestore}>
                <div className="form-field">
                  <label htmlFor="restorePass">Master Passphrase or Recovery Key</label>
                  <input
                    id="restorePass"
                    type="password"
                    required
                    value={restorePassphrase}
                    onChange={(e) => setRestorePassphrase(e.target.value)}
                    autoFocus
                  />
                </div>

                {restoreError && <div className="vault-error">{restoreError}</div>}

                <div className="form-actions form-actions-end">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setPendingRestore(null);
                      setRestorePassphrase("");
                      setRestoreError("");
                    }}
                    disabled={isRestoring}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="primary-button" disabled={!restorePassphrase.trim() || isRestoring}>
                    {restoreStatus ?? "Unlock & Restore Vault →"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {legalDoc && <LegalDocModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}

        <button type="button" className="text-button onboarding-pillars-link" onClick={() => setSlidesSeen(false)}>
          🛡️ Review the 3 Security Pillars
        </button>
      </div>
    </main>
  );
}

export default OnboardingScreen;
