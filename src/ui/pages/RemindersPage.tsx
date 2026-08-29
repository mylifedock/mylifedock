import {
  useState,
  useEffect,
} from "react";

import type {
  FormEvent,
} from "react";

import { useLiveQuery } from "dexie-react-hooks";

import {
  createReminder,
  deleteReminder,
  dismissReminder,
  getReminders,
  syncCoverageReminders,
  syncDocumentReminders,
  type CreateReminderInput,
} from "../../application/reminderService";

import type {
  ReminderRecord,
} from "../../infrastructure/database/db";

/* ──────────────────────────────────────────
 * Reminder status helper
 * ────────────────────────────────────────── */

function reminderStatus(
  reminder: ReminderRecord,
): "overdue" | "upcoming" | "dismissed" {
  if (!reminder.enabled) {
    return "dismissed";
  }

  const todayStr = new Date()
    .toISOString()
    .slice(0, 10);

  if (reminder.dueDate < todayStr) {
    return "overdue";
  }

  return "upcoming";
}

function daysUntil(dateStr: string): number {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const target = new Date(dateStr);

  target.setHours(0, 0, 0, 0);

  const diff =
    target.getTime() - today.getTime();

  return Math.ceil(
    diff / (1000 * 60 * 60 * 24),
  );
}

function formatDueLabel(
  dateStr: string,
): string {
  const days = daysUntil(dateStr);

  if (days < 0) {
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  }

  if (days === 0) {
    return "Due today";
  }

  if (days === 1) {
    return "Due tomorrow";
  }

  return `Due in ${days} days`;
}

/* ──────────────────────────────────────────
 * Create Reminder Form
 * ────────────────────────────────────────── */

function ReminderForm({
  onSaved,
  onCancel,
}: {
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");

  const [dueDate, setDueDate] =
    useState("");

  const [error, setError] = useState("");

  const [saving, setSaving] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setError("");

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    if (!dueDate) {
      setError("Due date is required.");
      return;
    }

    try {
      setSaving(true);

      const input: CreateReminderInput = {
        title: title.trim(),
        dueDate,
        enabled: true,
      };

      await createReminder(input);

      onSaved();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create reminder.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            NEW REMINDER
          </span>

          <h2>Create a reminder</h2>
        </div>
      </div>

      <form
        className="reminder-form"
        onSubmit={handleSubmit}
      >
        <div className="form-field">
          <label htmlFor="reminderTitle">
            Title *
          </label>

          <input
            id="reminderTitle"
            value={title}
            onChange={(event) =>
              setTitle(
                event.target.value,
              )
            }
            placeholder="e.g. Renew car insurance"
            autoFocus
          />
        </div>

        <div className="form-field">
          <label htmlFor="reminderDueDate">
            Due date *
          </label>

          <input
            id="reminderDueDate"
            type="date"
            value={dueDate}
            onChange={(event) =>
              setDueDate(
                event.target.value,
              )
            }
          />
        </div>

        {error && (
          <div className="vault-error">
            {error}
          </div>
        )}

        <div className="product-form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={
              saving ||
              !title.trim() ||
              !dueDate
            }
          >
            {saving
              ? "Saving..."
              : "Add reminder"}

            <span>→</span>
          </button>
        </div>
      </form>
    </section>
  );
}

/* ──────────────────────────────────────────
 * Reminder Card
 * ────────────────────────────────────────── */

function ReminderCard({
  reminder,
  onDismiss,
  onDelete,
}: {
  reminder: ReminderRecord;
  onDismiss: () => void;
  onDelete: () => void;
}) {
  const status = reminderStatus(reminder);

  const entityLabel =
    reminder.relatedEntityType === "coverage"
      ? "Coverage"
      : reminder.relatedEntityType ===
          "document"
        ? "Document"
        : undefined;

  return (
    <div
      className={`reminder-card reminder-${status}`}
    >
      <div className="reminder-card-header">
        <div>
          <strong>{reminder.title}</strong>

          <small
            className={`reminder-due-label reminder-due-${status}`}
          >
            {formatDueLabel(
              reminder.dueDate,
            )}
          </small>
        </div>

        <span
          className={`reminder-status-badge reminder-status-${status}`}
        >
          {status === "overdue"
            ? "Overdue"
            : status === "upcoming"
              ? "Upcoming"
              : "Dismissed"}
        </span>
      </div>

      <div className="reminder-card-meta">
        <small>
          Due: {reminder.dueDate}
        </small>

        {entityLabel && (
          <small>
            Linked to: {entityLabel}
          </small>
        )}
      </div>

      <div className="reminder-card-actions">
        {reminder.enabled && (
          <button
            type="button"
            className="text-button"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        )}

        <button
          type="button"
          className="document-delete"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
 * Reminders Page
 * ────────────────────────────────────────── */

type ReminderFilter =
  | "all"
  | "upcoming"
  | "overdue"
  | "dismissed";

function RemindersPage() {
  const reminders = useLiveQuery(
    () => getReminders(),
    [],
    [],
  );

  const [showForm, setShowForm] =
    useState(false);

  const [filter, setFilter] =
    useState<ReminderFilter>("all");

  const [pageError, setPageError] =
    useState("");

  const [syncMessage, setSyncMessage] =
    useState("");

  /*
   * Auto-sync coverage and document reminders
   * when the page loads.
   */
  useEffect(() => {
    async function autoSync() {
      try {
        const coverageCount =
          await syncCoverageReminders();

        const documentCount =
          await syncDocumentReminders();

        const total =
          coverageCount + documentCount;

        if (total > 0) {
          setSyncMessage(
            `${total} automatic reminder${total === 1 ? "" : "s"} created from your coverages and documents.`,
          );

          window.setTimeout(() => {
            setSyncMessage("");
          }, 5000);
        }
      } catch {
        /* Sync failure is non-critical */
      }
    }

    void autoSync();
  }, []);

  const filteredReminders =
    reminders.filter((r) => {
      const status = reminderStatus(r);

      switch (filter) {
        case "upcoming":
          return status === "upcoming";
        case "overdue":
          return status === "overdue";
        case "dismissed":
          return status === "dismissed";
        default:
          return true;
      }
    });

  const overdueCount = reminders.filter(
    (r) =>
      reminderStatus(r) === "overdue",
  ).length;

  const upcomingCount = reminders.filter(
    (r) =>
      reminderStatus(r) === "upcoming",
  ).length;

  async function handleDismiss(
    id: string,
  ) {
    try {
      setPageError("");
      await dismissReminder(id);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to dismiss reminder.",
      );
    }
  }

  async function handleDelete(
    reminder: ReminderRecord,
  ) {
    const confirmed = window.confirm(
      `Delete reminder "${reminder.title}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setPageError("");
      await deleteReminder(reminder.id);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to delete reminder.",
      );
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">
            STAY ON TOP OF THINGS
          </span>

          <h1>
            Reminders
            <br />
            <span>
              never miss a deadline.
            </span>
          </h1>

          <p>
            Track warranty expiries,
            document renewals, and anything
            important with automatic and
            manual reminders.
          </p>
        </div>

        {!showForm && (
          <button
            type="button"
            className="primary-button"
            onClick={() =>
              setShowForm(true)
            }
          >
            Add Reminder
            <span>+</span>
          </button>
        )}
      </header>

      {syncMessage && (
        <div className="reminder-sync-message">
          {syncMessage}
        </div>
      )}

      {pageError && (
        <div className="vault-error">
          {pageError}
        </div>
      )}

      {showForm && (
        <ReminderForm
          onSaved={() =>
            setShowForm(false)
          }
          onCancel={() =>
            setShowForm(false)
          }
        />
      )}

      {!showForm && (
        <>
          {/* Filter tabs */}
          <div className="reminder-filters">
            <button
              type="button"
              className={`reminder-filter-tab ${filter === "all" ? "reminder-filter-active" : ""}`}
              onClick={() =>
                setFilter("all")
              }
            >
              All ({reminders.length})
            </button>

            <button
              type="button"
              className={`reminder-filter-tab ${filter === "upcoming" ? "reminder-filter-active" : ""}`}
              onClick={() =>
                setFilter("upcoming")
              }
            >
              Upcoming ({upcomingCount})
            </button>

            <button
              type="button"
              className={`reminder-filter-tab ${filter === "overdue" ? "reminder-filter-active" : ""} ${overdueCount > 0 ? "reminder-filter-overdue" : ""}`}
              onClick={() =>
                setFilter("overdue")
              }
            >
              Overdue ({overdueCount})
            </button>

            <button
              type="button"
              className={`reminder-filter-tab ${filter === "dismissed" ? "reminder-filter-active" : ""}`}
              onClick={() =>
                setFilter("dismissed")
              }
            >
              Dismissed
            </button>
          </div>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  YOUR REMINDERS
                </span>

                <h2>
                  {filteredReminders.length}{" "}
                  {filteredReminders.length ===
                  1
                    ? "reminder"
                    : "reminders"}
                </h2>
              </div>
            </div>

            {filteredReminders.length ===
            0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  ◷
                </div>

                <h3>
                  {filter === "all"
                    ? "No reminders yet"
                    : `No ${filter} reminders`}
                </h3>

                <p>
                  {filter === "all"
                    ? "Add your first reminder or let MyLifeDock auto-create them from your coverage expiry dates."
                    : `You don't have any ${filter} reminders right now.`}
                </p>

                {filter === "all" && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setShowForm(true)
                    }
                  >
                    Create a reminder →
                  </button>
                )}
              </div>
            ) : (
              <div className="reminders-list">
                {filteredReminders.map(
                  (reminder) => (
                    <ReminderCard
                      key={reminder.id}
                      reminder={reminder}
                      onDismiss={() =>
                        void handleDismiss(
                          reminder.id,
                        )
                      }
                      onDelete={() =>
                        void handleDelete(
                          reminder,
                        )
                      }
                    />
                  ),
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default RemindersPage;
