/**
 * In-app purchase products for the Android (Google Play Billing) and iOS
 * (Apple In-App Purchase) apps. The Windows app sells through Razorpay instead
 * (src/config/pricingConfig.ts); see src/config/storePolicy.ts.
 *
 * Create products with EXACTLY these IDs in Play Console and App Store Connect.
 * The same IDs are used on both stores so one list serves both apps.
 * Prices are set in the store consoles, and the app shows the store's own
 * localized price, so nothing here needs to change when prices change.
 *
 * Play Console:
 *   Subscriptions  -> mylifedock.pro.monthly  (base plan id: "monthly", auto-renewing, 1 month)
 *                  -> mylifedock.pro.yearly   (base plan id: "yearly",  auto-renewing, 1 year)
 *   One-time product -> mylifedock.pro.lifetime (non-consumable)
 * App Store Connect:
 *   Auto-renewable subscriptions in one group "MyLifeDock Pro":
 *                     mylifedock.pro.monthly, mylifedock.pro.yearly
 *   Non-consumable  -> mylifedock.pro.lifetime
 */

export type StorePlanId = "pro_monthly" | "pro_yearly" | "pro_lifetime";

export interface StoreProduct {
  plan: StorePlanId;
  /** Product ID in Play Console and App Store Connect. */
  productId: string;
  /** Subscription (auto-renewing) or one-time purchase. */
  kind: "subscription" | "one-time";
  /** Play Console base plan ID (Android subscriptions only). */
  androidBasePlanId?: string;
}

export const STORE_PRODUCTS: readonly StoreProduct[] = [
  { plan: "pro_monthly", productId: "mylifedock.pro.monthly", kind: "subscription", androidBasePlanId: "monthly" },
  { plan: "pro_yearly", productId: "mylifedock.pro.yearly", kind: "subscription", androidBasePlanId: "yearly" },
  { plan: "pro_lifetime", productId: "mylifedock.pro.lifetime", kind: "one-time" },
];

/**
 * Set to true once the products exist in BOTH store consoles (and the app is
 * uploaded to a testing track / TestFlight). Until then the mobile apps show
 * "In-app purchase coming soon" and keep license-key activation.
 */
export const STORE_PRODUCTS_LIVE = false;
