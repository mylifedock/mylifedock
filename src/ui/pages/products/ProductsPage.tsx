import { useState } from "react";
import { useOpenFocusedRecord } from "../../useActiveProfileFilter";
import { useLiveQuery } from "dexie-react-hooks";
import { deleteProduct, getProducts } from "../../../application/productService";
import type { ProductRecord } from "../../../infrastructure/database/db";
import { getVaultQuotaStatus } from "../../../application/vaultLimitService";
import { ProUpgradeModal } from "../../components/ProUpgradeModal";
import { PageHeader } from "../../components/PageHeader";
import { ProductForm } from "./ProductForm";
import { ProductDetails } from "./ProductDetails";
import { ProductCard } from "./ProductCard";

/* ──────────────────────────────────────────
 * Products Page
 * ────────────────────────────────────────── */

function ProductsPage({ focusId }: { focusId?: string }) {
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

  const [showProUpgrade, setShowProUpgrade] = useState(false);
  const [vaultItemCount, setVaultItemCount] = useState(0);

  async function openCreateForm() {
    setPageError("");
    const quota = await getVaultQuotaStatus();
    if (quota.isLimitReached) {
      setVaultItemCount(quota.totalItems);
      setShowProUpgrade(true);
      return;
    }
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

  // A search result (product or one of its warranties) opens the product.
  useOpenFocusedRecord<ProductRecord>(focusId, products, setSelectedProduct);
  return (
    <div className="page-container fade-in">
      <PageHeader
        title="Products & Warranties"
        subtitle="Appliances and gadgets with their invoices, warranties and AMCs."
        actions={
          !showForm && (
            <button type="button" className="primary-button" onClick={() => void openCreateForm()}>
              + Add Product
            </button>
          )
        }
      />

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

      <ProUpgradeModal
        isOpen={showProUpgrade}
        onClose={() => setShowProUpgrade(false)}
        currentCount={vaultItemCount}
      />
    </div>
  );
}

export default ProductsPage;

