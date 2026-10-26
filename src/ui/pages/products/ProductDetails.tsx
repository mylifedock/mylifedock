import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { formatCurrency } from "../../../application/currencyService";
import { coverageStatus, coverageTypeLabel, deleteCoverage, getCoveragesForProduct } from "../../../application/coverageService";
import { getAttachmentsForDocument } from "../../../application/attachmentService";
import type { ProductRecord, CoverageRecord } from "../../../infrastructure/database/db";
import { AttachmentPreviewModal } from "../../components/AttachmentPreviewModal";
import type { PreviewFile } from "../../components/AttachmentPreviewModal";
import { shareFile } from "../../../platform/fileExport";
import { CoverageForm } from "./CoverageForm";

/* ──────────────────────────────────────────
 * Coverage Card
 * ────────────────────────────────────────── */

export function CoverageCard({
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

export function ProductDetailItem({
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

export function ProductDetails({
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
      ? formatCurrency(product.purchasePrice)
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

  const [previewFile, setPreviewFile] =
    useState<PreviewFile | null>(null);

  async function firstCoverageAttachment(
    coverage: CoverageRecord,
  ) {
    if (!coverage.documentId) {
      return undefined;
    }

    const attachments =
      await getAttachmentsForDocument(
        coverage.documentId,
      );

    return attachments[0]?.blob
      ? attachments[0]
      : undefined;
  }

  async function handleShareCoverageDocument(
    coverage: CoverageRecord,
  ) {
    try {
      const attachment =
        await firstCoverageAttachment(coverage);

      if (!attachment) {
        return;
      }

      await shareFile(
        attachment.blob,
        attachment.fileName,
        attachment.mimeType,
      );
    } catch {
      setCoverageError("Unable to share this document.");
    }
  }

  async function handleViewCoverageDocument(
    coverage: CoverageRecord,
  ) {
    try {
      const attachment =
        await firstCoverageAttachment(coverage);

      if (!attachment) {
        return;
      }

      setPreviewFile({
        blob: attachment.blob,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
      });
    } catch {
      setCoverageError("Unable to open this document.");
    }
  }

  async function handleShareInvoice() {
    const attachment =
      invoiceAttachments[0];

    if (!attachment?.blob) {
      return;
    }

    try {
      await shareFile(
        attachment.blob,
        attachment.fileName,
        attachment.mimeType,
      );
    } catch {
      setCoverageError("Unable to share the invoice.");
    }
  }

  function handleViewInvoice() {
    const attachment =
      invoiceAttachments[0];

    if (!attachment?.blob) {
      return;
    }

    setPreviewFile({
      blob: attachment.blob,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    });
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

      {previewFile && (
        <AttachmentPreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
