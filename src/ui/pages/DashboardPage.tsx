import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { getDocuments } from "../../application/documentService";
import { getProducts } from "../../application/productService";
import { getUpcomingReminders } from "../../application/reminderService";
import { getMedicalRecords } from "../../application/medicalService";
import { getVaultQuotaStatus, type VaultQuotaStatus } from "../../application/vaultLimitService";
import { ProUpgradeModal } from "../components/ProUpgradeModal";

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

  const medicalRecords = useLiveQuery(
    () => getMedicalRecords(),
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

  const [quota, setQuota] = useState<VaultQuotaStatus | null>(null);
  const [showProModal, setShowProModal] = useState(false);

  useEffect(() => {
    void getVaultQuotaStatus().then(setQuota);
  }, [documents, products, medicalRecords]);

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

      {quota && !quota.isPro && (
        <section
          style={{
            background: "linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(30, 41, 59, 0.6) 100%)",
            border: "1px solid rgba(234, 179, 8, 0.25)",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ flex: 1, minWidth: "260px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "16px" }}>⚡</span>
              <strong style={{ color: "#f8fafc", fontSize: "14px" }}>
                Free Core Vault: {quota.totalItems} / {quota.limit} Slots Used
              </strong>
              {quota.isLimitReached && (
                <span style={{ background: "#ef4444", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px" }}>
                  LIMIT REACHED
                </span>
              )}
            </div>
            <div style={{ background: "rgba(255, 255, 255, 0.1)", borderRadius: "6px", height: "6px", overflow: "hidden", maxWidth: "340px", marginBottom: "6px" }}>
              <div
                style={{
                  background: quota.isLimitReached ? "#ef4444" : "#eab308",
                  height: "100%",
                  width: `${Math.min(100, (quota.totalItems / quota.limit) * 100)}%`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <small style={{ color: "#94a3b8", fontSize: "12.5px" }}>
              {quota.isLimitReached
                ? "You have reached your 10 free items limit. Upgrade to Pro for unlimited storage."
                : `Store up to 10 free items across all categories. ${quota.remainingItems} slot${quota.remainingItems === 1 ? "" : "s"} left.`}
            </small>
          </div>
          <button
            type="button"
            className="primary-button"
            style={{
              background: "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)",
              color: "#0f172a",
              fontWeight: 700,
              border: "none",
              padding: "8px 16px",
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(234, 179, 8, 0.25)",
            }}
            onClick={() => setShowProModal(true)}
          >
            ⭐ Upgrade to Pro
          </button>
        </section>
      )}

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
              <div className="empty-icon">â—·</div>

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
                Explore reminders â†’
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
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate("reminders"); } }}
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
                  reminders â†’
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

            <QuickAction
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
              }
              title="Medical Records"
              description={`Prescriptions, lab reports (${medicalRecords.length} saved)`}
              onClick={() => onNavigate("medical")}
              accentBg="rgba(16, 185, 129, 0.15)"
              accentColor="#34d399"
            />
          </div>
        </div>
      </section>

      <section className="privacy-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div className="privacy-card-icon">ðŸ›¡ï¸</div>
          <div>
            <strong>Zero-Knowledge Security Active</strong>
            <p>
              Your vault is encrypted locally with AES-256-GCM. The developer and cloud providers cannot read your records.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="secondary-button"
          style={{ fontSize: "13.5px", padding: "8px 16px", border: "1px solid rgba(56, 189, 248, 0.3)", color: "#38bdf8" }}
          onClick={() => onNavigate("settings")}
        >
          Vault Backups &rarr;
        </button>
      </section>

      <ProUpgradeModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        currentCount={quota?.totalItems ?? 0}
      />
    </div>
  );
}

export default DashboardPage;