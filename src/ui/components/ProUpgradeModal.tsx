import { useState } from "react";
import { PRICING_CONFIG, type PricingPlan } from "../../config/pricingConfig";
import { activateLicense, __generateDevLicense } from "../../application/licenseService";
import { useToast } from "./Toast";

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentCount?: number;
}

export function ProUpgradeModal({
  isOpen,
  onClose,
  onSuccess,
  currentCount = 10,
}: ProUpgradeModalProps) {
  const { showToast } = useToast();
  const [licenseKeyInput, setLicenseKeyInput] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>(PRICING_CONFIG.plans[1]); // Default to Lifetime

  if (!isOpen) return null;

  function handleActivate() {
    if (!licenseKeyInput.trim()) {
      showToast("Please enter your MLD-PRO license key", "error");
      return;
    }

    const success = activateLicense(licenseKeyInput.trim());
    if (success) {
      showToast("🎉 MyLifeDock PRO successfully activated! Unlimited storage unlocked.", "success");
      setLicenseKeyInput("");
      if (onSuccess) onSuccess();
      onClose();
    } else {
      showToast("Invalid cryptographic signature or expired license key.", "error");
    }
  }

  function handleFillTestKey() {
    try {
      const sampleKey = __generateDevLicense("founder@mylifedock.com", "pro_lifetime");
      setLicenseKeyInput(sampleKey);
      showToast("Test Lifetime Pro key populated! Click 'Activate Key' to unlock.", "info");
    } catch {
      showToast("Test keys only available in development mode.", "info");
    }
  }

  function handleCheckout(plan: PricingPlan) {
    if (!plan.razorpayPaymentLink) {
      showToast("Payment link not configured yet.", "error");
      return;
    }
    window.open(plan.razorpayPaymentLink, "_system");
  }

  return (
    <div
      className="product-detail-overlay fade-in"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ zIndex: 1200 }}
    >
      <section
        className="product-detail-modal"
        role="dialog"
        aria-modal="true"
        style={{
          maxWidth: "580px",
          width: "95%",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "#0d1322",
          border: "1px solid rgba(234, 179, 8, 0.35)",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(234, 179, 8, 0.15)",
        }}
      >
        {/* Modal Header */}
        <div
          className="product-detail-header"
          style={{
            borderBottom: "1px solid rgba(234, 179, 8, 0.2)",
            background: "linear-gradient(to right, rgba(234, 179, 8, 0.08), transparent)",
          }}
        >
          <div>
            <span
              className="eyebrow"
              style={{ color: "#eab308", fontWeight: 700, letterSpacing: "0.08em" }}
            >
              ⭐ VAULT QUOTA LIMIT REACHED
            </span>
            <h2 style={{ color: "#fff", margin: "4px 0 0 0", fontSize: "22px" }}>
              Upgrade to MyLifeDock PRO
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "22px" }}>
          {/* Usage Progress Meter */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "10px",
              padding: "14px 16px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "13px",
                marginBottom: "6px",
                color: "#e2e8f0",
              }}
            >
              <span>
                Free Core Capacity: <strong>{currentCount} / {PRICING_CONFIG.freeItemLimit} items</strong>
              </span>
              <span style={{ color: "#f87171", fontWeight: 700 }}>100% Full</span>
            </div>
            <div
              style={{
                width: "100%",
                height: "8px",
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "linear-gradient(90deg, #f59e0b, #ef4444)",
                }}
              />
            </div>
            <p
              style={{
                fontSize: "12.5px",
                color: "#94a3b8",
                margin: "8px 0 0 0",
                lineHeight: "1.45",
              }}
            >
              You have reached the 10-item limit for the free version. Upgrade to PRO to store unlimited documents, medical prescriptions, lab reports, warranties, and secrets.
            </p>
          </div>

          {/* Pricing Plans Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "20px" }}>
            {PRICING_CONFIG.plans.map((plan) => {
              const isSelected = selectedPlan.id === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  style={{
                    padding: "16px 12px",
                    borderRadius: "10px",
                    border: isSelected
                      ? "2px solid #eab308"
                      : "1px solid rgba(255, 255, 255, 0.1)",
                    background: isSelected
                      ? "rgba(234, 179, 8, 0.08)"
                      : "rgba(15, 23, 42, 0.5)",
                    cursor: "pointer",
                    position: "relative",
                    transition: "all 0.2s ease",
                  }}
                >
                  {plan.badge && (
                    <span
                      style={{
                        position: "absolute",
                        top: "-9px",
                        right: "8px",
                        background: plan.id === "pro_yearly" ? "#10b981" : "#eab308",
                        color: plan.id === "pro_yearly" ? "#ffffff" : "#0f172a",
                        fontSize: "9px",
                        fontWeight: 800,
                        padding: "2px 7px",
                        borderRadius: "999px",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {plan.badge}
                    </span>
                  )}
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", color: "#fff" }}>
                    {plan.title}
                  </h4>
                  <div style={{ fontSize: "19px", fontWeight: 800, color: isSelected ? "#eab308" : "#fff" }}>
                    {plan.priceINR} <small style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 400 }}>({plan.priceUSD})</small>
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
                    {plan.billingPeriod}
                  </div>
                  {plan.savingsBadge && (
                    <div style={{ fontSize: "10px", color: "#34d399", fontWeight: 700, lineHeight: "1.2" }}>
                      ★ {plan.savingsBadge}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Features Included */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "8px",
              padding: "12px 14px",
              marginBottom: "20px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#eab308", marginBottom: "6px", textTransform: "uppercase" }}>
              Included with MyLifeDock PRO:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {selectedPlan.features.map((feat, idx) => (
                <div key={idx} style={{ fontSize: "12px", color: "#cbd5e1", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "#4ade80", fontWeight: "bold" }}>✓</span>
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Buy via Razorpay Button */}
          <div style={{ marginBottom: "22px" }}>
            <button
              type="button"
              className="primary-button cta-button"
              onClick={() => handleCheckout(selectedPlan)}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "15px",
                fontWeight: 700,
                background: "linear-gradient(135deg, #eab308, #ca8a04)",
                color: "#0f172a",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <span>Pay with UPI / Cards via Razorpay ({selectedPlan.priceINR})</span>
              <span className="btn-arrow" aria-hidden="true">→</span>
            </button>
            <div style={{ textAlign: "center", fontSize: "11.5px", color: "#94a3b8", marginTop: "6px" }}>
              🔒 Secured by Razorpay. Supports UPI (GPay, PhonePe, Paytm), RuPay, and Debit/Credit Cards.
            </div>
          </div>

          {/* License Key Activation Divider */}
          <div
            style={{
              position: "relative",
              textAlign: "center",
              margin: "18px 0",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: "-10px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "#0d1322",
                padding: "0 10px",
                color: "#64748b",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              ALREADY HAVE A KEY?
            </span>
          </div>

          {/* Key Input Section */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <input
              type="text"
              placeholder="Paste license key (MLD-PRO-...)"
              value={licenseKeyInput}
              onChange={(e) => setLicenseKeyInput(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 14px",
                background: "rgba(15, 23, 42, 0.9)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "13px",
              }}
            />
            <button
              type="button"
              className="primary-button"
              onClick={handleActivate}
              style={{ fontSize: "13px", padding: "10px 18px", whiteSpace: "nowrap" }}
            >
              Activate Key
            </button>
          </div>

          {/* Test / Dev Button */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleFillTestKey}
              style={{
                background: "none",
                border: "none",
                color: "#38bdf8",
                fontSize: "12px",
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              🧪 Fill Sample Test Key (Dev Mode)
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              style={{ fontSize: "12.5px", padding: "6px 14px" }}
            >
              Close
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ProUpgradeModal;
