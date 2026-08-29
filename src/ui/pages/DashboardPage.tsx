import { useLiveQuery } from "dexie-react-hooks";

import { getDocuments } from "../../application/documentService";
import { getProducts } from "../../application/productService";
import { getUpcomingReminders } from "../../application/reminderService";

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
  const documents = useLiveQuery(
    () => getDocuments(),
    [],
    [],
  );

  const products = useLiveQuery(
    () => getProducts(),
    [],
    [],
  );

  const upcomingReminders = useLiveQuery(
    () => getUpcomingReminders(90),
    [],
    [],
  );

  const sensitiveCount =
    documents.filter(
      (d) => d.sensitivity !== "normal",
    ).length +
    products.filter(
      (p) => p.sensitivity !== "normal",
    ).length;

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
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          }
          label="Documents"
          value={documents.length}
          description="Important records"
          accentColor="#60a5fa"
          accentBg="rgba(59, 130, 246, 0.12)"
          onClick={() => onNavigate("documents")}
        />

        <StatCard
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m7.5 4.27 9 5.15"/>
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              <path d="m3.3 7 8.7 5 8.7-5"/>
              <path d="M12 22V12"/>
            </svg>
          }
          label="Products"
          value={products.length}
          description="Tracked items & gadgets"
          accentColor="#fbbf24"
          accentBg="rgba(245, 158, 11, 0.12)"
          onClick={() => onNavigate("products")}
        />

        <StatCard
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          }
          label="Reminders"
          value={upcomingReminders.length}
          description={
            upcomingReminders.length === 0
              ? "Nothing urgent"
              : "In next 90 days"
          }
          accentColor="#f472b6"
          accentBg="rgba(236, 72, 153, 0.12)"
          onClick={() => onNavigate("reminders")}
        />

        <StatCard
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          }
          label="Protected"
          value={sensitiveCount}
          description="Sensitive records"
          accentColor="#34d399"
          accentBg="rgba(16, 185, 129, 0.12)"
          onClick={() => onNavigate("secrets")}
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

          {upcomingReminders.length === 0 ? (
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
          ) : (
            <div className="dashboard-reminders">
              {upcomingReminders
                .slice(0, 5)
                .map((reminder) => (
                  <div
                    key={reminder.id}
                    className="dashboard-reminder-item"
                    onClick={() => onNavigate("reminders")}
                    style={{ cursor: "pointer" }}
                    role="button"
                    tabIndex={0}
                  >
                    <div>
                      <strong>
                        {reminder.title}
                      </strong>
                      <small>
                        Due: {reminder.dueDate}
                      </small>
                    </div>
                  </div>
                ))}

              {upcomingReminders.length > 5 && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    onNavigate("reminders")
                  }
                >
                  View all{" "}
                  {upcomingReminders.length}{" "}
                  reminders →
                </button>
              )}
            </div>
          )}
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
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              }
              title="Add Document"
              description="Passport, certificate, invoice, medical..."
              onClick={() => onNavigate("documents")}
              accentBg="rgba(99, 102, 241, 0.15)"
              accentColor="#818cf8"
            />

            <QuickAction
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m7.5 4.27 9 5.15"/>
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                  <path d="m3.3 7 8.7 5 8.7-5"/>
                  <path d="M12 22V12"/>
                </svg>
              }
              title="Add Product"
              description="AC, phone, appliance, electronics..."
              onClick={() => onNavigate("products")}
              accentBg="rgba(245, 158, 11, 0.15)"
              accentColor="#fbbf24"
            />

            <QuickAction
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              }
              title="Set Reminder"
              description="Warranty, expiry or renewal deadline"
              onClick={() => onNavigate("reminders")}
              accentBg="rgba(236, 72, 153, 0.15)"
              accentColor="#f472b6"
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