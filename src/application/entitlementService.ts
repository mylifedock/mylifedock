import { db } from "../infrastructure/database/db";
import { getLicenseStatus } from "./licenseService";

export interface Entitlements {
  tier: "free" | "pro";
  maxProducts: number;
  maxDocuments: number;
  canSync: boolean;
  canUseVoiceSearch: boolean;
  isPro: boolean;
}

export function getEntitlements(): Entitlements {
  const status = getLicenseStatus();
  const isPro = status.isValid && status.tier !== "free_core";

  if (isPro) {
    return {
      tier: "pro",
      maxProducts: Infinity,
      maxDocuments: Infinity,
      canSync: true,
      canUseVoiceSearch: true,
      isPro: true,
    };
  }

  return {
    tier: "free",
    maxProducts: 15,
    maxDocuments: 20,
    canSync: false,
    canUseVoiceSearch: true,
    isPro: false,
  };
}

/**
 * Validates if the user is allowed to add another product.
 */
export async function canAddProduct(): Promise<boolean> {
  const entitlements = getEntitlements();
  if (entitlements.isPro) {
    return true;
  }
  const count = await db.products.count();
  return count < entitlements.maxProducts;
}

/**
 * Validates if the user is allowed to add another document.
 */
export async function canAddDocument(): Promise<boolean> {
  const entitlements = getEntitlements();
  if (entitlements.isPro) {
    return true;
  }
  const count = await db.documents.count();
  return count < entitlements.maxDocuments;
}
