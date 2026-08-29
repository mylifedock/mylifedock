type SidebarProps = {
  activePage: string;
  onNavigate: (page: string) => void;
  onLock: () => void;
  onClose?: () => void;
};

const navigation = [
  {
    id: "dashboard",
    label: "Overview",
    icon: "🏠",
    enabled: true,
  },
  {
    id: "documents",
    label: "Documents",
    icon: "📄",
    enabled: true,
  },
  {
    id: "products",
    label: "Products",
    icon: "📦",
    enabled: true,
  },
  {
    id: "search",
    label: "Search",
    icon: "🔍",
    enabled: true,
  },
  {
    id: "reminders",
    label: "Reminders",
    icon: "⏰",
    enabled: true,
  },
  {
    id: "secrets",
    label: "Secrets",
    icon: "🔐",
    enabled: true,
  },
  {
    id: "insurance",
    label: "Insurance",
    icon: "🛡️",
    enabled: true,
  },
  {
    id: "finance",
    label: "Finance",
    icon: "💰",
    enabled: true,
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    icon: "💳",
    enabled: true,
  },
  {
    id: "assets",
    label: "Assets (Vehicles & Properties)",
    icon: "📊",
    enabled: true,
  },
  {
    id: "emergency",
    label: "Emergency Kit",
    icon: "🆘",
    enabled: true,
  },
];

function Sidebar({
  activePage,
  onNavigate,
  onLock,
  onClose,
}: SidebarProps) {
  function handleNav(page: string) {
    onNavigate(page);
    if (onClose) {
      onClose();
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header-wrapper" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <button
          className="sidebar-header"
          type="button"
          onClick={() => handleNav("dashboard")}
          style={{ cursor: "pointer", border: "none", background: "transparent", flex: 1, textAlign: "left", display: "flex", alignItems: "center", gap: "10px" }}
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
        {navigation.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${
              activePage === item.id
                ? "nav-item-active"
                : ""
            } ${
              !item.enabled
                ? "nav-item-disabled"
                : ""
            }`}
            onClick={() => {
              if (item.enabled) {
                handleNav(item.id);
              }
            }}
            type="button"
            disabled={!item.enabled}
            title={
              !item.enabled
                ? "Coming soon"
                : undefined
            }
          >
            <span className="nav-icon">
              {item.icon}
            </span>

            <span>{item.label}</span>

            {!item.enabled && (
              <span className="nav-coming-soon">
                Soon
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button
          className={`nav-item ${activePage === "settings" ? "nav-item-active" : ""}`}
          type="button"
          onClick={() => handleNav("settings")}
        >
          <span className="nav-icon">
            ⚙️
          </span>
          <span>Settings</span>
        </button>
        <button
          className="nav-item"
          style={{ color: "var(--color-danger)" }}
          type="button"
          onClick={() => {
            if (onClose) onClose();
            onLock();
          }}
        >
          <span className="nav-icon">🔒</span>
          <span>Lock / Logout</span>
        </button>

        <div className="privacy-badge">
          <span>🛡️</span>
          <div>
            <strong>Local first</strong>
            <small>
              Your data stays with you
            </small>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;