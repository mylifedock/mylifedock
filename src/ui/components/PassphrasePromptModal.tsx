import { useEffect, useState } from "react";

interface PassphrasePromptModalProps {
  title: string;
  description: string;
  onSubmit: (passphrase: string) => void;
  onCancel: () => void;
}

/**
 * Masked passphrase / recovery-key prompt (replaces window.prompt, which shows
 * the secret in clear text and cannot be styled or labelled).
 */
export function PassphrasePromptModal({ title, description, onSubmit, onCancel }: PassphrasePromptModalProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="product-detail-overlay" role="presentation" style={{ zIndex: 1300 }}>
      <div
        className="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="passphrase-prompt-title"
        aria-describedby="passphrase-prompt-desc"
        style={{ maxWidth: "440px", width: "100%", margin: "auto", padding: "24px", background: "#111827", border: "1px solid rgba(56, 189, 248, 0.3)" }}
      >
        <h3 id="passphrase-prompt-title" style={{ marginTop: 0 }}>🔐 {title}</h3>
        <p id="passphrase-prompt-desc" style={{ fontSize: "13.5px", color: "#94a3b8" }}>{description}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onSubmit(value.trim());
          }}
        >
          <div className="form-field" style={{ marginBottom: "16px" }}>
            <label htmlFor="passphrase-prompt-input">Master Passphrase or Recovery Key</label>
            <input
              id="passphrase-prompt-input"
              type="password"
              autoComplete="current-password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button type="button" className="secondary-button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={!value.trim()}>
              Decrypt & Restore
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PassphrasePromptModal;
