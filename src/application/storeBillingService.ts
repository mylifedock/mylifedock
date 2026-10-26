/**
 * Google Play Billing (Android) and Apple In-App Purchase (iOS) through
 * @capgo/native-purchases. The Windows app uses Razorpay instead.
 *
 * Model (matches the app's offline, account-free design):
 * - No server and no MyLifeDock account. The store's own account (Google /
 *   Apple ID) owns the purchase.
 * - On launch, after a purchase and on "Restore purchases", the app asks the
 *   store which Pro products the signed-in store account currently owns and
 *   unlocks Pro for as long as the store says so. Nothing is cached in app
 *   storage, so Pro cannot be faked by editing it.
 * - Purchases are acknowledged/finished by the plugin right away (Google
 *   refunds purchases that are not acknowledged within 3 days).
 *
 * Optional later hardening: verify Play purchase tokens / App Store JWS on a
 * server. Not needed for launch; it would also add a server to the design.
 */
import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE, type Product, type Transaction } from "@capgo/native-purchases";
import { STORE_PRODUCTS, STORE_PRODUCTS_LIVE, type StorePlanId, type StoreProduct } from "../config/storeProducts";
import { getCheckoutChannel } from "../config/storePolicy";
import { setStoreEntitlement, type LicenseStatus } from "./licenseService";
import { withExternalActivity } from "../platform/externalActivity";

export interface StoreOffer {
  plan: StorePlanId;
  product: StoreProduct;
  /** Localized price from the store, e.g. "₹249.00". */
  priceString: string;
  title: string;
}

/** The user closed the store's payment sheet. */
export class StorePurchaseCancelledError extends Error {
  constructor() {
    super("Purchase cancelled.");
    this.name = "StorePurchaseCancelledError";
  }
}


/** In-app purchase is offered only in the store builds, once the products are live. */
export function isStoreBillingAvailable(): boolean {
  return (
    STORE_PRODUCTS_LIVE &&
    getCheckoutChannel() !== "razorpay" &&
    Capacitor.isPluginAvailable("NativePurchases")
  );
}

/** Mobile app, but the products are not set up yet: show "coming soon" instead of a buy button. */
export function isStoreBillingPending(): boolean {
  return getCheckoutChannel() !== "razorpay" && !isStoreBillingAvailable();
}

function storeName(): string {
  return getCheckoutChannel() === "app-store" ? "App Store" : "Google Play";
}

function productFor(productId: string): StoreProduct | undefined {
  return STORE_PRODUCTS.find((p) => p.productId === productId);
}

/** Loads the plans with the store's localized prices. */
export async function loadStoreOffers(): Promise<StoreOffer[]> {
  if (!isStoreBillingAvailable()) return [];
  const purchases = NativePurchases;
  const subs = STORE_PRODUCTS.filter((p) => p.kind === "subscription");
  const oneTime = STORE_PRODUCTS.filter((p) => p.kind === "one-time");

  // Query sequentially: the native billing clients do not support concurrent queries.
  const subProducts = subs.length
    ? (await purchases.getProducts({ productIdentifiers: subs.map((p) => p.productId), productType: PURCHASE_TYPE.SUBS })).products
    : [];
  const oneTimeProducts = oneTime.length
    ? (await purchases.getProducts({ productIdentifiers: oneTime.map((p) => p.productId), productType: PURCHASE_TYPE.INAPP })).products
    : [];

  const offers: StoreOffer[] = [];
  for (const product of STORE_PRODUCTS) {
    const match = (product.kind === "subscription" ? subProducts : oneTimeProducts).find((p: Product) =>
      // Android subscriptions report the base plan as `identifier` and the product as `planIdentifier`.
      p.identifier === product.productId ||
      (p.planIdentifier === product.productId && (!product.androidBasePlanId || p.identifier === product.androidBasePlanId)),
    );
    if (match) offers.push({ plan: product.plan, product, priceString: match.priceString, title: match.title });
  }
  return offers;
}

function isCancel(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /cancel|user ?canceled|USER_CANCELED/i.test(text);
}

/** Opens the store's payment sheet for a plan and unlocks Pro when the store confirms it. */
export async function purchaseStorePlan(plan: StorePlanId): Promise<LicenseStatus | null> {
  const product = STORE_PRODUCTS.find((p) => p.plan === plan);
  if (!product || !isStoreBillingAvailable()) throw new Error("In-app purchase is not available in this version.");
  const purchases = NativePurchases;
  try {
    await withExternalActivity(() =>
      purchases.purchaseProduct({
        productIdentifier: product.productId,
        productType: (product.kind === "subscription" ? PURCHASE_TYPE.SUBS : PURCHASE_TYPE.INAPP),
        planIdentifier: product.androidBasePlanId,
        quantity: 1,
      }),
    );
  } catch (error) {
    if (isCancel(error)) throw new StorePurchaseCancelledError();
    throw error;
  }
  return refreshStoreEntitlement();
}

/** Required by Apple: lets someone who reinstalled or changed phones get Pro back. */
export async function restoreStorePurchases(): Promise<LicenseStatus | null> {
  if (!isStoreBillingAvailable()) return null;
  const purchases = NativePurchases;
  await withExternalActivity(() => purchases.restorePurchases());
  return refreshStoreEntitlement();
}

/** Opens the store's own subscription management (cancel, change plan). */
export async function manageStoreSubscription(): Promise<void> {
  if (!isStoreBillingAvailable()) return;
  await NativePurchases.manageSubscriptions();
}

/** Whether a store transaction currently grants access. */
export function transactionGrantsAccess(t: Transaction, platform: "android" | "ios", now = Date.now()): boolean {
  if (!productFor(t.productIdentifier)) return false;
  if (platform === "android") return t.purchaseState === "1";
  if (t.revocationDate) return false;
  const product = productFor(t.productIdentifier);
  if (product?.kind === "one-time") return true;
  if (t.subscriptionState && ["subscribed", "inGracePeriod", "inBillingRetryPeriod"].includes(t.subscriptionState)) return true;
  if (t.isActive === true) return true;
  return Boolean(t.expirationDate && Date.parse(t.expirationDate) > now);
}

/** Best entitlement among the owned transactions: lifetime beats yearly beats monthly. */
export function entitlementFrom(transactions: Transaction[], platform: "android" | "ios", now = Date.now()): LicenseStatus | null {
  const rank = new Map<StorePlanId, number>([["pro_lifetime", 3], ["pro_yearly", 2], ["pro_monthly", 1]]);
  let best: { plan: StorePlanId; expiresAt?: string } | null = null;
  for (const t of transactions) {
    if (!transactionGrantsAccess(t, platform, now)) continue;
    const plan = productFor(t.productIdentifier)!.plan;
    if (!best || (rank.get(plan) ?? 0) > (rank.get(best.plan) ?? 0)) best = { plan, expiresAt: t.expirationDate };
  }
  if (!best) return null;
  const store = platform === "ios" ? "App Store" : "Google Play";
  return {
    tier: best.plan,
    isValid: true,
    expiresAt: best.expiresAt,
    message:
      best.plan === "pro_lifetime"
        ? `Pro Lifetime (bought on ${store})`
        : `Pro subscription active (${store}, renews automatically)`,
  };
}

/** Asks the store what this account owns and updates Pro. Safe to call often. */
export async function refreshStoreEntitlement(): Promise<LicenseStatus | null> {
  if (!isStoreBillingAvailable()) return null;
  const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
  try {
    const purchases = NativePurchases;
    const { purchases: owned } = await purchases.getPurchases({ onlyCurrentEntitlements: true });
    const status = entitlementFrom(owned, platform);
    setStoreEntitlement(status);
    return status;
  } catch (error) {
    // Store unreachable (e.g. Play Store app disabled): keep whatever was confirmed this session.
    console.warn(`[Billing] Could not read purchases from ${storeName()}:`, error);
    return null;
  }
}

let listening = false;

/** Re-checks Pro on launch and whenever the App Store reports a renewal, refund or new purchase. */
export async function startStoreBilling(): Promise<void> {
  if (!isStoreBillingAvailable()) return;
  await refreshStoreEntitlement();
  if (listening || Capacitor.getPlatform() !== "ios") return;
  listening = true;
  const purchases = NativePurchases;
  await purchases.addListener("transactionUpdated", () => {
    void refreshStoreEntitlement();
  });
}
