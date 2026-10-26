import { useEffect, useMemo } from "react";
import { useToast } from "./Toast";
import { canPreviewPdfInApp, saveFile, shareFile } from "../../platform/fileExport";

export interface PreviewFile {
  blob: Blob;
  fileName: string;
  mimeType: string;
}

/** In-app preview for a decrypted attachment, with Share and Download that work on every platform. */
export function AttachmentPreviewModal({ file, onClose }: { file: PreviewFile; onClose: () => void }) {
  const { showToast } = useToast();
  const url = useMemo(() => URL.createObjectURL(file.blob), [file.blob]);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleShare() {
    try {
      await shareFile(file.blob, file.fileName, file.mimeType);
    } catch {
      showToast("Unable to share this file.", "error");
    }
  }

  async function handleDownload() {
    try {
      if (await saveFile(file.blob, file.fileName)) showToast(`Saved ${file.fileName}`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to save this file.", "error");
    }
  }

  const isImage = file.mimeType.startsWith("image/");
  const isPdf = file.mimeType === "application/pdf";

  return (
    <div
      className="product-detail-overlay fade-in"
      style={{ zIndex: 99999, padding: "16px", display: "grid", placeItems: "center" }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${file.fileName}`}
        style={{
          maxWidth: "800px",
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          background: "#0f172a",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", flexWrap: "wrap", gap: "10px" }}>
          <strong style={{ fontSize: "15px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "300px" }}>
            {file.fileName}
          </strong>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button type="button" className="secondary-button" style={{ padding: "5px 12px", fontSize: "13px", color: "#38bdf8" }} onClick={handleShare}>
              Share
            </button>
            <button type="button" className="secondary-button" style={{ padding: "5px 12px", fontSize: "13px" }} onClick={handleDownload}>
              Download
            </button>
            <button type="button" className="secondary-button" style={{ padding: "4px 10px", fontSize: "14px" }} onClick={onClose} aria-label="Close preview" autoFocus>
              ✕
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", display: "grid", placeItems: "center", padding: "16px", background: "#090d16" }}>
          {isImage ? (
            <img src={url} alt={file.fileName} style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: "8px" }} />
          ) : isPdf && canPreviewPdfInApp() ? (
            <iframe src={url} title={file.fileName} style={{ width: "100%", height: "65vh", border: "none", borderRadius: "8px" }} />
          ) : (
            <div style={{ textAlign: "center", padding: "30px" }}>
              <p style={{ color: "#94a3b8" }}>
                {isPdf ? "Open this PDF in a PDF viewer app." : "Preview is not available in-app for this format."}
              </p>
              <button type="button" className="primary-button" onClick={isPdf ? handleShare : handleDownload}>
                {isPdf ? "Open with…" : "Download File"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
