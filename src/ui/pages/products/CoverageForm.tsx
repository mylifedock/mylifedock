import { useState } from "react";
import type { FormEvent } from "react";
import { createCoverage, coverageTypeLabel, updateCoverage } from "../../../application/coverageService";
import type { CreateCoverageInput } from "../../../application/coverageService";
import { createDocumentWithAttachment } from "../../../application/documentService";
import type { CoverageRecord, CoverageType } from "../../../infrastructure/database/db";
import { COVERAGE_TYPES } from "./productConstants";

/* ──────────────────────────────────────────
 * Coverage Form
 * ────────────────────────────────────────── */

type CoverageFormProps = {
  productId: string;
  productName: string;
  initialCoverage?: CoverageRecord;
  onSaved: () => void;
  onCancel: () => void;
};

export function CoverageForm({
  productId,
  productName,
  initialCoverage,
  onSaved,
  onCancel,
}: CoverageFormProps) {
  const isEditing =
    Boolean(initialCoverage);

  const [type, setType] =
    useState<CoverageType>(
      initialCoverage?.type ?? "warranty",
    );

  const [provider, setProvider] =
    useState(
      initialCoverage?.provider ?? "",
    );

  const [policyNumber, setPolicyNumber] =
    useState(
      initialCoverage?.policyNumber ?? "",
    );

  const [startDate, setStartDate] =
    useState(
      initialCoverage?.startDate ?? "",
    );

  const [endDate, setEndDate] =
    useState(
      initialCoverage?.endDate ?? "",
    );

  const [reminderEnabled, setReminderEnabled] =
    useState(
      initialCoverage?.reminderEnabled ??
        true,
    );

  const [
    reminderDaysBefore,
    setReminderDaysBefore,
  ] = useState(
    initialCoverage?.reminderDaysBefore !== undefined
      ? String(
          initialCoverage.reminderDaysBefore,
        )
      : "30",
  );

  const [coverageFile, setCoverageFile] =
    useState<File | undefined>();

  const [error, setError] =
    useState("");

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

    if (!startDate || !endDate) {
      setError(
        "Start and end dates are required.",
      );
      return;
    }

    const parsedDays = Number(
      reminderDaysBefore,
    );

    if (
      !Number.isFinite(parsedDays) ||
      parsedDays < 0
    ) {
      setError(
        "Reminder days must be a valid non-negative number.",
      );
      return;
    }

    try {
      setSaving(true);

      /*
       * If a coverage document was selected,
       * create a document record for it.
       */
      let documentId =
        initialCoverage?.documentId;

      if (coverageFile) {
        const label =
          coverageTypeLabel(type);

        const doc =
          await createDocumentWithAttachment({
            title: `${label} — ${productName}`,
            category: "product",
            sensitivity: "normal",
            storagePolicy: "local-only",
            tags: [
              type,
              "coverage",
              "product",
            ],
            file: coverageFile,
          });

        documentId = doc.id;
      }

      const input: CreateCoverageInput = {
        productId,
        type,
        provider:
          provider.trim() || undefined,
        policyNumber:
          policyNumber.trim() || undefined,
        startDate,
        endDate,
        documentId,
        reminderEnabled,
        reminderDaysBefore: parsedDays,
      };

      if (initialCoverage) {
        await updateCoverage(
          initialCoverage.id,
          input,
        );
      } else {
        await createCoverage(input);
      }

      onSaved();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save coverage.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="coverage-form-panel">
      <span className="eyebrow">
        {isEditing
          ? "EDIT COVERAGE"
          : "ADD COVERAGE"}
      </span>

      <h3>
        {isEditing
          ? "Update coverage"
          : "Add warranty, AMC or insurance"}
      </h3>

      <form
        className="coverage-form"
        onSubmit={handleSubmit}
      >
        <div className="product-form-grid">
          <div className="form-field">
            <label htmlFor="coverageType">
              Type *
            </label>

            <select
              id="coverageType"
              value={type}
              onChange={(event) =>
                setType(
                  event.target
                    .value as CoverageType,
                )
              }
            >
              {COVERAGE_TYPES.filter(
                // Insurance is managed in the Insurance section (and can be linked to this product there).
                (t) => t.value !== "insurance" || initialCoverage?.type === "insurance",
              ).map(
                (item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="coverageProvider">
              Provider
            </label>

            <input
              id="coverageProvider"
              value={provider}
              onChange={(event) =>
                setProvider(
                  event.target.value,
                )
              }
              placeholder="e.g. Samsung, Acko"
            />
          </div>

          <div className="form-field">
            <label htmlFor="coveragePolicyNumber">
              Policy / Reference #
            </label>

            <input
              id="coveragePolicyNumber"
              value={policyNumber}
              onChange={(event) =>
                setPolicyNumber(
                  event.target.value,
                )
              }
              placeholder="Policy or reference number"
            />
          </div>

          <div className="form-field">
            <label htmlFor="coverageStartDate">
              Start date *
            </label>

            <input
              id="coverageStartDate"
              type="date"
              value={startDate}
              onChange={(event) =>
                setStartDate(
                  event.target.value,
                )
              }
            />
          </div>

          <div className="form-field">
            <label htmlFor="coverageEndDate">
              End date *
            </label>

            <input
              id="coverageEndDate"
              type="date"
              value={endDate}
              onChange={(event) =>
                setEndDate(
                  event.target.value,
                )
              }
            />
          </div>

          <div className="form-field">
            <label htmlFor="coverageReminderDays">
              Remind before (days)
            </label>

            <input
              id="coverageReminderDays"
              type="number"
              min="0"
              value={reminderDaysBefore}
              onChange={(event) =>
                setReminderDaysBefore(
                  event.target.value,
                )
              }
              placeholder="30"
            />
          </div>

          <div className="form-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(event) =>
                  setReminderEnabled(
                    event.target.checked,
                  )
                }
              />{" "}
              Enable expiry reminder
            </label>
          </div>

          <div className="form-field product-form-full">
            <label htmlFor="coverageDocument">
              Attach proof document
            </label>

            <input
              id="coverageDocument"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(event) =>
                setCoverageFile(
                  event.target.files?.[0],
                )
              }
            />

            {coverageFile && (
              <small className="file-selection">
                Selected: {coverageFile.name}
              </small>
            )}

            {!coverageFile &&
              initialCoverage?.documentId && (
                <small className="file-selection">
                  Document already linked
                </small>
              )}
          </div>
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
              !startDate ||
              !endDate
            }
          >
            {saving
              ? "Saving..."
              : isEditing
                ? "Save changes"
                : "Add coverage"}

            <span>→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
