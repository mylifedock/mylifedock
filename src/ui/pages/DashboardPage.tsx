import StatCard from "../components/StatCard";
import QuickAction from "../components/QuickAction";

type DashboardPageProps = {
  displayName: string;
  onNavigate: (page: string) => void;
};

function DashboardPage({
  displayName,
  onNavigate,
}: DashboardPageProps) {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">YOUR PERSONAL DOCK</span>

          <h1>
            Good to see you,{" "}
            <span>{displayName}</span>
          </h1>

          <p>
            Everything important in your life, organized in one private
            place.
          </p>
        </div>

        <div className="header-status">
          <span className="status-dot" />
          Local vault active
        </div>
      </header>

      <section className="stats-grid">
        <StatCard
          icon="▣"
          label="Documents"
          value={0}
          description="Important records"
        />

        <StatCard
          icon="□"
          label="Products"
          value={0}
          description="Tracked products"
        />

        <StatCard
          icon="◷"
          label="Reminders"
          value={0}
          description="Nothing urgent"
        />

        <StatCard
          icon="◇"
          label="Protected"
          value={0}
          description="Sensitive records"
        />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">UP NEXT</span>
              <h2>Upcoming</h2>
            </div>
          </div>

          <div className="empty-state">
            <div className="empty-icon">◷</div>

            <h3>No upcoming reminders</h3>

            <p>
              Warranty expiries, renewals and important dates will
              appear here.
            </p>

            <button
              className="text-button"
              type="button"
              onClick={() => onNavigate("reminders")}
            >
              Explore reminders →
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">QUICK START</span>
              <h2>What do you want to add?</h2>
            </div>
          </div>

          <div className="quick-actions">
            <QuickAction
              icon="▣"
              title="Document"
              description="Passport, certificate, invoice..."
              onClick={() => onNavigate("documents")}
            />

            <QuickAction
              icon="□"
              title="Product"
              description="AC, phone, appliance..."
              onClick={() => onNavigate("products")}
            />

            <QuickAction
              icon="◷"
              title="Reminder"
              description="Expiry, renewal or important date"
              onClick={() => onNavigate("reminders")}
            />
          </div>
        </div>
      </section>

      <section className="privacy-card">
        <div className="privacy-card-icon">⌁</div>

        <div>
          <strong>Privacy-first by design</strong>
          <p>
            MyLifeDock starts with local storage. Cloud storage and
            sharing are optional and controlled by you.
          </p>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;