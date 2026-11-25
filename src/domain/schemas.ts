/**
 * Zod v4 validation schemas for tickets, attendees, quote requests, and booking creation.
 * Zero UI or database dependencies. Strictly rejects floats, out-of-range ages,
 * invalid dates, uncovered extras, mismatched attendee counts, and client-supplied prices.
 */

import { z } from "zod";
import {
  ADULT_MIN_AGE,
  BOOKER_MIN_AGE,
  CHILD_MAX_AGE,
  CHILD_MIN_AGE,
  DANDIYA_MAX_PER_ORDER,
  FESTIVAL_DATES,
  GARBA_WORKSHOP_DATES,
  MAX_AGE,
  MAX_QUANTITY_PER_LINE,
  MAX_TODDLERS_PER_BOOKING,
  TODDLER_MAX_AGE,
  TODDLER_MIN_AGE,
} from "./catalog";
import {
  getCoveredFestivalDays,
  getExpectedOtherAdultCount,
  getRequiredAttendeeCounts,
  getRequiredAttendeeCountsForDay,
} from "./pricing";

const PHONE_PATTERN = /^(?=(?:\D*\d){7})[+\d\s().-]+$/;

export const FestivalDateSchema = z.enum(FESTIVAL_DATES, {
  error: "Choose a valid festival date between Nov 10 and Nov 14, 2026.",
});

export const GarbaWorkshopDateSchema = z.enum(GARBA_WORKSHOP_DATES, {
  error: "Garba Workshop is only available on Nov 11 and Nov 13, 2026.",
});

const UniqueDaysCheck = z.refine<readonly string[]>((days) => new Set(days).size === days.length, {
  error: "Duplicate dates are not allowed.",
});
const FestivalDaysSchema = z
  .array(FestivalDateSchema, { error: "Selected days must be a list of dates." })
  .check(UniqueDaysCheck);
const WorkshopDaysSchema = z
  .array(GarbaWorkshopDateSchema, { error: "Selected days must be a list of dates." })
  .check(UniqueDaysCheck);

const NonNegativeIntSchema = z
  .int({ error: "Quantity must be a whole number." })
  .min(0, { error: "Quantity cannot be negative." });

const LineQuantitySchema = NonNegativeIntSchema.max(MAX_QUANTITY_PER_LINE, {
  error: `You can book at most ${MAX_QUANTITY_PER_LINE} of one ticket type in a single booking.`,
});

export const DayPassInputSchema = z.strictObject({
  quantity: LineQuantitySchema.default(0),
  days: FestivalDaysSchema.default([]),
});

export const AllDayInputSchema = z.strictObject({
  quantity: LineQuantitySchema.default(0),
});

export const DandiyaInputSchema = z.strictObject({
  quantity: NonNegativeIntSchema.max(DANDIYA_MAX_PER_ORDER, {
    error: `You can order at most ${DANDIYA_MAX_PER_ORDER} pairs of Dandiya Sticks per booking.`,
  }).default(0),
});

export const WorkshopInputSchema = z.strictObject({
  quantity: LineQuantitySchema.default(0),
  days: WorkshopDaysSchema.default([]),
});

export const PromoCodeInputSchema = z
  .string({ error: "Promo code must be text." })
  .trim()
  .max(32, { error: "Promo code must be 32 characters or fewer." });

export const TicketSelectionSchema = z
  .strictObject({
    day_pass_adult: DayPassInputSchema.default({ quantity: 0, days: [] }),
    day_pass_child: DayPassInputSchema.default({ quantity: 0, days: [] }),
    all_day_adult: AllDayInputSchema.default({ quantity: 0 }),
    all_day_child: AllDayInputSchema.default({ quantity: 0 }),
    family_pass: DayPassInputSchema.default({ quantity: 0, days: [] }),
    dandiya_sticks: DandiyaInputSchema.default({ quantity: 0 }),
    dinner_plate: DayPassInputSchema.default({ quantity: 0, days: [] }),
    garba_workshop: WorkshopInputSchema.default({ quantity: 0, days: [] }),
    promoCode: PromoCodeInputSchema.nullable().optional(),
  })
  .superRefine((selection, ctx) => {
    const hasEntryTicket =
      selection.day_pass_adult.quantity > 0 ||
      selection.day_pass_child.quantity > 0 ||
      selection.all_day_adult.quantity > 0 ||
      selection.all_day_child.quantity > 0 ||
      selection.family_pass.quantity > 0;

    if (!hasEntryTicket && selection.dandiya_sticks.quantity === 0) {
      ctx.addIssue({
        code: "custom",
        path: [],
        message: "Select at least one entry ticket or Dandiya Sticks pair.",
      });
    }

    const dayPassChecks: Array<{
      key: "day_pass_adult" | "day_pass_child" | "family_pass" | "dinner_plate" | "garba_workshop";
      label: string;
    }> = [
      { key: "day_pass_adult", label: "Day Pass – Adult" },
      { key: "day_pass_child", label: "Day Pass – Child" },
      { key: "family_pass", label: "Family Pass" },
      { key: "dinner_plate", label: "Dinner Plate" },
      { key: "garba_workshop", label: "Garba Workshop" },
    ];

    for (const check of dayPassChecks) {
      const entry = selection[check.key];
      if (entry.quantity > 0 && entry.days.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: [check.key, "days"],
          message: `Select at least one date for ${check.label}.`,
        });
      }
    }

    const coveredDays = new Set(getCoveredFestivalDays(selection));

    if (selection.dinner_plate.quantity > 0) {
      const uncoveredDinnerDays = selection.dinner_plate.days.filter(
        (day) => !coveredDays.has(day),
      );
      if (uncoveredDinnerDays.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["dinner_plate", "days"],
          message: `Dinner Plate requires an entry ticket covering each selected day (missing entry for ${uncoveredDinnerDays.join(", ")}).`,
        });
      }
    }

    if (selection.garba_workshop.quantity > 0) {
      const uncoveredWorkshopDays = selection.garba_workshop.days.filter(
        (day) => !coveredDays.has(day),
      );
      if (uncoveredWorkshopDays.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["garba_workshop", "days"],
          message: `Garba Workshop requires an entry ticket (ages 5+) covering each selected night (missing entry for ${uncoveredWorkshopDays.join(", ")}).`,
        });
      }
    }
  });

export const FullNameSchema = z
  .string({ error: "Full name is required." })
  .trim()
  .min(2, { error: "Full name must be at least 2 characters." })
  .max(100, { error: "Full name must be 100 characters or fewer." });

export const EmailSchema = z
  .string({ error: "Email address is required." })
  .trim()
  .pipe(z.email({ error: "Enter a valid email address." }));

export const PhoneSchema = z
  .string({ error: "Phone number is required." })
  .trim()
  .max(20, { error: "Phone number must be 20 characters or fewer." })
  .refine((val) => PHONE_PATTERN.test(val), {
    error: "Enter a valid phone number with at least 7 digits.",
  });

export const OptionalPhoneSchema = z
  .string({ error: "Phone number must be text." })
  .trim()
  .max(20, { error: "Phone number must be 20 characters or fewer." })
  .refine((val) => val.length === 0 || PHONE_PATTERN.test(val), {
    error: "Enter a valid phone number with at least 7 digits.",
  })
  .transform((val) => (val.length === 0 ? undefined : val))
  .optional();

export const BookerAgeSchema = z
  .int({ error: "Age must be a whole number." })
  .min(BOOKER_MIN_AGE, {
    error: `The person booking must be at least ${BOOKER_MIN_AGE} years old.`,
  })
  .max(MAX_AGE, { error: `Age must be ${MAX_AGE} or less.` });

export const AdultAgeSchema = z
  .int({ error: "Age must be a whole number." })
  .min(ADULT_MIN_AGE, {
    error: `Adult attendees must be at least ${ADULT_MIN_AGE} years old.`,
  })
  .max(MAX_AGE, { error: `Age must be ${MAX_AGE} or less.` });

export const ChildAgeSchema = z
  .int({ error: "Age must be a whole number." })
  .min(CHILD_MIN_AGE, {
    error: `Child attendees on a child ticket must be at least ${CHILD_MIN_AGE} years old (children under 5 attend free).`,
  })
  .max(CHILD_MAX_AGE, {
    error: `Attendees aged 12 and above require an adult ticket (child ticket max age is ${CHILD_MAX_AGE}).`,
  });

export const ToddlerAgeSchema = z
  .int({ error: "Age must be a whole number." })
  .min(TODDLER_MIN_AGE, { error: "Age cannot be negative." })
  .max(TODDLER_MAX_AGE, {
    error: `Free toddler admission is for ages ${TODDLER_MIN_AGE} to ${TODDLER_MAX_AGE} only.`,
  });

export const AttendeeIdSchema = z
  .string({ error: "Attendee ID is required." })
  .trim()
  .min(1, { error: "Attendee ID cannot be empty." })
  .max(100, { error: "Attendee ID is too long." });

export const BookerSchema = z.strictObject({
  fullName: FullNameSchema,
  email: EmailSchema,
  phone: PhoneSchema,
  age: BookerAgeSchema,
  isAttendingAsAdult: z.boolean({
    error: "Specify whether the booker is attending as an adult.",
  }),
});

export const AdultAttendeeSchema = z.strictObject({
  id: AttendeeIdSchema,
  fullName: FullNameSchema,
  age: AdultAgeSchema,
  phone: OptionalPhoneSchema,
});

export const ChildAttendeeSchema = z.strictObject({
  id: AttendeeIdSchema,
  fullName: FullNameSchema,
  age: ChildAgeSchema,
});

export const ToddlerAttendeeSchema = z.strictObject({
  id: AttendeeIdSchema,
  fullName: FullNameSchema,
  age: ToddlerAgeSchema,
  attendingDays: FestivalDaysSchema.refine((days) => days.length > 0, {
    error: "Choose at least one festival day for this child.",
  }),
});

export const AttendeeGroupSchema = z.strictObject({
  adults: z.array(AdultAttendeeSchema).default([]),
  children: z.array(ChildAttendeeSchema).default([]),
  toddlers: z
    .array(ToddlerAttendeeSchema)
    .max(MAX_TODDLERS_PER_BOOKING, {
      error: `You can add at most ${MAX_TODDLERS_PER_BOOKING} children under 5 to one booking.`,
    })
    .default([]),
});

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
