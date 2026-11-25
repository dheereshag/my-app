/**
 * Pure integer-cent pricing, day coverage, attendee reconciliation, and promo evaluation engine.
 * Zero UI, browser-clock, or database coupling.
 */

import {
  EVENT_METADATA,
  FAMILY_PASS_ADULTS,
  FAMILY_PASS_CHILDREN,
  FAMILY_PASS_KIDS_FREE_SAVINGS_CENTS_PER_DAY,
  FESTIVAL_DATES,
  INITIAL_CATALOG_MAP,
  INITIAL_PROMO_CODES,
  SKU_IDS,
  sortFestivalDates,
  sortGarbaWorkshopDates,
  type CatalogMap,
  type FestivalDate,
  type GarbaWorkshopDate,
  type PromoDefinition,
  type PromoRuleKind,
  type PromoStateMap,
  type SkuId,
} from "./catalog";

export interface DaySelectionInput {
  readonly quantity: number;
  readonly days: readonly FestivalDate[];
}

export interface FlatQuantityInput {
  readonly quantity: number;
}

export interface WorkshopSelectionInput {
  readonly quantity: number;
  readonly days: readonly GarbaWorkshopDate[];
}

export interface TicketSelection {
  readonly day_pass_adult: DaySelectionInput;
  readonly day_pass_child: DaySelectionInput;
  readonly all_day_adult: FlatQuantityInput;
  readonly all_day_child: FlatQuantityInput;
  readonly family_pass: DaySelectionInput;
  readonly dandiya_sticks: FlatQuantityInput;
  readonly dinner_plate: DaySelectionInput;
  readonly garba_workshop: WorkshopSelectionInput;
  readonly promoCode?: string | null;
}

export type PartialTicketSelection = {
  readonly [K in keyof TicketSelection]?: TicketSelection[K];
};

export interface RequiredAttendeeCounts {
  readonly adults: number;
  readonly children: number;
}

export interface AdultAttendeeDraft {
  readonly id: string;
  readonly fullName: string;
  readonly age?: number;
  readonly phone?: string;
}

export interface ChildAttendeeDraft {
  readonly id: string;
  readonly fullName: string;
  readonly age?: number;
}

export interface ToddlerAttendeeDraft {
  readonly id: string;
  readonly fullName: string;
  readonly age?: number;
  readonly attendingDays: readonly FestivalDate[];
}

export interface AttendeeGroupDraft {
  readonly adults: readonly AdultAttendeeDraft[];
  readonly children: readonly ChildAttendeeDraft[];
  readonly toddlers: readonly ToddlerAttendeeDraft[];
}

export interface ReconciledAttendeeGroup {
  readonly adults: AdultAttendeeDraft[];
  readonly children: ChildAttendeeDraft[];
  readonly toddlers: ToddlerAttendeeDraft[];
}

export interface BookerAttendeeFlag {
  readonly isAttendingAsAdult: boolean;
}

export type PromoStatus = "none" | "applied" | "expired" | "maxed_out" | "inactive" | "invalid";

export interface PromoEvaluationResult {
  readonly valid: boolean;
  readonly status: PromoStatus;
  readonly code: string;
  readonly kind: PromoRuleKind | null;
  readonly discountCents: number;
  readonly message: string;
}

export interface PromoStateWrapper {
  readonly code?: string | null;
  readonly promos?: PromoStateMap;
}

export type PromoStateInput =
  | PromoStateMap
  | PromoDefinition
  | PromoStateWrapper
  | null
  | undefined;

export interface QuoteLineItem {
  readonly sku: SkuId;
  readonly label: string;
  readonly unitPriceCents: number;
  readonly quantity: number;
  readonly days: FestivalDate[];
  readonly stockUnits: number;
  readonly lineSubtotalCents: number;
  readonly discountCents: number;
  readonly lineTotalCents: number;
}

export interface StockIssue {
  readonly sku: SkuId;
  readonly label: string;
  readonly requested: number;
  readonly available: number;
  readonly message: string;
}

export interface QuoteResult {
  readonly currency: typeof EVENT_METADATA.currency;
  readonly lineItems: QuoteLineItem[];
  readonly stockUsageBySku: Record<SkuId, number>;
  readonly stockIssues: StockIssue[];
  readonly hasStockIssues: boolean;
  readonly coveredDays: FestivalDate[];
  readonly requiredAdults: number;
  readonly requiredChildren: number;
  readonly subtotalCents: number;
  readonly childTicketSubtotalCents: number;
  readonly discountCents: number;
  readonly totalCents: number;
  readonly promo: PromoEvaluationResult | null;
  readonly kidsFreeFamilyTip: boolean;
  readonly kidsFreeFamilyTipSavingsCents: number;
  readonly kidsFreeFamilyTipMessage: string | null;
}

/** Creates an empty TicketSelection with zero quantities across all SKUs. */
export function createEmptySelection(): TicketSelection {
  return {
    day_pass_adult: { quantity: 0, days: [] },
    day_pass_child: { quantity: 0, days: [] },
    all_day_adult: { quantity: 0 },
    all_day_child: { quantity: 0 },
    family_pass: { quantity: 0, days: [] },
    dandiya_sticks: { quantity: 0 },
    dinner_plate: { quantity: 0, days: [] },
    garba_workshop: { quantity: 0, days: [] },
  };
}

function toSafeQuantity(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

/** Normalizes a partial or full selection into canonical arrays and integer quantities. */
export function normalizeSelection(
  selection: TicketSelection | PartialTicketSelection,
): TicketSelection {
  return {
    day_pass_adult: {
      quantity: toSafeQuantity(selection.day_pass_adult?.quantity),
      days: sortFestivalDates(selection.day_pass_adult?.days ?? []),
    },
    day_pass_child: {
      quantity: toSafeQuantity(selection.day_pass_child?.quantity),
      days: sortFestivalDates(selection.day_pass_child?.days ?? []),
    },
    all_day_adult: {
      quantity: toSafeQuantity(selection.all_day_adult?.quantity),
    },
    all_day_child: {
      quantity: toSafeQuantity(selection.all_day_child?.quantity),
    },
    family_pass: {
      quantity: toSafeQuantity(selection.family_pass?.quantity),
      days: sortFestivalDates(selection.family_pass?.days ?? []),
    },
    dandiya_sticks: {
      quantity: toSafeQuantity(selection.dandiya_sticks?.quantity),
    },
    dinner_plate: {
      quantity: toSafeQuantity(selection.dinner_plate?.quantity),
      days: sortFestivalDates(selection.dinner_plate?.days ?? []),
    },
    garba_workshop: {
      quantity: toSafeQuantity(selection.garba_workshop?.quantity),
      days: sortGarbaWorkshopDates(selection.garba_workshop?.days ?? []),
    },
    promoCode: selection.promoCode ?? undefined,
  };
}

/** Formats an integer cent amount as USD without floating-point arithmetic. */
export function formatUsd(cents: number): string {
  const safeCents = Number.isFinite(cents) ? Math.round(cents) : 0;
  const sign = safeCents < 0 ? "-" : "";
  const absCents = Math.abs(safeCents);
  const dollars = Math.trunc(absCents / 100);
  const remainder = absCents % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${String(remainder).padStart(2, "0")}`;
}

/**
 * Returns the canonically sorted festival dates covered by at least one entry ticket (ages 5+).
 * Extras (dandiya, dinner plate, garba workshop) never grant entry coverage.
 */
export function getCoveredFestivalDays(
  selection: TicketSelection | PartialTicketSelection,
): FestivalDate[] {
  const normalized = normalizeSelection(selection);
  const covered = new Set<FestivalDate>();

  if (normalized.all_day_adult.quantity > 0 || normalized.all_day_child.quantity > 0) {
    for (const date of FESTIVAL_DATES) {
      covered.add(date);
    }
  }
  if (normalized.day_pass_adult.quantity > 0) {
    for (const date of normalized.day_pass_adult.days) {
      covered.add(date);
    }
  }
  if (normalized.day_pass_child.quantity > 0) {
    for (const date of normalized.day_pass_child.days) {
      covered.add(date);
    }
  }
  if (normalized.family_pass.quantity > 0) {
    for (const date of normalized.family_pass.days) {
      covered.add(date);
    }
  }

  return sortFestivalDates(Array.from(covered));
}

/**
 * Returns the total number of ticketed adults (12+) and children (5..11)
 * implied by the selected entry tickets.
 */
export function getRequiredAttendeeCounts(
  selection: TicketSelection | PartialTicketSelection,
): RequiredAttendeeCounts {
  const normalized = normalizeSelection(selection);
  const adults =
    normalized.day_pass_adult.quantity +
    normalized.all_day_adult.quantity +
    normalized.family_pass.quantity * FAMILY_PASS_ADULTS;
  const children =
    normalized.day_pass_child.quantity +
    normalized.all_day_child.quantity +
    normalized.family_pass.quantity * FAMILY_PASS_CHILDREN;

  return { adults, children };
}

/** Returns the number of adult and child ticket holders attending on one day. */
export function getRequiredAttendeeCountsForDay(
  selection: TicketSelection | PartialTicketSelection,
  date: FestivalDate,
): RequiredAttendeeCounts {
  const normalized = normalizeSelection(selection);
  const familyPasses = normalized.family_pass.days.includes(date)
    ? normalized.family_pass.quantity
    : 0;

  return {
    adults:
      (normalized.day_pass_adult.days.includes(date) ? normalized.day_pass_adult.quantity : 0) +
      normalized.all_day_adult.quantity +
      familyPasses * FAMILY_PASS_ADULTS,
    children:
      (normalized.day_pass_child.days.includes(date) ? normalized.day_pass_child.quantity : 0) +
      normalized.all_day_child.quantity +
      familyPasses * FAMILY_PASS_CHILDREN,
  };
}

/**
 * Computes how many other adult attendee records must be collected
 * once the booker's own attendance status is factored in.
 */
export function getExpectedOtherAdultCount(
  requiredAdults: number,
  isAttendingAsAdult: boolean,
): number {
  const safeRequired = Math.max(0, Math.trunc(requiredAdults));
  if (safeRequired === 0) {
    return 0;
  }
  return isAttendingAsAdult ? safeRequired - 1 : safeRequired;
}

function createAttendeeId(prefix: "adult" | "child"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Purely resizes adult and child attendee draft arrays to match ticket parity
 * while preserving already-entered attendee details and leaving toddlers untouched.
 */
export function reconcileAttendees(
  current: AttendeeGroupDraft,
  requiredAdults: number,
  requiredChildren: number,
  booker: BookerAttendeeFlag,
): ReconciledAttendeeGroup {
  const expectedAdults = getExpectedOtherAdultCount(requiredAdults, booker.isAttendingAsAdult);
  const expectedChildren = Math.max(0, Math.trunc(requiredChildren));

  const nextAdults: AdultAttendeeDraft[] = current.adults
    .slice(0, expectedAdults)
    .map((adult) => ({ ...adult }));
  while (nextAdults.length < expectedAdults) {
    nextAdults.push({
      id: createAttendeeId("adult"),
      fullName: "",
      age: undefined,
      phone: undefined,
    });
  }

  const nextChildren: ChildAttendeeDraft[] = current.children
    .slice(0, expectedChildren)
    .map((child) => ({ ...child }));
  while (nextChildren.length < expectedChildren) {
    nextChildren.push({
      id: createAttendeeId("child"),
      fullName: "",
      age: undefined,
    });
  }

  const nextToddlers: ToddlerAttendeeDraft[] = current.toddlers.map((toddler) => ({ ...toddler }));

  return {
    adults: nextAdults,
    children: nextChildren,
    toddlers: nextToddlers,
  };
}

function isPromoDefinition(value: unknown): value is PromoDefinition {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    "code" in value &&
    typeof value.code === "string" &&
    "kind" in value &&
    typeof value.kind === "string" &&
    "value" in value &&
    typeof value.value === "number"
  );
}

function isPromoStateWrapper(value: unknown): value is PromoStateWrapper {
  if (typeof value !== "object" || value === null || isPromoDefinition(value)) {
    return false;
  }
  return "promos" in value || "code" in value;
}

function lookupPromoDefinition(
  normalizedCode: string,
  promoState: PromoStateInput,
): PromoDefinition | null {
  if (promoState === null) {
    return null;
  }
  if (promoState === undefined) {
    return INITIAL_PROMO_CODES[normalizedCode] ?? null;
  }
  if (isPromoDefinition(promoState)) {
    return promoState.code.trim().toUpperCase() === normalizedCode ? promoState : null;
  }
  if (isPromoStateWrapper(promoState)) {
    const source = promoState.promos ?? INITIAL_PROMO_CODES;
    return source[normalizedCode] ?? null;
  }
  return promoState[normalizedCode] ?? null;
}

/**
 * Evaluates a promo code against promo state and booking subtotals using pure integer math.
 * Accepts an injectable `now` Date so expiry validation is deterministic in tests.
 */
export function evaluatePromoCode(
  code: string | null | undefined,
  promoState: PromoStateInput,
  subtotalCents: number,
  childTicketSubtotalCents: number,
  now: Date = new Date(),
): PromoEvaluationResult {
  const normalized = (code ?? "").trim().toUpperCase();
  if (normalized.length === 0) {
    return {
      valid: false,
      status: "none",
      code: "",
      kind: null,
      discountCents: 0,
      message: "Enter a promo code to apply a discount.",
    };
  }

  const safeSubtotal = Math.max(0, Math.round(subtotalCents));
  const safeChildSubtotal = Math.min(
    safeSubtotal,
    Math.max(0, Math.round(childTicketSubtotalCents)),
  );
  const promo = lookupPromoDefinition(normalized, promoState);

  if (!promo) {
    return {
      valid: false,
      status: "invalid",
      code: normalized,
      kind: null,
      discountCents: 0,
      message: `Promo code "${normalized}" is not valid.`,
    };
  }

  if (!promo.isActive) {
    return {
      valid: false,
      status: "inactive",
      code: normalized,
      kind: promo.kind,
      discountCents: 0,
      message: `Promo code "${normalized}" is currently inactive.`,
    };
  }

  if (promo.expiresAt !== null) {
    const expiresMs = Date.parse(promo.expiresAt);
    if (!Number.isNaN(expiresMs) && now.getTime() > expiresMs) {
      return {
        valid: false,
        status: "expired",
        code: normalized,
        kind: promo.kind,
        discountCents: 0,
        message: `Promo code "${normalized}" expired on ${promo.expiresAt.slice(0, 10)}.`,
      };
    }
  }

  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return {
      valid: false,
      status: "maxed_out",
      code: normalized,
      kind: promo.kind,
      discountCents: 0,
      message: `Promo code "${normalized}" has reached its maximum number of redemptions.`,
    };
  }

  let discountCents = 0;
  let message = "";

  switch (promo.kind) {
    case "percent": {
      discountCents = Math.min(
        safeSubtotal,
        Math.max(0, Math.trunc((safeSubtotal * promo.value + 50) / 100)),
      );
      message = `${normalized} applied (${promo.value}% off: -${formatUsd(discountCents)}).`;
      break;
    }
    case "flat_cents": {
      discountCents = Math.min(safeSubtotal, Math.max(0, Math.trunc(promo.value)));
      message = `${normalized} applied (-${formatUsd(discountCents)}).`;
      break;
    }
    case "kids_free": {
      discountCents = safeChildSubtotal;
      message =
        discountCents > 0
          ? `${normalized} applied: individual child tickets are free (-${formatUsd(discountCents)}).`
          : `${normalized} applied, though your cart has no Day Pass – Child or All-Day Pass – Child tickets.`;
      break;
    }
  }

  return {
    valid: true,
    status: "applied",
    code: normalized,
    kind: promo.kind,
    discountCents,
    message,
  };
}

interface RawLineDraft {
  readonly sku: SkuId;
  readonly label: string;
  readonly unitPriceCents: number;
  readonly quantity: number;
  readonly days: FestivalDate[];
  readonly stockUnits: number;
  readonly lineSubtotalCents: number;
}

function allocateProportionalDiscounts(
  lines: readonly RawLineDraft[],
  totalDiscountCents: number,
  subtotalCents: number,
): number[] {
  if (totalDiscountCents <= 0 || subtotalCents <= 0 || lines.length === 0) {
    return lines.map(() => 0);
  }

  const baseDiscounts = lines.map((line) =>
    Math.trunc((totalDiscountCents * line.lineSubtotalCents) / subtotalCents),
  );
  const remainders = lines.map((line, index) => ({
    index,
    remainder: (totalDiscountCents * line.lineSubtotalCents) % subtotalCents,
    cap: line.lineSubtotalCents - baseDiscounts[index],
  }));

  let allocated = 0;
  for (const amount of baseDiscounts) {
    allocated += amount;
  }

  let leftover = totalDiscountCents - allocated;
  if (leftover > 0) {
    const ranked = [...remainders].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (const entry of ranked) {
      if (leftover <= 0) {
        break;
      }
      if (entry.cap > 0) {
        baseDiscounts[entry.index] += 1;
        leftover -= 1;
      }
    }
  }

  return baseDiscounts;
}

function createEmptyStockUsage(): Record<SkuId, number> {
  const entries = SKU_IDS.map((sku) => [sku, 0] as const);
  return Object.fromEntries(entries) as Record<SkuId, number>;
}

function resolveQuotePromoCode(
  selection: TicketSelection,
  promoState: PromoStateInput,
): string | null | undefined {
  if (isPromoStateWrapper(promoState) && promoState.code !== undefined) {
    return promoState.code;
  }
  if (selection.promoCode !== undefined) {
    return selection.promoCode;
  }
  if (isPromoDefinition(promoState)) {
    return promoState.code;
  }
  return undefined;
}

/**
 * Computes an authoritative integer-cent quote, itemized line discounts, stock usage by SKU,
 * stock availability issues, covered festival days, required attendees, and promo tips.
 */
export function calculateQuote(
  selection: TicketSelection | PartialTicketSelection,
  catalogMap: CatalogMap = INITIAL_CATALOG_MAP,
  promoState?: PromoStateInput,
  now: Date = new Date(),
): QuoteResult {
  const normalized = normalizeSelection(selection);
  const stockUsageBySku = createEmptyStockUsage();
  const rawLines: RawLineDraft[] = [];

  const addLine = (
    sku: SkuId,
    quantity: number,
    days: readonly FestivalDate[],
    stockUnits: number,
  ): void => {
    if (stockUnits <= 0 || quantity <= 0) {
      return;
    }
    const item = catalogMap[sku];
    stockUsageBySku[sku] += stockUnits;
    rawLines.push({
      sku,
      label: item.label,
      unitPriceCents: item.priceCents,
      quantity,
      days: [...days],
      stockUnits,
      lineSubtotalCents: item.priceCents * stockUnits,
    });
  };

  addLine(
    "day_pass_adult",
    normalized.day_pass_adult.quantity,
    normalized.day_pass_adult.days,
    normalized.day_pass_adult.quantity * normalized.day_pass_adult.days.length,
  );
  addLine(
    "day_pass_child",
    normalized.day_pass_child.quantity,
    normalized.day_pass_child.days,
    normalized.day_pass_child.quantity * normalized.day_pass_child.days.length,
  );
  addLine(
    "all_day_adult",
    normalized.all_day_adult.quantity,
    [...FESTIVAL_DATES],
    normalized.all_day_adult.quantity,
  );
  addLine(
    "all_day_child",
    normalized.all_day_child.quantity,
    [...FESTIVAL_DATES],
    normalized.all_day_child.quantity,
  );
  addLine(
    "family_pass",
    normalized.family_pass.quantity,
    normalized.family_pass.days,
    normalized.family_pass.quantity * normalized.family_pass.days.length,
  );
  addLine(
    "dandiya_sticks",
    normalized.dandiya_sticks.quantity,
    [],
    normalized.dandiya_sticks.quantity,
  );
  addLine(
    "dinner_plate",
    normalized.dinner_plate.quantity,
    normalized.dinner_plate.days,
    normalized.dinner_plate.quantity * normalized.dinner_plate.days.length,
  );
  addLine(
    "garba_workshop",
    normalized.garba_workshop.quantity,
    [...normalized.garba_workshop.days],
    normalized.garba_workshop.quantity * normalized.garba_workshop.days.length,
  );

  let subtotalCents = 0;
  let childTicketSubtotalCents = 0;
  for (const line of rawLines) {
    subtotalCents += line.lineSubtotalCents;
    if (line.sku === "day_pass_child" || line.sku === "all_day_child") {
      childTicketSubtotalCents += line.lineSubtotalCents;
    }
  }

  const rawCode = resolveQuotePromoCode(normalized, promoState);
  const trimmedCode = (rawCode ?? "").trim();
  const promo =
    trimmedCode.length > 0
      ? evaluatePromoCode(trimmedCode, promoState, subtotalCents, childTicketSubtotalCents, now)
      : null;

  const discountCents = promo?.valid ? promo.discountCents : 0;

  let lineDiscounts: number[];
  if (promo?.valid && promo.kind === "kids_free") {
    lineDiscounts = rawLines.map((line) =>
      line.sku === "day_pass_child" || line.sku === "all_day_child" ? line.lineSubtotalCents : 0,
    );
  } else {
    lineDiscounts = allocateProportionalDiscounts(rawLines, discountCents, subtotalCents);
  }

  const lineItems: QuoteLineItem[] = rawLines.map((line, index) => {
    const lineDiscount = lineDiscounts[index] ?? 0;
    return {
      sku: line.sku,
      label: line.label,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      days: line.days,
      stockUnits: line.stockUnits,
      lineSubtotalCents: line.lineSubtotalCents,
      discountCents: lineDiscount,
      lineTotalCents: line.lineSubtotalCents - lineDiscount,
    };
  });

  const stockIssues: StockIssue[] = [];
  for (const sku of SKU_IDS) {
    const requested = stockUsageBySku[sku];
    if (requested > 0) {
      const item = catalogMap[sku];
      if (requested > item.remainingStock) {
        const message =
          item.remainingStock === 0
            ? `${item.label} is sold out (0 remaining).`
            : `Only ${item.remainingStock} remaining for ${item.label}, but ${requested} requested.`;
        stockIssues.push({
          sku,
          label: item.label,
          requested,
          available: item.remainingStock,
          message,
        });
      }
    }
  }

  const familyPassStockUnits = stockUsageBySku.family_pass;
  const kidsFreeFamilyTip = Boolean(
    promo?.valid && promo.kind === "kids_free" && familyPassStockUnits > 0,
  );
  const kidsFreeFamilyTipSavingsCents = kidsFreeFamilyTip
    ? familyPassStockUnits * FAMILY_PASS_KIDS_FREE_SAVINGS_CENTS_PER_DAY
    : 0;
  const kidsFreeFamilyTipMessage = kidsFreeFamilyTip
    ? `Tip: KIDSFREE does not discount Family Pass ($40/day). Switching to 2 Day Pass – Adult ($30/day) + 2 Day Pass – Child (Free) saves ${formatUsd(FAMILY_PASS_KIDS_FREE_SAVINGS_CENTS_PER_DAY)}/day (${formatUsd(kidsFreeFamilyTipSavingsCents)} total).`
    : null;

  const { adults: requiredAdults, children: requiredChildren } =
    getRequiredAttendeeCounts(normalized);

  return {
    currency: EVENT_METADATA.currency,
    lineItems,
    stockUsageBySku,
    stockIssues,
    hasStockIssues: stockIssues.length > 0,
    coveredDays: getCoveredFestivalDays(normalized),
    requiredAdults,
    requiredChildren,
    subtotalCents,
    childTicketSubtotalCents,
    discountCents,
    totalCents: Math.max(0, subtotalCents - discountCents),
    promo,
    kidsFreeFamilyTip,
    kidsFreeFamilyTipSavingsCents,
    kidsFreeFamilyTipMessage,
  };
}
