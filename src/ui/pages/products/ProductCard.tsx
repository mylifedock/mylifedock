import { useLiveQuery } from "dexie-react-hooks";
import { formatCurrency } from "../../../application/currencyService";
import { coverageStatus, coverageTypeLabel, getCoveragesForProduct } from "../../../application/coverageService";
import type { ProductRecord } from "../../../infrastructure/database/db";

/* ──────────────────────────────────────────
 * Product Card
 * ────────────────────────────────────────── */

export function ProductCard({
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
              {formatCurrency(product.purchasePrice)}
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
