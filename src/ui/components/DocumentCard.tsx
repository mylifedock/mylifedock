import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import {
  getAttachmentsForDocument,
} from "../../application/attachmentService";

import type { DocumentRecord } from "../../infrastructure/database/db";

type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  blob?: Blob;
};

function AttachmentPreview({
  attachment,
}: {
  attachment: Attachment;
}) {
  const url = useMemo(() => {
    if (!attachment.blob) {
      return "";
    }

    return URL.createObjectURL(attachment.blob);
  }, [attachment.blob]);

  useEffect(() => {
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [url]);

  if (!url) {
    return (
      <div className="attachment-preview">
        <div className="attachment-header">
          <span>📎 {attachment.fileName}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="attachment-preview">
      <div className="attachment-header">
        <span>📎 {attachment.fileName}</span>

        <a
          href={url}
          download={attachment.fileName}
          className="attachment-download"
        >
          Download
        </a>
      </div>

      {attachment.mimeType.startsWith("image/") && (
        <img
          src={url}
          alt={attachment.fileName}
          className="attachment-image"
        />
      )}

      {attachment.mimeType === "application/pdf" && (
        <iframe
          src={url}
          title={attachment.fileName}
          className="attachment-pdf"
        />
      )}
    </div>
  );
}

function DocumentCard({
  document,
  onDelete,
}: {
  document: DocumentRecord;
  onDelete: (id: string) => void;
}) {
  const attachments = useLiveQuery(
    () => getAttachmentsForDocument(document.id),
    [document.id],
    [],
  );

  return (
    <div className="quick-action document-card">
      <span className="quick-action-icon">▣</span>

      <div className="quick-action-content">
        <strong>{document.title}</strong>

        <small>
          {document.category}

          {document.expiryDate
            ? ` · Expires ${document.expiryDate}`
            : ""}
        </small>

        {attachments.length > 0 && (
          <div className="document-attachments">
            {attachments.map((attachment) => (
              <AttachmentPreview
                key={attachment.id}
                attachment={attachment}
              />
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDelete(document.id)}
        className="document-delete"
      >
        Delete
      </button>
    </div>
  );
}

export default DocumentCard;