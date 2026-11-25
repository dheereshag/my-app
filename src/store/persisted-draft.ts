/**
 * Shape of what the booking store saves to sessionStorage. Stored data is
 * untrusted (old version, edited by hand), so it is re-validated on load and
 * discarded if it does not match. It is deliberately lenient about field
 * contents: a half-filled form is a valid draft even though it is not a valid booking.
 */

import { z } from "zod";
import { FestivalDateSchema, GarbaWorkshopDateSchema } from "../domain";
import { BookingConfirmationSchema } from "../server/confirmation";

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

export const PersistedDraftSchema = z.object({
  selection: z.object({
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
  }),
  promoCode: z.string(),
  booker: z.object({
    fullName: z.string(),
    email: z.string(),
    phone: z.string(),
    age: z.number().optional(),
    isAttendingAsAdult: z.boolean(),
  }),
  attendees: z.object({
    adults: z.array(PersonSchema.extend({ phone: z.string().optional() })),
    children: z.array(PersonSchema),
    toddlers: z.array(PersonSchema),
  }),
  idempotencyKey: z.string().min(1),
  confirmation: BookingConfirmationSchema.nullable(),
});

export type PersistedDraft = z.infer<typeof PersistedDraftSchema>;
