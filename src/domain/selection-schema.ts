import { z } from "zod";
import { FESTIVAL_DATES, GARBA_WORKSHOP_DATES } from "./catalog";

const DraftQuantitySchema = z.int().min(0).default(0);
const DraftFestivalDaysSchema = z
  .array(z.enum(FESTIVAL_DATES))
  .default([])
  .transform((days) => FESTIVAL_DATES.filter((day) => days.includes(day)));
const DraftWorkshopDaysSchema = z
  .array(z.enum(GARBA_WORKSHOP_DATES))
  .default([])
  .transform((days) => GARBA_WORKSHOP_DATES.filter((day) => days.includes(day)));

const DraftDaySelectionSchema = z
  .object({ quantity: DraftQuantitySchema, days: DraftFestivalDaysSchema })
  .default(() => ({ quantity: 0, days: [] }));
const DraftFlatSelectionSchema = z
  .object({ quantity: DraftQuantitySchema })
  .default(() => ({ quantity: 0 }));
const DraftWorkshopSelectionSchema = z
  .object({ quantity: DraftQuantitySchema, days: DraftWorkshopDaysSchema })
  .default(() => ({ quantity: 0, days: [] }));

export const DraftTicketSelectionSchema = z.object({
  day_pass_adult: DraftDaySelectionSchema,
  day_pass_child: DraftDaySelectionSchema,
  all_day_adult: DraftFlatSelectionSchema,
  all_day_child: DraftFlatSelectionSchema,
  family_pass: DraftDaySelectionSchema,
  dandiya_sticks: DraftFlatSelectionSchema,
  dinner_plate: DraftDaySelectionSchema,
  garba_workshop: DraftWorkshopSelectionSchema,
  promoCode: z
    .string()
    .nullish()
    .transform((code) => code ?? undefined),
});
