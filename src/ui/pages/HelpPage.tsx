import { useState } from "react";
import { useToast } from "../components/Toast";
import { PageHeader } from "../components/PageHeader";
import { getPlatform } from "../../platform/desktopBridge";
import { openExternalUrl } from "../../platform/fileExport";
import { PRICING_CONFIG } from "../../config/pricingConfig";
import founderPhoto from "../../assets/founder.jpg";

type FeedbackCategory = "Bug report" | "Feature request" | "Question" | "Review";

const CATEGORIES: { label: FeedbackCategory; icon: string }[] = [
  { label: "Bug report", icon: "🐞" },
  { label: "Feature request", icon: "💡" },
  { label: "Question", icon: "❓" },
  { label: "Review", icon: "⭐" },
];

const FAQS = [
  {
    q: "I forgot my Master Passphrase. What can I do?",
    a: "Unlock with the 64-character Recovery Key you saved when you created the vault. Nobody, including MyLifeDock, can reset your passphrase or read your vault without one of the two.",
  },
  {
    q: "Can anyone else read my vault?",
    a: "No. Records and files are encrypted on your device with AES-256-GCM before they are stored or backed up. Google Drive only ever receives the encrypted backup file.",
  },
  {
    q: "How do I move to a new phone or computer?",
    a: "Go to Settings & Backup → Backup & Sync. Export an encrypted .mldv file or back up to Google Drive, then choose Restore on the new device and enter your passphrase.",
  },
  {
    q: "Does the app need the internet?",
    a: "No. Everything works offline, including receipt scanning. The internet is only used for Google Drive backup and for buying Pro.",
  },
  {
    q: "What happens if I uninstall the app?",
    a: "Your vault lives only on this device, so uninstalling deletes it. Make a backup first, and restore it after reinstalling.",
  },
  {
    q: "Why does the vault lock when I switch apps?",
    a: "So nobody can see your records in the app switcher or on an unattended phone. Opening the camera, file picker or share sheet from inside the app does not lock it. You can change this in Settings & Backup → Security.",
  },
];

function diagnostics(): string {
  return [
    `App version: ${__APP_VERSION__}`,
    `Platform: ${getPlatform()}`,
    `Screen: ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`,
    `Online: ${navigator.onLine ? "yes" : "no"}`,
    `Date: ${new Date().toISOString()}`,
  ].join("\n");
}

/** About, FAQ, feedback and support in one place. */
export function HelpPage() {
  const { showToast } = useToast();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>("Bug report");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const supportEmail = PRICING_CONFIG.supportEmail;

  function emailBody(): { subject: string; body: string } {
    const fullSubject = `[MyLifeDock ${category}] ${subject.trim() || "Feedback"}`;
    const body = [message.trim(), includeDiagnostics ? `\n\n--- Technical info (no personal data) ---\n${diagnostics()}` : ""].join("");
    return { subject: fullSubject, body };
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    const { subject: s, body } = emailBody();
    try {
      await openExternalUrl(`mailto:${supportEmail}?subject=${encodeURIComponent(s)}&body=${encodeURIComponent(body)}`);
      showToast("Your email app is open with the message ready to send.", "success");
    } catch {
      showToast(`No email app was found. Use Copy and send it to ${supportEmail}.`, "error");
    }
  }

  async function handleCopy() {
    const { subject: s, body } = emailBody();
    try {
      await navigator.clipboard.writeText(`To: ${supportEmail}\nSubject: ${s}\n\n${body}`);
      showToast("Copied. Paste it into any email app.", "info");
    } catch {
      showToast("Copying is not available here.", "error");
    }
  }

  return (
    <div className="page-container fade-in help-page">
      <PageHeader title="Help & Feedback" subtitle={`MyLifeDock ${__APP_VERSION__} · ${getPlatform()}`} />

      <section className="card fade-in">
        <div className="card-header">
          <h3>Frequently asked questions</h3>
        </div>
        <div className="card-body faq-list">
          {FAQS.map((faq, index) => {
            const isExpanded = expandedFaq === index;
            return (
              <div key={faq.q} className="faq-item">
                <button
                  type="button"
                  className="faq-question"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedFaq(isExpanded ? null : index)}
                >
                  <span>{faq.q}</span>
                  <span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                </button>
                {isExpanded && <p className="faq-answer">{faq.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card fade-in" aria-labelledby="feedback-title">
        <div className="card-header">
          <h3 id="feedback-title">Send feedback or ask for help</h3>
        </div>
        <div className="card-body">
          <p className="muted-text">Your message opens in your own email app, addressed to {supportEmail}. The app sends nothing by itself.</p>
          <form onSubmit={handleSend} className="record-form">
            <div className="chip-row" role="radiogroup" aria-label="Feedback type">
              {CATEGORIES.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  role="radio"
                  aria-checked={category === c.label}
                  className={`chip ${category === c.label ? "active" : ""}`}
                  onClick={() => setCategory(c.label)}
                >
                  <span aria-hidden="true">{c.icon}</span> {c.label}
                </button>
              ))}
            </div>
            <div className="form-grid">
              <div className="form-field form-field-full">
                <label htmlFor="fb-subject">Subject</label>
                <input id="fb-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Backup failed on my phone" />
              </div>
              <div className="form-field form-field-full">
                <label htmlFor="fb-message">Message</label>
                <textarea id="fb-message" required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What happened, or what would you like to see?" />
              </div>
              <div className="form-field form-field-full form-field-checkbox">
                <input id="fb-diag" type="checkbox" checked={includeDiagnostics} onChange={(e) => setIncludeDiagnostics(e.target.checked)} />
                <label htmlFor="fb-diag">Include app version and device type (no personal data)</label>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={!message.trim()}>
                Open in email app
              </button>
              <button type="button" className="secondary-button" onClick={() => void handleCopy()}>
                Copy message
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="card fade-in about-card">
        <div className="card-body about-founder">
          <img src={founderPhoto} alt="B.S.S. Dinesh" width={56} height={56} />
          <div>
            <strong>Built by B.S.S. Dinesh</strong>
            <p className="muted-text">
              MyLifeDock keeps your family's records on your own device, encrypted, with no account and no tracking.
            </p>
            <button
              type="button"
              className="text-button"
              onClick={() => void openExternalUrl("https://in.linkedin.com/in/srisaidineshbollupalli")}
            >
              Connect on LinkedIn →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HelpPage;
