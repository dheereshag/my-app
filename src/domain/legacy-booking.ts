import { z } from "zod";
import { MAX_TODDLERS_PER_BOOKING } from "./catalog";
import { FESTIVAL_DATES } from "./calendar";
import { AttendeeGroupSchema, ToddlerAttendeeSchema } from "./attendee-schemas";
import { CreateBookingRequestSchema } from "./schemas";
import {
  DayPassInputSchema,
  PromoCodeInputSchema,
  TicketSelectionSchema,
  WorkshopInputSchema,
} from "./ticket-schemas";

export const LEGACY_FESTIVAL_DATES = [
  "2026-11-10",
  "2026-11-11",
  "2026-11-12",
  "2026-11-13",
  "2026-11-14",
] as const;
export const LEGACY_WORKSHOP_DATES = ["2026-11-11", "2026-11-13"] as const;

export const LegacyFestivalDateSchema = z.enum(LEGACY_FESTIVAL_DATES);
export const LegacyWorkshopDateSchema = z.enum(LEGACY_WORKSHOP_DATES);
export const BookingDateSchema = z.enum([...LEGACY_FESTIVAL_DATES, ...FESTIVAL_DATES]);
export type BookingDate = z.infer<typeof BookingDateSchema>;

const LegacyDaysSchema = z
  .array(LegacyFestivalDateSchema)
  .refine((days) => new Set(days).size === days.length, "Duplicate dates are not allowed.");
const LegacyWorkshopDaysSchema = z
  .array(LegacyWorkshopDateSchema)
  .refine((days) => new Set(days).size === days.length, "Duplicate dates are not allowed.");

const LegacyDayPassSchema = DayPassInputSchema.extend({
  days: LegacyDaysSchema.default([]),
});
const LegacyWorkshopSchema = WorkshopInputSchema.extend({
  days: LegacyWorkshopDaysSchema.default([]),
});
const LegacySelectionSchema = z.strictObject({
  ...TicketSelectionSchema.shape,
  day_pass_adult: LegacyDayPassSchema.default({ quantity: 0, days: [] }),
  day_pass_child: LegacyDayPassSchema.default({ quantity: 0, days: [] }),
  family_pass: LegacyDayPassSchema.default({ quantity: 0, days: [] }),
  dinner_plate: LegacyDayPassSchema.default({ quantity: 0, days: [] }),
  garba_workshop: LegacyWorkshopSchema.default({ quantity: 0, days: [] }),
});
const LegacyToddlerSchema = z.strictObject({
  ...ToddlerAttendeeSchema.shape,
  attendingDays: LegacyDaysSchema.refine((days) => days.length > 0).optional(),
});
const LegacyAttendeeGroupSchema = z.strictObject({
  ...AttendeeGroupSchema.shape,
  toddlers: z.array(LegacyToddlerSchema).max(MAX_TODDLERS_PER_BOOKING).default([]),
});

// Only a matching stored hash can authorize a replay; this schema never authorizes a new booking.
export const LegacyBookingReplaySchema = z.strictObject({
  ...CreateBookingRequestSchema.shape,
  selection: LegacySelectionSchema,
  attendees: LegacyAttendeeGroupSchema,
});
export type LegacyBookingReplayRequest = z.infer<typeof LegacyBookingReplaySchema>;

export const LegacyDraftRequestSchema = LegacyBookingReplaySchema.extend({
  selection: LegacySelectionSchema.extend({
    promoCode: z.string().nullable().optional(),
  }).transform(({ promoCode: _ignored, ...selection }) => selection),
  promoCode: PromoCodeInputSchema.transform((code) => code || null),
});
