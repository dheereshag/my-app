/**
 * Server-side pricing entry point and the public quote response shape.
 * Everything the browser shows as a price comes from here.
 */

import {
  calculateQuote,
  resolveRequestPromoCode,
  type FestivalDate,
  type QuoteRequest,
  type QuoteResult,
  type SkuId,
} from "../domain";
import type { Inventory } from "./inventory";

export interface QuoteLineResponse {
  readonly sku: SkuId;
  readonly label: string;
  readonly quantity: number;
  readonly days: FestivalDate[];
  readonly unitPriceCents: number;
  readonly subtotalCents: number;
  readonly discountCents: number;
  readonly totalCents: number;
}

export interface QuoteStockIssueResponse {
  readonly sku: SkuId;
  readonly label: string;
  readonly requested: number;
  readonly available: number;
  readonly message: string;
}

export interface QuotePromoResponse {
  readonly code: string;
  readonly valid: boolean;
  readonly status: string;
  readonly message: string;
}

export interface QuoteResponse {
  readonly currency: "USD";
  readonly lines: readonly QuoteLineResponse[];
  readonly subtotalCents: number;
  readonly discountCents: number;
  readonly totalCents: number;
  readonly promo: QuotePromoResponse | null;
  readonly stockIssues: readonly QuoteStockIssueResponse[];
  readonly requiredAdults: number;
  readonly requiredChildren: number;
  readonly tip: string | null;
}

/** Prices a selection against live inventory. Never reads a price from the request. */
export function buildQuote(request: QuoteRequest, inventory: Inventory, now: Date): QuoteResult {
  return calculateQuote(
    request.selection,
    inventory.catalog,
    { code: resolveRequestPromoCode(request) ?? null, promos: inventory.promos },
    now,
  );
}

export function toQuoteResponse(quote: QuoteResult): QuoteResponse {
  return {
    currency: quote.currency,
    lines: quote.lineItems.map((line) => ({
      sku: line.sku,
      label: line.label,
      quantity: line.quantity,
      days: line.days,
      unitPriceCents: line.unitPriceCents,
      subtotalCents: line.lineSubtotalCents,
      discountCents: line.discountCents,
      totalCents: line.lineTotalCents,
    })),
    subtotalCents: quote.subtotalCents,
    discountCents: quote.discountCents,
    totalCents: quote.totalCents,
    promo: quote.promo
      ? {
          code: quote.promo.code,
          valid: quote.promo.valid,
          status: quote.promo.status,
          message: quote.promo.message,
        }
      : null,
    stockIssues: quote.stockIssues.map((issue) => ({
      sku: issue.sku,
      label: issue.label,
      requested: issue.requested,
      available: issue.available,
      message: issue.message,
    })),
    requiredAdults: quote.requiredAdults,
    requiredChildren: quote.requiredChildren,
    tip: quote.kidsFreeFamilyTipMessage,
  };
}
