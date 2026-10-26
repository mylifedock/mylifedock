import { PRICING_API_URL, type PricingPlan } from "../config/pricingConfig";
import { getCheckoutChannel } from "../config/storePolicy";

/**
 * Current website prices and offers (the Pricing tab of the founder's Orders
 * sheet, served by the Apps Script web app). Used only by the Windows app's
 * Upgrade screen; the store apps show the store's own prices.
 * Nothing about the user or the vault is sent: it is a plain GET for prices.
 */

export type PlanId = PricingPlan["id"];

export interface LiveOffer {
  priceINR: number;
  priceUSD: number;
  text: string;
  endsOn: string;
}

export interface LivePlanPrice {
  priceINR: number;
  priceUSD: number;
  offer: LiveOffer | null;
}

export type LivePricing = Partial<Record<PlanId, LivePlanPrice>>;

const PLAN_IDS: PlanId[] = ["pro_monthly", "pro_yearly", "pro_lifetime"];
const TIMEOUT_MS = 6000;

function isPrice(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** Keeps only well-formed plans; returns null when nothing usable came back. */
export function parseLivePricing(data: unknown): LivePricing | null {
  if (!data || typeof data !== "object" || (data as { ok?: unknown }).ok !== true) return null;
  const plans = (data as { plans?: unknown }).plans;
  if (!plans || typeof plans !== "object") return null;

  const received = new Map(Object.entries(plans as Record<string, unknown>));
  const result = new Map<PlanId, LivePlanPrice>();
  for (const id of PLAN_IDS) {
    const raw = received.get(id);
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    if (!isPrice(p.priceINR) || !isPrice(p.priceUSD)) continue;
    const o = p.offer && typeof p.offer === "object" ? (p.offer as Record<string, unknown>) : null;
    const offer: LiveOffer | null =
      o && isPrice(o.priceINR) && isPrice(o.priceUSD) && o.priceINR < p.priceINR
        ? { priceINR: o.priceINR, priceUSD: o.priceUSD, text: String(o.text ?? "Limited-time offer").slice(0, 80), endsOn: String(o.endsOn ?? "") }
        : null;
    result.set(id, { priceINR: p.priceINR, priceUSD: p.priceUSD, offer });
  }
  return result.size ? (Object.fromEntries(result) as LivePricing) : null;
}

/** Fetches live prices from `url`; null on any failure (the caller keeps the built-in prices). */
export async function fetchLivePricing(url: string): Promise<LivePricing | null> {
  if (!/^https:\/\//.test(url)) return null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url}?action=pricing`, { cache: "no-store", signal: controller.signal });
    if (!res.ok) return null;
    return parseLivePricing(await res.json());
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Live prices for the Upgrade screen, only where the website checkout is used (Windows / dev browser). */
export function loadLivePricing(): Promise<LivePricing | null> {
  if (getCheckoutChannel() !== "razorpay" || !PRICING_API_URL) return Promise.resolve(null);
  return fetchLivePricing(PRICING_API_URL);
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
