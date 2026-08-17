type QuickActionProps = {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
};

function QuickAction({
  icon,
  title,
  description,
  onClick,
}: QuickActionProps) {
  return (
    <button className="quick-action" type="button" onClick={onClick}>
      <span className="quick-action-icon">{icon}</span>

      <span className="quick-action-content">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>

      <span className="quick-action-arrow">→</span>
    </button>
  );
}

export default QuickAction;