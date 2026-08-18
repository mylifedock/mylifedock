import {
  useEffect,
  useRef,
  useState,
} from "react";

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
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
      />

      <main className="main-content">
        <div className="mobile-topbar">
          <div className="brand-name">
            MyLifeDock
          </div>

          <div className="mobile-profile">
            {profile.displayName
              .charAt(0)
              .toUpperCase()}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
            padding:
              "12px 24px 0",
          }}
        >
          <button
  type="button"
  className="vault-lock-button"
  onClick={lockApplication}
>
  <span
    className="vault-lock-button-icon"
    aria-hidden="true"
  >
    ◈
  </span>

  Lock Vault
</button>
        </div>

        {renderPage()}
      </main>
    </div>
  );
}

export default App;