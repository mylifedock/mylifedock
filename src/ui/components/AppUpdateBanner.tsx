import { useState, useEffect } from "react";
import { checkForAppUpdates, openPlayStoreUpdate, type AppUpdateInfo } from "../../application/updateService";

export function AppUpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void checkForAppUpdates().then((info) => {
      if (info.hasUpdate) {
        setUpdateInfo(info);
      }
    });
  }, []);

  if (!updateInfo || !updateInfo.hasUpdate || dismissed) {
    return null;
  }

  return (
    <div
      className="app-update-banner fade-in"
      style={{
        background: "linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)",
        borderBottom: "1px solid rgba(56, 189, 248, 0.3)",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "10px",
        fontSize: "13px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "18px" }}>🚀</span>
        <div>
          <strong style={{ color: "#fff" }}>
            New Update Available (v{updateInfo.latestVersion})
          </strong>
          <span style={{ color: "#94a3b8", marginLeft: "6px" }}>
            {updateInfo.dataSafetyNotice}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          onClick={openPlayStoreUpdate}
          style={{
            background: "#38bdf8",
            color: "#0f172a",
            fontWeight: 700,
            border: "none",
            borderRadius: "6px",
            padding: "6px 14px",
            fontSize: "12.5px",
            cursor: "pointer",
          }}
        >
          Update via Play Store
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            background: "transparent",
            color: "#94a3b8",
            border: "none",
            fontSize: "16px",
            cursor: "pointer",
            padding: "4px 8px",
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default AppUpdateBanner;
