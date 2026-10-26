import type { SearchResult } from "../application/searchService";

/**
 * Single source of truth for the app's sections: sidebar groups, page titles
 * and old page ids that now live inside a merged section.
 */

export type PageId =
  | "dashboard"
  | "documents"
  | "products"
  | "reminders"
  | "insurance"
  | "money"
  | "assets"
  | "medical"
  | "secrets"
  | "emergency"
  | "search"
  | "settings"
  | "help";

export interface NavItem {
  id: PageId;
  label: string;
  icon: string;
  badge?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "VAULT",
    items: [
      { id: "dashboard", label: "Overview", icon: "🏠" },
      { id: "documents", label: "Documents", icon: "📄" },
      { id: "products", label: "Products & Warranties", icon: "📦" },
      { id: "reminders", label: "Reminders", icon: "⏰" },
    ],
  },
  {
    title: "LIFE & MONEY",
    items: [
      { id: "insurance", label: "Insurance", icon: "🛡️" },
      { id: "money", label: "Money", icon: "💰" },
      { id: "assets", label: "Vehicles & Property", icon: "🚗" },
      { id: "medical", label: "Medical & Health", icon: "🩺" },
    ],
  },
  {
    title: "SAFETY",
    items: [
      { id: "secrets", label: "Secrets", icon: "🔐" },
      { id: "emergency", label: "Emergency Kit", icon: "🆘", badge: "SOS" },
    ],
  },
];

export const FOOTER_ITEMS: NavItem[] = [
  { id: "settings", label: "Settings & Backup", icon: "⚙️" },
  { id: "help", label: "Help & Feedback", icon: "💬" },
];

const TITLES = new Map<PageId, string>([
  ["dashboard", "Overview"],
  ["documents", "Documents"],
  ["products", "Products & Warranties"],
  ["reminders", "Reminders"],
  ["insurance", "Insurance"],
  ["money", "Money"],
  ["assets", "Vehicles & Property"],
  ["medical", "Medical & Health"],
  ["secrets", "Secrets"],
  ["emergency", "Emergency Kit"],
  ["search", "Search"],
  ["settings", "Settings & Backup"],
  ["help", "Help & Feedback"],
]);

export function pageTitle(page: PageId): string {
  return TITLES.get(page) ?? "MyLifeDock";
}

/** Where a search result or an old page id opens. */
export interface Destination {
  page: PageId;
  /** Tab inside a merged page (Money: accounts | subscriptions, Assets: vehicles | properties). */
  tab?: string;
  /** Record to open once the page has loaded. */
  focusId?: string;
}

export function resolvePage(id: string): Destination {
  switch (id) {
    case "finance":
      return { page: "money", tab: "accounts" };
    case "subscriptions":
      return { page: "money", tab: "subscriptions" };
    case "vehicles":
      return { page: "assets", tab: "vehicles" };
    case "properties":
      return { page: "assets", tab: "properties" };
    case "about":
      return { page: "help" };
    default:
      return TITLES.has(id as PageId) ? { page: id as PageId } : { page: "dashboard" };
  }
}

/** Where each kind of search result opens. */
export function resultDestination(result: SearchResult): Destination {
  const focusId = result.id;
  switch (result.type) {
    case "document":
      return { page: "documents", focusId };
    case "product":
    case "warranty":
      return { page: "products", focusId };
    case "insurance":
      return { page: "insurance", focusId };
    case "finance":
      return { page: "money", tab: "accounts", focusId };
    case "subscription":
      return { page: "money", tab: "subscriptions", focusId };
    case "vehicle":
      return { page: "assets", tab: "vehicles", focusId };
    case "property":
      return { page: "assets", tab: "properties", focusId };
    case "reminder":
      return { page: "reminders", focusId };
    case "secret":
      return { page: "secrets", focusId };
    case "medical":
      return { page: "medical", focusId };
  }
}
