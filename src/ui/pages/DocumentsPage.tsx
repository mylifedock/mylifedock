import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import {
  createDocumentWithAttachment,
  deleteDocument,
} from "../../application/documentService";

import { validateAttachment } from "../../application/attachmentService";

import {
  db,
  type DocumentCategory,
  type SensitivityLevel,
  type StoragePolicy,
} from "../../infrastructure/database/db";

import DocumentCard from "../components/DocumentCard";

const categories: DocumentCategory[] = [
  "identity",
  "certificate",
  "education",
  "employment",
  "tax",
  "travel",
  "insurance",
  "financial",
  "property",
  "vehicle",
  "product",
  "membership",
  "other",
];

function DocumentsPage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] =
    useState<DocumentCategory>("identity");
  const [documentType, setDocumentType] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [sensitivity, setSensitivity] =
    useState<SensitivityLevel>("normal");
  const [storagePolicy, setStoragePolicy] =
    useState<StoragePolicy>("local-only");
  const [selectedFile, setSelectedFile] =
    useState<File | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documents = useLiveQuery(
    () =>
      db.documents
        .where("ownerId")
        .equals("local-profile")
        .reverse()
        .sortBy("createdAt"),
    [],
    [],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!title.trim() || isSaving) {
      return;
    }

    try {
      setIsSaving(true);

      if (selectedFile) {
        validateAttachment(selectedFile);
      }

      await createDocumentWithAttachment({
        title: title.trim(),
        category,
        documentType: documentType.trim() || undefined,
        issuer: issuer.trim() || undefined,
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        sensitivity,
        storagePolicy,
        tags: [],
        notes: notes.trim() || undefined,
        file: selectedFile,
      });

      setTitle("");
      setDocumentType("");
      setIssuer("");
      setIssueDate("");
      setExpiryDate("");
      setNotes("");
      setSelectedFile(undefined);

      if (fileInputRef.current) {
  fileInputRef.current.value = "";
}
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save the document.";

      window.alert(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDocument(id);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to delete the document.";

      window.alert(message);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">
            YOUR PRIVATE RECORDS
          </span>

          <h1>Documents</h1>

          <p>
            Keep your important documents organized and easy to
            find.
          </p>
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <span className="eyebrow">ADD RECORD</span>
            <h2>New document</h2>
          </div>

          <form
            className="document-form"
            onSubmit={handleSubmit}
          >
            <label>
              Title

              <input
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="Passport"
                required
              />
            </label>

            <label>
              Category

              <select
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target.value as DocumentCategory,
                  )
                }
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Document type

              <input
                value={documentType}
                onChange={(event) =>
                  setDocumentType(event.target.value)
                }
                placeholder="Passport / Aadhaar / Certificate"
              />
            </label>

            <label>
              Issuer

              <input
                value={issuer}
                onChange={(event) =>
                  setIssuer(event.target.value)
                }
                placeholder="Issuing authority"
              />
            </label>

            <label>
              Issue date

              <input
                type="date"
                value={issueDate}
                onChange={(event) =>
                  setIssueDate(event.target.value)
                }
              />
            </label>

            <label>
              Expiry date

              <input
                type="date"
                value={expiryDate}
                onChange={(event) =>
                  setExpiryDate(event.target.value)
                }
              />
            </label>

            <label>
              Sensitivity

              <select
                value={sensitivity}
                onChange={(event) =>
                  setSensitivity(
                    event.target.value as SensitivityLevel,
                  )
                }
              >
                <option value="normal">Normal</option>
                <option value="sensitive">Sensitive</option>
                <option value="critical">Critical</option>
              </select>
            </label>

            <label>
              Storage policy

              <select
                value={storagePolicy}
                onChange={(event) =>
                  setStoragePolicy(
                    event.target.value as StoragePolicy,
                  )
                }
              >
                <option value="local-only">
                  Local only
                </option>

                <option value="drive-allowed">
                  Google Drive allowed
                </option>

                <option value="sync-allowed">
                  Sync allowed
                </option>
              </select>
            </label>

            <label>
              Attachment

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) =>
                    setSelectedFile(event.target.files?.[0])
                }
                />

              {selectedFile && (
                <small className="file-selection">
                  Selected: {selectedFile.name}
                </small>
              )}
            </label>

            <label>
              Notes

              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Optional notes..."
              />
            </label>

            <button
              className="primary-button"
              type="submit"
              disabled={!title.trim() || isSaving}
            >
              {isSaving
                ? "Saving..."
                : "Add document"}

              <span>{isSaving ? "…" : "→"}</span>
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <span className="eyebrow">YOUR VAULT</span>

            <h2>
              {documents.length}{" "}
              {documents.length === 1
                ? "document"
                : "documents"}
            </h2>
          </div>

          {documents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">▣</div>

              <h3>Your documents will appear here</h3>

              <p>
                Add your first document to start building your
                personal vault.
              </p>
            </div>
          ) : (
            <div className="quick-actions">
              {documents.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  onDelete={(id) =>
                    void handleDelete(id)
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default DocumentsPage;