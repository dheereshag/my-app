import { z } from "zod";
import {
  getCoveredFestivalDays,
  getExpectedOtherAdultCount,
  getRequiredAttendeeCounts,
  getRequiredAttendeeCountsForDay,
} from "./attendees";
import {
  AdultAttendeeSchema,
  AttendeeGroupSchema,
  BookerSchema,
  ChildAttendeeSchema,
  ToddlerAttendeeSchema,
} from "./attendee-schemas";
import { PromoCodeInputSchema, TicketSelectionSchema } from "./ticket-schemas";

export const QuoteRequestSchema = z.strictObject({
  selection: TicketSelectionSchema,
  promoCode: PromoCodeInputSchema.nullable().optional(),
});

export const IdempotencyKeySchema = z
  .string({ error: "Idempotency key is required." })
  .trim()
  .min(1, { error: "Idempotency key cannot be empty." })
  .max(128, { error: "Idempotency key must be 128 characters or fewer." });

export const CreateBookingRequestSchema = z
  .strictObject({
    idempotencyKey: IdempotencyKeySchema,
    selection: TicketSelectionSchema,
    promoCode: PromoCodeInputSchema.nullable().optional(),
    booker: BookerSchema,
    attendees: AttendeeGroupSchema,
  })
  .superRefine((booking, ctx) => {
    const { adults: requiredAdults, children: requiredChildren } = getRequiredAttendeeCounts(
      booking.selection,
    );

    if (booking.booker.isAttendingAsAdult && requiredAdults === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["booker", "isAttendingAsAdult"],
        message:
          "You cannot attend as an adult unless at least one adult or family entry ticket is selected.",
      });
    }

    const expectedAdults = getExpectedOtherAdultCount(
      requiredAdults,
      booking.booker.isAttendingAsAdult,
    );

    if (booking.attendees.adults.length !== expectedAdults) {
      ctx.addIssue({
        code: "custom",
        path: ["attendees", "adults"],
        message: `Expected ${expectedAdults} additional adult attendee(s) for the selected tickets, received ${booking.attendees.adults.length}.`,
      });
    }

    if (booking.attendees.children.length !== requiredChildren) {
      ctx.addIssue({
        code: "custom",
        path: ["attendees", "children"],
        message: `Expected ${requiredChildren} child attendee(s) for the selected tickets, received ${booking.attendees.children.length}.`,
      });
    }

    const attendeeIds = [
      ...booking.attendees.adults,
      ...booking.attendees.children,
      ...booking.attendees.toddlers,
    ].map((attendee) => attendee.id);
    if (new Set(attendeeIds).size !== attendeeIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["attendees"],
        message: "Each attendee must have a unique ID.",
      });
    }

    const coveredDays = new Set(getCoveredFestivalDays(booking.selection));
    booking.attendees.toddlers.forEach((toddler, index) => {
      const uncoveredDays = toddler.attendingDays.filter((day) => !coveredDays.has(day));
      if (uncoveredDays.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["attendees", "toddlers", index, "attendingDays"],
          message: `A child under 5 needs an accompanying entry ticket for ${uncoveredDays.join(", ")}.`,
        });
      }
    });

    for (const day of booking.selection.dinner_plate.days) {
      const { adults, children } = getRequiredAttendeeCountsForDay(booking.selection, day);
      const toddlerCount = booking.attendees.toddlers.filter((toddler) =>
        toddler.attendingDays.includes(day),
      ).length;
      const dinnerEaters = adults + children + toddlerCount;
      if (booking.selection.dinner_plate.quantity > dinnerEaters) {
        const attendance =
          dinnerEaters === 1 ? "1 person attends" : `${dinnerEaters} people attend`;
        ctx.addIssue({
          code: "custom",
          path: ["selection", "dinner_plate", "quantity"],
          message: `Dinner Plate is per person, per day: ${attendance} on ${day}, but ${booking.selection.dinner_plate.quantity} plates were requested.`,
        });
      }
    }

    for (const day of booking.selection.garba_workshop.days) {
      const { adults, children } = getRequiredAttendeeCountsForDay(booking.selection, day);
      const ticketedPeople = adults + children;
      if (booking.selection.garba_workshop.quantity > ticketedPeople) {
        const attendance =
          ticketedPeople === 1
            ? "1 ticketed person attends"
            : `${ticketedPeople} ticketed people attend`;
        ctx.addIssue({
          code: "custom",
          path: ["selection", "garba_workshop", "quantity"],
          message: `Garba Workshop is one place per person: ${attendance} on ${day}, but ${booking.selection.garba_workshop.quantity} places were requested.`,
        });
      }
    }
  });

export type BookerInput = z.infer<typeof BookerSchema>;
export type AdultAttendee = z.infer<typeof AdultAttendeeSchema>;
export type ChildAttendee = z.infer<typeof ChildAttendeeSchema>;
export type ToddlerAttendee = z.infer<typeof ToddlerAttendeeSchema>;
export type AttendeeGroup = z.infer<typeof AttendeeGroupSchema>;
export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;

/** Resolves the effective promo code from top-level request field or nested selection field. */
export function resolveRequestPromoCode(input: {
  promoCode?: string | null;
  selection: { promoCode?: string | null };
}): string | null | undefined {
  return input.promoCode !== undefined ? input.promoCode : input.selection.promoCode;
}
