type StatCardProps = {
  label: string;
  value: number;
  description: string;
  icon: string;
};

function StatCard({
  label,
  value,
  description,
  icon,
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-icon">{icon}</span>
        <span className="stat-value">{value}</span>
      </div>

      <div className="stat-label">{label}</div>
      <div className="stat-description">{description}</div>
    </div>
  );
}

export default StatCard;