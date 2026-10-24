import { db } from "../infrastructure/database/db";
import { getLicenseStatus } from "./licenseService";
import { PRICING_CONFIG } from "../config/pricingConfig";

export interface VaultQuotaStatus {
  totalItems: number;
  limit: number;
  isPro: boolean;
  isLimitReached: boolean;
  remainingItems: number;
}

/**
 * Counts the total number of items stored across all vault categories.
 */
export async function getVaultTotalItemCount(): Promise<number> {
  const [
    docCount,
    medCount,
    prodCount,
    finCount,
    vehCount,
    propCount,
    secCount,
  ] = await Promise.all([
    db.documents.count(),
    db.medicalRecords.count(),
    db.products.count(),
    db.finance.count(),
    db.vehicles.count(),
    db.properties.count(),
    db.secrets.count(),
  ]);

  return docCount + medCount + prodCount + finCount + vehCount + propCount + secCount;
}

/**
 * Checks the user's current vault usage against their license quota.
 * Free Core Vault allows up to 10 items.
 * Pro License allows unlimited items.
 */
export async function getVaultQuotaStatus(): Promise<VaultQuotaStatus> {
  const totalItems = await getVaultTotalItemCount();
  const license = getLicenseStatus();

  const isPro = license.isValid && license.tier !== "free_core";
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
