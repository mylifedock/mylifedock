import { useState } from "react";
import type { FormEvent } from "react";
import { createProduct, updateProduct } from "../../../application/productService";
import type { CreateProductInput } from "../../../application/productService";
import { createDocumentWithAttachment } from "../../../application/documentService";
import type { SensitivityLevel, ProductRecord } from "../../../infrastructure/database/db";
import { PRODUCT_CATEGORIES } from "./productConstants";

/* ──────────────────────────────────────────
 * Product Form
 * ────────────────────────────────────────── */

type ProductFormProps = {
  initialProduct?: ProductRecord;
  onSaved: () => void;
  onCancel: () => void;
};

export function ProductForm({
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
      
      const { extractTextFromImage, parseReceiptData } = await import("../../../application/ocrService");
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

            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "4px", flexWrap: "wrap" }}>
              <label 
                className="secondary-button" 
                style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.2)", padding: "6px 12px" }}
              >
                <span>📷</span>
                <span>Snap Invoice</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) =>
                    setInvoiceFile(
                      event.target.files?.[0],
                    )
                  }
                  style={{ display: "none" }}
                />
              </label>

              <label 
                className="secondary-button" 
                style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", padding: "6px 12px" }}
              >
                <span>📁</span>
                <span>Choose File</span>
                <input
                  id="productInvoice"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(event) =>
                    setInvoiceFile(
                      event.target.files?.[0],
                    )
                  }
                  style={{ display: "none" }}
                />
              </label>
            </div>

            {invoiceFile && (
              <small className="file-selection" style={{ display: "block", marginTop: "6px", color: "#38bdf8" }}>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", flexWrap: "wrap", gap: "8px" }}>
              <label htmlFor="productNotes" style={{ margin: 0 }}>
                Notes
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <label className="text-button" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", color: "#38bdf8" }}>
                  <span>{isScanning ? `Scanning... ${scanProgress}%` : "📷 Snap & Auto-Fill"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleScan}
                    disabled={isScanning}
                    style={{ display: "none" }}
                  />
                </label>
                <label className="text-button" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <span>🖼️ Upload to Auto-Fill</span>
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
