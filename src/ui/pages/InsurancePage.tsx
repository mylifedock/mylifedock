import { useState } from "react";
import type { FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../infrastructure/database/db";
import { updateCoverage, deleteCoverage } from "../../application/coverageService";
import type { CoverageRecord } from "../../infrastructure/database/db";
import { AttachmentManager } from "../components/AttachmentManager";

const LOCAL_PROFILE_ID = "local-profile";

export function InsurancePage() {
  const insurances = useLiveQuery(() => 
    db.coverages
      .where("ownerId").equals(LOCAL_PROFILE_ID)
      .filter(c => c.type === "insurance")
      .toArray()
  , [], []);

  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CoverageRecord | undefined>();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  
  const [provider, setProvider] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(true);

  function openCreateForm() {
    setEditingRecord(undefined);
    setDraftId(crypto.randomUUID());
    setIsNewRecord(true);
    setProvider("");
    setPolicyNumber("");
    setStartDate("");
    setEndDate("");
    setReminderEnabled(true);
    setShowForm(true);
  }

  function openEditForm(record: CoverageRecord) {
    setEditingRecord(record);
    setDraftId(record.id);
    setIsNewRecord(false);
    setProvider(record.provider || "");
    setPolicyNumber(record.policyNumber || "");
    setStartDate(record.startDate);
    setEndDate(record.endDate);
    setReminderEnabled(record.reminderEnabled);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setIsNewRecord(false);
    setDraftId(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) return;

    if (!isNewRecord && editingRecord) {
      await updateCoverage(editingRecord.id, {
        provider: provider.trim() || undefined,
        policyNumber: policyNumber.trim() || undefined,
        startDate,
        endDate,
        reminderEnabled
      });
    } else if (draftId) {
      // Instead of relying purely on createCoverage which generates a UUID,
      // we do it manually to preserve the draftId for attachments
      const now = new Date().toISOString();
      await db.coverages.add({
        id: draftId,
        ownerId: LOCAL_PROFILE_ID,
        type: "insurance",
        provider: provider.trim() || undefined,
        policyNumber: policyNumber.trim() || undefined,
        startDate,
        endDate,
        reminderEnabled,
        reminderDaysBefore: 30,
        createdAt: now,
        updatedAt: now
      });
    }
    closeForm();
  }

  return (
    <div className="page-container fade-in">
      <header className="page-header">
        <div className="page-title-group">
          <span className="eyebrow">YOUR POLICIES</span>
          <h1 className="page-title">Insurance</h1>
          <p className="page-subtitle">Track health, life, and standalone insurance policies.</p>
        </div>
        {!showForm && (
          <button className="primary-button" onClick={openCreateForm}>
            Add Policy +
          </button>
        )}
      </header>

      {showForm && (
        <div className="card fade-in" style={{ marginBottom: "24px" }}>
          <div className="card-header">
            <h3>{editingRecord ? "Edit Policy" : "Add Insurance Policy"}</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-field">
                <label>Provider (e.g., BlueCross, State Farm)</label>
                <input required type="text" value={provider} onChange={(e) => setProvider(e.target.value)} />
              </div>
              <div className="form-field">
                <label>Policy Number</label>
                <input type="text" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: "16px" }}>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Start Date</label>
                  <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Expiry Date</label>
                  <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                <input 
                  type="checkbox" 
                  id="reminderEnabled"
                  checked={reminderEnabled} 
                  onChange={(e) => setReminderEnabled(e.target.checked)} 
                />
                <label htmlFor="reminderEnabled" style={{ fontSize: "14px", cursor: "pointer" }}>Enable expiry reminders</label>
              </div>

              <div style={{ marginTop: "8px", borderTop: "1px solid var(--color-border)", paddingTop: "16px" }}>
                <AttachmentManager entityId={draftId!} />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button type="submit" className="primary-button">Save Policy</button>
                <button type="button" className="secondary-button" onClick={closeForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!showForm && insurances.length === 0 && (
        <div className="empty-state card">
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🛡️</div>
          <h3>No policies added</h3>
          <p>Add your health, life, or standalone insurance policies here.</p>
        </div>
      )}

      {!showForm && insurances.length > 0 && (
        <div className="grid-list">
          {insurances.map(policy => (
            <div key={policy.id} className="card fade-in">
              <div className="card-header">
                <h3>{policy.provider || "Unnamed Policy"}</h3>
                <span className="status-badge active">INSURANCE</span>
              </div>
              <div className="card-body">
                {policy.policyNumber && <p><strong>Policy #:</strong> {policy.policyNumber}</p>}
                <p><strong>Valid:</strong> {new Date(policy.startDate).toLocaleDateString()} - {new Date(policy.endDate).toLocaleDateString()}</p>
                <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
                  <button className="secondary-button" onClick={() => openEditForm(policy)}>Edit</button>
                  <button className="text-button" style={{ color: "var(--color-danger)" }} onClick={() => {
                    if(window.confirm("Delete this policy?")) deleteCoverage(policy.id);
                  }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default InsurancePage;
