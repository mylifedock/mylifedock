import { useEffect, useState } from "react";
import { useOpenFocusedRecord } from "../useActiveProfileFilter";
import { getLocalDateString } from "../../utils/dateUtils";
import { getVaultQuotaStatus, VaultLimitReachedError } from "../../application/vaultLimitService";
import { ProUpgradeModal } from "../components/ProUpgradeModal";
import { useToast } from "../components/Toast";
import { getSubscriptions, saveSubscription, deleteSubscription, type SubscriptionItem } from "../../application/subscriptionService";
import { formatCurrency, getPreferredCurrency, isSupportedCurrency, SUPPORTED_CURRENCIES } from "../../application/currencyService";

function formatAmount(amount: number, currency: string): string {
  return formatCurrency(amount, isSupportedCurrency(currency) ? currency : undefined);
}

/** Totals are kept per currency: adding amounts in different currencies would be meaningless. */
function formatTotals(totals: Map<string, number>): string {
  if (totals.size === 0) return formatCurrency(0);
  return [...totals].map(([currency, amount]) => formatAmount(amount, currency)).join(" + ");
}

function monthlyCost(sub: SubscriptionItem): number {
  if (sub.billingCycle === "yearly") return sub.amount / 12;
  if (sub.billingCycle === "quarterly") return sub.amount / 3;
  return sub.amount;
}

function emptySubscription(): Omit<SubscriptionItem, "id"> {
  return {
    name: "",
    category: "entertainment",
    amount: 199,
    currency: getPreferredCurrency(),
    billingCycle: "monthly",
    nextBillingDate: getLocalDateString(),
    autoRenew: true,
    notes: "",
  };
}

/** Subscriptions tab of the Money section. */
export function SubscriptionsSection({ focusId }: { focusId?: string }) {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const { showToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<SubscriptionItem, "id">>(emptySubscription);
  const [upgradeCount, setUpgradeCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void getSubscriptions()
      .then((list) => {
        if (active) setSubscriptions(list);
      })
      .catch(() => {
        if (active) showToast("Could not load subscriptions.", "error");
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  const monthlyTotals = new Map<string, number>();
  for (const sub of subscriptions) {
    monthlyTotals.set(sub.currency, (monthlyTotals.get(sub.currency) ?? 0) + monthlyCost(sub));
  }
  const yearlyTotals = new Map([...monthlyTotals].map(([currency, amount]) => [currency, amount * 12]));

  // A search result opens that subscription's form.
  useOpenFocusedRecord(focusId, subscriptions, handleEdit);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast("Subscription name is required", "error");
      return;
    }

    try {
      await saveSubscription(formData, editingId || undefined);
      setSubscriptions(await getSubscriptions());
      setShowForm(false);
      setEditingId(null);
      showToast(editingId ? "Subscription updated" : "Subscription added with renewal reminder", "success");
    } catch (err) {
      if (err instanceof VaultLimitReachedError) {
        setUpgradeCount((await getVaultQuotaStatus()).totalItems);
      } else {
        showToast("Failed to save subscription", "error");
      }
    }
  }

  async function openNew() {
    const quota = await getVaultQuotaStatus();
    if (quota.isLimitReached) {
      setUpgradeCount(quota.totalItems);
      return;
    }
    setEditingId(null);
    setFormData(emptySubscription());
    setShowForm(true);
  }

  function handleEdit(sub: SubscriptionItem) {
    setFormData({
      name: sub.name,
      category: sub.category,
      amount: sub.amount,
      currency: sub.currency,
      billingCycle: sub.billingCycle,
      nextBillingDate: sub.nextBillingDate,
      autoRenew: sub.autoRenew,
      notes: sub.notes || "",
    });
    setEditingId(sub.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this subscription?")) return;
    try {
      await deleteSubscription(id);
      setSubscriptions(await getSubscriptions());
      showToast("Subscription removed", "success");
    } catch {
      showToast("Failed to remove subscription", "error");
    }
  }

  return (
    <div className="fade-in">
      {!showForm && (
        <div className="section-toolbar">
          <button
            type="button"
            className="primary-button"
            onClick={() => void openNew()}
          >
            + Add Subscription
          </button>
        </div>
      )}

      {/* Spending Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: "24px" }}>
        <div className="stat-card">
          <div className="stat-card-top">
            <span style={{ fontSize: "20px" }}>💳</span>
            <span className="stat-value">{subscriptions.length}</span>
          </div>
          <div className="stat-label">Active Subscriptions</div>
          <div className="stat-description">Recurring services</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span style={{ fontSize: "20px" }}>📅</span>
            <span className="stat-value">{formatTotals(monthlyTotals)}</span>
          </div>
          <div className="stat-label">Monthly Outflow</div>
          <div className="stat-description">Average cost per month</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span style={{ fontSize: "20px" }}>📈</span>
            <span className="stat-value">{formatTotals(yearlyTotals)}</span>
          </div>
          <div className="stat-label">Annual Projected Cost</div>
          <div className="stat-description">Estimated 12-month spend</div>
        </div>
      </div>

      {showForm && (
        <div className="card fade-in" style={{ marginBottom: "24px" }}>
          <div className="card-header">
            <h3>{editingId ? "Edit Subscription" : "Add Subscription / Recurring Bill"}</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <div className="form-field" style={{ flex: 1, minWidth: "240px" }}>
                  <label htmlFor="subscriptions-serviceName">Service Name (e.g. Netflix, Gym, AWS, Spotify)</label>
                  <input id="subscriptions-serviceName"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Netflix 4K"
                  />
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "180px" }}>
                  <label htmlFor="subscriptions-category">Category</label>
                  <select id="subscriptions-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as SubscriptionItem["category"] })}
                  >
                    <option value="entertainment">Entertainment (Streaming, Games)</option>
                    <option value="software">Software / Cloud</option>
                    <option value="utilities">Utilities & Telecom</option>
                    <option value="health">Health & Fitness (Gym)</option>
                    <option value="finance">Insurance / Finance</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <div className="form-field" style={{ flex: 1, minWidth: "140px" }}>
                  <label htmlFor="subscriptions-amount">Amount</label>
                  <input id="subscriptions-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "140px" }}>
                  <label htmlFor="subscriptions-currency">Currency</label>
                  <select id="subscriptions-currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  >
                    {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "140px" }}>
                  <label htmlFor="subscriptions-billingCycle">Billing Cycle</label>
                  <select id="subscriptions-billingCycle"
                    value={formData.billingCycle}
                    onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value as SubscriptionItem["billingCycle"] })}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "160px" }}>
                  <label htmlFor="subscriptions-nextBillingDate">Next Billing Date</label>
                  <input id="subscriptions-nextBillingDate"
                    type="date"
                    required
                    value={formData.nextBillingDate}
                    onChange={(e) => setFormData({ ...formData, nextBillingDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="product-form-actions">
                <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  {editingId ? "Save Changes" : "Save Subscription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscriptions List */}
      <div className="card fade-in">
        <div className="card-header">
          <h3>Active Recurring Subscriptions</h3>
        </div>
        <div className="card-body">
          {subscriptions.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>
              No recurring subscriptions tracked yet. Click <strong>+ Add Subscription</strong> to track your recurring services and receive renewal alerts before billing.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {subscriptions.map(sub => (
                <div 
                  key={sub.id} 
                  style={{
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    padding: "12px 16px", 
                    background: "rgba(255, 255, 255, 0.03)", 
                    border: "1px solid rgba(255, 255, 255, 0.08)", 
                    borderRadius: "10px"
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "16px", display: "block" }}>{sub.name}</strong>
                    <small style={{ color: "#94a3b8" }}>
                      {sub.billingCycle.toUpperCase()} • Next Charge: {sub.nextBillingDate}
                    </small>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span style={{ fontSize: "16px", fontWeight: "bold", color: "#a78bfa" }}>
                      {formatAmount(sub.amount, sub.currency)}
                    </span>
                    <button type="button" className="text-button" onClick={() => handleEdit(sub)}>
                      Edit
                    </button>
                    <button type="button" className="text-button" style={{ color: "var(--color-danger)" }} onClick={() => handleDelete(sub.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ProUpgradeModal isOpen={upgradeCount !== null} onClose={() => setUpgradeCount(null)} currentCount={upgradeCount ?? 0} />
    </div>
  );
}

export default SubscriptionsSection;
