/**
 * MyLifeDock Pricing & Payment Configuration
 * 
 * You can customize your Razorpay Payment Link URLs here.
 * When a user clicks "Purchase Pro via Razorpay", they are redirected to your secure checkout.
 */

export interface PricingPlan {
  id: "pro_yearly" | "pro_lifetime";
  title: string;
  priceINR: string;
  priceUSD: string;
  billingPeriod: string;
  badge?: string;
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
  supportEmail: "support@mylifedock.com",
  plans: [
    {
      id: "pro_yearly",
      title: "MyLifeDock Pro (1 Year)",
      priceINR: "₹499",
      priceUSD: "$9.99",
      billingPeriod: "per year",
      features: [
        "Unlimited Encrypted Documents & Files",
        "Unlimited Doctor Prescriptions & Lab Reports",
        "Unlimited Warranties, Products & Reminders",
        "Full On-Device OCR Scanner",
        "Google Drive Encrypted Cloud Backup",
        "1 Year of Updates & Support",
      ],
      // Replace with your real Razorpay Payment Link
      razorpayPaymentLink: "https://rzp.io/l/mylifedock-pro-annual",
    },
    {
      id: "pro_lifetime",
      title: "Lifetime Founder License",
      priceINR: "₹999",
      priceUSD: "$19.99",
      billingPeriod: "one-time payment",
      badge: "BEST VALUE",
      features: [
        "Everything in Pro, FOREVER",
        "Unlimited Lifetime Vault Capacity",
        "All Future Updates & Major Releases Included",
        "Priority Customer Support",
        "Zero Recurring Subscriptions",
      ],
      // Replace with your real Razorpay Payment Link
      razorpayPaymentLink: "https://rzp.io/l/mylifedock-founder-lifetime",
    },
  ],
};
