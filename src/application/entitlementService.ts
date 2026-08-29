import { db } from "../infrastructure/database/db";

// Simulated server-side entitlement fetch. 
// In a fully local-first app without a backend, you'd store this in IndexedDB (perhaps fetched once on login).
export interface Entitlements {
  tier: "free" | "premium" | "lifetime";
  maxProducts: number;
  maxDocuments: number;
  canSync: boolean;
  canUseVoiceSearch: boolean;
}

const FREE_TIER: Entitlements = {
  tier: "free",
  maxProducts: 15,
  maxDocuments: 30,
  canSync: false,
  canUseVoiceSearch: true,
};

// Simulated mock for user's tier. 
// In a real app, this would be tied to the profileService or fetched via Stripe/RevenueCat after Google Auth.
let currentEntitlements = FREE_TIER;

export function getEntitlements(): Entitlements {
  return currentEntitlements;
}

/**
 * Validates if the user is allowed to add another product.
 */
export async function canAddProduct(): Promise<boolean> {
  if (currentEntitlements.tier === "premium" || currentEntitlements.tier === "lifetime") {
    return true;
  }
  const count = await db.products.count();
  return count < currentEntitlements.maxProducts;
}

/**
 * Validates if the user is allowed to add another document.
 */
export async function canAddDocument(): Promise<boolean> {
  if (currentEntitlements.tier === "premium" || currentEntitlements.tier === "lifetime") {
    return true;
  }
  const count = await db.documents.count();
  return count < currentEntitlements.maxDocuments;
}

/**
 * Optional function to manually override tier for testing.
 */
export function __setMockTier(tier: "free" | "premium") {
  if (tier === "premium") {
    currentEntitlements = {
      tier: "premium",
      maxProducts: Infinity,
      maxDocuments: Infinity,
      canSync: true,
      canUseVoiceSearch: true,
    };
  } else {
    currentEntitlements = FREE_TIER;
  }
}
