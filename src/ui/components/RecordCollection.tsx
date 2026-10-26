import { useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "./Toast";
import { AttachmentManager } from "./AttachmentManager";
import { ProUpgradeModal } from "./ProUpgradeModal";
import { EmptyState, PageHeader } from "./PageHeader";
import { deleteAttachmentsFor } from "../../application/attachmentService";
import { getVaultQuotaStatus, VaultLimitReachedError } from "../../application/vaultLimitService";
import { useOpenFocusedRecord } from "../useActiveProfileFilter";

type FieldValue = string | number | boolean | undefined;

export interface FieldDef<D> {
  key: keyof D & string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "checkbox";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  inputMode?: "numeric" | "decimal" | "text";
  maxLength?: number;
  pattern?: string;
  step?: string;
  /** Sits next to the following half-width field on wide screens. */
  half?: boolean;
  hint?: string;
}

export interface RecordCard {
  title: string;
  badge?: string;
  badgeTone?: "active" | "warning" | "danger";
  lines: [label: string, value: string | undefined][];
  notes?: string;
}

interface RecordCollectionProps<R extends { id: string }, D extends object> {
  /** Singular name shown in buttons and messages, e.g. "Vehicle". */
  noun: string;
  items: R[] | undefined;
  fields: FieldDef<D>[];
  emptyDraft: () => D;
  toDraft: (record: R) => D;
  create: (draft: D, id: string) => Promise<unknown>;
  update: (id: string, draft: D) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  card: (record: R) => RecordCard;
  empty: { icon: string; title: string; text: string };
  /** Full page header; when omitted (inside a tabbed section) a small toolbar is shown. */
  header?: { title: string; subtitle?: string };
  notice?: ReactNode;
  attachments?: boolean;
  /** Opens this record's form once it has loaded (search results). */
  focusId?: string;
}

/**
 * List + add/edit form shared by Insurance, Accounts, Vehicles and Properties,
 * so they behave the same: the free-vault limit is checked before a new form
 * opens, files attached to a cancelled new record are removed, and empty
 * number fields are saved as "not set" instead of NaN.
 */
export function RecordCollection<R extends { id: string }, D extends object>(props: RecordCollectionProps<R, D>) {
  const { noun, items, fields, emptyDraft, toDraft, create, update, remove, card, empty, header, notice, attachments, focusId } = props;
  const { showToast } = useToast();
  const [draft, setDraft] = useState<D | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [upgradeCount, setUpgradeCount] = useState<number | null>(null);
  const pendingNewId = useRef<string | null>(null);

  // A new record's attachments are saved before the record itself; drop them if the form is abandoned.
  useEffect(() => () => {
    if (pendingNewId.current) void deleteAttachmentsFor(pendingNewId.current);
  }, []);

  async function openNew() {
    const quota = await getVaultQuotaStatus();
    if (quota.isLimitReached) {
      setUpgradeCount(quota.totalItems);
      return;
    }
    const id = crypto.randomUUID();
    pendingNewId.current = id;
    setDraft(emptyDraft());
    setRecordId(id);
    setIsNew(true);
  }

  function openEdit(record: R) {
    setDraft(toDraft(record));
    setRecordId(record.id);
    setIsNew(false);
  }

  useOpenFocusedRecord(focusId, items, openEdit);

  function closeForm(discardNew: boolean) {
    if (discardNew && isNew && recordId) void deleteAttachmentsFor(recordId);
    pendingNewId.current = null;
    setDraft(null);
    setRecordId(null);
    setIsNew(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !recordId || isSaving) return;
    setIsSaving(true);
    try {
      if (isNew) {
        await create(draft, recordId);
        showToast(`${noun} added`, "success");
      } else {
        await update(recordId, draft);
        showToast(`${noun} updated`, "success");
      }
      closeForm(false);
    } catch (err) {
      if (err instanceof VaultLimitReachedError) {
        setUpgradeCount((await getVaultQuotaStatus()).totalItems);
      } else {
        showToast(err instanceof Error ? err.message : `Could not save this ${noun.toLowerCase()}.`, "error");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(record: R) {
    if (!window.confirm(`Delete this ${noun.toLowerCase()}? Its attachments are deleted too.`)) return;
    try {
      await remove(record.id);
      showToast(`${noun} deleted`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Could not delete this ${noun.toLowerCase()}.`, "error");
    }
  }

  function setField(key: string, value: FieldValue) {
    setDraft((current) => (current ? ({ ...current, [key]: value } as D) : current));
  }

  const addButton = !draft && (
    <button type="button" className="primary-button" onClick={() => void openNew()}>
      + Add {noun}
    </button>
  );

  return (
    <div className="record-collection">
      {header ? (
        <PageHeader title={header.title} subtitle={header.subtitle} actions={addButton} />
      ) : (
        addButton && <div className="section-toolbar">{addButton}</div>
      )}

      {notice}

      {draft && recordId && (
        <div className="card fade-in record-form-card">
          <div className="card-header">
            <h3>{isNew ? `Add ${noun}` : `Edit ${noun}`}</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} className="record-form">
              <div className="form-grid">
                {fields.map((field) => (
                  <FieldInput
                    key={field.key}
                    field={field}
                    idPrefix={noun.toLowerCase().replace(/\s+/g, "-")}
                    value={(draft as Record<string, FieldValue>)[field.key]}
                    onChange={(value) => setField(field.key, value)}
                  />
                ))}
              </div>

              {attachments && (
                <div className="record-form-attachments">
                  <AttachmentManager entityId={recordId} />
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={isSaving}>
                  {isSaving ? "Saving..." : `Save ${noun}`}
                </button>
                <button type="button" className="secondary-button" onClick={() => closeForm(true)} disabled={isSaving}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!draft && items && items.length === 0 && <EmptyState icon={empty.icon} title={empty.title} text={empty.text} />}

      {!draft && items && items.length > 0 && (
        <div className="grid-list">
          {items.map((record) => {
            const view = card(record);
            return (
              <article key={record.id} className="card fade-in record-card">
                <div className="card-header">
                  <h3>{view.title}</h3>
                  {view.badge && <span className={`status-badge ${view.badgeTone ?? "active"}`}>{view.badge}</span>}
                </div>
                <div className="card-body">
                  <dl className="record-lines">
                    {view.lines
                      .filter(([, value]) => value !== undefined && value !== "")
                      .map(([label, value]) => (
                        <div key={label} className="record-line">
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                  </dl>
                  {view.notes && <p className="record-notes">{view.notes}</p>}
                  <div className="record-actions">
                    <button type="button" className="secondary-button" onClick={() => openEdit(record)}>
                      Edit
                    </button>
                    <button type="button" className="text-button danger-text" onClick={() => void handleDelete(record)}>
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ProUpgradeModal isOpen={upgradeCount !== null} onClose={() => setUpgradeCount(null)} currentCount={upgradeCount ?? 0} />
    </div>
  );
}

function FieldInput<D>({
  field,
  idPrefix,
  value,
  onChange,
}: {
  field: FieldDef<D>;
  idPrefix: string;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}) {
  const id = `${idPrefix}-${field.key}`;
  const className = `form-field ${field.half ? "form-field-half" : "form-field-full"}`;

  if (field.type === "checkbox") {
    return (
      <div className={`${className} form-field-checkbox`}>
        <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        <label htmlFor={id}>{field.label}</label>
      </div>
    );
  }

  const text = value === undefined || value === null ? "" : String(value);
  const common = {
    id,
    required: field.required,
    placeholder: field.placeholder,
  };

  return (
    <div className={className}>
      <label htmlFor={id}>{field.label}</label>
      {field.type === "select" ? (
        <select {...common} value={text} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea {...common} rows={3} value={text} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "number" ? (
        <input
          {...common}
          type="number"
          inputMode={field.inputMode ?? "decimal"}
          step={field.step ?? "any"}
          value={text}
          onChange={(e) => {
            const parsed = e.target.value === "" ? undefined : Number(e.target.value);
            onChange(parsed === undefined || Number.isNaN(parsed) ? undefined : parsed);
          }}
        />
      ) : (
        <input
          {...common}
          type={field.type}
          inputMode={field.inputMode}
          maxLength={field.maxLength}
          pattern={field.pattern}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.hint && <small className="field-hint">{field.hint}</small>}
    </div>
  );
}
