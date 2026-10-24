import { getLicenseStatus } from "../../application/licenseService";

type SidebarProps = {
  activePage: string;
  onNavigate: (page: string) => void;
  onLock: () => void;
  onClose?: () => void;
  onOpenFeedback?: () => void;
};

type NavItem = {
  id: string;
  label: string;
  icon: string;
  badge?: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navigationGroups: NavGroup[] = [
  {
    title: "VAULT ESSENTIALS",
    items: [
      { id: "dashboard", label: "Overview", icon: "🏠" },
      { id: "documents", label: "Documents", icon: "📄" },
      { id: "products", label: "Products & Warranties", icon: "📦" },
      { id: "reminders", label: "Reminders & Expiries", icon: "⏰" },
      { id: "search", label: "Universal Search", icon: "🔍" },
    ],
  },
  {
    title: "HEALTH & WELLNESS",
    items: [
      { id: "medical", label: "Medical & Health Records", icon: "🩺" },
    ],
  },
  {
    title: "FINANCIAL & ASSETS",
    items: [
      { id: "insurance", label: "Insurance Policies", icon: "🛡️" },
      { id: "finance", label: "Financial Accounts", icon: "💰" },
      { id: "subscriptions", label: "Subscriptions", icon: "💳" },
      { id: "assets", label: "Vehicles & Properties", icon: "📊" },
    ],
  },
  {
    title: "SECURITY & RECOVERY",
    items: [
      { id: "secrets", label: "Secrets Vault", icon: "🔐" },
      { id: "emergency", label: "Emergency Life Kit", icon: "🆘", badge: "SOS" },
    ],
  },
];

function Sidebar({
  activePage,
  onNavigate,
  onLock,
  onClose,
  onOpenFeedback,
}: SidebarProps) {
  const license = getLicenseStatus();
  const isPro = license.isValid && license.tier !== "free_core";

  function handleNav(page: string) {
    onNavigate(page);
    if (onClose) {
      onClose();
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header-wrapper">
        <button
          className="sidebar-header"
          type="button"
          onClick={() => handleNav("dashboard")}
          aria-label="Go to home"
        >
          <div className="brand-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <div className="brand-name">
            MyLife<span className="brand-accent">Dock</span>
          </div>
        </button>

        {onClose && (
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            ✕
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        {navigationGroups.map((group) => (
          <div key={group.title} className="sidebar-nav-group">
            <div className="sidebar-group-title">{group.title}</div>
            {group.items.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${
                  activePage === item.id ? "nav-item-active" : ""
                }`}
                onClick={() => handleNav(item.id)}
                type="button"
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>

                <span className="nav-label">{item.label}</span>

                {item.badge && (
                  <span className="nav-item-badge">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {!isPro ? (
          <button
            className="nav-item pro-nav-item"
            type="button"
            style={{
              background: "linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(245, 158, 11, 0.08) 100%)",
              border: "1px solid rgba(234, 179, 8, 0.3)",
              color: "#facc15",
              marginBottom: "8px",
              fontWeight: 600,
            }}
            onClick={() => handleNav("settings")}
          >
            <span className="nav-icon" aria-hidden="true">⭐</span>
            <span className="nav-label">Upgrade to Pro</span>
            <span className="nav-item-badge" style={{ background: "#eab308", color: "#111827", fontWeight: 700 }}>10 Slots</span>
          </button>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 12px",
              fontSize: "12px",
              color: "#eab308",
              background: "rgba(234, 179, 8, 0.1)",
              borderRadius: "6px",
              marginBottom: "8px",
              border: "1px solid rgba(234, 179, 8, 0.2)",
            }}
          >
            <span>⭐</span>
            <span style={{ fontWeight: 600 }}>PRO ACTIVE</span>
          </div>
        )}
        <button
          className={`nav-item ${activePage === "about" ? "nav-item-active" : ""}`}
          type="button"
          onClick={() => handleNav("about")}
        >
          <span className="nav-icon" aria-hidden="true">
            ℹ️
          </span>
          <span className="nav-label">About & Support</span>
        </button>
        <button
          className="nav-item"
          type="button"
          onClick={() => {
            if (onClose) onClose();
            if (onOpenFeedback) {
              onOpenFeedback();
            } else {
              window.dispatchEvent(new CustomEvent("open-feedback-modal"));
            }
          }}
        >
          <span className="nav-icon" aria-hidden="true">
            💬
          </span>
          <span className="nav-label">Send Feedback</span>
        </button>
        <button
          className={`nav-item ${activePage === "settings" ? "nav-item-active" : ""}`}
          type="button"
          onClick={() => handleNav("settings")}
        >
          <span className="nav-icon" aria-hidden="true">
            ⚙️
          </span>
          <span className="nav-label">Settings & Backup</span>
        </button>
        <button
          className="nav-item nav-item-danger"
          type="button"
          onClick={() => {
            if (onClose) onClose();
            onLock();
          }}
        >
          <span className="nav-icon" aria-hidden="true">🔒</span>
          <span className="nav-label">Lock Vault</span>
        </button>

        <div className="privacy-badge">
          <span>🛡️</span>
          <div>
            <strong>Zero-Knowledge Active</strong>
            <small>Local AES-256-GCM Vault</small>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: "11px", color: "#475569", marginTop: "12px", paddingBottom: "4px" }}>
          © 2026 MyLifeDock Technologies<br />All rights reserved.
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;