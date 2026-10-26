import { useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "./Toast";
import {
  getAttachmentsForDocument,
  addAttachment,
  deleteAttachment,
  getAttachment
} from "../../application/attachmentService";
import { saveFile, shareFile } from "../../platform/fileExport";
import { AttachmentPreviewModal, type PreviewFile } from "./AttachmentPreviewModal";

export function AttachmentManager({ entityId }: { entityId: string }) {
  const attachments = useLiveQuery(() => getAttachmentsForDocument(entityId), [entityId], []);
  const { showToast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const files = input.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const fileList = Array.from(files);
      for (const file of fileList) {
        await addAttachment({ documentId: entityId, file });
      }
      showToast(`${fileList.length} file(s) attached securely`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error attaching files", "error");
    } finally {
      setIsUploading(false);
      input.value = "";
    }
  }

  async function loadBlob(id: string): Promise<Blob> {
    const freshAttachment = await getAttachment(id);
    if (!freshAttachment?.blob) throw new Error("Attachment data missing.");
    return freshAttachment.blob;
  }

  async function handlePreview(id: string, fileName: string, mimeType: string) {
    try {
      setPreviewFile({ blob: await loadBlob(id), fileName, mimeType });
    } catch {
      showToast("Unable to load preview for this attachment.", "error");
    }
  }

  async function handleShare(id: string, fileName: string, mimeType: string) {
    try {
      await shareFile(await loadBlob(id), fileName, mimeType);
    } catch {
      showToast("Unable to share attachment.", "error");
    }
  }

  async function handleDownload(id: string, fileName: string) {
    try {
      if (await saveFile(await loadBlob(id), fileName)) {
        showToast(`Saved ${fileName}`, "success");
      }
    } catch {
      showToast("Unable to download this attachment.", "error");
    }
  }

  async function handleDelete(id: string) {
    if (window.confirm("Remove this attachment?")) {
      await deleteAttachment(id);
      showToast("Attachment removed", "success");
    }
  }

  return (
    <div className="attachment-manager">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <span style={{ fontSize: "13px", fontWeight: "bold", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Attachments ({attachments?.length || 0})
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            ref={fileInputRef}
            style={{ display: "none" }}
            aria-label="Attach files"
            onChange={handleFileSelect}
          />
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            style={{ display: "none" }}
            aria-label="Take a photo"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            className="secondary-button"
            style={{ padding: "6px 12px", fontSize: "13px", background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.2)" }}
            onClick={() => cameraInputRef.current?.click()}
            disabled={isUploading}
          >
            📷 Snap Photo
          </button>
          <button
            type="button"
            className="secondary-button"
            style={{ padding: "6px 12px", fontSize: "13px" }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? "Encrypting..." : "+ Attach Files"}
          </button>
        </div>
      </div>

      {attachments && attachments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {attachments.map(att => (
            <div
              key={att.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: "8px",
                flexWrap: "wrap",
                gap: "8px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden", minWidth: "160px", flex: 1 }}>
                <span style={{ fontSize: "16px" }} aria-hidden="true">{att.mimeType.startsWith("image/") ? "🖼️" : "📄"}</span>
                <span style={{ fontSize: "13.5px", color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={att.fileName}>
                  {att.fileName}
                </span>
              </div>

              <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="text-button"
                  style={{ fontSize: "13px", color: "#a78bfa", fontWeight: 600, padding: "2px 6px" }}
                  onClick={() => handlePreview(att.id, att.fileName, att.mimeType)}
                >
                  👁️ Preview
                </button>
                <button
                  type="button"
                  className="text-button"
                  style={{ fontSize: "13px", color: "#38bdf8", fontWeight: 500, padding: "2px 6px" }}
                  onClick={() => handleShare(att.id, att.fileName, att.mimeType)}
                >
                  Share
                </button>
                <button
                  type="button"
                  className="text-button"
                  style={{ fontSize: "13px", padding: "2px 6px" }}
                  onClick={() => handleDownload(att.id, att.fileName)}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="text-button"
                  style={{ fontSize: "13px", padding: "2px 6px", color: "var(--color-danger)" }}
                  onClick={() => handleDelete(att.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewFile && <AttachmentPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}

export default AttachmentManager;
