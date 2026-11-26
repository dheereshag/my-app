/**
 * Shape of what the booking store saves to sessionStorage. Stored data is
 * untrusted (old version, edited by hand), so it is re-validated on load and
 * discarded if it does not match. It is deliberately lenient about field
 * contents: a half-filled form is a valid draft even though it is not a valid booking.
 */

import { z } from "zod";
import { createEmptySelection, FestivalDateSchema, GarbaWorkshopDateSchema } from "../domain";
import { LegacyFestivalDateSchema, LegacyWorkshopDateSchema } from "../domain/legacy-booking";
import { BookingConfirmationSchema } from "../server/confirmation";
import { EMPTY_BOOKER } from "./booking-request";

const QuantitySchema = z.int().min(0);
const DayQuantitySchema = z.object({
  quantity: QuantitySchema,
  days: z.array(FestivalDateSchema),
});
const FlatQuantitySchema = z.object({ quantity: QuantitySchema });

const PersonSchema = z.object({
  id: z.string().min(1),
  fullName: z.string(),
  age: z.number().optional(),
});
const ToddlerSchema = PersonSchema.extend({
  attendingDays: z.array(FestivalDateSchema).default([]),
});

const SelectionDraftSchema = z.object({
  day_pass_adult: DayQuantitySchema,
  day_pass_child: DayQuantitySchema,
  all_day_adult: FlatQuantitySchema,
  all_day_child: FlatQuantitySchema,
  family_pass: DayQuantitySchema,
  dandiya_sticks: FlatQuantitySchema,
  dinner_plate: DayQuantitySchema,
  garba_workshop: z.object({
    quantity: QuantitySchema,
    days: z.array(GarbaWorkshopDateSchema),
  }),
});
const AttendeeDraftSchema = z.object({
  adults: z.array(PersonSchema.extend({ phone: z.string().optional() })),
  children: z.array(PersonSchema),
  toddlers: z.array(ToddlerSchema),
});
const PersistedDraftBaseSchema = z.object({
  selection: SelectionDraftSchema,
  promoCode: z.string(),
  booker: z.object({
    fullName: z.string(),
    email: z.string(),
    phone: z.string(),
    age: z.number().optional(),
    isAttendingAsAdult: z.boolean(),
  }),
  attendees: AttendeeDraftSchema,
  idempotencyKey: z.string().min(1),
  confirmation: BookingConfirmationSchema.nullable(),
});

const LegacyDayQuantitySchema = DayQuantitySchema.extend({
  days: z.array(LegacyFestivalDateSchema),
});
export const LegacyPersistedDraftSchema = PersistedDraftBaseSchema.extend({
  selection: SelectionDraftSchema.extend({
    day_pass_adult: LegacyDayQuantitySchema,
    day_pass_child: LegacyDayQuantitySchema,
    family_pass: LegacyDayQuantitySchema,
    dinner_plate: LegacyDayQuantitySchema,
    garba_workshop: z.object({
      quantity: QuantitySchema,
      days: z.array(LegacyWorkshopDateSchema),
    }),
  }),
  attendees: AttendeeDraftSchema.extend({
    toddlers: z.array(
      PersonSchema.extend({
        attendingDays: z.array(LegacyFestivalDateSchema).optional(),
      }),
    ),
  }),
});
export type LegacyPersistedDraft = z.infer<typeof LegacyPersistedDraftSchema>;

export const PreviousDraftMigrationSchema = LegacyPersistedDraftSchema.transform((previous) => ({
  selection: createEmptySelection(),
  promoCode: "",
  booker: EMPTY_BOOKER,
  attendees: { adults: [], children: [], toddlers: [] },
  idempotencyKey: previous.idempotencyKey,
  confirmation: previous.confirmation,
  previousDraft: previous,
}));

export const PersistedDraftSchema = PersistedDraftBaseSchema.extend({
  previousDraft: LegacyPersistedDraftSchema.nullable().default(null),
});
export type PersistedDraft = z.infer<typeof PersistedDraftSchema>;
