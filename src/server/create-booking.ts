/**
 * Turns a validated booking request into a stored booking.
 *
 * Concurrency model: the pre-check reads are advisory. The authoritative guard is
 * a single `db.batch` whose statements decrement stock, bump promo usage and insert
 * the booking. The table CHECK constraints (stock >= 0, promo uses <= max) and the
 * UNIQUE idempotency key make any losing race fail, and D1 rolls the whole batch back.
 */

import { attendees, bookings, promoUsage, stock } from "@schema";
import { db, eq, sql, type BatchItem } from "void/db";
import type { CreateBookingRequest, StockIssue } from "../domain";
import { BookingConfirmationSchema, type BookingConfirmation } from "./confirmation";
import { loadInventory } from "./inventory-store";
import {
  buildConfirmation,
  listAttendees,
  planBooking,
  type BookingPlan,
  type BookingRejection,
} from "./plan-booking";
import { buildQuote } from "./quote";
import { createBookingReference } from "./reference";

export type CreateBookingOutcome =
  | { readonly kind: "created"; readonly confirmation: BookingConfirmation }
  | { readonly kind: "replayed"; readonly confirmation: BookingConfirmation }
  | { readonly kind: "idempotency_conflict" }
  | { readonly kind: "stock_conflict"; readonly issues: readonly StockIssue[] }
  | { readonly kind: "promo_rejected"; readonly message: string }
  | { readonly kind: "event_closed"; readonly message: string };

type StoredBooking = typeof bookings.$inferSelect;

async function hashRequest(request: CreateBookingRequest): Promise<string> {
  const payload = JSON.stringify({
    selection: request.selection,
    promoCode: request.promoCode ?? null,
    booker: request.booker,
    attendees: request.attendees,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function findByIdempotencyKey(key: string): Promise<StoredBooking | null> {
  const [row] = await db.select().from(bookings).where(eq(bookings.idempotencyKey, key)).limit(1);
  return row ?? null;
}

/** Same key + same request returns the original confirmation; same key + different request is refused. */
function replayOutcome(existing: StoredBooking, requestHash: string): CreateBookingOutcome {
  if (existing.requestHash !== requestHash) {
    return { kind: "idempotency_conflict" };
  }
  return {
    kind: "replayed",
    confirmation: BookingConfirmationSchema.parse(JSON.parse(existing.confirmationJson)),
  };
}

function rejectionOutcome(rejection: BookingRejection): CreateBookingOutcome {
  switch (rejection.kind) {
    case "stock":
      return { kind: "stock_conflict", issues: rejection.issues };
    case "promo":
      return { kind: "promo_rejected", message: rejection.message };
    case "event_closed":
      return { kind: "event_closed", message: rejection.message };
  }
}

function buildWrites(
  request: CreateBookingRequest,
  plan: BookingPlan,
  confirmation: BookingConfirmation,
  requestHash: string,
): [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] {
  const reference = confirmation.reference;
  const writes: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
    db.insert(bookings).values({
      reference,
      idempotencyKey: request.idempotencyKey,
      requestHash,
      bookerName: request.booker.fullName,
      bookerEmail: request.booker.email,
      bookerPhone: request.booker.phone,
      promoCode: plan.promoCode,
      subtotalCents: confirmation.subtotalCents,
      discountCents: confirmation.discountCents,
      totalCents: confirmation.totalCents,
      confirmationJson: JSON.stringify(confirmation),
    }),
  ];

  for (const { sku, units } of plan.stockDecrements) {
    writes.push(
      db
        .update(stock)
        .set({ remaining: sql`${stock.remaining} - ${units}` })
        .where(eq(stock.sku, sku)),
    );
  }

  if (plan.promoCode !== null) {
    writes.push(
      db
        .update(promoUsage)
        .set({ usedCount: sql`${promoUsage.usedCount} + 1` })
        .where(eq(promoUsage.code, plan.promoCode)),
    );
  }

  // One insert per person keeps each statement under D1's bound-parameter limit.
  for (const person of listAttendees(request)) {
    writes.push(
      db.insert(attendees).values({
        bookingId: sql`(SELECT ${bookings.id} FROM ${bookings} WHERE ${bookings.reference} = ${reference})`,
        kind: person.kind,
        fullName: person.fullName,
        age: person.age,
        phone: person.phone,
        attendanceDaysJson:
          person.attendingDays === null ? null : JSON.stringify(person.attendingDays),
      }),
    );
  }

  return writes;
}

function errorText(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  while (current instanceof Error && messages.length < 5) {
    messages.push(current.message);
    current = current.cause;
  }
  return messages.join(" | ");
}

async function resolveWriteFailure(
  error: unknown,
  request: CreateBookingRequest,
  plan: BookingPlan,
  requestHash: string,
  now: Date,
): Promise<CreateBookingOutcome> {
  const text = errorText(error);

  if (text.includes("stock_remaining_non_negative")) {
    const issues = buildQuote(request, await loadInventory(), now).stockIssues;
    return { kind: "stock_conflict", issues };
  }
  if (text.includes("promo_usage_within_limit")) {
    return {
      kind: "promo_rejected",
      message: `Promo code "${plan.promoCode}" has just reached its maximum number of redemptions.`,
    };
  }
  if (text.includes("bookings.idempotency_key")) {
    const existing = await findByIdempotencyKey(request.idempotencyKey);
    if (existing !== null) {
      return replayOutcome(existing, requestHash);
    }
  }
  throw error;
}

export async function createBooking(
  request: CreateBookingRequest,
  now: Date = new Date(),
): Promise<CreateBookingOutcome> {
  const requestHash = await hashRequest(request);

  const existing = await findByIdempotencyKey(request.idempotencyKey);
  if (existing !== null) {
    return replayOutcome(existing, requestHash);
  }

  const planned = planBooking(request, await loadInventory(), now);
  if (!planned.ok) {
    return rejectionOutcome(planned.rejection);
  }

  const confirmation = buildConfirmation(request, planned.plan, createBookingReference());
  try {
    await db.batch(buildWrites(request, planned.plan, confirmation, requestHash));
  } catch (error) {
    return resolveWriteFailure(error, request, planned.plan, requestHash, now);
  }
  return { kind: "created", confirmation };
}
