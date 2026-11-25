/**
 * The confirmation returned for a booking. It is stored verbatim with the booking
 * so a repeated request (double click, retry after a dropped connection) gets the
 * identical response back, and it is re-validated when read from storage.
 */

import { z } from "zod";
import { FestivalDateSchema, SKU_IDS } from "../domain";

const ConfirmationLineSchema = z.object({
  sku: z.enum(SKU_IDS),
  label: z.string(),
  quantity: z.int(),
  days: z.array(FestivalDateSchema),
  unitPriceCents: z.int(),
  subtotalCents: z.int(),
  discountCents: z.int(),
  totalCents: z.int(),
});

export const BookingConfirmationSchema = z.object({
  reference: z.string(),
  status: z.literal("confirmed"),
  payment: z.object({
    method: z.literal("simulated"),
    status: z.literal("paid"),
    amountCents: z.int(),
  }),
  booker: z.object({ fullName: z.string(), email: z.string() }),
  lines: z.array(ConfirmationLineSchema),
  subtotalCents: z.int(),
  discountCents: z.int(),
  totalCents: z.int(),
  promoCode: z.string().nullable(),
  attendees: z.array(
    z.object({
      kind: z.enum(["adult", "child", "toddler"]),
      fullName: z.string(),
      age: z.int(),
      attendingDays: z.array(FestivalDateSchema).nullable().default(null),
    }),
  ),
});

export type BookingConfirmation = z.infer<typeof BookingConfirmationSchema>;
