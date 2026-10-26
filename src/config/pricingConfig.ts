/**
 * MyLifeDock website/Windows pricing.
 *
 * Prices and offers are managed in the Pricing tab of the founder's Orders sheet
 * and served by the Apps Script web app at PRICING_API_URL (see
 * scripts/razorpay-auto-mailer.gs). The prices below are the regular prices,
 * shown when live prices cannot be loaded. The Windows app sends buyers to the
 * website checkout (CHECKOUT_PAGE_URL), which charges the live price.
 * Android and iOS sell through the stores (src/config/storeProducts.ts).
 * `npm run release:check` keeps these in step with the website, admin tool and script.
 *
 * Free and Pro have the same features (encryption, Google Drive backup, OCR,
 * family members, reminders); Pro removes the free vault's item limit.
 */

/** Apps Script Web App URL serving ?action=pricing. Same value as in docs/assets/pricing.js. Empty: built-in prices only. */
export const PRICING_API_URL = "https://script.google.com/macros/s/AKfycbw44GxaH1cqekPHWf3C9pYyxD6nuH1VeJhXLbnYDIY0XtQp_IIBmn57EXywRgTlHd3y/exec";

/** Website checkout page; opened with ?plan=<plan id>. */
export const CHECKOUT_PAGE_URL = "https://mylifedock.github.io/buy.html";

export function checkoutUrl(plan: PricingPlan["id"]): string {
  return `${CHECKOUT_PAGE_URL}?plan=${plan}`;
}

/** What every user gets without paying; shown next to the Pro plans. */
export const FREE_FEATURES = [
  "Encrypted vault on your device",
  "Google Drive and file backups",
  "On-device receipt scanning (OCR)",
  "Family members and reminders",
];

export interface PricingPlan {
  id: "pro_monthly" | "pro_yearly" | "pro_lifetime";
  title: string;
  priceINR: string;
  priceUSD: string;
  billingPeriod: string;
  badge?: string;
  features: string[];
}

export const PRICING_CONFIG: {
  freeItemLimit: number;
  razorpayMerchantName: string;
  supportEmail: string;
  plans: PricingPlan[];
} = {
  freeItemLimit: 10,
  razorpayMerchantName: "MyLifeDock Technologies",
  supportEmail: "mylifedock@gmail.com",
  plans: [
    {
      id: "pro_monthly",
      title: "Monthly Pro",
      priceINR: "₹25",
      priceUSD: "$0.49",
      billingPeriod: "per month",
      features: [
        "Unlimited items in every section (free vault: 10)",
        "Unlimited records for every family member",
        "Valid for 30 days",
      ],
    },
    {
      id: "pro_yearly",
      title: "Yearly Pro",
      priceINR: "₹250",
      priceUSD: "$4.99",
      billingPeriod: "per year",
      badge: "SAVE 2 MONTHS FREE",
      features: [
        "Everything in Monthly Pro",
        "12 months for the price of 10",
        "Valid for 365 days",
      ],
    },
    {
      id: "pro_lifetime",
      title: "Lifetime Founder",
      priceINR: "₹999",
      priceUSD: "$19.99",
      billingPeriod: "one-time payment",
      badge: "BEST VALUE",
      features: [
        "Unlimited items, forever",
        "All future updates included",
        "Priority email support",
        "One payment, no renewals",
      ],
    },
  ],
};
