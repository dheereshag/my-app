/**
 * Browser-side calls to the booking API. Every failure is translated into a
 * plain-language BookingFailure so the UI never has to interpret status codes.
 */

import { fetch, FetchError } from "void/client";
import { z } from "zod";
import type { CreateBookingRequest, QuoteRequest } from "../domain";
import { BookingConfirmationSchema, type BookingConfirmation } from "../server/confirmation";
import type { QuoteResponse } from "../server/quote";

export type BookingFailure =
  | { readonly reason: "offline"; readonly message: string }
  | { readonly reason: "stock"; readonly message: string; readonly details: readonly string[] }
  | { readonly reason: "promo"; readonly message: string }
  | { readonly reason: "invalid"; readonly message: string }
  | { readonly reason: "conflict"; readonly message: string }
  | { readonly reason: "closed"; readonly message: string }
  | { readonly reason: "server"; readonly message: string };

export type BookingResult =
  | { readonly ok: true; readonly confirmation: BookingConfirmation }
  | { readonly ok: false; readonly failure: BookingFailure };

const StockConflictBodySchema = z.object({
  code: z.literal("stock_conflict"),
  message: z.string(),
  issues: z.array(z.object({ message: z.string() })),
});

const MessageBodySchema = z.object({ message: z.string() });

const OFFLINE_MESSAGE =
  "We couldn't reach the server. Check your connection and try again. You have not been charged.";
const SERVER_MESSAGE =
  "Something went wrong on our side. You have not been charged. Please try again in a moment.";

function describeFailure(error: unknown): BookingFailure {
  // A FetchError with no status means no response arrived: offline, dropped, or timed out.
  if (!(error instanceof FetchError) || error.status === undefined) {
    return { reason: "offline", message: OFFLINE_MESSAGE };
  }

  const body = MessageBodySchema.safeParse(error.data);
  const message = body.success ? body.data.message : SERVER_MESSAGE;

  if (error.status === 409) {
    const stock = StockConflictBodySchema.safeParse(error.data);
    return stock.success
      ? {
          reason: "stock",
          message: stock.data.message,
          details: stock.data.issues.map((issue) => issue.message),
        }
      : { reason: "conflict", message };
  }
  if (error.status === 422) {
    return { reason: "promo", message };
  }
  if (error.status === 410) {
    return { reason: "closed", message };
  }
  if (error.status === 400) {
    return { reason: "invalid", message: "Some details need another look. Please review them." };
  }
  return { reason: "server", message: SERVER_MESSAGE };
}

const BOOKING_TIMEOUT_MS = 20_000;

/** Posts the booking. The same idempotency key is safe to send again after any failure. */
export async function postBooking(request: CreateBookingRequest): Promise<BookingResult> {
  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      body: request,
      timeout: BOOKING_TIMEOUT_MS,
    });
    return { ok: true, confirmation: BookingConfirmationSchema.parse(response) };
  } catch (error) {
    return { ok: false, failure: describeFailure(error) };
  }
}

export function fetchQuote(request: QuoteRequest, signal: AbortSignal): Promise<QuoteResponse> {
  return fetch("/api/quote", { method: "POST", body: request, signal });
}
