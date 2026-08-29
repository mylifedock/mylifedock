import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: number;
  description: string;
  icon: ReactNode;
  accentColor?: string;
  accentBg?: string;
  onClick?: () => void;
};

function StatCard({
  label,
  value,
  description,
  icon,
  accentColor = "#818cf8",
  accentBg = "rgba(99, 102, 241, 0.12)",
  onClick,
}: StatCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <div 
      className={`stat-card ${isClickable ? "stat-card-clickable" : ""}`}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      style={{ cursor: isClickable ? "pointer" : "default" }}
    >
      <div className="stat-card-top">
        <div 
          className="stat-icon-wrapper"
          style={{ color: accentColor, background: accentBg }}
        >
          {icon}
        </div>
        <span className="stat-value">{value}</span>
      </div>

      <div className="stat-label">{label}</div>
      <div className="stat-description">{description}</div>
    </div>
  );
}

export default StatCard;