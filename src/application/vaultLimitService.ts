import { db } from "../infrastructure/database/db";
import { getLicenseStatus, isProLicense } from "./licenseService";
import { PRICING_CONFIG } from "../config/pricingConfig";

export interface VaultQuotaStatus {
  totalItems: number;
  limit: number;
  isPro: boolean;
  isLimitReached: boolean;
  remainingItems: number;
}

/** The free vault is full: the caller should offer the upgrade screen. */
export class VaultLimitReachedError extends Error {
  constructor() {
    super(`The free vault holds ${PRICING_CONFIG.freeItemLimit} items. Upgrade to Pro for unlimited items.`);
    this.name = "VaultLimitReachedError";
  }
}

/**
 * Counts every item a user adds: documents, medical records, products,
 * accounts, vehicles, properties, secrets, insurance policies and subscriptions.
 * Warranties and AMCs belong to a product and are not counted separately.
 */
export async function getVaultTotalItemCount(): Promise<number> {
  const [docs, medical, products, finance, vehicles, properties, secrets, policies, profiles] = await Promise.all([
    db.documents.count(),
    db.medicalRecords.count(),
    db.products.count(),
    db.finance.count(),
    db.vehicles.count(),
    db.properties.count(),
    db.secrets.count(),
    db.coverages.filter((c) => c.type === "insurance").count(),
    db.profiles.toArray(),
  ]);
  const subscriptions = profiles.reduce((sum, p) => sum + (p.subscriptions?.length ?? 0), 0);
  return docs + medical + products + finance + vehicles + properties + secrets + policies + subscriptions;
}

/**
 * Checks the user's current vault usage against their license quota.
 * The free vault allows PRICING_CONFIG.freeItemLimit items; Pro is unlimited.
 */
export async function getVaultQuotaStatus(): Promise<VaultQuotaStatus> {
  const [totalItems, license] = await Promise.all([
    getVaultTotalItemCount(),
    getLicenseStatus(),
  ]);

  const isPro = isProLicense(license);
  const limit = isPro ? Infinity : PRICING_CONFIG.freeItemLimit;
  const isLimitReached = !isPro && totalItems >= limit;
  const remainingItems = isPro ? Infinity : Math.max(0, limit - totalItems);

  return {
    totalItems,
    limit,
    isPro,
    isLimitReached,
    remainingItems,
  };
}

/** Every create path calls this, so no page can skip the free-vault limit. */
export async function assertCanAddItem(): Promise<void> {
  if ((await getVaultQuotaStatus()).isLimitReached) {
    throw new VaultLimitReachedError();
  }
}
