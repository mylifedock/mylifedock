import { useState } from "react";
import type { FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getSecrets, createSecret, updateSecret, deleteSecret } from "../../application/secretsService";
import type { SecretRecord, SecretCategory } from "../../infrastructure/database/db";

function SecretCard({ secret, onEdit, onDelete }: { secret: SecretRecord, onEdit: () => void, onDelete: () => void }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <article className="card fade-in">
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span className="eyebrow" style={{ textTransform: "uppercase" }}>{secret.category}</span>
          <h3 style={{ margin: "4px 0 0 0" }}>{secret.title}</h3>
        </div>
      </div>
      <div className="card-body">
        <div style={{ marginBottom: "16px", padding: "16px", backgroundColor: "#f1f3f4", borderRadius: "8px", position: "relative" }}>
          {revealed ? (
            <div style={{ fontFamily: "monospace", fontSize: "16px", wordBreak: "break-all" }}>
              {secret.value}
            </div>
          ) : (
            <div style={{ fontSize: "24px", letterSpacing: "4px", color: "#5f6368" }}>
              ••••••••••••
            </div>
          )}
        </div>
        
        {secret.notes && (
          <p style={{ fontSize: "14px", color: "#5f6368", marginBottom: "16px" }}>{secret.notes}</p>
        )}

        <div style={{ display: "flex", gap: "12px" }}>
          <button 
            className={revealed ? "secondary-button" : "primary-button"}
            onClick={() => setRevealed(!revealed)}
          >
            {revealed ? "Hide Secret" : "Reveal Secret"}
          </button>
          <button className="secondary-button" onClick={onEdit}>Edit</button>
          <button className="text-button" style={{ color: "var(--color-danger)" }} onClick={onDelete}>Delete</button>
        </div>
      </div>
    </article>
  );
}

export function SecretsPage() {
  const secrets = useLiveQuery(() => getSecrets(), [], []);
  
  const [showForm, setShowForm] = useState(false);
  const [editingSecret, setEditingSecret] = useState<SecretRecord | undefined>();
  
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<SecretCategory>("password");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  function openCreateForm() {
    setEditingSecret(undefined);
    setTitle("");
    setCategory("password");
    setValue("");
    setNotes("");
    setShowForm(true);
  }

  function openEditForm(secret: SecretRecord) {
    setEditingSecret(secret);
    setTitle(secret.title);
    setCategory(secret.category);
    setValue(secret.value);
    setNotes(secret.notes || "");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !value.trim()) return;

    if (editingSecret) {
      await updateSecret(editingSecret.id, {
        title: title.trim(),
        category,
        value: value.trim(),
        notes: notes.trim() || undefined
      });
    } else {
      await createSecret({
        title: title.trim(),
        category,
        value: value.trim(),
        notes: notes.trim() || undefined
      });
    }
    closeForm();
  }

  async function handleDelete(id: string) {
    if (window.confirm("Are you sure you want to permanently delete this secret?")) {
      await deleteSecret(id);
    }
  }

  return (
    <div className="page-container fade-in">
      <header className="page-header">
        <div className="page-title-group">
          <span className="eyebrow">YOUR VAULT</span>
          <h1 className="page-title">Secure Secrets</h1>
          <p className="page-subtitle">Store PINs, recovery phrases, and sensitive codes safely.</p>
        </div>
        {!showForm && (
          <button className="primary-button" onClick={openCreateForm}>
            Add Secret +
          </button>
        )}
      </header>

      {showForm && (
        <div className="card fade-in" style={{ marginBottom: "24px" }}>
          <div className="card-header">
            <h3>{editingSecret ? "Edit Secret" : "Add New Secret"}</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-field">
                <label>Title</label>
                <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Master Padlock, Binance Seed..." />
              </div>
              <div className="form-field">
                <label>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as SecretCategory)}>
                  <option value="password">Password</option>
                  <option value="pin">PIN / Combo</option>
                  <option value="crypto">Crypto Seed</option>
                  <option value="combination">Combination Lock</option>
                  <option value="note">Secure Note</option>
                </select>
              </div>
              <div className="form-field">
                <label>Secret Value</label>
                <textarea required rows={3} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Enter the sensitive data here..." style={{ fontFamily: "monospace" }} />
              </div>
              <div className="form-field">
                <label>Additional Notes (Optional)</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context or hints..." />
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button type="submit" className="primary-button">Save Secret</button>
                <button type="button" className="secondary-button" onClick={closeForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!showForm && secrets.length === 0 && (
        <div className="empty-state card">
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔐</div>
          <h3>No secrets stored yet</h3>
          <p>Add your first highly sensitive PIN, password, or recovery phrase.</p>
        </div>
      )}

      {!showForm && secrets.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
          {secrets.map(s => (
            <SecretCard 
              key={s.id} 
              secret={s} 
              onEdit={() => openEditForm(s)} 
              onDelete={() => handleDelete(s.id)} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SecretsPage;
