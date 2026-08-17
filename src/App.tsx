import { useEffect, useState } from "react";
import {
  createLocalProfile,
  getLocalProfile,
} from "./application/profileService";
import type { ProfileRecord } from "./infrastructure/database/db";
import Sidebar from "./ui/components/Sidebar";
import DashboardPage from "./ui/pages/DashboardPage";
import DocumentsPage from "./ui/pages/DocumentsPage";

function App() {
  const [profile, setProfile] = useState<ProfileRecord>();
  const [displayName, setDisplayName] = useState("");
  const [activePage, setActivePage] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getLocalProfile()
      .then((existingProfile) => {
        setProfile(existingProfile);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function handleCreateVault() {
    if (!displayName.trim()) {
      return;
    }

    const newProfile = await createLocalProfile(displayName);
    setProfile(newProfile);
  }

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
      <main className="onboarding">
        <div className="onboarding-glow" />

        <div className="onboarding-card">
          <div className="brand-mark large">M</div>

          <span className="eyebrow">WELCOME TO MYLIFEDOCK</span>

          <h1>
            Your life.
            <br />
            <span>One private dock.</span>
          </h1>

          <p>
            Keep documents, products, warranties, reminders and
            important life information organized in one place.
          </p>

          <label htmlFor="displayName">What should we call you?</label>

          <input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleCreateVault();
              }
            }}
          />

          <button
            className="primary-button"
            type="button"
            onClick={() => void handleCreateVault()}
            disabled={!displayName.trim()}
          >
            Create my local vault
            <span>→</span>
          </button>

          <div className="onboarding-security">
            <span>●</span>
            <div>
              <strong>Private by default</strong>
              <small>
                Your first vault lives only on this device.
              </small>
            </div>
          </div>
        </div>
      </main>
    );
  }
  const currentProfile = profile;
  function renderPage() {
    switch (activePage) {
      case "documents":
        return <DocumentsPage />;

      case "dashboard":
        return (
          <DashboardPage
            displayName={currentProfile.displayName}
            onNavigate={setActivePage}
          />
        );

      default:
        return (
          <DashboardPage
            displayName={currentProfile.displayName}
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
          <div className="brand-name">MyLifeDock</div>

          <div className="mobile-profile">
            {profile.displayName.charAt(0).toUpperCase()}
          </div>
        </div>

        {renderPage()}
      </main>
    </div>
  );
}

export default App;