/**
 * Sharad Utsav 2026 festival catalog, calendar constants, age boundaries, and promo definitions.
 * Pure TypeScript module with zero UI or database dependencies.
 */

export const EVENT_METADATA = {
  name: "Sharad Utsav 2026",
  location: "Radha Krishna Temple, Allen, Texas",
  currency: "USD",
  dateRangeLabel: "Tue 10 Nov 2026 – Sat 14 Nov 2026",
  totalDays: 5,
} as const;

export const FESTIVAL_DATES = [
  "2026-11-10",
  "2026-11-11",
  "2026-11-12",
  "2026-11-13",
  "2026-11-14",
] as const;

export type FestivalDate = (typeof FESTIVAL_DATES)[number];

export const GARBA_WORKSHOP_DATES = ["2026-11-11", "2026-11-13"] as const;

export type GarbaWorkshopDate = (typeof GARBA_WORKSHOP_DATES)[number];

export interface FestivalDayInfo {
  readonly date: FestivalDate;
  readonly weekday: string;
  readonly shortDate: string;
  readonly label: string;
  readonly dayNumber: number;
  readonly hasGarbaWorkshop: boolean;
}

export const FESTIVAL_DAYS: readonly FestivalDayInfo[] = [
  {
    date: "2026-11-10",
    weekday: "Tue",
    shortDate: "Nov 10",
    label: "Tue, Nov 10",
    dayNumber: 1,
    hasGarbaWorkshop: false,
  },
  {
    date: "2026-11-11",
    weekday: "Wed",
    shortDate: "Nov 11",
    label: "Wed, Nov 11",
    dayNumber: 2,
    hasGarbaWorkshop: true,
  },
  {
    date: "2026-11-12",
    weekday: "Thu",
    shortDate: "Nov 12",
    label: "Thu, Nov 12",
    dayNumber: 3,
    hasGarbaWorkshop: false,
  },
  {
    date: "2026-11-13",
    weekday: "Fri",
    shortDate: "Nov 13",
    label: "Fri, Nov 13",
    dayNumber: 4,
    hasGarbaWorkshop: true,
  },
  {
    date: "2026-11-14",
    weekday: "Sat",
    shortDate: "Nov 14",
    label: "Sat, Nov 14",
    dayNumber: 5,
    hasGarbaWorkshop: false,
  },
] as const;

const FESTIVAL_DATE_ORDER = new Map<FestivalDate, number>(
  FESTIVAL_DATES.map((date, index) => [date, index]),
);
const FESTIVAL_DATE_SET = new Set<string>(FESTIVAL_DATES);
const GARBA_WORKSHOP_DATE_SET = new Set<string>(GARBA_WORKSHOP_DATES);

/** Type guard checking whether a string is one of the 5 allowed festival dates. */
export function isFestivalDate(value: string): value is FestivalDate {
  return FESTIVAL_DATE_SET.has(value);
}

/** Type guard checking whether a string is a valid Garba Workshop date (Nov 11 or Nov 13). */
export function isGarbaWorkshopDate(value: string): value is GarbaWorkshopDate {
  return GARBA_WORKSHOP_DATE_SET.has(value);
}

/** Deduplicates and sorts festival dates into canonical chronological order. */
export function sortFestivalDates(dates: readonly FestivalDate[]): FestivalDate[] {
  const unique = new Set<FestivalDate>();
  for (const date of dates) {
    if (FESTIVAL_DATE_SET.has(date)) {
      unique.add(date);
    }
  }
  return Array.from(unique).sort(
    (a, b) => (FESTIVAL_DATE_ORDER.get(a) ?? 0) - (FESTIVAL_DATE_ORDER.get(b) ?? 0),
  );
}

/** Deduplicates and sorts workshop dates into canonical chronological order. */
export function sortGarbaWorkshopDates(dates: readonly GarbaWorkshopDate[]): GarbaWorkshopDate[] {
  const unique = new Set<GarbaWorkshopDate>();
  for (const date of dates) {
    if (GARBA_WORKSHOP_DATE_SET.has(date)) {
      unique.add(date);
    }
  }
  return Array.from(unique).sort(
    (a, b) => (FESTIVAL_DATE_ORDER.get(a) ?? 0) - (FESTIVAL_DATE_ORDER.get(b) ?? 0),
  );
}

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
    description: "Ages 12 and above. Choose any 1 to 5 festival evenings.",
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
    description: "Ages 5 to 11. Choose any 1 to 5 festival evenings.",
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
    description: "Ages 12 and above. Covers all 5 festival days (Nov 10–14).",
    priceCents: 6000,
    unitLabel: "flat for all 5 days",
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
    description: "Ages 5 to 11. Covers all 5 festival days (Nov 10–14).",
    priceCents: 3000,
    unitLabel: "flat for all 5 days",
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
      "Guided Garba workshop on Wed Nov 11 & Fri Nov 13 only (shared 2-spot pool). Requires entry coverage (ages 5+) on the chosen night.",
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

export type PromoRuleKind = "percent" | "flat_cents" | "kids_free";

export interface PromoDefinition {
  readonly code: string;
  readonly kind: PromoRuleKind;
  readonly value: number;
  readonly description: string;
  readonly expiresAt: string | null;
  readonly maxUses: number | null;
  readonly usedCount: number;
  readonly isActive: boolean;
}

export type PromoStateMap = Record<string, PromoDefinition>;

const CANONICAL_PROMOS: readonly PromoDefinition[] = [
  {
    code: "SEVA10",
    kind: "percent",
    value: 10,
    description: "10% off the whole booking",
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    isActive: true,
  },
  {
    code: "FLAT20",
    kind: "flat_cents",
    value: 2000,
    description: "$20 off the whole booking",
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    isActive: true,
  },
  {
    code: "KIDSFREE",
    kind: "kids_free",
    value: 100,
    description: "Makes Day Pass – Child and All-Day Pass – Child tickets free",
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    isActive: true,
  },
  {
    code: "EXPIRED5",
    kind: "percent",
    value: 5,
    description: "5% off (expired Oct 31, 2026)",
    expiresAt: "2026-10-31T23:59:59Z",
    maxUses: null,
    usedCount: 0,
    isActive: true,
  },
  {
    code: "MAXEDOUT",
    kind: "flat_cents",
    value: 1000,
    description: "$10 off (redemption limit reached)",
    expiresAt: null,
    maxUses: 100,
    usedCount: 100,
    isActive: true,
  },
] as const;

/** Builds a PromoStateMap with optional per-code overrides (for tests or DB hydration). */
export function createPromoMap(
  overrides?: Partial<Record<string, Partial<PromoDefinition>>>,
): PromoStateMap {
  const map: PromoStateMap = {};
  for (const promo of CANONICAL_PROMOS) {
    const patch = overrides?.[promo.code];
    map[promo.code] = patch ? { ...promo, ...patch } : { ...promo };
  }
  if (overrides) {
    for (const [rawKey, patch] of Object.entries(overrides)) {
      const key = rawKey.trim().toUpperCase();
      if (!map[key] && patch && patch.kind && patch.code) {
        map[key] = {
          code: patch.code.trim().toUpperCase(),
          kind: patch.kind,
          value: patch.value ?? 0,
          description: patch.description ?? "",
          expiresAt: patch.expiresAt ?? null,
          maxUses: patch.maxUses ?? null,
          usedCount: patch.usedCount ?? 0,
          isActive: patch.isActive ?? true,
        };
      }
    }
  }
  return map;
}

export const INITIAL_PROMO_CODES: PromoStateMap = createPromoMap();
