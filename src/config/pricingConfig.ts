/**
 * MyLifeDock Pricing & Payment Configuration
 * 
 * You can customize your Razorpay Payment Link URLs here.
 * When a user clicks "Purchase Pro via Razorpay", they are redirected to your secure checkout.
 */

export interface PricingPlan {
  id: "pro_monthly" | "pro_yearly" | "pro_lifetime";
  title: string;
  priceINR: string;
  priceUSD: string;
  billingPeriod: string;
  badge?: string;
  savingsBadge?: string;
  features: string[];
  razorpayPaymentLink: string;
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
        "Unlimited Encrypted Documents & Files",
        "Unlimited Prescriptions & Lab Reports",
        "Full On-Device OCR Scanner",
        "Encrypted Google Drive Cloud Backup",
        "30 Days of Unlimited Protection",
      ],
      razorpayPaymentLink: "https://rzp.io/rzp/RzGKEOuM",
    },
    {
      id: "pro_yearly",
      title: "Yearly Pro",
      priceINR: "₹250",
      priceUSD: "$4.99",
      billingPeriod: "per year",
      badge: "SAVE 2 MONTHS FREE",
      savingsBadge: "12 Months for the Price of 10! (Save ₹50)",
      features: [
        "Everything in Monthly Pro",
        "Save 2 Months Extra (Save ₹50/yr)",
        "Unlimited Family & Child Profiles",
        "Encrypted Google Drive Cloud Backup",
        "Full 365 Days of Unlimited Protection",
      ],
      razorpayPaymentLink: "https://rzp.io/rzp/aPFk0yOg",
    },
    {
      id: "pro_lifetime",
      title: "Lifetime Founder",
      priceINR: "₹999",
      priceUSD: "$19.99",
      billingPeriod: "one-time payment",
      badge: "BEST VALUE",
      savingsBadge: "Price doubles after every 15 spots! (First 15 only)",
      features: [
        "Everything in Pro, FOREVER",
        "Unlimited Lifetime Vault Capacity",
        "All Future Updates & Major Releases Included",
        "Priority Customer Support",
        "Zero Recurring Subscriptions",
      ],
      razorpayPaymentLink: "https://rzp.io/rzp/lT9C4JH4",
    },
  ],
};
