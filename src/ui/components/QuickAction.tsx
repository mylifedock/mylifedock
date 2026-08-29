import type { ReactNode } from "react";

type QuickActionProps = {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  accentBg?: string;
  accentColor?: string;
};

function QuickAction({
  icon,
  title,
  description,
  onClick,
  accentBg = "rgba(124, 58, 237, 0.1)",
  accentColor = "#a78bfa",
}: QuickActionProps) {
  return (
    <button className="quick-action" type="button" onClick={onClick}>
      <span className="quick-action-icon-box" style={{ background: accentBg, color: accentColor }}>
        {icon}
      </span>

      <span className="quick-action-content">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>

      <span className="quick-action-arrow">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14"/>
          <path d="m12 5 7 7-7 7"/>
        </svg>
      </span>
    </button>
  );
}

export default QuickAction;