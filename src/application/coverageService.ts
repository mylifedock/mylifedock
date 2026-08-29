import {
  db,
  type CoverageRecord,
  type CoverageType,
} from "../infrastructure/database/db";

const LOCAL_PROFILE_ID = "local-profile";

export type CreateCoverageInput = Omit<
  CoverageRecord,
  "id" | "ownerId" | "createdAt" | "updatedAt"
>;

export type UpdateCoverageInput =
  Partial<CreateCoverageInput>;

function normalizeOptionalText(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim();

  return trimmed || undefined;
}

const VALID_COVERAGE_TYPES: CoverageType[] = [
  "warranty",
  "extended-warranty",
  "amc",
  "insurance",
];

function validateCoverageInput(
  input: CreateCoverageInput,
): void {
  if (input.type !== "insurance" && (!input.productId || !input.productId.trim())) {
    throw new Error(
      "Product is required for this coverage type.",
    );
  }

  if (
    !VALID_COVERAGE_TYPES.includes(
      input.type,
    )
  ) {
    throw new Error(
      "Invalid coverage type.",
    );
  }

  if (!input.startDate.trim()) {
    throw new Error(
      "Start date is required.",
    );
  }

  if (!input.endDate.trim()) {
    throw new Error(
      "End date is required.",
    );
  }

  if (input.startDate > input.endDate) {
    throw new Error(
      "End date must be on or after the start date.",
    );
  }

  if (
    input.reminderDaysBefore < 0 ||
    !Number.isFinite(
      input.reminderDaysBefore,
    )
  ) {
    throw new Error(
      "Reminder days must be a non-negative number.",
    );
  }
}

function normalizeCoverageInput(
  input: CreateCoverageInput,
): CreateCoverageInput {
  return {
    ...input,

    productId: input.productId?.trim(),

    provider: normalizeOptionalText(
      input.provider,
    ),

    policyNumber: normalizeOptionalText(
      input.policyNumber,
    ),

    startDate: input.startDate.trim(),
    endDate: input.endDate.trim(),
  };
}

/**
 * Returns a human-readable label for a coverage type.
 */
export function coverageTypeLabel(
  type: CoverageType,
): string {
  switch (type) {
    case "warranty":
      return "Warranty";
    case "extended-warranty":
      return "Extended Warranty";
    case "amc":
      return "AMC";
    case "insurance":
      return "Insurance";
    case "membership":
      return "Membership";
    default:
      return type;
  }
}

/**
 * Returns the expiry status of a coverage.
 */
export function coverageStatus(
  coverage: CoverageRecord,
): "active" | "expiring-soon" | "expired" {
  const today = new Date()
    .toISOString()
    .slice(0, 10);

  if (coverage.endDate < today) {
    return "expired";
  }

  if (coverage.reminderEnabled) {
    const endDate = new Date(
      coverage.endDate,
    );

    const warningDate = new Date(
      endDate,
    );

    warningDate.setDate(
      warningDate.getDate() -
        coverage.reminderDaysBefore,
    );

    const warningDateStr = warningDate
      .toISOString()
      .slice(0, 10);

    if (today >= warningDateStr) {
      return "expiring-soon";
    }
  }

  return "active";
}

export async function createCoverage(
  input: CreateCoverageInput,
): Promise<CoverageRecord> {
  const normalized =
    normalizeCoverageInput(input);

  validateCoverageInput(normalized);

  /*
   * Verify the product exists and belongs
   * to the local profile, if a product is linked.
   */
  if (normalized.productId) {
    const product = await db.products.get(
      normalized.productId,
    );

    if (!product) {
      throw new Error(
        "Product not found.",
      );
    }

    if (
      product.ownerId !== LOCAL_PROFILE_ID
    ) {
      throw new Error(
        "You cannot add coverage to this product.",
      );
    }
  }

  const now = new Date().toISOString();

  const coverage: CoverageRecord = {
    ...normalized,

    id: crypto.randomUUID(),
    ownerId: LOCAL_PROFILE_ID,

    createdAt: now,
    updatedAt: now,
  };

  await db.coverages.add(coverage);

  return coverage;
}

export async function getCoverage(
  id: string,
): Promise<CoverageRecord | undefined> {
  return db.coverages.get(id);
}

export async function getCoveragesForProduct(
  productId: string,
): Promise<CoverageRecord[]> {
  const coverages = await db.coverages
    .where("productId")
    .equals(productId)
    .toArray();

  return coverages.sort(
    (a, b) =>
      a.endDate.localeCompare(
        b.endDate,
      ),
  );
}

/**
 * Returns all coverages expiring within
 * the given number of days.
 */
export async function getExpiringCoverages(
  withinDays: number,
): Promise<CoverageRecord[]> {
  const today = new Date();

  const futureDate = new Date(today);

  futureDate.setDate(
    futureDate.getDate() + withinDays,
  );

  const todayStr = today
    .toISOString()
    .slice(0, 10);

  const futureStr = futureDate
    .toISOString()
    .slice(0, 10);

  const allCoverages =
    await db.coverages
      .where("ownerId")
      .equals(LOCAL_PROFILE_ID)
      .toArray();

  return allCoverages
    .filter(
      (c) =>
        c.endDate >= todayStr &&
        c.endDate <= futureStr,
    )
    .sort(
      (a, b) =>
        a.endDate.localeCompare(
          b.endDate,
        ),
    );
}

export async function updateCoverage(
  id: string,
  input: UpdateCoverageInput,
): Promise<CoverageRecord> {
  const existing =
    await db.coverages.get(id);

  if (!existing) {
    throw new Error(
      "Coverage not found.",
    );
  }

  if (
    existing.ownerId !== LOCAL_PROFILE_ID
  ) {
    throw new Error(
      "You cannot update this coverage.",
    );
  }

  const merged: CreateCoverageInput = {
    productId:
      existing.productId,

    type:
      input.type ??
      existing.type,

    provider:
      input.provider ??
      existing.provider,

    policyNumber:
      input.policyNumber ??
      existing.policyNumber,

    startDate:
      input.startDate ??
      existing.startDate,

    endDate:
      input.endDate ??
      existing.endDate,

    documentId:
      input.documentId ??
      existing.documentId,

    reminderEnabled:
      input.reminderEnabled ??
      existing.reminderEnabled,

    reminderDaysBefore:
      input.reminderDaysBefore ??
      existing.reminderDaysBefore,
  };

  const normalized =
    normalizeCoverageInput(merged);

  validateCoverageInput(normalized);

  const updated: CoverageRecord = {
    ...existing,
    ...normalized,
    updatedAt:
      new Date().toISOString(),
  };

  await db.coverages.put(updated);

  return updated;
}

export async function deleteCoverage(
  id: string,
): Promise<void> {
  const existing =
    await db.coverages.get(id);

  if (!existing) {
    return;
  }

  if (
    existing.ownerId !== LOCAL_PROFILE_ID
  ) {
    throw new Error(
      "You cannot delete this coverage.",
    );
  }

  await db.coverages.delete(id);
}
