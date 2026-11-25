/**
 * Turns the in-progress booking draft into API requests, using the same Zod
 * schemas the server uses. The client only uses the result to show inline
 * errors early; the server re-validates everything.
 */

import {
  AdultAttendeeSchema,
  BookerSchema,
  ChildAttendeeSchema,
  CreateBookingRequestSchema,
  QuoteRequestSchema,
  TicketSelectionSchema,
  ToddlerAttendeeSchema,
  getRequiredAttendeeCounts,
  type AttendeeGroupDraft,
  type CreateBookingRequest,
  type QuoteRequest,
  type TicketSelection,
} from "../domain";

export interface BookerDraft {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly age?: number;
  readonly isAttendingAsAdult: boolean;
}

export interface BookingDraft {
  readonly selection: TicketSelection;
  readonly promoCode: string;
  readonly booker: BookerDraft;
  readonly attendees: AttendeeGroupDraft;
}

/** Field errors keyed by dotted path, e.g. `booker.email` or `attendees.adults.0.age`. */
export type FieldErrors = Readonly<Record<string, string>>;

export type DraftValidation =
  | { readonly valid: true; readonly request: CreateBookingRequest }
  | { readonly valid: false; readonly errors: FieldErrors };

/** Random id that also works on plain-http pages, where crypto.randomUUID is unavailable. */
export function createRandomId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}-${hex}`;
}

/** The booker can only attend as an adult if an adult or family ticket exists. */
export function isBookerAttendingAsAdult(draft: BookingDraft): boolean {
  return draft.booker.isAttendingAsAdult && getRequiredAttendeeCounts(draft.selection).adults > 0;
}

function cleanPromoCode(promoCode: string): string | null {
  const trimmed = promoCode.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function selectionInput(selection: TicketSelection) {
  const { promoCode: _ignored, ...tickets } = selection;
  return tickets;
}

export function parseQuoteRequest(
  draft: Pick<BookingDraft, "selection" | "promoCode">,
): QuoteRequest | null {
  const parsed = QuoteRequestSchema.safeParse({
    selection: selectionInput(draft.selection),
    promoCode: cleanPromoCode(draft.promoCode),
  });
  return parsed.success ? parsed.data : null;
}

export function validateDraft(draft: BookingDraft, idempotencyKey: string): DraftValidation {
  const parsed = CreateBookingRequestSchema.safeParse({
    idempotencyKey,
    selection: selectionInput(draft.selection),
    promoCode: cleanPromoCode(draft.promoCode),
    booker: { ...draft.booker, isAttendingAsAdult: isBookerAttendingAsAdult(draft) },
    attendees: draft.attendees,
  });
  if (parsed.success) {
    return { valid: true, request: parsed.data };
  }

  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.join(".");
    if (!(path in errors)) {
      errors[path] = issue.message;
    }
  }
  return { valid: false, errors };
}

interface ValidationIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/** First message per dotted path, with `prefix` put in front of each path. */
function collectErrors(prefix: string, issues: readonly ValidationIssue[]): FieldErrors {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = [prefix, ...issue.path].filter((part) => part !== "").join(".");
    if (!(path in errors)) {
      errors[path] = issue.message;
    }
  }
  return errors;
}

function issuesOf(result: {
  readonly success: boolean;
  readonly error?: { readonly issues: readonly ValidationIssue[] };
}): readonly ValidationIssue[] {
  return result.success || !result.error ? [] : result.error.issues;
}

/** Problems with the chosen tickets only (step 1), keyed under `selection`. */
export function validateTickets(selection: TicketSelection): FieldErrors {
  return collectErrors(
    "selection",
    issuesOf(TicketSelectionSchema.safeParse(selectionInput(selection))),
  );
}

/** Problems with the booker and attendee details only (step 2). */
export function validateGroup(draft: BookingDraft): FieldErrors {
  return {
    ...collectErrors(
      "booker",
      issuesOf(
        BookerSchema.safeParse({
          ...draft.booker,
          isAttendingAsAdult: isBookerAttendingAsAdult(draft),
        }),
      ),
    ),
    ...collectErrors(
      "attendees.adults",
      issuesOf(AdultAttendeeSchema.array().safeParse(draft.attendees.adults)),
    ),
    ...collectErrors(
      "attendees.children",
      issuesOf(ChildAttendeeSchema.array().safeParse(draft.attendees.children)),
    ),
    ...collectErrors(
      "attendees.toddlers",
      issuesOf(ToddlerAttendeeSchema.array().safeParse(draft.attendees.toddlers)),
    ),
  };
}
