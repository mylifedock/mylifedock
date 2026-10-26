import { useEffect, useState } from "react";
import { FREE_FEATURES, PRICING_CONFIG, checkoutUrl, type PricingPlan } from "../../config/pricingConfig";
import { formatINR, formatUSD, loadLivePricing, type LivePricing } from "../../application/livePricingService";
import { activateLicense, isProLicense, __generateDevLicense } from "../../application/licenseService";
import { getCheckoutChannel } from "../../config/storePolicy";
import { openExternalUrl } from "../../platform/fileExport";
import {
  isStoreBillingAvailable,
  isStoreBillingPending,
  loadStoreOffers,
  purchaseStorePlan,
  restoreStorePurchases,
  StorePurchaseCancelledError,
  type StoreOffer,
} from "../../application/storeBillingService";
import type { StorePlanId } from "../../config/storeProducts";
import { useToast } from "./Toast";
import { LegalDocModal, type LegalDoc } from "./LegalDocModal";

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentCount?: number;
}

const DEFAULT_PLAN: PricingPlan["id"] = "pro_lifetime";

/**
 * The one upgrade screen. What it sells depends on where the app runs
 * (src/config/storePolicy.ts):
 * - Windows app: live prices/offers, website checkout (Razorpay) in the browser, then a license key by email.
 * - Android / iOS: Google Play Billing / Apple In-App Purchase, with Restore.
 * License-key activation is offered everywhere.
 */
export function ProUpgradeModal({ isOpen, onClose, onSuccess, currentCount }: ProUpgradeModalProps) {
  if (!isOpen) return null;
  return <UpgradeDialog onClose={onClose} onSuccess={onSuccess} currentCount={currentCount} />;
}

function UpgradeDialog({ onClose, onSuccess, currentCount }: Omit<ProUpgradeModalProps, "isOpen">) {
  const { showToast } = useToast();
  const channel = getCheckoutChannel();
  const storeLive = isStoreBillingAvailable();
  const storePending = isStoreBillingPending();
  const storeName = channel === "app-store" ? "App Store" : "Google Play";

  const [selectedPlanId, setSelectedPlanId] = useState<PricingPlan["id"]>(DEFAULT_PLAN);
  const [licenseKeyInput, setLicenseKeyInput] = useState("");
  const [busy, setBusy] = useState<"" | "activate" | "buy" | "restore">("");
  const [offers, setOffers] = useState<StoreOffer[] | null>(storeLive ? null : []);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  const [live, setLive] = useState<LivePricing | null>(null);

  useEffect(() => {
    if (channel !== "razorpay") return;
    let active = true;
    void loadLivePricing().then((prices) => active && setLive(prices));
    return () => {
      active = false;
    };
  }, [channel]);

  useEffect(() => {
    if (!storeLive) return;
    let active = true;
    loadStoreOffers()
      .then((loaded) => active && setOffers(loaded))
      .catch(() => active && setOffers([]));
    return () => {
      active = false;
    };
  }, [storeLive]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const limit = PRICING_CONFIG.freeItemLimit;
  const isLimitReached = currentCount !== undefined && currentCount >= limit;
  const usagePercent = currentCount === undefined ? 0 : Math.min(100, Math.round((currentCount / limit) * 100));
  const selectedPlan = PRICING_CONFIG.plans.find((p) => p.id === selectedPlanId) ?? PRICING_CONFIG.plans[0];
  const selectedOffer = offers?.find((o) => o.plan === selectedPlanId);

  function done(message: string) {
    showToast(message, "success");
    onSuccess?.();
    onClose();
  }

  async function handleActivate() {
    if (!licenseKeyInput.trim()) {
      showToast("Please enter your MLD-PRO license key", "error");
      return;
    }
    setBusy("activate");
    try {
      const status = await activateLicense(licenseKeyInput.trim());
      if (isProLicense(status)) {
        setLicenseKeyInput("");
        done("🎉 MyLifeDock Pro activated. Your vault now has unlimited items.");
      } else {
        showToast(status.message || "Invalid or expired license key.", "error");
      }
    } finally {
      setBusy("");
    }
  }

  async function handleStorePurchase(plan: StorePlanId) {
    setBusy("buy");
    try {
      const status = await purchaseStorePlan(plan);
      if (status && isProLicense(status)) {
        done("🎉 MyLifeDock Pro unlocked. Thank you!");
      } else {
        showToast(`${storeName} has not confirmed the payment yet. It will unlock automatically when it does.`, "info");
      }
    } catch (err) {
      if (!(err instanceof StorePurchaseCancelledError)) {
        showToast(err instanceof Error ? err.message : "The purchase could not be completed.", "error");
      }
    } finally {
      setBusy("");
    }
  }

  async function handleRestore() {
    setBusy("restore");
    try {
      const status = await restoreStorePurchases();
      if (status && isProLicense(status)) {
        done("Your Pro purchase was restored.");
      } else {
        showToast(`No active Pro purchase was found for this ${storeName} account.`, "info");
      }
    } catch {
      showToast(`Could not reach ${storeName}. Check your connection and try again.`, "error");
    } finally {
      setBusy("");
    }
  }

  /** Website price for a plan: live (with any offer) when loaded, otherwise the built-in regular price. */
  function websitePrice(plan: PricingPlan) {
    const p = live?.[plan.id];
    if (!p) return { inr: plan.priceINR, usd: plan.priceUSD, regularINR: "", offerText: "" };
    const current = p.offer ?? p;
    return {
      inr: formatINR(current.priceINR),
      usd: formatUSD(current.priceUSD),
      regularINR: p.offer ? formatINR(p.priceINR) : "",
      offerText: p.offer ? p.offer.text : "",
    };
  }

  function handleRazorpay(plan: PricingPlan) {
    void openExternalUrl(checkoutUrl(plan.id)).catch(() => showToast("Could not open the payment page.", "error"));
  }

  async function handleFillTestKey() {
    try {
      setLicenseKeyInput(await __generateDevLicense("mylifedock@gmail.com", "pro_lifetime"));
      showToast("Test Lifetime Pro key filled in. Click 'Activate Key'.", "info");
    } catch {
      showToast("Test keys are only available in development mode.", "info");
    }
  }

  const planCards = (
    <div className="upgrade-plans" role="radiogroup" aria-label="Pro plan">
      {PRICING_CONFIG.plans.map((plan) => {
        const offer = offers?.find((o) => o.plan === plan.id);
        // In the store apps, show only plans the store actually offers, with the store's price.
        if (storeLive && offers && !offer) return null;
        const isSelected = selectedPlanId === plan.id;
        const web = websitePrice(plan);
        return (
          <button
            key={plan.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`upgrade-plan ${isSelected ? "active" : ""}`}
            onClick={() => setSelectedPlanId(plan.id)}
          >
            {plan.badge && <span className={`upgrade-plan-badge ${plan.id === "pro_yearly" ? "green" : ""}`}>{plan.badge}</span>}
            <span className="upgrade-plan-title">{plan.title}</span>
            <span className="upgrade-plan-price">
              {!storeLive && web.regularINR && <s className="upgrade-plan-was">{web.regularINR}</s>}
              {storeLive ? offer?.priceString ?? "…" : web.inr}
              {!storeLive && <small> ({web.usd})</small>}
            </span>
            {!storeLive && web.offerText && <span className="upgrade-plan-offer">{web.offerText}</span>}
            <span className="upgrade-plan-period">
              {plan.id === "pro_lifetime" ? "one-time payment" : storeLive ? `${plan.billingPeriod}, renews automatically` : plan.billingPeriod}
            </span>
          </button>
        );
      })}
    </div>
  );

  const features = (
    <div className="upgrade-features">
      <div className="upgrade-features-title">Included with MyLifeDock Pro</div>
      <ul>
        {selectedPlan.features.map((feat) => (
          <li key={feat}>{feat}</li>
        ))}
      </ul>
      <p className="muted-text">Free includes: {FREE_FEATURES.join(" · ")}.</p>
    </div>
  );

  return (
    <div
      className="product-detail-overlay fade-in"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ zIndex: 1200 }}
    >
      <section className="product-detail-modal upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
        <div className="product-detail-header upgrade-header">
          <div>
            <span className="eyebrow upgrade-eyebrow">{isLimitReached ? "⭐ FREE VAULT IS FULL" : "⭐ MYLIFEDOCK PRO"}</span>
            <h2 id="upgrade-title">Upgrade to MyLifeDock Pro</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="upgrade-body">
          {currentCount !== undefined && (
            <div className="upgrade-usage">
              <div className="upgrade-usage-row">
                <span>
                  Free vault: <strong>{currentCount} / {limit} items</strong>
                </span>
                <span className={isLimitReached ? "danger-text" : "upgrade-gold"}>{isLimitReached ? "Full" : `${usagePercent}% used`}</span>
              </div>
              <div className="upgrade-meter" aria-hidden="true">
                <div style={{ width: `${usagePercent}%` }} />
              </div>
              <p className="muted-text">
                Pro removes the limit in every section: documents, medical records, policies, accounts, subscriptions and secrets.
              </p>
            </div>
          )}

          {channel === "razorpay" && (
            <>
              {planCards}
              {features}
              <button type="button" className="primary-button cta-button upgrade-buy" onClick={() => handleRazorpay(selectedPlan)}>
                <span>Pay with UPI / Cards via Razorpay ({websitePrice(selectedPlan).inr})</span>
                <span className="btn-arrow" aria-hidden="true">→</span>
              </button>
              <p className="upgrade-fineprint">
                🔒 Opens the secure MyLifeDock checkout in your browser (Razorpay: UPI, RuPay, debit and credit cards). Your
                license key arrives by email within minutes.
              </p>
            </>
          )}

          {storeLive && (
            <>
              {offers === null ? <p className="muted-text">Loading prices from {storeName}…</p> : planCards}
              {offers !== null && offers.length === 0 && (
                <p className="warning-text">Could not load plans from {storeName}. Check your connection and try again.</p>
              )}
              {features}
              <button
                type="button"
                className="primary-button cta-button upgrade-buy"
                disabled={!selectedOffer || busy !== ""}
                onClick={() => void handleStorePurchase(selectedPlanId)}
              >
                <span>
                  {busy === "buy"
                    ? "Opening payment…"
                    : selectedPlanId === "pro_lifetime"
                      ? `Buy with ${storeName}${selectedOffer ? ` (${selectedOffer.priceString})` : ""}`
                      : `Subscribe with ${storeName}${selectedOffer ? ` (${selectedOffer.priceString})` : ""}`}
                </span>
              </button>
              <button type="button" className="text-button upgrade-restore" disabled={busy !== ""} onClick={() => void handleRestore()}>
                {busy === "restore" ? "Restoring…" : "Restore purchases"}
              </button>
              <p className="upgrade-fineprint">
                Payment is charged to your {storeName} account. Monthly and yearly plans renew automatically unless cancelled at least
                24 hours before the end of the current period; manage or cancel them in your {storeName} account settings.{" "}
                <button type="button" className="inline-link" onClick={() => setLegalDoc("terms")}>
                  Terms of Use
                </button>{" "}
                ·{" "}
                <button type="button" className="inline-link" onClick={() => setLegalDoc("privacy")}>
                  Privacy Policy
                </button>
              </p>
            </>
          )}

          {storePending && (
            <p className="upgrade-coming-soon" role="note">
              Buying Pro through {storeName} arrives with the store release. Bought a license key on the MyLifeDock website or
              desktop app? Activate it below.
            </p>
          )}

          <div className="upgrade-divider">
            <span>{channel === "razorpay" ? "ALREADY HAVE A KEY?" : "HAVE A LICENSE KEY?"}</span>
          </div>

          <div className="upgrade-key-row">
            <input
              type="text"
              placeholder="Paste license key (MLD-PRO-...)"
              aria-label="License key"
              value={licenseKeyInput}
              onChange={(e) => setLicenseKeyInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="primary-button" onClick={() => void handleActivate()} disabled={busy !== ""}>
              {busy === "activate" ? "Verifying..." : "Activate Key"}
            </button>
          </div>

          <div className="upgrade-footer">
            {import.meta.env.DEV && (
              <button type="button" className="text-button" onClick={() => void handleFillTestKey()}>
                🧪 Fill Sample Test Key (Dev Mode)
              </button>
            )}
            <button type="button" className="secondary-button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </section>

      {legalDoc && <LegalDocModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  );
}

export default ProUpgradeModal;
