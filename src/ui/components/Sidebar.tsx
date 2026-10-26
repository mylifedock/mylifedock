import { useEffect, useState } from "react";
import { getLicenseStatus, isProLicense, LICENSE_CHANGED_EVENT } from "../../application/licenseService";
import { FOOTER_ITEMS, NAV_GROUPS, type NavItem, type PageId } from "../navigation";

type SidebarProps = {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  onLock: () => void;
  onClose?: () => void;
  onUpgrade: () => void;
};

function Sidebar({ activePage, onNavigate, onLock, onClose, onUpgrade }: SidebarProps) {
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      void getLicenseStatus().then((status) => {
        if (!cancelled) setIsPro(isProLicense(status));
      });
    }
    refresh();
    window.addEventListener(LICENSE_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(LICENSE_CHANGED_EVENT, refresh);
    };
  }, []);

  function handleNav(page: PageId) {
    onNavigate(page);
    onClose?.();
  }

  function renderItem(item: NavItem) {
    return (
      <button
        key={item.id}
        className={`nav-item ${activePage === item.id ? "nav-item-active" : ""}`}
        aria-current={activePage === item.id ? "page" : undefined}
        onClick={() => handleNav(item.id)}
        type="button"
      >
        <span className="nav-icon" aria-hidden="true">
          {item.icon}
        </span>
        <span className="nav-label">{item.label}</span>
        {item.badge && <span className="nav-item-badge">{item.badge}</span>}
      </button>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header-wrapper">
        <button className="sidebar-header" type="button" onClick={() => handleNav("dashboard")} aria-label="Go to home">
          <div className="brand-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div className="brand-name">
            MyLife<span className="brand-accent">Dock</span>
          </div>
        </button>

        {onClose && (
          <button type="button" className="sidebar-close-btn" onClick={onClose} aria-label="Close navigation menu">
            ✕
          </button>
        )}
      </div>

      <nav className="sidebar-nav" aria-label="Sections">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="sidebar-nav-group">
            <div className="sidebar-group-title">{group.title}</div>
            {group.items.map(renderItem)}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {isPro ? (
          <div className="pro-active-pill">
            <span aria-hidden="true">⭐</span> PRO ACTIVE
          </div>
        ) : (
          <button
            className="nav-item pro-nav-item"
            type="button"
            onClick={() => {
              onClose?.();
              onUpgrade();
            }}
          >
            <span className="nav-icon" aria-hidden="true">⭐</span>
            <span className="nav-label">Upgrade to Pro</span>
          </button>
        )}

        {FOOTER_ITEMS.map(renderItem)}

        <button
          className="nav-item nav-item-danger"
          type="button"
          onClick={() => {
            onClose?.();
            onLock();
          }}
        >
          <span className="nav-icon" aria-hidden="true">🔒</span>
          <span className="nav-label">Lock Vault</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
