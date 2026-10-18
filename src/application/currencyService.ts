/**
 * Global Currency & Formatting Service
 * Supports Indian Rupee (INR) with Lakh/Crore grouping and International Currencies
 */

export type SupportedCurrency = "INR" | "USD" | "EUR" | "GBP" | "AED" | "CAD" | "AUD" | "JPY";

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  label: string;
  locale: string;
}

export const SUPPORTED_CURRENCIES: Record<SupportedCurrency, CurrencyConfig> = {
  INR: { code: "INR", symbol: "₹", label: "Indian Rupee (₹ INR)", locale: "en-IN" },
  USD: { code: "USD", symbol: "$", label: "US Dollar ($ USD)", locale: "en-US" },
  EUR: { code: "EUR", symbol: "€", label: "Euro (€ EUR)", locale: "de-DE" },
  GBP: { code: "GBP", symbol: "£", label: "British Pound (£ GBP)", locale: "en-GB" },
  AED: { code: "AED", symbol: "د.إ", label: "UAE Dirham (AED)", locale: "ar-AE" },
  CAD: { code: "CAD", symbol: "CA$", label: "Canadian Dollar (CA$)", locale: "en-CA" },
  AUD: { code: "AUD", symbol: "AU$", label: "Australian Dollar (AU$)", locale: "en-AU" },
  JPY: { code: "JPY", symbol: "¥", label: "Japanese Yen (¥ JPY)", locale: "ja-JP" }
};

const STORAGE_KEY = "mld_preferred_currency";

export function getPreferredCurrency(): SupportedCurrency {
  const saved = localStorage.getItem(STORAGE_KEY) as SupportedCurrency | null;
  if (saved && SUPPORTED_CURRENCIES[saved]) {
    return saved;
  }
  // Auto-detect based on browser locale
  const lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
  if (lang.includes("IN")) return "INR";
  if (lang.includes("GB")) return "GBP";
  if (lang.includes("AE")) return "AED";
  if (lang.includes("CA")) return "CAD";
  if (lang.includes("AU")) return "AUD";
  if (lang.includes("JP")) return "JPY";
  if (/de|fr|es|it|nl|pt|eu/i.test(lang)) return "EUR";
  return "INR"; // Default to INR as founder base
}

export function setPreferredCurrency(currency: SupportedCurrency): void {
  localStorage.setItem(STORAGE_KEY, currency);
  window.dispatchEvent(new Event("mld_currency_changed"));
}

export function formatCurrency(amount: number | undefined | null, currencyOverride?: SupportedCurrency): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "";
  const currCode = currencyOverride || getPreferredCurrency();
  const config = SUPPORTED_CURRENCIES[currCode] || SUPPORTED_CURRENCIES.INR;

  try {
    return new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: config.code,
      maximumFractionDigits: currCode === "JPY" ? 0 : 2
    }).format(amount);
  } catch {
    return `${config.symbol} ${amount.toLocaleString()}`;
  }
}
