import {
  db,
  type ProductRecord,
} from "../infrastructure/database/db";

const LOCAL_PROFILE_ID = "local-profile";

export type CreateProductInput = Omit<
  ProductRecord,
  "id" | "ownerId" | "createdAt" | "updatedAt"
>;

export type UpdateProductInput =
  Partial<CreateProductInput>;

function normalizeOptionalText(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim();

  return trimmed || undefined;
}

function validateProductInput(
  input: CreateProductInput,
): void {
  if (!input.name.trim()) {
    throw new Error(
      "Product name is required.",
    );
  }

  if (!input.category.trim()) {
    throw new Error(
      "Product category is required.",
    );
  }

  if (
    input.purchasePrice !== undefined &&
    (!Number.isFinite(
      input.purchasePrice,
    ) ||
      input.purchasePrice < 0)
  ) {
    throw new Error(
      "Purchase price must be a valid non-negative number.",
    );
  }
}

function normalizeProductInput(
  input: CreateProductInput,
): CreateProductInput {
  return {
    ...input,

    name: input.name.trim(),

    category:
      input.category.trim(),

    brand:
      normalizeOptionalText(
        input.brand,
      ),

    model:
      normalizeOptionalText(
        input.model,
      ),

    serialNumber:
      normalizeOptionalText(
        input.serialNumber,
      ),

    imei:
      normalizeOptionalText(
        input.imei,
      ),

    vendor:
      normalizeOptionalText(
        input.vendor,
      ),

    notes:
      normalizeOptionalText(
        input.notes,
      ),
  };
}

export async function createProduct(
  input: CreateProductInput,
): Promise<ProductRecord> {
  const normalized =
    normalizeProductInput(input);

  validateProductInput(
    normalized,
  );

  const now =
    new Date().toISOString();

  const product: ProductRecord = {
    ...normalized,

    id: crypto.randomUUID(),

    ownerId:
      LOCAL_PROFILE_ID,

    createdAt: now,
    updatedAt: now,
  };

  await db.products.add(
    product,
  );

  return product;
}

export async function getProduct(
  id: string,
): Promise<ProductRecord | undefined> {
  return db.products.get(id);
}

export async function getProducts(): Promise<
  ProductRecord[]
> {
  const products =
    await db.products
      .where("ownerId")
      .equals(LOCAL_PROFILE_ID)
      .toArray();

  return products.sort(
    (a, b) =>
      b.createdAt.localeCompare(
        a.createdAt,
      ),
  );
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<ProductRecord> {
  const existing =
    await db.products.get(id);

  if (!existing) {
    throw new Error(
      "Product not found.",
    );
  }

  if (
    existing.ownerId !==
    LOCAL_PROFILE_ID
  ) {
    throw new Error(
      "You cannot update this product.",
    );
  }

  const merged: CreateProductInput = {
    category:
      input.category ??
      existing.category,

    name:
      input.name ??
      existing.name,

    brand:
      input.brand ??
      existing.brand,

    model:
      input.model ??
      existing.model,

    serialNumber:
      input.serialNumber ??
      existing.serialNumber,

    imei:
      input.imei ??
      existing.imei,

    purchaseDate:
      input.purchaseDate ??
      existing.purchaseDate,

    purchasePrice:
      input.purchasePrice ??
      existing.purchasePrice,

    vendor:
      input.vendor ??
      existing.vendor,

    invoiceDocumentId:
      input.invoiceDocumentId ??
      existing.invoiceDocumentId,

    sensitivity:
      input.sensitivity ??
      existing.sensitivity,

    notes:
      input.notes ??
      existing.notes,
  };

  const normalized =
    normalizeProductInput(
      merged,
    );

  validateProductInput(
    normalized,
  );

  const updated: ProductRecord = {
    ...existing,
    ...normalized,
    updatedAt:
      new Date().toISOString(),
  };

  await db.products.put(
    updated,
  );

  return updated;
}

export async function deleteProduct(
  id: string,
): Promise<void> {
  const existing =
    await db.products.get(id);

  if (!existing) {
    return;
  }

  if (
    existing.ownerId !==
    LOCAL_PROFILE_ID
  ) {
    throw new Error(
      "You cannot delete this product.",
    );
  }

  await db.products.delete(
    id,
  );
}