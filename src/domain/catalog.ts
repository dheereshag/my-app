/**
 * Sharad Utsav 2026 festival catalog, age boundaries, and promo definitions.
 * Pure TypeScript module with zero UI or database dependencies.
 */

import {
  EVENT_METADATA,
  FESTIVAL_DATES,
  GARBA_WORKSHOP_DATES,
  type FestivalDate,
} from "./calendar";

export const BOOKER_MIN_AGE = 18;
export const ADULT_MIN_AGE = 12;
export const CHILD_MIN_AGE = 5;
export const CHILD_MAX_AGE = 11;
export const TODDLER_MIN_AGE = 0;
export const TODDLER_MAX_AGE = 4;
export const MAX_AGE = 120;

export const DANDIYA_MAX_PER_ORDER = 20;
/** Upper bound on any single ticket, dinner or workshop quantity in one booking. */
export const MAX_QUANTITY_PER_LINE = 30;
/** Under-5s need no ticket, so their count is bounded here rather than by ticket quantities. */
export const MAX_TODDLERS_PER_BOOKING = 10;
export const FAMILY_PASS_ADULTS = 2;
export const FAMILY_PASS_CHILDREN = 2;
export const FAMILY_PASS_KIDS_FREE_SAVINGS_CENTS_PER_DAY = 1000;

export const ENTRY_SKU_IDS = [
  "day_pass_adult",
  "day_pass_child",
  "all_day_adult",
  "all_day_child",
  "family_pass",
] as const;

export type EntrySkuId = (typeof ENTRY_SKU_IDS)[number];

export const EXTRA_SKU_IDS = ["dandiya_sticks", "dinner_plate", "garba_workshop"] as const;

export type ExtraSkuId = (typeof EXTRA_SKU_IDS)[number];

export const SKU_IDS = [...ENTRY_SKU_IDS, ...EXTRA_SKU_IDS] as const;

export type SkuId = (typeof SKU_IDS)[number];

export type CatalogCategory = "entry" | "extra";

export type AgeGroupRule = "adult" | "child" | "family" | "any";

export interface CatalogItem {
  readonly sku: SkuId;
  readonly category: CatalogCategory;
  readonly label: string;
  readonly description: string;
  readonly priceCents: number;
  readonly unitLabel: string;
  readonly initialStock: number;
  readonly remainingStock: number;
  readonly ageGroup: AgeGroupRule;
  readonly lockedAllDays: boolean;
  readonly allowedDates: readonly FestivalDate[] | null;
  readonly maxPerOrder: number | null;
}

export type CatalogMap = Record<SkuId, CatalogItem>;

export const CATALOG_ITEMS: readonly CatalogItem[] = [
  {
    sku: "day_pass_adult",
    category: "entry",
    label: "Day Pass – Adult",
    description: `Ages 12 and above. Choose any of the ${EVENT_METADATA.totalDays} festival days.`,
    priceCents: 1500,
    unitLabel: "per person, per day",
    initialStock: 380,
    remainingStock: 380,
    ageGroup: "adult",
    lockedAllDays: false,
    allowedDates: FESTIVAL_DATES,
    maxPerOrder: null,
  },
  {
    sku: "day_pass_child",
    category: "entry",
    label: "Day Pass – Child",
    description: `Ages 5 to 11. Choose any of the ${EVENT_METADATA.totalDays} festival days.`,
    priceCents: 800,
    unitLabel: "per person, per day",
    initialStock: 260,
    remainingStock: 260,
    ageGroup: "child",
    lockedAllDays: false,
    allowedDates: FESTIVAL_DATES,
    maxPerOrder: null,
  },
  {
    sku: "all_day_adult",
    category: "entry",
    label: "All-Day Pass – Adult",
    description: `Ages 12 and above. Covers all ${EVENT_METADATA.totalDays} festival days.`,
    priceCents: 6000,
    unitLabel: `flat for all ${EVENT_METADATA.totalDays} days`,
    initialStock: 0,
    remainingStock: 0,
    ageGroup: "adult",
    lockedAllDays: true,
    allowedDates: FESTIVAL_DATES,
    maxPerOrder: null,
  },
  {
    sku: "all_day_child",
    category: "entry",
    label: "All-Day Pass – Child",
    description: `Ages 5 to 11. Covers all ${EVENT_METADATA.totalDays} festival days.`,
    priceCents: 3000,
    unitLabel: `flat for all ${EVENT_METADATA.totalDays} days`,
    initialStock: 140,
    remainingStock: 140,
    ageGroup: "child",
    lockedAllDays: true,
    allowedDates: FESTIVAL_DATES,
    maxPerOrder: null,
  },
  {
    sku: "family_pass",
    category: "entry",
    label: "Family Pass",
    description:
      "Covers 2 adults (12+) and 2 children (5–11) per group for each selected festival day.",
    priceCents: 4000,
    unitLabel: "flat per group, per day",
    initialStock: 95,
    remainingStock: 95,
    ageGroup: "family",
    lockedAllDays: false,
    allowedDates: FESTIVAL_DATES,
    maxPerOrder: null,
  },
  {
    sku: "dandiya_sticks",
    category: "extra",
    label: "Dandiya Sticks (pair)",
    description: "Souvenir pair of dandiya sticks. May be ordered standalone (max 20 per order).",
    priceCents: 500,
    unitLabel: "per pair",
    initialStock: 900,
    remainingStock: 900,
    ageGroup: "any",
    lockedAllDays: false,
    allowedDates: null,
    maxPerOrder: DANDIYA_MAX_PER_ORDER,
  },
  {
    sku: "dinner_plate",
    category: "extra",
    label: "Dinner Plate",
    description:
      "Prasad dinner plate per person, per chosen festival day. Requires entry coverage on each selected day.",
    priceCents: 1200,
    unitLabel: "per person, per day",
    initialStock: 1700,
    remainingStock: 1700,
    ageGroup: "any",
    lockedAllDays: false,
    allowedDates: FESTIVAL_DATES,
    maxPerOrder: null,
  },
  {
    sku: "garba_workshop",
    category: "extra",
    label: "Garba Workshop",
    description:
      "Guided Garba workshop on Nov 27 and Nov 29 only (shared 2-spot pool). Requires entry coverage (ages 5+) on the chosen night.",
    priceCents: 2000,
    unitLabel: "per spot",
    initialStock: 2,
    remainingStock: 2,
    ageGroup: "any",
    lockedAllDays: false,
    allowedDates: GARBA_WORKSHOP_DATES,
    maxPerOrder: null,
  },
] as const;

export type CatalogItemOverrides = Partial<
  Record<
    SkuId,
    Partial<Pick<CatalogItem, "remainingStock" | "priceCents" | "label" | "description">>
  >
>;

/** Builds a CatalogMap from canonical definitions with optional stock/price/copy overrides. */
export function createCatalogMap(overrides?: CatalogItemOverrides): CatalogMap {
  const entries = CATALOG_ITEMS.map((item) => {
    const patch = overrides?.[item.sku];
    const merged: CatalogItem = patch
      ? {
          ...item,
          ...patch,
          remainingStock:
            patch.remainingStock !== undefined
              ? Math.max(0, Math.trunc(patch.remainingStock))
              : item.remainingStock,
          priceCents:
            patch.priceCents !== undefined
              ? Math.max(0, Math.trunc(patch.priceCents))
              : item.priceCents,
        }
      : { ...item };
    return [item.sku, merged] as const;
  });

  return Object.fromEntries(entries) as CatalogMap;
}

export const INITIAL_CATALOG_MAP: CatalogMap = createCatalogMap();
