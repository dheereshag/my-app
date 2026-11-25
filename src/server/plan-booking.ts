/**
 * Pure booking decision: given a request that has already passed
 * CreateBookingRequestSchema and the live inventory, decide whether it can be
 * sold and exactly what must be reserved. No database access, so every rule here
 * is unit-testable.
 */

import {
  type FestivalDate,
  SKU_IDS,
  type CreateBookingRequest,
  type QuoteResult,
  type SkuId,
  type StockIssue,
  isEventBookingClosed,
} from "../domain";
import type { BookingConfirmation } from "./confirmation";
import type { Inventory } from "./inventory";
import { buildQuote, toQuoteResponse } from "./quote";

export interface StockDecrement {
  readonly sku: SkuId;
  readonly units: number;
}

export interface BookingPlan {
  readonly quote: QuoteResult;
  readonly stockDecrements: readonly StockDecrement[];
  /** Canonical promo code that was applied, or null when none was used. */
  readonly promoCode: string | null;
}

export type BookingRejection =
  | { readonly kind: "stock"; readonly issues: readonly StockIssue[] }
  | { readonly kind: "promo"; readonly message: string }
  | { readonly kind: "event_closed"; readonly message: string };

export type PlanResult =
  | { readonly ok: true; readonly plan: BookingPlan }
  | { readonly ok: false; readonly rejection: BookingRejection };

export function planBooking(
  request: CreateBookingRequest,
  inventory: Inventory,
  now: Date,
): PlanResult {
  if (isEventBookingClosed(now)) {
    return {
      ok: false,
      rejection: {
        kind: "event_closed",
        message: "Sharad Utsav 2026 has ended. New bookings are closed.",
      },
    };
  }

  const quote = buildQuote(request, inventory, now);

  // A code the customer typed that cannot be applied is an error, never a silent full-price charge.
  if (quote.promo !== null && !quote.promo.valid) {
    return { ok: false, rejection: { kind: "promo", message: quote.promo.message } };
  }
  if (quote.hasStockIssues) {
    return { ok: false, rejection: { kind: "stock", issues: quote.stockIssues } };
  }

  const stockDecrements = SKU_IDS.flatMap((sku) => {
    const units = quote.stockUsageBySku[sku];
    return units > 0 ? [{ sku, units }] : [];
  });

  return {
    ok: true,
    plan: { quote, stockDecrements, promoCode: quote.promo?.valid ? quote.promo.code : null },
  };
}

export interface AttendeeRecord {
  readonly kind: "adult" | "child" | "toddler";
  readonly fullName: string;
  readonly age: number;
  readonly phone: string | null;
  readonly attendingDays: readonly FestivalDate[] | null;
}

/** Everyone the door volunteers need to check in, including the booker when attending. */
export function listAttendees(request: CreateBookingRequest): AttendeeRecord[] {
  const { booker, attendees } = request;
  const bookerRecords: AttendeeRecord[] = booker.isAttendingAsAdult
    ? [
        {
          kind: "adult",
          fullName: booker.fullName,
          age: booker.age,
          phone: booker.phone,
          attendingDays: null,
        },
      ]
    : [];
  return [
    ...bookerRecords,
    ...attendees.adults.map((person) => ({
      kind: "adult" as const,
      fullName: person.fullName,
      age: person.age,
      phone: person.phone ?? null,
      attendingDays: null,
    })),
    ...attendees.children.map((person) => ({
      kind: "child" as const,
      fullName: person.fullName,
      age: person.age,
      phone: null,
      attendingDays: null,
    })),
    ...attendees.toddlers.map((person) => ({
      kind: "toddler" as const,
      fullName: person.fullName,
      age: person.age,
      phone: null,
      attendingDays: person.attendingDays,
    })),
  ];
}

export function buildConfirmation(
  request: CreateBookingRequest,
  plan: BookingPlan,
  reference: string,
): BookingConfirmation {
  // The confirmation is built from the server's own quote, never from request fields.
  const quote = toQuoteResponse(plan.quote);
  return {
    reference,
    status: "confirmed",
    payment: { method: "simulated", status: "paid", amountCents: quote.totalCents },
    booker: { fullName: request.booker.fullName, email: request.booker.email },
    lines: [...quote.lines],
    subtotalCents: quote.subtotalCents,
    discountCents: quote.discountCents,
    totalCents: quote.totalCents,
    promoCode: plan.promoCode,
    attendees: listAttendees(request).map(({ kind, fullName, age, attendingDays }) => ({
      kind,
      fullName,
      age,
      attendingDays: attendingDays === null ? null : [...attendingDays],
    })),
  };
}
