import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "../components/Toast";

import {
  createDocumentWithAttachment,
  deleteDocument,
  getDocuments,
  updateDocument,
} from "../../application/documentService";

import { validateAttachment } from "../../application/attachmentService";
import { extractTextFromImage, parseReceiptData } from "../../application/ocrService";

import type {
  DocumentCategory,
  DocumentRecord,
  SensitivityLevel,
  StoragePolicy,
} from "../../infrastructure/database/db";

import DocumentCard from "../components/DocumentCard";
import { AttachmentManager } from "../components/AttachmentManager";

const CATEGORIES: {
  value: DocumentCategory;
  label: string;
}[] = [
  { value: "identity", label: "Identity" },
  { value: "certificate", label: "Certificate" },
  { value: "education", label: "Education" },
  { value: "employment", label: "Employment" },
  { value: "tax", label: "Tax" },
  { value: "travel", label: "Travel" },
  { value: "insurance", label: "Insurance" },
  { value: "financial", label: "Financial" },
  { value: "property", label: "Property" },
  { value: "vehicle", label: "Vehicle" },
  { value: "product", label: "Product" },
  { value: "membership", label: "Membership" },
  { value: "other", label: "Other" },
];

/* ──────────────────────────────────────────
 * Document Form (Create + Edit)
 * ────────────────────────────────────────── */

type DocumentFormProps = {
  initialDocument?: DocumentRecord;
  onSaved: () => void;
  onCancel: () => void;
};

function DocumentForm({
  initialDocument,
  onSaved,
  onCancel,
}: DocumentFormProps) {
  const isEditing = Boolean(initialDocument);

  const [title, setTitle] = useState(
    initialDocument?.title ?? "",
  );
  const [category, setCategory] =
    useState<DocumentCategory>(
      initialDocument?.category ?? "identity",
    );
  const [documentType, setDocumentType] = useState(
    initialDocument?.documentType ?? "",
  );
  const [issuer, setIssuer] = useState(
    initialDocument?.issuer ?? "",
  );
  const [issueDate, setIssueDate] = useState(
    initialDocument?.issueDate ?? "",
  );
  const [expiryDate, setExpiryDate] = useState(
    initialDocument?.expiryDate ?? "",
  );
  const [notes, setNotes] = useState(
    initialDocument?.notes ?? "",
  );
  const [sensitivity, setSensitivity] =
    useState<SensitivityLevel>(
      initialDocument?.sensitivity ?? "normal",
    );
  const [storagePolicy, setStoragePolicy] =
    useState<StoragePolicy>(
      initialDocument?.storagePolicy ?? "local-only",
    );
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(
    initialDocument?.tags ?? [],
  );
  const [selectedFile, setSelectedFile] =
    useState<File | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  async function handleOcrScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsOcrScanning(true);
      setOcrProgress(10);
      setSelectedFile(file);
      
      const text = await extractTextFromImage(file, (progress) => {
        setOcrProgress(progress);
      });

      const parsed = parseReceiptData(text);
      if (parsed.vendor && !title) {
        setTitle(parsed.vendor);
      }
      if (parsed.vendor && !issuer) {
        setIssuer(parsed.vendor);
      }
      if (parsed.date && !issueDate) {
        setIssueDate(parsed.date);
      }
      if (parsed.rawText) {
        setNotes((prev) => prev ? `${prev}\n\n[OCR Text]:\n${parsed.rawText.slice(0, 300)}` : `[OCR Text]:\n${parsed.rawText.slice(0, 300)}`);
      }
    } catch {
      setError("Unable to extract text from this image. You can still save it manually.");
    } finally {
      setIsOcrScanning(false);
      if (ocrInputRef.current) ocrInputRef.current.value = "";
    }
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase();

    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }

    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (!title.trim() || isSaving) {
      return;
    }

    setError("");

    try {
      setIsSaving(true);

      if (selectedFile) {
        validateAttachment(selectedFile);
      }

      if (isEditing && initialDocument) {
        await updateDocument(
          initialDocument.id,
          {
            title: title.trim(),
            category,
            documentType:
              documentType.trim() || undefined,
            issuer:
              issuer.trim() || undefined,
            issueDate:
              issueDate || undefined,
            expiryDate:
              expiryDate || undefined,
            sensitivity,
            storagePolicy,
            tags,
            notes:
              notes.trim() || undefined,
          },
        );
      } else {
        await createDocumentWithAttachment({
          title: title.trim(),
          category,
          documentType:
            documentType.trim() || undefined,
          issuer:
            issuer.trim() || undefined,
          issueDate:
            issueDate || undefined,
          expiryDate:
            expiryDate || undefined,
          sensitivity,
          storagePolicy,
          tags,
          notes:
            notes.trim() || undefined,
          file: selectedFile,
        });
      }

      onSaved();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save the document.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel document-form-panel">
      <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <span className="eyebrow">
            {isEditing
              ? "EDIT DOCUMENT"
              : "NEW DOCUMENT"}
          </span>

          <h2>
            {isEditing
              ? "Update document"
              : "Add a document"}
          </h2>
        </div>

        <div>
          <input
            type="file"
            accept="image/*"
            ref={ocrInputRef}
            style={{ display: "none" }}
            onChange={handleOcrScan}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => ocrInputRef.current?.click()}
            disabled={isOcrScanning || isSaving}
            style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}
          >
            <span>📷</span>
            {isOcrScanning ? `Scanning (${ocrProgress}%)...` : "Scan / Auto-Fill from Image"}
          </button>
        </div>
      </div>

      <form
        className="document-form"
        onSubmit={handleSubmit}
      >
        <div className="product-form-grid">
          <div className="form-field">
            <label htmlFor="docTitle">
              Title *
            </label>

            <input
              id="docTitle"
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              placeholder="e.g. Passport"
              autoFocus
            />
          </div>

          <div className="form-field">
            <label htmlFor="docCategory">
              Category
            </label>

            <select
              id="docCategory"
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target
                    .value as DocumentCategory,
                )
              }
            >
              {CATEGORIES.map((c) => (
                <option
                  key={c.value}
                  value={c.value}
                >
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="docType">
              Document type
            </label>

            <input
              id="docType"
              value={documentType}
              onChange={(e) =>
                setDocumentType(
                  e.target.value,
                )
              }
              placeholder="Passport / Aadhaar / Certificate"
            />
          </div>

          <div className="form-field">
            <label htmlFor="docIssuer">
              Issuer
            </label>

            <input
              id="docIssuer"
              value={issuer}
              onChange={(e) =>
                setIssuer(e.target.value)
              }
              placeholder="Issuing authority"
            />
          </div>

          <div className="form-field">
            <label htmlFor="docIssueDate">
              Issue date
            </label>

            <input
              id="docIssueDate"
              type="date"
              value={issueDate}
              onChange={(e) =>
                setIssueDate(
                  e.target.value,
                )
              }
            />
          </div>

          <div className="form-field">
            <label htmlFor="docExpiryDate">
              Expiry date
            </label>

            <input
              id="docExpiryDate"
              type="date"
              value={expiryDate}
              onChange={(e) =>
                setExpiryDate(
                  e.target.value,
                )
              }
            />
          </div>

          <div className="form-field">
            <label htmlFor="docSensitivity">
              Privacy level
            </label>

            <select
              id="docSensitivity"
              value={sensitivity}
              onChange={(e) =>
                setSensitivity(
                  e.target
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

          <div className="form-field">
            <label htmlFor="docStorage">
              Storage policy
            </label>

            <select
              id="docStorage"
              value={storagePolicy}
              onChange={(e) =>
                setStoragePolicy(
                  e.target
                    .value as StoragePolicy,
                )
              }
            >
              <option value="local-only">
                Local only
              </option>
              <option value="drive-allowed">
                Drive allowed
              </option>
              <option value="sync-allowed">
                Sync allowed
              </option>
            </select>
          </div>

          {/* Tags input */}
          <div className="form-field product-form-full">
            <label htmlFor="docTags">
              Tags
            </label>

            <div className="tag-input-container">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="tag-chip"
                >
                  {tag}
                  <button
                    type="button"
                    className="tag-remove"
                    onClick={() =>
                      removeTag(tag)
                    }
                  >
                    ×
                  </button>
                </span>
              ))}

              <input
                id="docTags"
                className="tag-text-input"
                value={tagInput}
                onChange={(e) =>
                  setTagInput(
                    e.target.value,
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" ||
                    e.key === ","
                  ) {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Type and press Enter"
              />
            </div>
          </div>

          {!isEditing && (
            <div className="form-field product-form-full">
              <label htmlFor="docAttachment">
                Attachment
              </label>

              <input
                id="docAttachment"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) =>
                  setSelectedFile(
                    e.target.files?.[0],
                  )
                }
              />

              {selectedFile && (
                <small className="file-selection">
                  Selected:{" "}
                  {selectedFile.name}
                </small>
              )}
            </div>
          )}

          <div className="form-field product-form-full">
            <label htmlFor="docNotes">
              Notes
            </label>

            <textarea
              id="docNotes"
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value)
              }
              placeholder="Optional notes..."
              rows={3}
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
            disabled={isSaving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={
              !title.trim() || isSaving
            }
          >
            {isSaving
              ? "Saving..."
              : isEditing
                ? "Save changes"
                : "Add document"}

            <span>→</span>
          </button>
        </div>
      </form>
    </section>
  );
}

/* ──────────────────────────────────────────
 * Document Detail Modal
 * ────────────────────────────────────────── */

function DocumentDetailModal({
  document,
  onEdit,
  onClose,
}: {
  document: DocumentRecord;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="product-detail-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (
          e.target === e.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className="product-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-detail-title"
      >
        <div className="product-detail-header">
          <div>
            <span className="eyebrow">
              {document.category}
            </span>

            <h2 id="doc-detail-title">
              {document.title}
            </h2>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="product-detail-status">
          <span
            className={`sensitivity-badge sensitivity-${document.sensitivity}`}
          >
            {document.sensitivity}
          </span>

          {document.expiryDate && (
            <span className="document-expiry-badge">
              Expires: {document.expiryDate}
            </span>
          )}
        </div>

        <div className="product-detail-section">
          <span className="eyebrow">
            DOCUMENT INFORMATION
          </span>

          <div className="product-detail-grid">
            {document.documentType && (
              <div className="product-detail-item">
                <small>Type</small>
                <strong>
                  {document.documentType}
                </strong>
              </div>
            )}

            {document.issuer && (
              <div className="product-detail-item">
                <small>Issuer</small>
                <strong>
                  {document.issuer}
                </strong>
              </div>
            )}

            {document.issueDate && (
              <div className="product-detail-item">
                <small>Issue date</small>
                <strong>
                  {document.issueDate}
                </strong>
              </div>
            )}

            {document.expiryDate && (
              <div className="product-detail-item">
                <small>Expiry date</small>
                <strong>
                  {document.expiryDate}
                </strong>
              </div>
            )}

            <div className="product-detail-item">
              <small>Storage</small>
              <strong>
                {document.storagePolicy}
              </strong>
            </div>
          </div>
        </div>

        {document.tags &&
          document.tags.length > 0 && (
            <div className="product-detail-section">
              <span className="eyebrow">
                TAGS
              </span>

              <div className="document-tags">
                {document.tags.map(
                  (tag) => (
                    <span
                      key={tag}
                      className="document-tag"
                    >
                      {tag}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

        {document.notes && (
          <div className="product-detail-section">
            <span className="eyebrow">
              NOTES
            </span>

            <p className="product-detail-notes">
              {document.notes}
            </p>
          </div>
        )}

        <div className="product-detail-section" style={{ marginTop: "16px" }}>
          <AttachmentManager entityId={document.id} />
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
            Edit document
            <span>→</span>
          </button>
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────
 * Documents Page
 * ────────────────────────────────────────── */

function DocumentsPage() {
  const documents = useLiveQuery(
    () => getDocuments(),
    [],
    [],
  );

  const { showToast } = useToast();

  const [showForm, setShowForm] =
    useState(false);

  const [editingDocument, setEditingDocument] =
    useState<DocumentRecord | undefined>();

  const [selectedDocument, setSelectedDocument] =
    useState<DocumentRecord | undefined>();

  const [pageError, setPageError] =
    useState("");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [filterCategory, setFilterCategory] =
    useState<DocumentCategory | "all">(
      "all",
    );

  function openCreateForm() {
    setPageError("");
    setEditingDocument(undefined);
    setSelectedDocument(undefined);
    setShowForm(true);
  }

  function openEditForm(
    doc: DocumentRecord,
  ) {
    setPageError("");
    setSelectedDocument(undefined);
    setEditingDocument(doc);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingDocument(undefined);
  }

  const filteredDocuments =
    documents.filter((doc) => {
      if (
        filterCategory !== "all" &&
        doc.category !== filterCategory
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q =
          searchQuery.toLowerCase();

        const matchesTitle =
          doc.title
            .toLowerCase()
            .includes(q);

        const matchesTags =
          doc.tags?.some((tag) =>
            tag
              .toLowerCase()
              .includes(q),
          );

        const matchesCategory =
          doc.category
            .toLowerCase()
            .includes(q);

        const matchesIssuer =
          doc.issuer
            ?.toLowerCase()
            .includes(q);

        return (
          matchesTitle ||
          matchesTags ||
          matchesCategory ||
          matchesIssuer
        );
      }

      return true;
    });

  async function handleDelete(
    id: string,
  ) {
    const confirmed = window.confirm(
      "Delete this document?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setPageError("");
      await deleteDocument(id);

      if (
        selectedDocument?.id === id
      ) {
        setSelectedDocument(undefined);
      }
      
      showToast("Document deleted successfully", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Unable to delete the document.",
        "error"
      );
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">
            YOUR PRIVATE RECORDS
          </span>

          <h1>
            Documents
            <br />
            <span>
              safe and organized.
            </span>
          </h1>

          <p>
            Keep your important documents
            organized, searchable, and
            easy to find.
          </p>
        </div>

        {!showForm && (
          <button
            type="button"
            className="primary-button"
            onClick={openCreateForm}
          >
            Add Document
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
        <DocumentForm
          initialDocument={editingDocument}
          onSaved={closeForm}
          onCancel={closeForm}
        />
      )}

      {!showForm && (
        <>
          {/* Search + Filter */}
          <div className="documents-toolbar">
            <input
              className="search-input"
              type="text"
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(
                  e.target.value,
                )
              }
              placeholder="Search documents..."
            />

            <select
              className="category-filter"
              value={filterCategory}
              onChange={(e) =>
                setFilterCategory(
                  e.target
                    .value as
                    | DocumentCategory
                    | "all",
                )
              }
            >
              <option value="all">
                All categories
              </option>

              {CATEGORIES.map((c) => (
                <option
                  key={c.value}
                  value={c.value}
                >
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  YOUR VAULT
                </span>

                <h2>
                  {filteredDocuments.length}{" "}
                  {filteredDocuments.length === 1
                    ? "document"
                    : "documents"}

                  {filterCategory !== "all" &&
                    ` in ${filterCategory}`}
                </h2>
              </div>
            </div>

            {filteredDocuments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  ▣
                </div>

                <h3>
                  {searchQuery ||
                  filterCategory !== "all"
                    ? "No matching documents"
                    : "Your documents will appear here"}
                </h3>

                <p>
                  {searchQuery ||
                  filterCategory !== "all"
                    ? "Try adjusting your search or filter."
                    : "Add your first document to start building your personal vault."}
                </p>

                {!searchQuery &&
                  filterCategory ===
                    "all" && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={
                        openCreateForm
                      }
                    >
                      Add your first
                      document →
                    </button>
                  )}
              </div>
            ) : (
              <div className="quick-actions">
                {filteredDocuments.map(
                  (doc) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      onView={() =>
                        setSelectedDocument(
                          doc,
                        )
                      }
                      onEdit={() =>
                        openEditForm(
                          doc,
                        )
                      }
                      onDelete={(id) =>
                        void handleDelete(
                          id,
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

      {selectedDocument && (
        <DocumentDetailModal
          document={selectedDocument}
          onEdit={() =>
            openEditForm(
              selectedDocument,
            )
          }
          onClose={() =>
            setSelectedDocument(
              undefined,
            )
          }
        />
      )}
    </div>
  );
}

export default DocumentsPage;