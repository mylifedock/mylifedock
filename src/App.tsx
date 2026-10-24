import {
  useEffect,
  useRef,
  useState,
} from "react";

import { App as CapacitorApp } from "@capacitor/app";

import {
  isTauri,
  onDesktopLockRequested,
} from "./platform/desktopBridge";

import {
  createLocalProfile,
  getLocalProfile,
} from "./application/profileService";

import type { ProfileRecord } from "./infrastructure/database/db";

import {
  isVaultConfigured,
  isVaultUnlocked,
  lockVault,
} from "./security/vaultKeyService";

import VaultGate from "./security/VaultGate";

import { useGoogleLogin } from "@react-oauth/google";
import { useToast } from "./ui/components/Toast";
import { listBackups, downloadBackup } from "./application/googleDriveService";
import { restoreVaultFromBackup } from "./application/backupService";

import Sidebar from "./ui/components/Sidebar";
import DashboardPage from "./ui/pages/DashboardPage";
import DocumentsPage from "./ui/pages/DocumentsPage";
import ProductsPage from "./ui/pages/ProductsPage";
import RemindersPage from "./ui/pages/RemindersPage";
import { FinancePage } from "./ui/pages/FinancePage";
import { AssetsPage } from "./ui/pages/AssetsPage";
import { SearchPage } from "./ui/pages/SearchPage";
import SettingsPage from "./ui/pages/SettingsPage";
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import SecretsPage from "./ui/pages/SecretsPage";
import InsurancePage from "./ui/pages/InsurancePage";
import { VehiclesPage } from "./ui/pages/VehiclesPage";
import { SubscriptionsPage } from "./ui/pages/SubscriptionsPage";
import { EmergencyKitPage } from "./ui/pages/EmergencyKitPage";
import { MedicalPage } from "./ui/pages/MedicalPage";
import AboutPage from "./ui/pages/AboutPage";
import PillarsSlideshow from "./ui/components/PillarsSlideshow";
import AppUpdateBanner from "./ui/components/AppUpdateBanner";

function getAutoLockTimeoutMs(): number {
  try {
    const saved = localStorage.getItem("mld_autolock_timeout_min");
    if (!saved) return 30 * 60 * 1000;
    const mins = parseInt(saved, 10);
    return isNaN(mins) || mins <= 0 ? 30 * 60 * 1000 : mins * 60 * 1000;
  } catch {
    return 30 * 60 * 1000;
  }
}

function getPageTitle(page: string): string {
  switch (page) {
    case "dashboard": return "Overview";
    case "documents": return "Documents";
    case "products": return "Products & Warranties";
    case "reminders": return "Reminders & Expiries";
    case "search": return "Universal Search";
    case "secrets": return "Secrets Vault";
    case "insurance": return "Insurance Policies";
    case "finance": return "Financial Accounts";
    case "assets":
    case "vehicles": return "Vehicles & Properties";
    case "subscriptions": return "Subscriptions";
    case "emergency": return "Emergency Life Kit";
    case "medical": return "Medical & Health Records";
    case "about": return "About & Support";
    case "settings": return "Settings & Backup";
    default: return "MyLifeDock";
  }
}

function App() {
  const { showToast } = useToast();
  const [profile, setProfile] =
    useState<ProfileRecord>();

  const [displayName, setDisplayName] =
    useState("");

  const [acceptedTerms, setAcceptedTerms] =
    useState(false);

  const [onboardingTab, setOnboardingTab] =
    useState<"create" | "restore">("create");

  const [isRestoring, setIsRestoring] =
    useState(false);

  const [showRestoreModal, setShowRestoreModal] =
    useState(false);

  const [pendingRestoreBlob, setPendingRestoreBlob] =
    useState<Blob | File | null>(null);

  const [restoreSource, setRestoreSource] =
    useState<string>("");

  const [restorePassphrase, setRestorePassphrase] =
    useState("");

  const [restoreError, setRestoreError] =
    useState("");

  const restoreFileInputRef =
    useRef<HTMLInputElement>(null);

  const [activePage, setActivePage] =
    useState("dashboard");

  const [loading, setLoading] =
    useState(true);

  const [vaultConfigured, setVaultConfigured] =
    useState(false);

  const [vaultUnlocked, setVaultUnlocked] =
    useState(false);

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const sidebarOpenRef = useRef(false);
  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    function handleViewportResize() {
      if (window.visualViewport) {
        const heightDiff = window.innerHeight - window.visualViewport.height;
        const open = heightDiff > 120;
        setIsKeyboardOpen(open);
        if (open) {
          document.body.classList.add("keyboard-open");
        } else {
          document.body.classList.remove("keyboard-open");
        }
      }
    }

    function handleFocusIn(e: FocusEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (isInput) {
        if (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio")) {
          return;
        }
        setIsKeyboardOpen(true);
        document.body.classList.add("keyboard-open");
      }
    }

    function handleFocusOut() {
      setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        const stillInInput =
          active &&
          (active.tagName === "INPUT" ||
           active.tagName === "TEXTAREA" ||
           active.tagName === "SELECT" ||
           active.isContentEditable) &&
          !(active instanceof HTMLInputElement && (active.type === "checkbox" || active.type === "radio"));

        if (!stillInInput) {
          setIsKeyboardOpen(false);
          document.body.classList.remove("keyboard-open");
        }
      }, 100);
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportResize);
    }
    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportResize);
      }
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
      document.body.classList.remove("keyboard-open");
    };
  }, []);

  const autoLockTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

   function clearAutoLockTimer() {
    if (autoLockTimerRef.current) {
      clearTimeout(
        autoLockTimerRef.current,
      );

      autoLockTimerRef.current = null;
    }
  }

  useEffect(() => {
    const backListener = CapacitorApp.addListener('backButton', () => {
      if (sidebarOpenRef.current) {
        setSidebarOpen(false);
        return;
      }
      setActivePage((currentPage) => {
        if (currentPage !== 'dashboard') {
          return 'dashboard';
        }
        CapacitorApp.exitApp();
        return currentPage;
      });
    });

    return () => {
      backListener.then(listener => listener.remove());
    };
  }, []);

  // Subscribe to Tauri tray "Lock Vault" event (desktop only â€” no-op on mobile/web)
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void onDesktopLockRequested(() => {
      lockApplication();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function lockApplication() {
    clearAutoLockTimer();

    lockVault();

    setVaultUnlocked(false);
  }

  // Security: Auto-lock when app moves to background, Recent Apps overview, or window is minimized/hidden
  useEffect(() => {
    // 1. Mobile background / Recent Apps (Capacitor)
    const appStateListener = CapacitorApp.addListener('appStateChange', (state) => {
      const lockOnBg = localStorage.getItem("mld_lock_on_background") !== "false";
      if (!state.isActive && lockOnBg) {
        lockApplication();
      }
    });

    // 2. Web / Desktop minimized or tab switch
    function handleVisibilityChange() {
      const lockOnBg = localStorage.getItem("mld_lock_on_background") !== "false";
      if (document.hidden && lockOnBg) {
        lockApplication();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      appStateListener.then(listener => listener.remove());
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadApplicationState() {
      try {
        const [
          existingProfile,
          configured,
        ] = await Promise.all([
          getLocalProfile(),
          isVaultConfigured(),
        ]);

        setProfile(existingProfile);
        setVaultConfigured(configured);
        setVaultUnlocked(
          configured && isVaultUnlocked(),
        );
      } finally {
        setLoading(false);
      }
    }

    void loadApplicationState();
  }, []);

  /*
   * Automatic vault locking.
   *
   * The timer only exists while the vault is
   * unlocked.
   *
   * Normal user activity resets the timer.
   */
   useEffect(() => {
    if (!vaultUnlocked) {
      clearAutoLockTimer();
      return;
    }

    function scheduleAutoLock() {
      clearAutoLockTimer();

      autoLockTimerRef.current =
        setTimeout(() => {
          lockVault();
          autoLockTimerRef.current =
            null;
          setVaultUnlocked(false);
        }, getAutoLockTimeoutMs());
    }

    scheduleAutoLock();

    const activityEvents = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ] as const;

    function handleActivity() {
      scheduleAutoLock();
    }

    for (const eventName of activityEvents) {
      window.addEventListener(
        eventName,
        handleActivity,
        {
          passive: true,
        },
      );
    }

    return () => {
      clearAutoLockTimer();

      for (const eventName of activityEvents) {
        window.removeEventListener(
          eventName,
          handleActivity,
        );
      }
    };
  }, [vaultUnlocked]);  const handleGoogleDriveRestore = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/drive.appdata",
    onSuccess: async (tokenResponse) => {
      try {
        setIsRestoring(true);
        showToast("Connecting to Google Drive...", "info");
        const token = tokenResponse.access_token;

        const files = await listBackups(token);
        if (files.length === 0) {
          showToast("No backups found in Google Drive.", "error");
          setIsRestoring(false);
          return;
        }

        const latestBackup = files[0];
        showToast("Downloading backup from Google Drive...", "info");
        const blob = await downloadBackup(token, latestBackup.id);

        setPendingRestoreBlob(blob);
        setRestoreSource("Google Drive");
        setRestoreError("");
        setRestorePassphrase("");
        setShowRestoreModal(true);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to fetch cloud backup", "error");
      } finally {
        setIsRestoring(false);
      }
    },
    onError: () => {
      showToast("Google authentication cancelled or failed.", "error");
      setIsRestoring(false);
    },
  });

  function handleFileRestoreSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingRestoreBlob(file);
    setRestoreSource(`File (${file.name})`);
    setRestoreError("");
    setRestorePassphrase("");
    setShowRestoreModal(true);
    e.target.value = "";
  }

  async function handleExecuteRestore(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingRestoreBlob || !restorePassphrase.trim() || isRestoring) return;

    setRestoreError("");
    setIsRestoring(true);
    try {
      const result = await restoreVaultFromBackup(pendingRestoreBlob, restorePassphrase.trim());
      showToast(`Vault restored! Welcome back, ${result.profileName}.`, "success");

      const updatedProfile = await getLocalProfile();
      setProfile(updatedProfile);
      setVaultConfigured(true);
      setVaultUnlocked(true);
      setShowRestoreModal(false);
      setPendingRestoreBlob(null);
      setRestorePassphrase("");
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Failed to restore vault.");
    } finally {
      setIsRestoring(false);
    }
  }

  async function handleCreateProfile() {
    if (!displayName.trim()) {
      return;
    }

    const newProfile =
      await createLocalProfile(
        displayName.trim(),
      );

    setProfile(newProfile);
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-mark">
          M
        </div>

        <span>
          Loading your dock...
        </span>
      </div>
    );
  }

  if (!profile) {
    return (
      <main className="onboarding">
        <div className="onboarding-glow" />

        <div className="onboarding-card">
          <div className="brand-mark large">
            M
          </div>

          <span className="eyebrow">
            WELCOME TO MYLIFEDOCK
          </span>

          <h1>
            Your life.
            <br />
            <span>One private dock.</span>
          </h1>

          {/* 3 Core Pillars Slideshow: Zero Server Access, Zero-Knowledge, Sovereign Offline */}
          <PillarsSlideshow />

          {/* New vs Returning User Tab Toggle */}
          <div style={{ display: "flex", background: "rgba(255, 255, 255, 0.06)", padding: "4px", borderRadius: "8px", margin: "18px 0 16px 0", gap: "4px" }}>
            <button
              type="button"
              onClick={() => setOnboardingTab("create")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "6px",
                border: "none",
                background: onboardingTab === "create" ? "#38bdf8" : "transparent",
                color: onboardingTab === "create" ? "#0f172a" : "#94a3b8",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              âœ¨ Create New Vault
            </button>
            <button
              type="button"
              onClick={() => setOnboardingTab("restore")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "6px",
                border: "none",
                background: onboardingTab === "restore" ? "#38bdf8" : "transparent",
                color: onboardingTab === "restore" ? "#0f172a" : "#94a3b8",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              ðŸ”„ Restore Existing Vault
            </button>
          </div>

          {onboardingTab === "create" ? (
            <>
              <p>
                Keep documents, products, warranties, reminders and important life information organized in one place.
              </p>

              <label htmlFor="displayName">
                What should we call you?
              </label>

              <input
                id="displayName"
                value={displayName}
                maxLength={50}
                onChange={(event) =>
                  setDisplayName(
                    event.target.value,
                  )
                }
                placeholder="Your name"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter" && acceptedTerms) {
                    void handleCreateProfile();
                  }
                }}
              />

              <div style={{ marginTop: "16px", marginBottom: "8px", display: "flex", alignItems: "flex-start", gap: "10px", textAlign: "left", padding: "12px", background: "rgba(255, 0, 0, 0.05)", border: "1px solid rgba(255, 100, 100, 0.2)", borderRadius: "8px" }}>
                <input 
                  type="checkbox" 
                  id="termsCheckbox" 
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  style={{ marginTop: "4px", cursor: "pointer", width: "16px", height: "16px", flexShrink: 0 }}
                />
                <label htmlFor="termsCheckbox" style={{ fontSize: "12.5px", color: "#e2e8f0", lineHeight: "1.4", cursor: "pointer" }}>
                  I agree to the <a href="#" style={{ color: "#38bdf8" }}>Terms of Service</a> & <a href="#" style={{ color: "#38bdf8" }}>Privacy Policy</a>. 
                  <br/><br/>
                  <strong style={{ color: "#f87171" }}>CRITICAL RISK ACKNOWLEDGEMENT:</strong> I understand that MyLifeDock uses a Zero-Knowledge architecture. <strong>If I lose my Master Passphrase and Recovery Key, my data is permanently unrecoverable.</strong> The developer cannot reset my password or access my data under any circumstances. I accept full responsibility for securely backing up my keys.
                </label>
              </div>

              <button
                className="primary-button cta-button"
                type="button"
                onClick={() =>
                  void handleCreateProfile()
                }
                disabled={!displayName.trim() || !acceptedTerms}
              >
                <span>Create my local vault</span>
                <span className="btn-arrow" aria-hidden="true">â†’</span>
              </button>

              <div className="onboarding-security">
                <span>â—</span>
                <div>
                  <strong>
                    Private by default
                  </strong>
                  <small>
                    Your first vault lives only on this device.
                  </small>
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ color: "#94a3b8", fontSize: "13.5px", lineHeight: "1.5", margin: 0 }}>
                Reinstalling the app or switching devices? Restore your encrypted vault from your personal Google Drive or an exported <strong>.mldv</strong> backup file.
              </p>

              <div style={{ display: "grid", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => handleGoogleDriveRestore()}
                  disabled={isRestoring}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "linear-gradient(135deg, #4285F4, #34A853)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L4 16h6l2-4 2 4h6L12 2z" fill="#fff"/>
                  </svg>
                  {isRestoring ? "Connecting to Cloud..." : "Restore from Google Drive"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => restoreFileInputRef.current?.click()}
                  disabled={isRestoring}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
                >
                  ðŸ“ Restore from Backup File (.mldv)
                </button>
                <input
                  type="file"
                  accept=".mldv"
                  ref={restoreFileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileRestoreSelected}
                />
              </div>

              <div className="onboarding-security" style={{ marginTop: "4px" }}>
                <span>â—</span>
                <div>
                  <strong>Zero-Knowledge Restoration</strong>
                  <small>
                    Your Master Passphrase decrypts your vault directly on this device. No unencrypted data is ever sent to any developer server.
                  </small>
                </div>
              </div>
            </div>
          )}

          {/* Master Passphrase Modal for Restoration */}
          {showRestoreModal && (
            <div className="product-detail-overlay">
              <div className="card" style={{ maxWidth: "440px", width: "100%", margin: "auto", padding: "24px", background: "#111827", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  ðŸ” Enter Vault Passphrase
                </h3>
                <p style={{ fontSize: "13px", color: "#94a3b8" }}>
                  Restoring from <strong>{restoreSource}</strong>. Enter the Master Passphrase (or 64-character Recovery Key) used for this vault.
                </p>

                <form onSubmit={handleExecuteRestore}>
                  <div className="form-field" style={{ marginBottom: "16px" }}>
                    <label htmlFor="restorePass">Master Passphrase or Recovery Key</label>
                    <input
                      id="restorePass"
                      type="password"
                      required
                      value={restorePassphrase}
                      onChange={(e) => setRestorePassphrase(e.target.value)}
                      placeholder="Enter passphrase or recovery key"
                      autoFocus
                    />
                  </div>

                  {restoreError && (
                    <div className="vault-error" style={{ marginBottom: "16px", color: "#f87171", fontSize: "13px" }}>
                      {restoreError}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setShowRestoreModal(false);
                        setPendingRestoreBlob(null);
                        setRestorePassphrase("");
                        setRestoreError("");
                      }}
                      disabled={isRestoring}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={!restorePassphrase.trim() || isRestoring}
                    >
                      {isRestoring ? "Decrypting..." : "Unlock & Restore Vault â†’"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (!vaultConfigured || !vaultUnlocked) {
    return (
      <VaultGate
        configured={vaultConfigured}
        onUnlocked={() => {
          setVaultConfigured(true);
          setVaultUnlocked(true);
        }}
      />
    );
  }

 function renderPage() {
  switch (activePage) {
    case "documents":
      return <DocumentsPage />;

    case "products":
      return <ProductsPage />;

    case "reminders":
      return <RemindersPage />;
    case "search":
      return <SearchPage onNavigate={setActivePage} />;
    case "secrets":
      return <SecretsPage />;
    case "insurance":
      return <InsurancePage />;
    case "finance":
      return <FinancePage />;
    case "assets":
      return <AssetsPage />;
    case "vehicles":
      return <VehiclesPage />;
    case "subscriptions":
      return <SubscriptionsPage />;
    case "emergency":
      return <EmergencyKitPage />;
    case "medical":
      return <MedicalPage />;
    case "about":
      return <AboutPage />;
    case "settings":
      return <SettingsPage />;

    case "dashboard":
    default:
      return (
        <DashboardPage
          displayName={
            profile!.displayName
          }
          onNavigate={setActivePage}
        />
      );
  }
}

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}
      <div className={`sidebar-wrapper ${sidebarOpen ? "open" : ""}`}>
        <Sidebar
          activePage={activePage}
          onNavigate={(page) => {
            setActivePage(page);
            setSidebarOpen(false);
          }}
          onLock={lockApplication}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <main className="main-content">
        <AppUpdateBanner />
        {activePage === "dashboard" ? (
          <div className="mobile-topbar mobile-topbar-home">
            <button 
              type="button"
              className="mobile-menu-btn" 
              onClick={() => setSidebarOpen(true)}
              aria-label="Open Vault Directory"
              title="Vault Directory"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            
            <div className="brand-name mobile-brand-btn">
              <div className="brand-logo" style={{ width: "24px", height: "24px" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
              </div>
              <span>MyLife<strong className="brand-accent">Dock</strong></span>
            </div>

            <div className="mobile-topbar-actions">
              <button
                type="button"
                className="mobile-lock-btn"
                onClick={lockApplication}
                aria-label="Lock Vault"
                title="Lock Vault"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </button>
              <button 
                type="button"
                className="mobile-profile-btn"
                onClick={() => setActivePage("settings")}
                title="Settings & Profile"
              >
                {profile.displayName
                  .charAt(0)
                  .toUpperCase()}
              </button>
            </div>
          </div>
        ) : (
          <div className="mobile-topbar mobile-topbar-inner">
            <button 
              type="button"
              className="mobile-back-btn" 
              onClick={() => setActivePage("dashboard")}
              aria-label="Back to Dashboard"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Home</span>
            </button>
            
            <h2 className="mobile-page-title">
              {getPageTitle(activePage)}
            </h2>

            <div className="mobile-topbar-actions">
              <button
                type="button"
                className="mobile-lock-btn"
                onClick={lockApplication}
                aria-label="Lock Vault"
                title="Lock Vault"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </button>
              <button 
                type="button"
                className="mobile-menu-btn" 
                onClick={() => setSidebarOpen(true)}
                aria-label="Open Directory"
                title="Directory"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        )}
        <ErrorBoundary onReset={() => setActivePage('dashboard')}>
          {renderPage()}
        </ErrorBoundary>
      </main>

      {activePage === "dashboard" && !isKeyboardOpen && (
        <nav className="mobile-bottom-nav">
          <button 
            type="button" 
            onClick={() => setActivePage("dashboard")} 
            className="active"
            aria-label="Home"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Home</span>
          </button>

          <button 
            type="button" 
            onClick={() => setActivePage("search")} 
            className=""
            aria-label="Universal Search"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Search</span>
          </button>

          <button 
            type="button" 
            onClick={() => setSidebarOpen(true)}
            className="mobile-nav-categories"
            aria-label="Vault Directory"
          >
            <div className="mobile-nav-cat-bubble">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </div>
            <span>Directory</span>
          </button>

          <button 
            type="button" 
            onClick={() => setActivePage("emergency")} 
            className="emergency-nav-btn"
            aria-label="Emergency Kit"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>Emergency</span>
          </button>

          <button 
            type="button" 
            onClick={() => setActivePage("settings")} 
            className=""
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Settings</span>
          </button>
        </nav>
      )}
    </div>
  );
}

export default App;