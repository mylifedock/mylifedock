import { useState, useRef, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { useToast } from "./Toast";
import { 
  getAttachmentsForDocument, 
  addAttachment, 
  deleteAttachment, 
  getAttachment 
} from "../../application/attachmentService";
import { blobToBase64 } from "../../application/backupService";
import { isTauri, showSaveDialog, writeFileDesktop } from "../../platform/desktopBridge";

export function AttachmentManager({ entityId }: { entityId: string }) {
  const attachments = useLiveQuery(() => getAttachmentsForDocument(entityId), [entityId], []);
  const { showToast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<{ id: string; url: string; fileName: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewData?.url) {
        URL.revokeObjectURL(previewData.url);
      }
    };
  }, [previewData]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handlePreview(id: string, fileName: string, mimeType: string) {
    try {
      const freshAttachment = await getAttachment(id);
      if (!freshAttachment?.blob) throw new Error("Attachment data missing.");
      
      const url = URL.createObjectURL(freshAttachment.blob);
      setPreviewData({ id, url, fileName, mimeType });
    } catch {
      showToast("Unable to load preview for this attachment.", "error");
    }
  }

  async function handleShare(id: string, fileName: string, mimeType: string) {
    try {
      const freshAttachment = await getAttachment(id);
      if (!freshAttachment?.blob) throw new Error("Attachment data missing.");

      if (Capacitor.isNativePlatform()) {
        const base64Data = await blobToBase64(freshAttachment.blob);
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: fileName,
          url: savedFile.uri,
          dialogTitle: `Share ${fileName}`,
        });
      } else {
        const file = new File([freshAttachment.blob], fileName, { type: mimeType });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: fileName,
            files: [file],
          });
        } else {
          // Web share fallback
          await handleDownload(id, fileName);
          showToast("Web Share opened file download.", "info");
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        showToast("Unable to share attachment.", "error");
      }
    }
  }

  async function handleDownload(id: string, fileName: string) {
    try {
      const freshAttachment = await getAttachment(id);
      if (!freshAttachment?.blob) throw new Error("Attachment data missing.");
      
      if (Capacitor.isNativePlatform()) {
        const base64Data = await blobToBase64(freshAttachment.blob);
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: fileName,
          url: savedFile.uri,
          dialogTitle: `Save or Share ${fileName}`,
        });
      } else if (isTauri()) {
        const ext = fileName.includes(".") ? fileName.split(".").pop() || "" : "";
        const filePath = await showSaveDialog({
          defaultPath: fileName,
          filters: ext ? [{ name: `${ext.toUpperCase()} File`, extensions: [ext] }] : undefined,
        });
        if (filePath) {
          const arrayBuffer = await freshAttachment.blob.arrayBuffer();
          await writeFileDesktop(filePath, new Uint8Array(arrayBuffer));
          showToast(`Saved to ${fileName}`, "success");
        }
      } else {
        const downloadUrl = URL.createObjectURL(freshAttachment.blob);
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = fileName;
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 10_000);
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
        <label style={{ fontSize: "12px", fontWeight: "bold", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Attachments ({attachments?.length || 0})
        </label>
        <div>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />
          <button
            type="button"
            className="secondary-button"
            style={{ padding: "5px 10px", fontSize: "12px" }}
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
                <span style={{ fontSize: "16px" }}>{att.mimeType.startsWith("image/") ? "🖼️" : "📄"}</span>
                <span style={{ fontSize: "13.5px", color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={att.fileName}>
                  {att.fileName}
                </span>
              </div>

              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                <button 
                  type="button" 
                  className="text-button" 
                  style={{ fontSize: "12px", color: "#a78bfa", fontWeight: 600, padding: "2px 6px" }} 
                  onClick={() => handlePreview(att.id, att.fileName, att.mimeType)}
                >
                  👁️ Preview
                </button>
                <button 
                  type="button" 
                  className="text-button" 
                  style={{ fontSize: "12px", color: "#38bdf8", fontWeight: 500, padding: "2px 6px" }} 
                  onClick={() => handleShare(att.id, att.fileName, att.mimeType)}
                >
                  Share
                </button>
                <button 
                  type="button" 
                  className="text-button" 
                  style={{ fontSize: "12px", padding: "2px 6px" }} 
                  onClick={() => handleDownload(att.id, att.fileName)}
                >
                  Download
                </button>
                <button 
                  type="button" 
                  className="text-button" 
                  style={{ fontSize: "12px", padding: "2px 6px", color: "var(--color-danger)" }} 
                  onClick={() => handleDelete(att.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* On-Demand Fullscreen / Modal Lightbox Preview */}
      {previewData && (
        <div 
          className="product-detail-overlay fade-in"
          style={{ zIndex: 99999, padding: "16px", display: "grid", placeItems: "center" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewData(null);
          }}
        >
          <div 
            className="card" 
            style={{ 
              maxWidth: "800px", 
              width: "100%", 
              maxHeight: "90vh", 
              display: "flex", 
              flexDirection: "column",
              background: "#0f172a",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
              overflow: "hidden"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", flexWrap: "wrap", gap: "10px" }}>
              <strong style={{ fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "300px" }}>
                {previewData.fileName}
              </strong>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ padding: "4px 10px", fontSize: "12px", color: "#38bdf8" }}
                  onClick={() => handleShare(previewData.id, previewData.fileName, previewData.mimeType)}
                >
                  Share
                </button>
                <a 
                  href={previewData.url} 
                  download={previewData.fileName}
                  className="secondary-button" 
                  style={{ padding: "4px 10px", fontSize: "12px", textDecoration: "none" }}
                >
                  Download
                </a>
                <button 
                  type="button" 
                  className="secondary-button" 
                  style={{ padding: "4px 10px", fontSize: "14px" }}
                  onClick={() => setPreviewData(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: "auto", display: "grid", placeItems: "center", padding: "16px", background: "#090d16" }}>
              {previewData.mimeType.startsWith("image/") ? (
                <img 
                  src={previewData.url} 
                  alt={previewData.fileName} 
                  style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: "8px" }} 
                />
              ) : previewData.mimeType === "application/pdf" ? (
                <iframe 
                  src={previewData.url} 
                  title={previewData.fileName} 
                  style={{ width: "100%", height: "65vh", border: "none", borderRadius: "8px" }} 
                />
              ) : (
                <div style={{ textAlign: "center", padding: "30px" }}>
                  <p style={{ color: "#94a3b8" }}>Preview not directly supported in-app for this format.</p>
                  <a href={previewData.url} download={previewData.fileName} className="primary-button">
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AttachmentManager;
