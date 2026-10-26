import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getSecrets, createSecret, updateSecret, deleteSecret } from "../../application/secretsService";
import { getVaultQuotaStatus, VaultLimitReachedError } from "../../application/vaultLimitService";
import type { SecretRecord, SecretCategory } from "../../infrastructure/database/db";
import { useToast } from "../components/Toast";
import { EmptyState, PageHeader } from "../components/PageHeader";
import { ProUpgradeModal } from "../components/ProUpgradeModal";
import { useOpenFocusedRecord } from "../useActiveProfileFilter";

/** A revealed secret hides again, and a copied one is cleared from the clipboard, after this long. */
const EXPOSURE_MS = 30_000;

const CATEGORY_LABELS: Record<SecretCategory, string> = {
  password: "Password",
  pin: "PIN",
  crypto: "Recovery phrase",
  combination: "Lock combination",
  note: "Secure note",
};

function SecretCard({ secret, onEdit, onDelete }: { secret: SecretRecord; onEdit: () => void; onDelete: () => void }) {
  const { showToast } = useToast();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => setRevealed(false), EXPOSURE_MS);
    return () => clearTimeout(timer);
  }, [revealed]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(secret.value);
      showToast("Copied. The clipboard is cleared in 30 seconds.", "success");
      setTimeout(() => {
        // Only clear it if the user has not copied something else since.
        void navigator.clipboard
          .readText()
          .then((current) => (current === secret.value ? navigator.clipboard.writeText("") : undefined))
          .catch(() => navigator.clipboard.writeText("").catch(() => {}));
      }, EXPOSURE_MS);
    } catch {
      showToast("Copying is not available here.", "error");
    }
  }

  return (
    <article className="card fade-in secret-card">
      <div className="card-header">
        <div>
          <span className="eyebrow">{CATEGORY_LABELS[secret.category] ?? secret.category}</span>
          <h3>{secret.title}</h3>
        </div>
      </div>
      <div className="card-body">
        <div className={`secret-value ${revealed ? "revealed" : ""}`} aria-live="polite">
          {revealed ? secret.value : "••••••••••••"}
        </div>

        {secret.notes && <p className="record-notes">{secret.notes}</p>}

        <div className="record-actions">
          <button type="button" className={revealed ? "secondary-button" : "primary-button"} onClick={() => setRevealed(!revealed)}>
            {revealed ? "Hide" : "Reveal"}
          </button>
          <button type="button" className="secondary-button" onClick={() => void handleCopy()}>
            Copy
          </button>
          <button type="button" className="secondary-button" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="text-button danger-text" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export function SecretsPage({ focusId }: { focusId?: string }) {
  const secrets = useLiveQuery(() => getSecrets(), [], []);
  const { showToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingSecret, setEditingSecret] = useState<SecretRecord | undefined>();
  const [upgradeCount, setUpgradeCount] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<SecretCategory>("password");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  async function openCreateForm() {
    const quota = await getVaultQuotaStatus();
    if (quota.isLimitReached) {
      setUpgradeCount(quota.totalItems);
      return;
    }
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

  useOpenFocusedRecord(focusId, secrets, openEditForm);

  function closeForm() {
    setShowForm(false);
    setValue("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !value.trim()) return;

    const data = { title: title.trim(), category, value: value.trim(), notes: notes.trim() || undefined };
    try {
      if (editingSecret) {
        await updateSecret(editingSecret.id, data);
      } else {
        await createSecret(data);
      }
      closeForm();
      showToast(editingSecret ? "Secret updated" : "Secret added", "success");
    } catch (err) {
      if (err instanceof VaultLimitReachedError) {
        setUpgradeCount((await getVaultQuotaStatus()).totalItems);
      } else {
        showToast(err instanceof Error ? err.message : "Could not save this secret.", "error");
      }
    }
  }

  async function handleDelete(id: string) {
    if (window.confirm("Permanently delete this secret?")) {
      await deleteSecret(id);
      showToast("Secret deleted", "success");
    }
  }

  return (
    <div className="page-container fade-in">
      <PageHeader
        title="Secrets"
        subtitle="PINs, passwords, recovery phrases and lock combinations."
        actions={
          !showForm && (
            <button type="button" className="primary-button" onClick={() => void openCreateForm()}>
              + Add Secret
            </button>
          )
        }
      />

      {showForm && (
        <div className="card fade-in record-form-card">
          <div className="card-header">
            <h3>{editingSecret ? "Edit Secret" : "Add Secret"}</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} className="record-form">
              <div className="form-grid">
                <div className="form-field form-field-half">
                  <label htmlFor="secrets-title">Title</label>
                  <input id="secrets-title" required type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Locker PIN, Wallet seed" />
                </div>
                <div className="form-field form-field-half">
                  <label htmlFor="secrets-category">Category</label>
                  <select id="secrets-category" value={category} onChange={(e) => setCategory(e.target.value as SecretCategory)}>
                    {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field form-field-full">
                  <label htmlFor="secrets-secretValue">Secret value</label>
                  <textarea
                    id="secrets-secretValue"
                    required
                    rows={3}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="monospace-input"
                  />
                </div>
                <div className="form-field form-field-full">
                  <label htmlFor="secrets-additionalNotes">Notes (optional)</label>
                  <textarea id="secrets-additionalNotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context or hints" />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="primary-button">
                  Save Secret
                </button>
                <button type="button" className="secondary-button" onClick={closeForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!showForm && secrets.length === 0 && (
        <EmptyState icon="🔐" title="No secrets yet" text="Add a PIN, password or recovery phrase. It is encrypted on this device and hidden until you reveal it." />
      )}

      {!showForm && secrets.length > 0 && (
        <div className="grid-list">
          {secrets.map((s) => (
            <SecretCard key={s.id} secret={s} onEdit={() => openEditForm(s)} onDelete={() => void handleDelete(s.id)} />
          ))}
        </div>
      )}

      <ProUpgradeModal isOpen={upgradeCount !== null} onClose={() => setUpgradeCount(null)} currentCount={upgradeCount ?? 0} />
    </div>
  );
}

export default SecretsPage;
