import {
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import { useLiveQuery } from "dexie-react-hooks";

import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
  type CreateProductInput,
} from "../../application/productService";

import {
  createCoverage,
  coverageStatus,
  coverageTypeLabel,
  deleteCoverage,
  getCoveragesForProduct,
  updateCoverage,
  type CreateCoverageInput,
} from "../../application/coverageService";

import {
  createDocumentWithAttachment,
} from "../../application/documentService";

import {
  getAttachmentsForDocument,
} from "../../application/attachmentService";

import type {
  SensitivityLevel,
  ProductRecord,
  CoverageRecord,
  CoverageType,
} from "../../infrastructure/database/db";

/* ──────────────────────────────────────────
 * Share helper
 * ────────────────────────────────────────── */

async function shareAttachmentBlob(
  fileName: string,
  blob: Blob,
  mimeType: string,
) {
  const file = new File(
    [blob],
    fileName,
    { type: mimeType },
  );

  if (
    navigator.share &&
    navigator.canShare?.({ files: [file] })
  ) {
    await navigator.share({
      title: fileName,
      files: [file],
    });
  } else {
    /*
     * Fallback: trigger a download.
     */
    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = "none";

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 10_000);
  }
}

/* ──────────────────────────────────────────
 * Product categories
 * ────────────────────────────────────────── */

const PRODUCT_CATEGORIES = [
  "Electronics",
  "Appliance",
  "Vehicle",
  "Furniture",
  "Personal",
  "Home",
  "Membership",
  "Other",
];

const COVERAGE_TYPES: {
  value: CoverageType;
  label: string;
}[] = [
  { value: "warranty", label: "Warranty" },
  {
    value: "extended-warranty",
    label: "Extended Warranty",
  },
  { value: "amc", label: "AMC" },
  { value: "insurance", label: "Insurance" },
];

/* ──────────────────────────────────────────
 * Product Form
 * ────────────────────────────────────────── */

type ProductFormProps = {
  initialProduct?: ProductRecord;
  onSaved: () => void;
  onCancel: () => void;
};

function ProductForm({
  initialProduct,
  onSaved,
  onCancel,
}: ProductFormProps) {
  const isEditing =
    Boolean(initialProduct);

  const [category, setCategory] =
    useState(
      initialProduct?.category ??
        "Electronics",
    );

  const [name, setName] =
    useState(
      initialProduct?.name ?? "",
    );

  const [brand, setBrand] =
    useState(
      initialProduct?.brand ?? "",
    );

  const [model, setModel] =
    useState(
      initialProduct?.model ?? "",
    );

  const [serialNumber, setSerialNumber] =
    useState(
      initialProduct?.serialNumber ?? "",
    );

  const [imei, setImei] =
    useState(
      initialProduct?.imei ?? "",
    );

  const [purchaseDate, setPurchaseDate] =
    useState(
      initialProduct?.purchaseDate ?? "",
    );

  const [purchasePrice, setPurchasePrice] =
    useState(
      initialProduct?.purchasePrice !==
        undefined
        ? String(
            initialProduct.purchasePrice,
          )
        : "",
    );

  const [vendor, setVendor] =
    useState(
      initialProduct?.vendor ?? "",
    );

  const [sensitivity, setSensitivity] =
    useState<SensitivityLevel>(
      initialProduct?.sensitivity ??
        "normal",
    );

  const [notes, setNotes] =
    useState(
      initialProduct?.notes ?? "",
    );

  const [invoiceFile, setInvoiceFile] =
    useState<File | undefined>();

  const [error, setError] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  async function handleScan(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsScanning(true);
      setScanProgress(10);
      setInvoiceFile(file);
      
      const { extractTextFromImage, parseReceiptData } = await import("../../application/ocrService");
      const extractedText = await extractTextFromImage(file, (p) => setScanProgress(p));
      
      const parsed = parseReceiptData(extractedText);
      if (parsed.vendor && !vendor) {
        setVendor(parsed.vendor);
      }
      if (parsed.vendor && !name) {
        setName(parsed.vendor);
      }
      if (parsed.date && !purchaseDate) {
        setPurchaseDate(parsed.date);
      }
      if (parsed.totalAmount && !purchasePrice) {
        setPurchasePrice(String(parsed.totalAmount));
      }

      setNotes((prev) => {
        const prefix = prev ? prev + "\n\n" : "";
        return prefix + "[OCR Scan Details]:\n" + extractedText.slice(0, 300);
      });

    } catch {
      setError("Failed to extract text from image. You can still save it manually.");
    } finally {
      setIsScanning(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setError("");

    const trimmedName =
      name.trim();

    if (!trimmedName) {
      setError(
        "Product name is required.",
      );
      return;
    }

    const parsedPrice =
      purchasePrice.trim()
        ? Number(purchasePrice)
        : undefined;

    if (
      parsedPrice !== undefined &&
      (!Number.isFinite(
        parsedPrice,
      ) ||
        parsedPrice < 0)
    ) {
      setError(
        "Enter a valid purchase price.",
      );
      return;
    }

    try {
      setSaving(true);

      /*
       * If an invoice file was selected,
       * create a document record for it first.
       */
      let invoiceDocumentId =
        initialProduct?.invoiceDocumentId;

      if (invoiceFile) {
        const invoiceDoc =
          await createDocumentWithAttachment({
            title: `Invoice — ${trimmedName}`,
            category: "product",
            sensitivity,
            storagePolicy: "local-only",
            tags: ["invoice", "product"],
            file: invoiceFile,
          });

        invoiceDocumentId =
          invoiceDoc.id;
      }

      const input: CreateProductInput = {
        category:
          category.trim(),

        name:
          trimmedName,

        brand:
          brand.trim() || undefined,

        model:
          model.trim() || undefined,

        serialNumber:
          serialNumber.trim() ||
          undefined,

        imei:
          imei.trim() || undefined,

        purchaseDate:
          purchaseDate ||
          undefined,

        purchasePrice:
          parsedPrice,

        vendor:
          vendor.trim() || undefined,

        sensitivity,

        notes:
          notes.trim() || undefined,

        invoiceDocumentId,
      };

      if (initialProduct) {
        await updateProduct(
          initialProduct.id,
          input,
        );
      } else {
        await createProduct(input);
      }

      onSaved();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save product.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel product-form-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            {isEditing
              ? "EDIT PRODUCT"
              : "NEW PRODUCT"}
          </span>

          <h2>
            {isEditing
              ? "Update product"
              : "Add a product"}
          </h2>
        </div>
      </div>

      <form
        className="product-form"
        onSubmit={handleSubmit}
      >
        <div className="product-form-grid">
          <div className="form-field">
            <label htmlFor="productCategory">
              Category
            </label>

            <select
              id="productCategory"
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value,
                )
              }
            >
              {PRODUCT_CATEGORIES.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="productName">
              Product name *
            </label>

            <input
              id="productName"
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value,
                )
              }
              placeholder="e.g. Samsung TV"
              autoFocus
            />
          </div>

          <div className="form-field">
            <label htmlFor="productBrand">
              Brand
            </label>

            <input
              id="productBrand"
              value={brand}
              onChange={(event) =>
                setBrand(
                  event.target.value,
                )
              }
              placeholder="e.g. Samsung"
            />
          </div>

          <div className="form-field">
            <label htmlFor="productModel">
              Model
            </label>

            <input
              id="productModel"
              value={model}
              onChange={(event) =>
                setModel(
                  event.target.value,
                )
              }
              placeholder="Model number"
            />
          </div>

          <div className="form-field">
            <label htmlFor="productSerial">
              Serial number
            </label>

            <input
              id="productSerial"
              value={serialNumber}
              onChange={(event) =>
                setSerialNumber(
                  event.target.value,
                )
              }
              placeholder="Serial number"
            />
          </div>

          <div className="form-field">
            <label htmlFor="productImei">
              IMEI
            </label>

            <input
              id="productImei"
              value={imei}
              onChange={(event) =>
                setImei(
                  event.target.value,
                )
              }
              placeholder="For phones/tablets"
              inputMode="numeric"
            />
          </div>

          <div className="form-field">
            <label htmlFor="purchaseDate">
              Purchase date
            </label>

            <input
              id="purchaseDate"
              type="date"
              value={purchaseDate}
              onChange={(event) =>
                setPurchaseDate(
                  event.target.value,
                )
              }
            />
          </div>

          <div className="form-field">
            <label htmlFor="purchasePrice">
              Purchase price
            </label>

            <input
              id="purchasePrice"
              type="number"
              min="0"
              step="0.01"
              value={purchasePrice}
              onChange={(event) =>
                setPurchasePrice(
                  event.target.value,
                )
              }
              placeholder="₹ 0"
            />
          </div>

          <div className="form-field">
            <label htmlFor="productVendor">
              Vendor / Store
            </label>

            <input
              id="productVendor"
              value={vendor}
              onChange={(event) =>
                setVendor(
                  event.target.value,
                )
              }
              placeholder="e.g. Amazon"
            />
          </div>

          <div className="form-field">
            <label htmlFor="productSensitivity">
              Privacy level
            </label>

            <select
              id="productSensitivity"
              value={sensitivity}
              onChange={(event) =>
                setSensitivity(
                  event.target
                    .value as SensitivityLevel,
                )
              }
            >
              <option value="normal">
                Normal
              </option>

              <option value="sensitive">
                Sensitive
              </option>

              <option value="critical">
                Critical
              </option>
            </select>
          </div>

          <div className="form-field product-form-full">
            <label htmlFor="productInvoice">
              Invoice attachment
            </label>

            <input
              id="productInvoice"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(event) =>
                setInvoiceFile(
                  event.target.files?.[0],
                )
              }
            />

            {invoiceFile && (
              <small className="file-selection">
                Selected: {invoiceFile.name}
              </small>
            )}

            {!invoiceFile &&
              initialProduct?.invoiceDocumentId && (
                <small className="file-selection">
                  Invoice already linked
                </small>
              )}
          </div>

          <div className="form-field product-form-full">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label htmlFor="productNotes" style={{ margin: 0 }}>
                Notes
              </label>
              <div>
                <label className="text-button" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <span>{isScanning ? `Scanning... ${scanProgress}%` : "📸 Auto-Fill via Scan"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleScan}
                    disabled={isScanning}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>

            <textarea
              id="productNotes"
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value,
                )
              }
              placeholder="Anything important about this product..."
              rows={4}
            />
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
              saving || !name.trim()
            }
          >
            {saving
              ? "Saving..."
              : isEditing
                ? "Save changes"
                : "Add product"}

            <span>→</span>
          </button>
        </div>
      </form>
    </section>
  );
}

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

function CoverageForm({
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
              {COVERAGE_TYPES.map(
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

/* ──────────────────────────────────────────
 * Coverage Card
 * ────────────────────────────────────────── */

function CoverageCard({
  coverage,
  onDelete,
  onViewDocument,
  onShareDocument,
}: {
  coverage: CoverageRecord;
  onDelete: () => void;
  onViewDocument: () => void;
  onShareDocument: () => void;
}) {
  const status = coverageStatus(coverage);
  const label = coverageTypeLabel(
    coverage.type,
  );

  return (
    <div className="coverage-card">
      <div className="coverage-card-header">
        <div>
          <span className="eyebrow">
            {label}
          </span>

          {coverage.provider && (
            <strong>{coverage.provider}</strong>
          )}
        </div>

        <span
          className={`coverage-status-badge coverage-status-${status}`}
        >
          {status === "active"
            ? "Active"
            : status === "expiring-soon"
              ? "Expiring soon"
              : "Expired"}
        </span>
      </div>

      <div className="coverage-card-details">
        <div>
          <small>Period</small>
          <strong>
            {coverage.startDate} →{" "}
            {coverage.endDate}
          </strong>
        </div>

        {coverage.policyNumber && (
          <div>
            <small>Policy #</small>
            <strong>
              {coverage.policyNumber}
            </strong>
          </div>
        )}

        {coverage.reminderEnabled && (
          <div>
            <small>Reminder</small>
            <strong>
              {coverage.reminderDaysBefore}{" "}
              days before expiry
            </strong>
          </div>
        )}
      </div>

      <div className="coverage-card-actions">
        {coverage.documentId && (
          <>
            <button
              type="button"
              className="text-button"
              onClick={onViewDocument}
            >
              View proof
            </button>

            <button
              type="button"
              className="text-button"
              onClick={onShareDocument}
            >
              Share
            </button>
          </>
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
 * Product Detail Item
 * ────────────────────────────────────────── */

function ProductDetailItem({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="product-detail-item">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

/* ──────────────────────────────────────────
 * Product Details (full modal)
 * ────────────────────────────────────────── */

function ProductDetails({
  product,
  onEdit,
  onClose,
}: {
  product: ProductRecord;
  onEdit: () => void;
  onClose: () => void;
}) {
  const formattedPrice =
    product.purchasePrice !==
    undefined
      ? `₹ ${product.purchasePrice.toLocaleString(
          "en-IN",
        )}`
      : undefined;

  const coverages = useLiveQuery(
    () =>
      getCoveragesForProduct(
        product.id,
      ),
    [product.id],
    [],
  );

  const invoiceAttachments = useLiveQuery(
    () =>
      product.invoiceDocumentId
        ? getAttachmentsForDocument(
            product.invoiceDocumentId,
          )
        : Promise.resolve([]),
    [product.invoiceDocumentId],
    [],
  );

  const [showCoverageForm, setShowCoverageForm] =
    useState(false);

  const [coverageError, setCoverageError] =
    useState("");

  async function handleDeleteCoverage(
    coverage: CoverageRecord,
  ) {
    const confirmed = window.confirm(
      `Delete this ${coverageTypeLabel(coverage.type)}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setCoverageError("");
      await deleteCoverage(coverage.id);
    } catch (error) {
      setCoverageError(
        error instanceof Error
          ? error.message
          : "Unable to delete coverage.",
      );
    }
  }

  async function handleShareCoverageDocument(
    coverage: CoverageRecord,
  ) {
    if (!coverage.documentId) {
      return;
    }

    try {
      const attachments =
        await getAttachmentsForDocument(
          coverage.documentId,
        );

      const attachment = attachments[0];

      if (!attachment?.blob) {
        return;
      }

      await shareAttachmentBlob(
        attachment.fileName,
        attachment.blob,
        attachment.mimeType,
      );
    } catch {
      /* Share cancelled or unavailable */
    }
  }

  async function handleViewCoverageDocument(
    coverage: CoverageRecord,
  ) {
    if (!coverage.documentId) {
      return;
    }

    try {
      const attachments =
        await getAttachmentsForDocument(
          coverage.documentId,
        );

      const attachment = attachments[0];

      if (!attachment?.blob) {
        return;
      }

      const url = URL.createObjectURL(
        attachment.blob,
      );

      window.open(url, "_blank");

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 30_000);
    } catch {
      /* View failed */
    }
  }

  async function handleShareInvoice() {
    const attachment =
      invoiceAttachments[0];

    if (!attachment?.blob) {
      return;
    }

    try {
      await shareAttachmentBlob(
        attachment.fileName,
        attachment.blob,
        attachment.mimeType,
      );
    } catch {
      /* Share cancelled or unavailable */
    }
  }

  async function handleViewInvoice() {
    const attachment =
      invoiceAttachments[0];

    if (!attachment?.blob) {
      return;
    }

    const url = URL.createObjectURL(
      attachment.blob,
    );

    window.open(url, "_blank");

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 30_000);
  }

  return (
    <div
      className="product-detail-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className="product-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
      >
        <div className="product-detail-header">
          <div>
            <span className="eyebrow">
              {product.category}
            </span>

            <h2 id="product-detail-title">
              {product.name}
            </h2>

            {product.brand && (
              <p>
                {product.brand}
                {product.model
                  ? ` · ${product.model}`
                  : ""}
              </p>
            )}
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close product details"
          >
            ×
          </button>
        </div>

        <div className="product-detail-status">
          <span
            className={`sensitivity-badge sensitivity-${product.sensitivity}`}
          >
            {product.sensitivity}
          </span>

          {product.invoiceDocumentId ? (
            <span className="product-invoice-status product-invoice-linked">
              Invoice linked
            </span>
          ) : (
            <span className="product-invoice-status">
              No invoice linked
            </span>
          )}
        </div>

        <div className="product-detail-section">
          <span className="eyebrow">
            PRODUCT INFORMATION
          </span>

          <div className="product-detail-grid">
            <ProductDetailItem
              label="Category"
              value={product.category}
            />

            <ProductDetailItem
              label="Brand"
              value={product.brand}
            />

            <ProductDetailItem
              label="Model"
              value={product.model}
            />

            <ProductDetailItem
              label="Serial number"
              value={product.serialNumber}
            />

            <ProductDetailItem
              label="IMEI"
              value={product.imei}
            />
          </div>
        </div>

        <div className="product-detail-section">
          <span className="eyebrow">
            PURCHASE INFORMATION
          </span>

          <div className="product-detail-grid">
            <ProductDetailItem
              label="Purchase date"
              value={product.purchaseDate}
            />

            <ProductDetailItem
              label="Purchase price"
              value={formattedPrice}
            />

            <ProductDetailItem
              label="Vendor / Store"
              value={product.vendor}
            />
          </div>
        </div>

        {/* Invoice section */}
        {invoiceAttachments.length > 0 && (
          <div className="product-detail-section">
            <span className="eyebrow">
              INVOICE
            </span>

            <div className="coverage-card">
              <div className="coverage-card-header">
                <div>
                  <strong>
                    {invoiceAttachments[0].fileName}
                  </strong>
                </div>
              </div>

              <div className="coverage-card-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    void handleViewInvoice()
                  }
                >
                  View
                </button>

                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    void handleShareInvoice()
                  }
                >
                  Share
                </button>
              </div>
            </div>
          </div>
        )}

        {product.notes && (
          <div className="product-detail-section">
            <span className="eyebrow">
              NOTES
            </span>

            <p className="product-detail-notes">
              {product.notes}
            </p>
          </div>
        )}

        {/* Coverage section */}
        <div className="product-detail-section">
          <div className="coverage-section-header">
            <div>
              <span className="eyebrow">
                PROTECTION
              </span>

              <h3>
                Warranty & coverage
              </h3>
            </div>

            {!showCoverageForm && (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setShowCoverageForm(true)
                }
              >
                + Add coverage
              </button>
            )}
          </div>

          {coverageError && (
            <div className="vault-error">
              {coverageError}
            </div>
          )}

          {showCoverageForm && (
            <CoverageForm
              productId={product.id}
              productName={product.name}
              onSaved={() =>
                setShowCoverageForm(false)
              }
              onCancel={() =>
                setShowCoverageForm(false)
              }
            />
          )}

          {coverages.length === 0 &&
            !showCoverageForm && (
              <div className="coverage-empty">
                <p>
                  No warranty, AMC or insurance
                  added yet.
                </p>

                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setShowCoverageForm(true)
                  }
                >
                  Add first coverage →
                </button>
              </div>
            )}

          {coverages.length > 0 && (
            <div className="coverages-list">
              {coverages.map(
                (coverage) => (
                  <CoverageCard
                    key={coverage.id}
                    coverage={coverage}
                    onDelete={() =>
                      void handleDeleteCoverage(
                        coverage,
                      )
                    }
                    onViewDocument={() =>
                      void handleViewCoverageDocument(
                        coverage,
                      )
                    }
                    onShareDocument={() =>
                      void handleShareCoverageDocument(
                        coverage,
                      )
                    }
                  />
                ),
              )}
            </div>
          )}
        </div>

        <div className="product-detail-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
          >
            Close
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={onEdit}
          >
            Edit product
            <span>→</span>
          </button>
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────
 * Product Card
 * ────────────────────────────────────────── */

function ProductCard({
  product,
  onView,
  onEdit,
  onDelete,
}: {
  product: ProductRecord;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const coverages = useLiveQuery(
    () =>
      getCoveragesForProduct(
        product.id,
      ),
    [product.id],
    [],
  );

  const activeCoverages =
    coverages.filter(
      (c) =>
        coverageStatus(c) !== "expired",
    );

  return (
    <article className="product-card">
      <div className="product-card-top">
        <div className="product-card-icon">
          □
        </div>

        <div className="product-card-title">
          <span className="eyebrow">
            {product.category}
          </span>

          <h3>{product.name}</h3>
        </div>

        <span
          className={`sensitivity-badge sensitivity-${product.sensitivity}`}
        >
          {product.sensitivity}
        </span>
      </div>

      <div className="product-details">
        {product.brand && (
          <div>
            <small>Brand</small>
            <strong>
              {product.brand}
            </strong>
          </div>
        )}

        {product.model && (
          <div>
            <small>Model</small>
            <strong>
              {product.model}
            </strong>
          </div>
        )}

        {product.serialNumber && (
          <div>
            <small>Serial</small>
            <strong>
              {product.serialNumber}
            </strong>
          </div>
        )}

        {product.purchaseDate && (
          <div>
            <small>Purchased</small>
            <strong>
              {product.purchaseDate}
            </strong>
          </div>
        )}

        {product.purchasePrice !==
          undefined && (
          <div>
            <small>Price</small>
            <strong>
              ₹{" "}
              {product.purchasePrice.toLocaleString(
                "en-IN",
              )}
            </strong>
          </div>
        )}

        {product.vendor && (
          <div>
            <small>Vendor</small>
            <strong>
              {product.vendor}
            </strong>
          </div>
        )}
      </div>

      {/* Coverage summary badges */}
      {activeCoverages.length > 0 && (
        <div className="product-card-coverages">
          {activeCoverages.map((c) => (
            <span
              key={c.id}
              className={`coverage-badge coverage-status-${coverageStatus(c)}`}
            >
              {coverageTypeLabel(c.type)}
            </span>
          ))}
        </div>
      )}

      {product.notes && (
        <p className="product-card-notes">
          {product.notes}
        </p>
      )}

      <div className="product-card-actions">
        <button
          type="button"
          className="text-button"
          onClick={onView}
        >
          View details
        </button>

        <button
          type="button"
          className="text-button"
          onClick={onEdit}
        >
          Edit
        </button>

        <button
          type="button"
          className="document-delete"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

/* ──────────────────────────────────────────
 * Products Page
 * ────────────────────────────────────────── */

function ProductsPage() {
  const products = useLiveQuery(
    () => getProducts(),
    [],
    [],
  );

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    editingProduct,
    setEditingProduct,
  ] = useState<
    ProductRecord | undefined
  >();

  const [
    selectedProduct,
    setSelectedProduct,
  ] = useState<
    ProductRecord | undefined
  >();

  const [
    deletingProductId,
    setDeletingProductId,
  ] = useState<
    string | null
  >(null);

  const [
    pageError,
    setPageError,
  ] = useState("");

  function openCreateForm() {
    setPageError("");
    setEditingProduct(undefined);
    setSelectedProduct(undefined);
    setShowForm(true);
  }

  function openEditForm(
    product: ProductRecord,
  ) {
    setPageError("");
    setSelectedProduct(undefined);
    setEditingProduct(product);
    setShowForm(true);
  }

  function openDetails(
    product: ProductRecord,
  ) {
    setPageError("");
    setSelectedProduct(product);
  }

  function closeForm() {
    setShowForm(false);
    setEditingProduct(undefined);
  }

  function closeDetails() {
    setSelectedProduct(undefined);
  }

  async function handleDelete(
    product: ProductRecord,
  ) {
    if (
      deletingProductId !== null
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${product.name}" from MyLifeDock?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setPageError("");
      setDeletingProductId(
        product.id,
      );

      await deleteProduct(
        product.id,
      );

      if (
        selectedProduct?.id ===
        product.id
      ) {
        setSelectedProduct(
          undefined,
        );
      }
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to delete product.",
      );
    } finally {
      setDeletingProductId(
        null,
      );
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">
            YOUR PRODUCTS
          </span>

          <h1>
            Products
            <br />
            <span>
              worth keeping track of.
            </span>
          </h1>

          <p>
            Keep your appliances,
            electronics, vehicles and other
            important purchases organized in
            one place.
          </p>
        </div>

        {!showForm && (
          <button
            type="button"
            className="primary-button"
            onClick={openCreateForm}
          >
            Add Product
            <span>+</span>
          </button>
        )}
      </header>

      {pageError && (
        <div className="vault-error">
          {pageError}
        </div>
      )}

      {showForm && (
        <ProductForm
          initialProduct={
            editingProduct
          }
          onSaved={closeForm}
          onCancel={closeForm}
        />
      )}

      {!showForm && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                YOUR INVENTORY
              </span>

              <h2>
                {products.length}{" "}
                {products.length === 1
                  ? "product"
                  : "products"}
              </h2>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                □
              </div>

              <h3>
                Your products will
                appear here
              </h3>

              <p>
                Add your first product to
                keep purchase details,
                serial numbers, invoices
                and warranty information
                organized.
              </p>

              <button
                type="button"
                className="text-button"
                onClick={openCreateForm}
              >
                Add your first product →
              </button>
            </div>
          ) : (
            <div className="products-grid">
              {products.map(
                (product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onView={() =>
                      openDetails(
                        product,
                      )
                    }
                    onEdit={() =>
                      openEditForm(
                        product,
                      )
                    }
                    onDelete={() =>
                      void handleDelete(
                        product,
                      )
                    }
                  />
                ),
              )}
            </div>
          )}
        </section>
      )}

      {selectedProduct && (
        <ProductDetails
          product={selectedProduct}
          onClose={closeDetails}
          onEdit={() =>
            openEditForm(
              selectedProduct,
            )
          }
        />
      )}
    </div>
  );
}

export default ProductsPage;