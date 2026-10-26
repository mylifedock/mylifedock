import { useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";

import { isTauri, onDesktopLockRequested } from "./platform/desktopBridge";
import { clearExternalActivityMark, isExternalActivityActive, markExternalActivity } from "./platform/externalActivity";
import { purgeSharedFiles } from "./platform/fileExport";
import { getEmergencyProfile } from "./application/emergencyKitService";
import { getSubscriptions } from "./application/subscriptionService";
import { getLocalProfile } from "./application/profileService";
import { getVaultTotalItemCount } from "./application/vaultLimitService";
import { startStoreBilling } from "./application/storeBillingService";
import type { ProfileRecord } from "./infrastructure/database/db";
import { isVaultConfigured, isVaultUnlocked, lockVault } from "./security/vaultKeyService";
import VaultGate from "./security/VaultGate";

import { pageTitle, resolvePage, type Destination, type PageId } from "./ui/navigation";
import { OnboardingScreen } from "./ui/OnboardingScreen";
import Sidebar from "./ui/components/Sidebar";
import { ErrorBoundary } from "./ui/components/ErrorBoundary";
import { ProUpgradeModal } from "./ui/components/ProUpgradeModal";
import DashboardPage from "./ui/pages/DashboardPage";
import DocumentsPage from "./ui/pages/DocumentsPage";
import ProductsPage from "./ui/pages/products/ProductsPage";
import RemindersPage from "./ui/pages/RemindersPage";
import { MoneyPage } from "./ui/pages/MoneyPage";
import { AssetsPage } from "./ui/pages/AssetsPage";
import { SearchPage } from "./ui/pages/SearchPage";
import SettingsPage from "./ui/pages/SettingsPage";
import SecretsPage from "./ui/pages/SecretsPage";
import InsurancePage from "./ui/pages/InsurancePage";
import { EmergencyKitPage } from "./ui/pages/EmergencyKitPage";
import { MedicalPage } from "./ui/pages/MedicalPage";
import { HelpPage } from "./ui/pages/HelpPage";

const LOCK_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const MENU_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const SEARCH_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

function getAutoLockTimeoutMs(): number {
  try {
    const mins = parseInt(localStorage.getItem("mld_autolock_timeout_min") ?? "", 10);
    return Number.isNaN(mins) || mins <= 0 ? 30 * 60 * 1000 : mins * 60 * 1000;
  } catch {
    return 30 * 60 * 1000;
  }
}

function App() {
  const [profile, setProfile] = useState<ProfileRecord>();
  const [loading, setLoading] = useState(true);
  const [vaultConfigured, setVaultConfigured] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);

  const [destination, setDestination] = useState<Destination>({ page: "dashboard" });
  // Remounts the page when the same section is opened again (e.g. another search result).
  const [visit, setVisit] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [upgradeCount, setUpgradeCount] = useState<number | null>(null);

  const activePage = destination.page;
  const sidebarOpenRef = useRef(false);
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  function navigate(target: string | Destination) {
    setDestination(typeof target === "string" ? resolvePage(target) : target);
    setVisit((v) => v + 1);
    setSidebarOpen(false);
  }

  // The on-screen keyboard hides the bottom bar so it does not cover inputs.
  useEffect(() => {
    function isTextInput(el: Element | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      if (el instanceof HTMLInputElement) return el.type !== "checkbox" && el.type !== "radio";
      return el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
    }
    function setOpen(open: boolean) {
      setIsKeyboardOpen(open);
      document.body.classList.toggle("keyboard-open", open);
    }
    function handleViewportResize() {
      if (window.visualViewport) setOpen(window.innerHeight - window.visualViewport.height > 120);
    }
    function handleFocusIn(e: FocusEvent) {
      if (isTextInput(e.target as Element)) setOpen(true);
    }
    function handleFocusOut() {
      setTimeout(() => {
        if (!isTextInput(document.activeElement)) setOpen(false);
      }, 100);
    }

    window.visualViewport?.addEventListener("resize", handleViewportResize);
    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);
    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportResize);
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
      document.body.classList.remove("keyboard-open");
    };
  }, []);

  function clearAutoLockTimer() {
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = null;
    }
  }

  function lockApplication() {
    clearAutoLockTimer();
    lockVault();
    void purgeSharedFiles();
    setVaultUnlocked(false);
  }

  // Android back button: close the menu, then go home, then leave the app.
  useEffect(() => {
    const backListener = CapacitorApp.addListener("backButton", () => {
      if (sidebarOpenRef.current) {
        setSidebarOpen(false);
        return;
      }
      setDestination((current) => {
        if (current.page !== "dashboard") return { page: "dashboard" };
        void CapacitorApp.exitApp();
        return current;
      });
    });
    return () => {
      void backListener.then((listener) => listener.remove());
    };
  }, []);

  // Tauri tray "Lock Vault" (desktop only).
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void onDesktopLockRequested(() => lockApplication()).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Decrypted copies left for the share sheet by a previous session.
  useEffect(() => {
    void purgeSharedFiles();
  }, []);

  // Older builds kept the emergency kit and subscriptions in plaintext
  // localStorage; move them into the encrypted vault as soon as it is open.
  useEffect(() => {
    if (!vaultUnlocked) return;
    void getEmergencyProfile().catch(() => {});
    void getSubscriptions().catch(() => {});
    // Google Play / App Store purchases: re-read what this store account owns.
    void startStoreBilling().catch(() => {});
  }, [vaultUnlocked]);

  // Lock when the app goes to the background or the desktop window is minimized.
  useEffect(() => {
    function lockIfBackgroundLockEnabled() {
      const lockOnBg = localStorage.getItem("mld_lock_on_background") !== "false";
      // The camera, file picker, share sheet, Google sign-in and Face ID were opened
      // by the user from inside the app; locking would break that action.
      if (lockOnBg && !isExternalActivityActive()) {
        lockApplication();
      }
    }

    const appStateListener = CapacitorApp.addListener("appStateChange", (state) => {
      if (state.isActive) {
        clearExternalActivityMark();
      } else {
        lockIfBackgroundLockEnabled();
      }
    });

    function handleVisibilityChange() {
      if (document.hidden) lockIfBackgroundLockEnabled();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // A file input opens the camera or the file picker, which backgrounds the app.
    function handleFileInputClick(event: MouseEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === "file") markExternalActivity();
    }
    document.addEventListener("click", handleFileInputClick, true);
    // Desktop file dialogs do not hide the window; focus returns when they close.
    window.addEventListener("focus", clearExternalActivityMark);

    return () => {
      void appStateListener.then((listener) => listener.remove());
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("click", handleFileInputClick, true);
      window.removeEventListener("focus", clearExternalActivityMark);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [existingProfile, configured] = await Promise.all([getLocalProfile(), isVaultConfigured()]);
        setProfile(existingProfile);
        setVaultConfigured(configured);
        setVaultUnlocked(configured && isVaultUnlocked());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Inactivity auto-lock: any interaction restarts the timer while the vault is open.
  useEffect(() => {
    if (!vaultUnlocked) {
      clearAutoLockTimer();
      return;
    }

    function scheduleAutoLock() {
      clearAutoLockTimer();
      autoLockTimerRef.current = setTimeout(() => lockApplication(), getAutoLockTimeoutMs());
    }
    scheduleAutoLock();

    const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, scheduleAutoLock, { passive: true });
    }
    return () => {
      clearAutoLockTimer();
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, scheduleAutoLock);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultUnlocked]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-mark">M</div>
        <span>Loading your dock...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <OnboardingScreen
        onProfileCreated={setProfile}
        onVaultRestored={(restored) => {
          setProfile(restored);
          setVaultConfigured(true);
          setVaultUnlocked(true);
        }}
      />
    );
  }

  if (!vaultConfigured || !vaultUnlocked) {
    return (
      <VaultGate
        configured={vaultConfigured}
        onUnlocked={() => {
          // Profile fields are encrypted at rest; re-read them now that the key is available.
          void getLocalProfile().then((unlockedProfile) => {
            if (unlockedProfile) setProfile(unlockedProfile);
            setVaultConfigured(true);
            setVaultUnlocked(true);
          });
        }}
      />
    );
  }

  function openUpgrade() {
    void getVaultTotalItemCount().then(setUpgradeCount);
  }

  function openSearch(query = searchQuery) {
    setSearchQuery(query);
    if (activePage !== "search") navigate("search");
  }

  function renderPage() {
    const { focusId, tab } = destination;
    switch (activePage) {
      case "documents":
        return <DocumentsPage focusId={focusId} />;
      case "products":
        return <ProductsPage focusId={focusId} />;
      case "reminders":
        return <RemindersPage focusId={focusId} />;
      case "insurance":
        return <InsurancePage focusId={focusId} />;
      case "money":
        return <MoneyPage initialTab={tab} focusId={focusId} />;
      case "assets":
        return <AssetsPage initialTab={tab} focusId={focusId} />;
      case "medical":
        return <MedicalPage focusId={focusId} />;
      case "secrets":
        return <SecretsPage focusId={focusId} />;
      case "emergency":
        return <EmergencyKitPage />;
      case "search":
        return <SearchPage query={searchQuery} onQueryChange={setSearchQuery} onOpen={navigate} />;
      case "settings":
        return <SettingsPage initialTab={tab} />;
      case "help":
        return <HelpPage />;
      case "dashboard":
      default:
        return <DashboardPage displayName={profile!.displayName} onNavigate={navigate} onUpgrade={openUpgrade} />;
    }
  }

  const bottomNav: { page: PageId | "menu"; label: string; icon: React.ReactNode; className?: string }[] = [
    {
      page: "dashboard",
      label: "Home",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    { page: "search", label: "Search", icon: SEARCH_ICON },
    {
      page: "menu",
      label: "Sections",
      className: "mobile-nav-categories",
      icon: (
        <div className="mobile-nav-cat-bubble">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </div>
      ),
    },
    {
      page: "emergency",
      label: "Emergency",
      className: "emergency-nav-btn",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
    {
      page: "settings",
      label: "Settings",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <div className={`sidebar-wrapper ${sidebarOpen ? "open" : ""}`}>
        <Sidebar
          activePage={activePage}
          onNavigate={navigate}
          onLock={lockApplication}
          onClose={() => setSidebarOpen(false)}
          onUpgrade={openUpgrade}
        />
      </div>

      <main className="main-content">
        {activePage === "dashboard" ? (
          <div className="mobile-topbar mobile-topbar-home">
            <button type="button" className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open sections" title="Sections">
              {MENU_ICON}
            </button>
            <div className="brand-name mobile-brand-btn">
              <div className="brand-logo" style={{ width: "24px", height: "24px" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <span>
                MyLife<strong className="brand-accent">Dock</strong>
              </span>
            </div>
            <div className="mobile-topbar-actions">
              <button type="button" className="mobile-lock-btn" onClick={lockApplication} aria-label="Lock Vault" title="Lock Vault">
                {LOCK_ICON}
              </button>
              <button type="button" className="mobile-profile-btn" onClick={() => navigate("settings")} title="Settings & Backup" aria-label="Settings & Backup">
                {(profile.displayName ?? "").charAt(0).toUpperCase()}
              </button>
            </div>
          </div>
        ) : (
          <div className="mobile-topbar mobile-topbar-inner">
            <button type="button" className="mobile-back-btn" onClick={() => navigate("dashboard")} aria-label="Back to Overview">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Home</span>
            </button>
            <h2 className="mobile-page-title">{pageTitle(activePage)}</h2>
            <div className="mobile-topbar-actions">
              {activePage !== "search" && (
                <button type="button" className="mobile-search-btn" onClick={() => openSearch()} aria-label="Search" title="Search">
                  {SEARCH_ICON}
                </button>
              )}
              <button type="button" className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open sections" title="Sections">
                {MENU_ICON}
              </button>
            </div>
          </div>
        )}

        {activePage !== "search" && (
          <form
            className="desktop-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              openSearch();
            }}
          >
            {SEARCH_ICON}
            <input
              type="search"
              aria-label="Search your vault"
              placeholder="Search documents, policies, accounts, people…"
              value={searchQuery}
              onChange={(e) => openSearch(e.target.value)}
            />
          </form>
        )}

        <ErrorBoundary onReset={() => navigate("dashboard")}>
          <div key={`${activePage}-${visit}`}>{renderPage()}</div>
        </ErrorBoundary>

        <footer className="app-global-footer">
          <div className="footer-copyright-inner">
            <strong>MyLifeDock</strong>
            <span className="footer-sep">•</span>
            <span>© 2026 MyLifeDock Technologies. All rights reserved.</span>
          </div>
        </footer>
      </main>

      {activePage === "dashboard" && !isKeyboardOpen && (
        <nav className="mobile-bottom-nav" aria-label="Quick navigation">
          {bottomNav.map((item) => (
            <button
              key={item.page}
              type="button"
              className={`${item.className ?? ""} ${item.page === activePage ? "active" : ""}`.trim()}
              aria-label={item.label}
              onClick={() => (item.page === "menu" ? setSidebarOpen(true) : navigate(item.page))}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      )}

      <ProUpgradeModal isOpen={upgradeCount !== null} onClose={() => setUpgradeCount(null)} currentCount={upgradeCount ?? 0} />
    </div>
  );
}

export default App;
