import { useEffect } from "react";

export type LegalDoc = "privacy" | "terms";

const TITLES: Record<LegalDoc, string> = {
  privacy: "Privacy Policy",
  terms: "Terms of Service",
};

/**
 * Shows the bundled privacy policy / terms (public/privacy.html, public/terms.html)
 * in-app. Works offline on every platform and keeps onboarding state intact.
 */
export function LegalDocModal({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const title = doc === "terms" ? TITLES.terms : TITLES.privacy;
  const src = `${import.meta.env.BASE_URL}${doc === "terms" ? "terms" : "privacy"}.html`;

  return (
    <div
      className="product-detail-overlay"
      role="presentation"
      style={{ zIndex: 1400 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: "100%", maxWidth: "760px", height: "min(86vh, 900px)", margin: "auto", padding: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "#111827" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 style={{ margin: 0, fontSize: "17px" }}>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={`Close ${title}`} autoFocus>
            ✕
          </button>
        </div>
        <iframe title={title} src={src} style={{ flex: 1, width: "100%", border: 0, background: "#0a0e1a" }} />
      </section>
    </div>
  );
}

export default LegalDocModal;
