import { EVENT_METADATA, FESTIVAL_DATES, type FestivalDate } from "./calendar";
import {
  FAMILY_PASS_KIDS_FREE_SAVINGS_CENTS_PER_DAY,
  INITIAL_CATALOG_MAP,
  SKU_IDS,
  type CatalogMap,
  type SkuId,
} from "./catalog";
import {
  getCoveredFestivalDays,
  getRequiredAttendeeCounts,
  type PartialTicketSelection,
  type TicketSelection,
} from "./attendees";
import { formatUsd } from "./money";
import {
  evaluatePromoCode,
  resolveQuotePromoCode,
  type PromoEvaluationResult,
  type PromoStateInput,
} from "./promotions";
import { DraftTicketSelectionSchema } from "./selection-schema";

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
  const normalized = DraftTicketSelectionSchema.parse(selection);
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
