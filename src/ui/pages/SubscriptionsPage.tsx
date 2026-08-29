import { useState } from "react";
import { useToast } from "../components/Toast";
import { getSubscriptions, saveSubscription, deleteSubscription, type SubscriptionItem } from "../../application/subscriptionService";

export function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>(() => getSubscriptions());
  const { showToast } = useToast();
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<SubscriptionItem, "id">>({
    name: "",
    category: "entertainment",
    amount: 9.99,
    currency: "USD",
    billingCycle: "monthly",
    nextBillingDate: new Date().toISOString().slice(0, 10),
    autoRenew: true,
    notes: "",
  });

  // Calculate monthly & annual totals
  const monthlyTotal = subscriptions.reduce((acc, s) => {
    if (s.billingCycle === "monthly") return acc + s.amount;
    if (s.billingCycle === "yearly") return acc + (s.amount / 12);
    if (s.billingCycle === "quarterly") return acc + (s.amount / 3);
    return acc + s.amount;
  }, 0);

  const yearlyTotal = monthlyTotal * 12;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast("Subscription name is required", "error");
      return;
    }

    try {
      await saveSubscription(formData, editingId || undefined);
      setSubscriptions(getSubscriptions());
      setShowForm(false);
      setEditingId(null);
      showToast(editingId ? "Subscription updated" : "Subscription added with renewal reminder", "success");
    } catch {
      showToast("Failed to save subscription", "error");
    }
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

  function handleDelete(id: string) {
    if (!window.confirm("Remove this subscription?")) return;
    deleteSubscription(id);
    setSubscriptions(getSubscriptions());
    showToast("Subscription removed", "success");
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Subscriptions & Recurring Bills</h1>
          <p className="page-subtitle">Track recurring expenses and get alerted before cards are charged.</p>
        </div>
        <button 
          className="primary-button" 
          onClick={() => {
            setEditingId(null);
            setFormData({
              name: "",
              category: "entertainment",
              amount: 14.99,
              currency: "USD",
              billingCycle: "monthly",
              nextBillingDate: new Date().toISOString().slice(0, 10),
              autoRenew: true,
              notes: "",
            });
            setShowForm(true);
          }}
        >
          + Add Subscription
        </button>
      </div>

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
            <span className="stat-value">${monthlyTotal.toFixed(2)}</span>
          </div>
          <div className="stat-label">Monthly Outflow</div>
          <div className="stat-description">Average cost per month</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span style={{ fontSize: "20px" }}>📈</span>
            <span className="stat-value">${yearlyTotal.toFixed(2)}</span>
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
                  <label>Service Name (e.g. Netflix, Gym, AWS, Spotify)</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Netflix 4K"
                  />
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "180px" }}>
                  <label>Category</label>
                  <select
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
                  <label>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "140px" }}>
                  <label>Billing Cycle</label>
                  <select
                    value={formData.billingCycle}
                    onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value as SubscriptionItem["billingCycle"] })}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "160px" }}>
                  <label>Next Billing Date</label>
                  <input
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
                      ${sub.amount.toFixed(2)}
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
    </div>
  );
}

export default SubscriptionsPage;
