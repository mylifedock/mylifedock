import type { CoverageType } from "../../../infrastructure/database/db";

/* ──────────────────────────────────────────
 * Product categories
 * ────────────────────────────────────────── */

export const PRODUCT_CATEGORIES = [
  "Electronics",
  "Appliance",
  "Vehicle",
  "Furniture",
  "Personal",
  "Home",
  "Membership",
  "Other",
];

export const COVERAGE_TYPES: {
  value: CoverageType;
  label: string;
}[] = [
  { value: "warranty", label: "Warranty" },
  {
    value: "extended-warranty",
    label: "Extended Warranty",
  },
  { value: "amc", label: "AMC" },
  { value: "insurance", label: "Insurance" },
];
