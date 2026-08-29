import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "../components/Toast";
import { getFinances, updateFinance, deleteFinance, type CreateFinanceInput } from "../../application/financeService";
import { db, type FinanceRecord } from "../../infrastructure/database/db";
import { AttachmentManager } from "../components/AttachmentManager";

export function FinancePage() {
  const finances = useLiveQuery(() => getFinances(), [], []);
  const { showToast } = useToast();
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [formData, setFormData] = useState<CreateFinanceInput>({
    category: "bank",
    institution: "",
    accountType: "",
    identifier: "",
    balance: 0,
    currency: "USD",
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!isNewRecord && editingId) {
        await updateFinance(editingId, formData);
        showToast("Financial record updated", "success");
      } else if (editingId) {
        // Create it with the pre-generated ID
        const now = new Date().toISOString();
        await db.finance.add({
          ...formData,
          id: editingId,
          ownerId: "local-profile",
          createdAt: now,
          updatedAt: now,
        });
        showToast("Financial record created", "success");
      }
      setShowForm(false);
      setEditingId(null);
      setIsNewRecord(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error saving record", "error");
    }
  }

  function handleEdit(record: FinanceRecord) {
    setFormData({
      category: record.category,
      institution: record.institution,
      accountType: record.accountType || "",
      identifier: record.identifier || "",
      balance: record.balance || 0,
      currency: record.currency || "USD",
      notes: record.notes || "",
    });
    setEditingId(record.id);
    setIsNewRecord(false);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this financial record?")) return;
    try {
      await deleteFinance(id);
      showToast("Record deleted", "success");
    } catch {
      showToast("Error deleting record", "error");
    }
  }

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Financial Life</h1>
          <p className="page-subtitle">Manage accounts, cards, and investments securely.</p>
        </div>
        <button className="primary-button" onClick={() => {
          setEditingId(crypto.randomUUID());
          setIsNewRecord(true);
          setFormData({ category: "bank", institution: "", accountType: "", identifier: "", balance: 0, currency: "USD" });
          setShowForm(true);
        }}>
          + Add Record
        </button>
      </div>

      <div className="alert alert-info" style={{ marginBottom: "24px" }}>
        <strong>Privacy Enforcement Active:</strong> The vault restricts identifiers (cards/accounts) to the last 4 digits. Raw credentials are never stored.
      </div>

      {showForm && (
        <div className="card fade-in" style={{ marginBottom: "24px" }}>
          <div className="card-header">
            <h3>{editingId ? "Edit Record" : "Add Record"}</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-field">
                <label>Category</label>
                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value as "bank" | "card" | "investment" | "liability" })} required>
                  <option value="bank">Bank Account</option>
                  <option value="card">Credit/Debit Card</option>
                  <option value="investment">Investment</option>
                  <option value="liability">Liability / Loan</option>
                </select>
              </div>
              <div className="form-field">
                <label>Institution / Bank Name</label>
                <input type="text" value={formData.institution} onChange={e => setFormData({ ...formData, institution: e.target.value })} required placeholder="e.g. Chase, Vanguard" />
              </div>
              <div className="form-field">
                <label>Account Type / Card Network</label>
                <input type="text" value={formData.accountType} onChange={e => setFormData({ ...formData, accountType: e.target.value })} placeholder="e.g. Checking, Visa Signature" />
              </div>
              <div className="form-field">
                <label>Identifier (Last 4 Digits Only)</label>
                <input type="text" maxLength={4} pattern="\d{1,4}" value={formData.identifier} onChange={e => setFormData({ ...formData, identifier: e.target.value })} placeholder="1234" />
              </div>
              <div style={{ display: "flex", gap: "16px" }}>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Balance</label>
                  <input type="number" step="0.01" value={formData.balance} onChange={e => setFormData({ ...formData, balance: parseFloat(e.target.value) })} />
                </div>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Currency</label>
                  <input type="text" value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })} />
                </div>
              </div>
              <div className="form-field">
                <label>Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={3} />
              </div>
              
              <div style={{ marginTop: "8px", borderTop: "1px solid var(--color-border)", paddingTop: "16px" }}>
                <AttachmentManager entityId={editingId!} />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button type="submit" className="primary-button">Save Record</button>
                <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!showForm && (
        <div className="grid-list">
          {finances?.length === 0 ? (
            <div className="empty-state card" style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>💰</div>
              <h3>No financial records added</h3>
              <p>Add your banks, cards, or investments here to track your financial life.</p>
            </div>
          ) : (
            finances?.map(record => (
              <div key={record.id} className="card fade-in">
                <div className="card-header">
                  <h3>{record.institution}</h3>
                  <span className={`status-badge active`}>{record.category.toUpperCase()}</span>
                </div>
                <div className="card-body">
                  <p><strong>Type:</strong> {record.accountType || "N/A"}</p>
                  <p><strong>Ending in:</strong> {record.identifier ? `  ${record.identifier}` : "N/A"}</p>
                  <p><strong>Balance:</strong> {record.balance?.toLocaleString()} {record.currency}</p>
                  {record.notes && <p style={{ fontSize: "14px", color: "#7a8ba8", marginTop: "12px" }}>{record.notes}</p>}
                  <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
                    <button className="secondary-button" onClick={() => handleEdit(record)}>Edit</button>
                    <button className="text-button" style={{ color: "var(--color-danger)" }} onClick={() => handleDelete(record.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default FinancePage;
