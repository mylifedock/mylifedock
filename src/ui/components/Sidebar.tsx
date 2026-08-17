type SidebarProps = {
  activePage: string;
  onNavigate: (page: string) => void;
};

const navigation = [
  { id: "dashboard", label: "Overview", icon: "⌂" },
  { id: "documents", label: "Documents", icon: "▣" },
  { id: "products", label: "Products", icon: "□" },
  { id: "insurance", label: "Insurance", icon: "◇" },
  { id: "finance", label: "Finance", icon: "₹" },
  { id: "assets", label: "Assets", icon: "△" },
  { id: "reminders", label: "Reminders", icon: "◷" },
];

function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">M</div>

        <div>
          <div className="brand-name">MyLifeDock</div>
          <div className="brand-caption">Personal command center</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navigation.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${
              activePage === item.id ? "nav-item-active" : ""
            }`}
            onClick={() => onNavigate(item.id)}
            type="button"
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button
          className="nav-item"
          type="button"
          onClick={() => onNavigate("settings")}
        >
          <span className="nav-icon">⚙</span>
          <span>Settings</span>
        </button>

        <div className="privacy-badge">
          <span>●</span>
          <div>
            <strong>Local first</strong>
            <small>Your data stays with you</small>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;