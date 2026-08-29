import { useLiveQuery } from "dexie-react-hooks";
import { getAttachmentsForDocument } from "../../application/attachmentService";
import type { DocumentRecord } from "../../infrastructure/database/db";

interface DocumentCardProps {
  document: DocumentRecord;
  onDelete: (id: string) => void;
  onView?: () => void;
  onEdit?: () => void;
}

function DocumentCard({
  document,
  onDelete,
  onView,
  onEdit,
}: DocumentCardProps) {
  const attachments = useLiveQuery(
    () => getAttachmentsForDocument(document.id),
    [document.id],
    []
  );

  return (
    <div 
      className="card fade-in document-card"
      style={{
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        cursor: onView ? "pointer" : "default",
      }}
      onClick={(e) => {
        // If not clicking an action button, open view
        if ((e.target as HTMLElement).closest("button")) return;
        if (onView) onView();
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div 
            style={{ 
              width: "36px", 
              height: "36px", 
              borderRadius: "10px", 
              background: "rgba(167, 139, 250, 0.12)", 
              color: "#a78bfa", 
              display: "grid", 
              placeItems: "center", 
              fontSize: "18px",
              flexShrink: 0
            }}
          >
            📄
          </div>
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: "15px", color: "#f8fafc", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {document.title}
            </strong>
            <small style={{ color: "#94a3b8", fontSize: "12px" }}>
              {document.category.toUpperCase()} {document.issuer ? `• ${document.issuer}` : ""}
            </small>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {document.expiryDate && (
            <span style={{ fontSize: "11px", color: "#f59e0b", background: "rgba(245, 158, 11, 0.1)", padding: "2px 8px", borderRadius: "6px", fontWeight: 500 }}>
              Expires: {document.expiryDate}
            </span>
          )}
          <span className={`sensitivity-badge sensitivity-${document.sensitivity}`}>
            {document.sensitivity}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
          {attachments && attachments.length > 0 && (
            <span 
              style={{
                fontSize: "12px",
                color: "#c084fc",
                background: "rgba(192, 132, 252, 0.12)",
                border: "1px solid rgba(192, 132, 252, 0.25)",
                padding: "3px 8px",
                borderRadius: "6px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              📎 {attachments.length} {attachments.length === 1 ? "Attachment" : "Attachments"}
            </span>
          )}

          {document.tags && document.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="document-tag">
              #{tag}
            </span>
          ))}
          {document.tags && document.tags.length > 3 && (
            <span style={{ fontSize: "11px", color: "#64748b" }}>+{document.tags.length - 3}</span>
          )}
        </div>

        <div className="document-card-actions" style={{ margin: 0 }}>
          {onView && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onView(); }}
              className="text-button"
              style={{ color: "#a78bfa", fontWeight: 600 }}
            >
              👁️ View / Preview
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="text-button"
            >
              Edit
            </button>
          )}

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(document.id); }}
            className="text-button"
            style={{ color: "var(--color-danger)" }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default DocumentCard;