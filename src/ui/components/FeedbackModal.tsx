import { useState } from "react";
import { useToast } from "./Toast";
import { getPlatform, isTauri, isCapacitor } from "../../platform/desktopBridge";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackCategory = "Feature Request" | "Bug Report" | "General Review" | "Question & Help";

const CATEGORIES: { label: FeedbackCategory; icon: string; description: string }[] = [
  { label: "Feature Request", icon: "💡", description: "Suggest a new capability or improvement" },
  { label: "Bug Report", icon: "🐞", description: "Report something that isn't working as expected" },
  { label: "General Review", icon: "⭐", description: "Share your experience or words of encouragement" },
  { label: "Question & Help", icon: "❓", description: "Ask for guidance on using your vault" },
];

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { showToast } = useToast();
  const [category, setCategory] = useState<FeedbackCategory>("Feature Request");
  const [rating, setRating] = useState<number>(5);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const platform = getPlatform();
  const appVersion = "1.2.0";
  const founderEmail = "mylifedock@gmail.com";

  function getDiagnosticSummary(): string {
    return [
      `App Version: MyLifeDock v${appVersion}`,
      `Platform: ${platform.toUpperCase()} (Tauri: ${isTauri()}, Capacitor: ${isCapacitor()})`,
      `Viewport: ${window.innerWidth}x${window.innerHeight} (DPR: ${window.devicePixelRatio || 1})`,
      `Online Status: ${navigator.onLine ? "Online" : "Offline"}`,
      `Timestamp: ${new Date().toISOString()}`,
      `Privacy: 100% Zero-Knowledge Verified (Zero personal records/keys included)`,
    ].join("\n");
  }

  function generateEmailPayload() {
    const formattedSubject = `[MyLifeDock Feedback] ${category}: ${subject.trim() || "User Feedback"}`;
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

    const bodyLines = [
      `NEW USER FEEDBACK FOR FOUNDER`,
      `==================================================`,
      `Category    : ${category}`,
      `Rating      : ${stars} (${rating} / 5)`,
      `Subject     : ${subject.trim() || "No Subject"}`,
      `From        : ${name.trim() || "App User"} ${email.trim() ? `<${email.trim()}>` : ""}`,
      `Date        : ${new Date().toLocaleString()}`,
      `Platform    : ${platform.toUpperCase()}`,
      `==================================================`,
      ``,
      `DETAILED FEEDBACK:`,
      message.trim() || "(No message written)",
      ``,
    ];

    if (includeDiagnostics) {
      bodyLines.push(`--- SYSTEM DIAGNOSTICS ---`);
      bodyLines.push(getDiagnosticSummary());
    }

    return {
      formattedSubject,
      body: bodyLines.join("\n"),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      showToast("Please enter your feedback message.", "error");
      return;
    }

    setIsSubmitting(true);
    const { formattedSubject, body } = generateEmailPayload();

    // Check if custom Google Apps Script Webhook URL is stored
    const webhookUrl = localStorage.getItem("mld_webhook_mailer_url");
    let sentViaWebhook = false;

    if (webhookUrl && navigator.onLine) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "feedback",
            category,
            rating,
            subject: subject.trim(),
            name: name.trim(),
            email: email.trim(),
            message: message.trim(),
            diagnostics: includeDiagnostics ? getDiagnosticSummary() : undefined,
            platform,
          }),
          mode: "no-cors",
        });
        sentViaWebhook = true;
      } catch {
        // Fall back to mailto launcher
      }
    }

    // Launch mailto link so user's email client directly dispatches to founder
    const mailtoUrl = `mailto:${founderEmail}?subject=${encodeURIComponent(formattedSubject)}&body=${encodeURIComponent(body)}`;
    window.location.assign(mailtoUrl);

    showToast(
      sentViaWebhook
        ? "🎉 Feedback dispatched and email client launched!"
        : `Email client opened with subject: "${formattedSubject}"`,
      "success"
    );

    setIsSubmitting(false);
    onClose();
  }

  function handleCopyFeedback() {
    const { formattedSubject, body } = generateEmailPayload();
    const fullText = `To: ${founderEmail}\nSubject: ${formattedSubject}\n\n${body}`;
    void navigator.clipboard.writeText(fullText).then(() => {
      showToast("Feedback text and subject copied to clipboard! You can paste it into Gmail/Outlook.", "info");
    });
  }

  return (
    <div
      className="product-detail-overlay fade-in"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ zIndex: 1250 }}
    >
      <section
        className="product-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        style={{
          maxWidth: "520px",
          width: "95%",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#0d1322",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.15)",
        }}
      >
        {/* Header */}
        <div
          className="product-detail-header"
          style={{
            borderBottom: "1px solid rgba(56, 189, 248, 0.2)",
            background: "linear-gradient(to right, rgba(56, 189, 248, 0.08), transparent)",
            padding: "18px 22px",
          }}
        >
          <div>
            <span
              className="eyebrow"
              style={{ color: "#38bdf8", fontWeight: 700, letterSpacing: "0.08em" }}
            >
              💬 FOUNDER FEEDBACK & SUGGESTIONS
            </span>
            <h2 id="feedback-modal-title" style={{ color: "#fff", margin: "4px 0 0 0", fontSize: "20px" }}>
              Share Your Thoughts
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close feedback modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 22px" }}>
          {/* Category Chips */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: "8px", textTransform: "uppercase" }}>
              Feedback Category
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {CATEGORIES.map((c) => {
                const isSelected = category === c.label;
                return (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => setCategory(c.label)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: isSelected ? "1.5px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                      background: isSelected ? "rgba(56, 189, 248, 0.12)" : "rgba(15, 23, 42, 0.6)",
                      color: isSelected ? "#38bdf8" : "#cbd5e1",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "12.5px",
                      fontWeight: isSelected ? 700 : 500,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Star Rating */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: "6px", textTransform: "uppercase" }}>
              Experience Rating
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    padding: "2px",
                    color: star <= rating ? "#facc15" : "#475569",
                    transition: "transform 0.1s ease",
                  }}
                  title={`${star} Star${star > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
              <span style={{ fontSize: "13px", color: "#94a3b8", marginLeft: "8px" }}>
                ({rating} of 5 stars)
              </span>
            </div>
          </div>

          {/* Subject Line */}
          <div className="form-field" style={{ marginBottom: "14px" }}>
            <label htmlFor="fb-subject" style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
              Topic / Summary
            </label>
            <input
              id="fb-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Export to Excel option, Camera OCR speed..."
              style={{
                width: "100%",
                padding: "9px 12px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "13.5px",
              }}
            />
          </div>

          {/* Detailed Message */}
          <div className="form-field" style={{ marginBottom: "14px" }}>
            <label htmlFor="fb-message" style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
              Detailed Feedback <span style={{ color: "#f87171" }}>*</span>
            </label>
            <textarea
              id="fb-message"
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what you like, what is confusing, or what features you would love to see..."
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "13.5px",
                resize: "vertical",
              }}
            />
          </div>

          {/* Optional Name & Email */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div className="form-field">
              <label htmlFor="fb-name" style={{ fontSize: "11.5px", fontWeight: 600, color: "#94a3b8" }}>
                Your Name (Optional)
              </label>
              <input
                id="fb-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "6px",
                  color: "#fff",
                  fontSize: "13px",
                }}
              />
            </div>
            <div className="form-field">
              <label htmlFor="fb-email" style={{ fontSize: "11.5px", fontWeight: 600, color: "#94a3b8" }}>
                Your Email (Optional, for reply)
              </label>
              <input
                id="fb-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "6px",
                  color: "#fff",
                  fontSize: "13px",
                }}
              />
            </div>
          </div>

          {/* Include Diagnostics Checkbox */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              padding: "10px 12px",
              background: "rgba(56, 189, 248, 0.05)",
              border: "1px solid rgba(56, 189, 248, 0.15)",
              borderRadius: "6px",
              marginBottom: "20px",
            }}
          >
            <input
              id="fb-diag"
              type="checkbox"
              checked={includeDiagnostics}
              onChange={(e) => setIncludeDiagnostics(e.target.checked)}
              style={{ marginTop: "2px", accentColor: "#38bdf8", cursor: "pointer" }}
            />
            <label htmlFor="fb-diag" style={{ fontSize: "12px", color: "#cbd5e1", cursor: "pointer", lineHeight: "1.4" }}>
              Include technical environment info (Platform: {platform.toUpperCase()}, v{appVersion}).
              <span style={{ display: "block", color: "#94a3b8", fontSize: "11px", marginTop: "2px" }}>
                🔒 Zero-Knowledge Guarantee: No personal files, notes, or encryption keys are ever shared.
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <button
              type="button"
              className="text-button"
              onClick={handleCopyFeedback}
              style={{ fontSize: "12px", color: "#38bdf8", padding: 0 }}
            >
              📋 Copy Text & Subject
            </button>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{ fontSize: "13px", padding: "8px 14px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={!message.trim() || isSubmitting}
                style={{
                  fontSize: "13px",
                  padding: "8px 18px",
                  background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>🚀 Send to Founder ({founderEmail})</span>
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

export default FeedbackModal;
