import { useState } from "react";
import { useToast } from "../components/Toast";
import { getPlatform, isTauri, isCapacitor } from "../../platform/desktopBridge";

export function AboutPage() {
  const { showToast } = useToast();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const platform = getPlatform();
  const appVersion = "1.2.0";
  const buildDate = "October 2026";
  const supportEmail = "mylifedock@gmail.com";

  const faqs = [
    {
      q: "What should I do if I forget my Master Passphrase?",
      a: "Because MyLifeDock is built on Zero-Knowledge architecture, your passphrase is never stored on any server and cannot be reset via email. You must use your Emergency Recovery PDF / 24-Word Key created during setup to restore access."
    },
    {
      q: "Can anyone (including Google or MyLifeDock) read my vault?",
      a: "No. All documents, bank details, and attachments are encrypted locally on your device using AES-256-GCM before touching storage or Google Drive. Only your master passphrase holds the cryptographic key."
    },
    {
      q: "How do I move my vault to a new computer or phone?",
      a: "Go to Settings -> 'Local Backup & Export' to save a password-protected .mldv backup file, or use 'Backup to Google Drive'. On your new device, install MyLifeDock and click 'Restore from Drive' or 'Import File'."
    },
    {
      q: "Does MyLifeDock require an internet connection?",
      a: "No! MyLifeDock is 100% offline-first. All features, document storage, optical character recognition (OCR), and search function completely without an internet connection."
    },
    {
      q: "How does the Auto-Lock and Privacy Shield protect my data?",
      a: "MyLifeDock includes military-grade security locking: it locks immediately when you press Home, switch apps, or open Recent Apps (where Android FLAG_SECURE blocks preview thumbnails and screenshots), plus customizable inactivity timeouts (1m to 60m) and brute-force rate-limiting lockout penalties."
    }
  ];

  async function generateDiagnosticReport(): Promise<string> {
    let storageInfo = "Storage API unavailable";
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const usedMB = estimate.usage ? (estimate.usage / (1024 * 1024)).toFixed(2) : "0";
        const quotaMB = estimate.quota ? (estimate.quota / (1024 * 1024)).toFixed(0) : "Unknown";
        storageInfo = `${usedMB} MB used (Quota: ${quotaMB} MB)`;
      }
    } catch {
      storageInfo = "Storage estimate check failed";
    }

    const hasCrypto = typeof window !== "undefined" && Boolean(window.crypto?.subtle);
    const hasWasm = typeof WebAssembly !== "undefined";
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    return [
      `=== MyLifeDock System Diagnostic Report ===`,
      `App Version: ${appVersion} (${buildDate})`,
      `Platform: ${platform.toUpperCase()} (Tauri: ${isTauri()}, Capacitor: ${isCapacitor()})`,
      `Online Status: ${isOnline ? "Online (Connected)" : "Offline (Local Only)"}`,
      `Crypto Engine: ${hasCrypto ? "Web Crypto API (Active AES-GCM)" : "Unavailable"}`,
      `WebAssembly (OCR Engine): ${hasWasm ? "Supported (Ready)" : "Unsupported"}`,
      `Storage Usage: ${storageInfo}`,
      `Screen / Viewport: ${window.innerWidth}x${window.innerHeight} (DPR: ${window.devicePixelRatio || 1})`,
      `User Agent: ${navigator.userAgent}`,
      `Report Generated: ${new Date().toISOString()}`,
      `===========================================`
    ].join("\n");
  }

  async function copyDiagnostics() {
    try {
      const report = await generateDiagnosticReport();
      await navigator.clipboard.writeText(report);
      showToast("Comprehensive diagnostic report copied to clipboard!", "success");
    } catch {
      showToast("Failed to copy report to clipboard.", "error");
    }
  }

  async function handleEmailSupport() {
    const report = await generateDiagnosticReport();
    const subject = encodeURIComponent(`[Support Request] MyLifeDock v${appVersion} - ${platform.toUpperCase()}`);
    const body = encodeURIComponent(
      `Hello MyLifeDock Support,\n\n[Please describe your issue or question here]\n\n\n--- Diagnostic Info ---\n${report}\n`
    );
    window.location.assign(`mailto:${supportEmail}?subject=${subject}&body=${body}`);
  }

  return (
    <div className="page-container fade-in" style={{ maxWidth: "880px", margin: "0 auto" }}>
      {/* Header / Brand Card */}
      <div className="card fade-in" style={{ textAlign: "center", padding: "36px 20px", marginBottom: "24px" }}>
        <div 
          className="brand-logo" 
          style={{ width: "56px", height: "56px", margin: "0 auto 16px auto", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        </div>
        <h1 style={{ fontSize: "2rem", margin: "0 0 8px 0" }}>
          MyLife<span className="brand-accent">Dock</span>
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "14px", margin: "0 0 16px 0" }}>
          Version {appVersion} (Production Release) • {buildDate}
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <span style={{ background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", padding: "5px 14px", borderRadius: "16px", fontSize: "13px", fontWeight: 600 }}>
            🔒 AES-256-GCM Zero-Knowledge
          </span>
          <span style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", padding: "5px 14px", borderRadius: "16px", fontSize: "13px", fontWeight: 600 }}>
            🛡️ 100% Offline-First
          </span>
          <span style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", padding: "5px 14px", borderRadius: "16px", fontSize: "13px", fontWeight: 600 }}>
            🚫 Zero Telemetry
          </span>
        </div>
      </div>

      {/* About Mission Card */}
      <div className="card fade-in" style={{ marginBottom: "24px" }}>
        <div className="card-header">
          <h3>🌟 About MyLifeDock</h3>
        </div>
        <div className="card-body">
          <p>
            <strong>MyLifeDock</strong> was created to give individuals and families complete sovereignty over their most critical personal, financial, and legal records.
          </p>
          <p style={{ color: "#94a3b8", marginTop: "8px" }}>
            Unlike traditional cloud apps that harvest data or store plaintext files on corporate servers, MyLifeDock runs entirely on your device. Every file and note is encrypted locally with your master passphrase using military-grade AES-256 before touching storage.
          </p>
        </div>
      </div>

      {/* Founder & Architect Card */}
      <div className="card fade-in" style={{ marginBottom: "24px", border: "1px solid rgba(56, 189, 248, 0.25)", background: "linear-gradient(135deg, rgba(56, 189, 248, 0.05) 0%, rgba(15, 23, 42, 0.6) 100%)" }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <span>👨‍💻</span> Built by Founder & Architect
          </h3>
          <a
            href="https://www.linkedin.com/in/bssdinesh"
            target="_blank"
            rel="noopener noreferrer"
            className="secondary-button"
            style={{ fontSize: "12.5px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.4)" }}
          >
            <span>🔗</span> Connect on LinkedIn &rarr;
          </a>
        </div>
        <div className="card-body">
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid #38bdf8",
                boxShadow: "0 0 16px rgba(14, 165, 233, 0.4)",
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                flexShrink: 0,
              }}
            >
              <img
                src="/founder.jpg"
                alt="B.S.S. Dinesh - Founder"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                  const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "grid";
                }}
              />
              <span style={{ display: "none", color: "#ffffff", fontWeight: 700, fontSize: "18px" }}>
                BD
              </span>
            </div>
            <div>
              <strong style={{ fontSize: "16px", color: "#f8fafc" }}>B.S.S. Dinesh</strong>
              <div style={{ color: "#38bdf8", fontSize: "13px", fontWeight: 500 }}>
                Creator & Privacy Engineer, MyLifeDock
              </div>
            </div>
          </div>
          <p style={{ color: "#cbd5e1", fontSize: "13.5px", lineHeight: "1.6" }}>
            &ldquo;I designed MyLifeDock on a non-negotiable principle: your most sensitive life records, health prescriptions, and financial documents should belong exclusively to you. In an era where big tech clouds analyze personal files, MyLifeDock guarantees mathematical zero-knowledge privacy with 100% on-device encryption.&rdquo;
          </p>
        </div>
      </div>

      {/* Self-Service Support & FAQ */}
      <div className="card fade-in" style={{ marginBottom: "24px" }}>
        <div className="card-header">
          <h3>❓ Frequently Asked Questions (Self-Help)</h3>
        </div>
        <div className="card-body">
          <p style={{ color: "#94a3b8", marginBottom: "16px" }}>
            Quick solutions to the most common questions:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {faqs.map((faq, index) => {
              const isExpanded = expandedFaq === index;
              return (
                <div 
                  key={index} 
                  style={{ 
                    border: "1px solid var(--border-color, #1e293b)", 
                    borderRadius: "8px", 
                    overflow: "hidden",
                    background: "rgba(255, 255, 255, 0.02)" 
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isExpanded ? null : index)}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      color: "var(--text-primary, #f8fafc)",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <span>{faq.q}</span>
                    <span style={{ color: "var(--color-accent, #38bdf8)", fontSize: "18px" }}>
                      {isExpanded ? "−" : "+"}
                    </span>
                  </button>
                  {isExpanded && (
                    <div style={{ padding: "0 16px 14px 16px", color: "#94a3b8", fontSize: "14px", lineHeight: "1.6" }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* System Diagnostics & Contact Support */}
      <div className="card fade-in" style={{ marginBottom: "24px" }}>
        <div className="card-header">
          <h3>🛠️ System Diagnostics & Contact Support</h3>
        </div>
        <div className="card-body">
          <p>
            Need assistance or have feedback? You can contact our support channel directly.
          </p>
          
          <div style={{ 
            background: "#0b0f19", 
            padding: "14px 18px", 
            borderRadius: "8px", 
            border: "1px solid #1e293b",
            margin: "16px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px"
          }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>Platform Environment:</div>
              <div style={{ fontSize: "13.5px", color: "#38bdf8", marginTop: "2px" }}>{platform.toUpperCase()} • MyLifeDock v{appVersion}</div>
            </div>
            <button 
              type="button" 
              className="secondary-button"
              onClick={copyDiagnostics}
              style={{ fontSize: "13.5px", padding: "6px 14px" }}
            >
              📋 Copy Diagnostic Report
            </button>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "16px" }}>
            <button 
              type="button" 
              className="primary-button"
              onClick={handleEmailSupport}
            >
              ✉️ Email Support ({supportEmail})
            </button>
          </div>
        </div>
      </div>

      {/* Legal & Security Footer */}
      <div style={{ textAlign: "center", color: "#64748b", fontSize: "13px", padding: "16px 0" }}>
        <p>Cryptographic standards: FIPS 197 AES-GCM (256-bit) • NIST SP 800-132 PBKDF2</p>
        <p style={{ marginTop: "4px" }}>© 2026 MyLifeDock. All rights reserved. Privacy-First Life Vault.</p>
      </div>
    </div>
  );
}

export default AboutPage;
