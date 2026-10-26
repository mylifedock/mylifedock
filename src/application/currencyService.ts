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

export const PREFERRED_CURRENCY_STORAGE_KEY = "mld_preferred_currency";
const STORAGE_KEY = PREFERRED_CURRENCY_STORAGE_KEY;

export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return typeof value === "string" && Object.hasOwn(SUPPORTED_CURRENCIES, value);
}

/** INR is the default for every new vault (USD is listed second); users can change it in Settings. */
export const DEFAULT_CURRENCY: SupportedCurrency = "INR";

export function getPreferredCurrency(): SupportedCurrency {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isSupportedCurrency(saved)) {
      return saved;
    }
  } catch {
    // Storage unavailable: use the default.
  }
  return DEFAULT_CURRENCY;
}

export function setPreferredCurrency(currency: SupportedCurrency): void {
  localStorage.setItem(STORAGE_KEY, currency);
  window.dispatchEvent(new Event("mld_currency_changed"));
}

export function getCurrencyConfig(code: SupportedCurrency): CurrencyConfig {
  return Object.values(SUPPORTED_CURRENCIES).find((config) => config.code === code) ?? SUPPORTED_CURRENCIES.INR;
}

export function formatCurrency(amount: number | undefined | null, currencyOverride?: SupportedCurrency): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "";
  const currCode = currencyOverride || getPreferredCurrency();
  const config = getCurrencyConfig(currCode);

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
