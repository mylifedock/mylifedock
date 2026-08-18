import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import {
  getAttachment,
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
  const [downloadError, setDownloadError] = useState("");

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

  async function handleDownload() {
    setDownloadError("");

    try {
      /*
       * Fetch the attachment again so the download has its own
       * decrypted Blob and its own object URL.
       */
      const freshAttachment = await getAttachment(attachment.id);

      if (!freshAttachment?.blob) {
        throw new Error("Attachment data is missing.");
      }

      const downloadUrl = URL.createObjectURL(
        freshAttachment.blob,
      );

      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = freshAttachment.fileName;
      anchor.style.display = "none";

      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      /*
       * Keep the object URL alive long enough for Chromium
       * to start the download.
       */
      window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 10_000);
    } catch (error) {
      console.error(
        "Attachment download failed:",
        error,
      );

      setDownloadError(
        "Unable to download this attachment.",
      );
    }
  }

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

        <button
          type="button"
          onClick={handleDownload}
          className="attachment-download"
        >
          Download
        </button>
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

      {downloadError && (
        <div className="vault-error">
          {downloadError}
        </div>
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