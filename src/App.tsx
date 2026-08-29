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

import Sidebar from "./ui/components/Sidebar";
import DashboardPage from "./ui/pages/DashboardPage";
import DocumentsPage from "./ui/pages/DocumentsPage";
import ProductsPage from "./ui/pages/ProductsPage";
import RemindersPage from "./ui/pages/RemindersPage";
import { FinancePage } from "./ui/pages/FinancePage";
import { AssetsPage } from "./ui/pages/AssetsPage";
import { SearchPage } from "./ui/pages/SearchPage";
import SettingsPage from "./ui/pages/SettingsPage";
import SecretsPage from "./ui/pages/SecretsPage";
import InsurancePage from "./ui/pages/InsurancePage";
import { VehiclesPage } from "./ui/pages/VehiclesPage";
import { SubscriptionsPage } from "./ui/pages/SubscriptionsPage";
import { EmergencyKitPage } from "./ui/pages/EmergencyKitPage";
import AboutPage from "./ui/pages/AboutPage";

const AUTO_LOCK_TIMEOUT_MS =
  30 * 60 * 1000;

function App() {
  const [profile, setProfile] =
    useState<ProfileRecord>();

  const [displayName, setDisplayName] =
    useState("");

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

  // Subscribe to Tauri tray "Lock Vault" event (desktop only — no-op on mobile/web)
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
        }, AUTO_LOCK_TIMEOUT_MS);
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
  }, [vaultUnlocked]);

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

          <p>
            Keep documents, products, warranties,
            reminders and important life
            information organized in one place.
          </p>

          <label htmlFor="displayName">
            What should we call you?
          </label>

          <input
            id="displayName"
            value={displayName}
            onChange={(event) =>
              setDisplayName(
                event.target.value,
              )
            }
            placeholder="Your name"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleCreateProfile();
              }
            }}
          />

          <button
            className="primary-button"
            type="button"
            onClick={() =>
              void handleCreateProfile()
            }
            disabled={!displayName.trim()}
          >
            Create my local vault
            <span>→</span>
          </button>

          <div className="onboarding-security">
            <span>●</span>

            <div>
              <strong>
                Private by default
              </strong>

              <small>
                Your first vault lives only on
                this device.
              </small>
            </div>
          </div>
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
        <div className="mobile-topbar">
          <button 
            type="button"
            className="mobile-menu-btn" 
            onClick={() => setSidebarOpen(true)}
            aria-label="Open full vault navigation"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          
          <button 
            type="button" 
            className="brand-name mobile-brand-btn" 
            onClick={() => setActivePage("dashboard")}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <div className="brand-logo" style={{ width: "22px", height: "22px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <span>MyLife<strong className="brand-accent">Dock</strong></span>
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

        {renderPage()}
      </main>

      <nav className="mobile-bottom-nav">
        <button 
          type="button" 
          onClick={() => setActivePage("dashboard")} 
          className={activePage === "dashboard" ? "active" : ""}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Home</span>
        </button>

        <button 
          type="button" 
          onClick={() => setActivePage("documents")} 
          className={activePage === "documents" ? "active" : ""}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          <span>Docs</span>
        </button>

        <button 
          type="button" 
          onClick={() => setActivePage("products")} 
          className={activePage === "products" ? "active" : ""}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <span>Products</span>
        </button>

        <button 
          type="button" 
          onClick={() => setActivePage("reminders")} 
          className={activePage === "reminders" ? "active" : ""}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>Reminders</span>
        </button>

        <button 
          type="button" 
          onClick={() => setSidebarOpen(true)}
          className={sidebarOpen ? "active" : ""}
          aria-label="More categories"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}

export default App;