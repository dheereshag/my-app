import { z } from "zod";
import { FESTIVAL_DATES, GARBA_WORKSHOP_DATES } from "./calendar";
import { DANDIYA_MAX_PER_ORDER, MAX_QUANTITY_PER_LINE } from "./catalog";
import { getCoveredFestivalDays } from "./attendees";

export const FestivalDateSchema = z.enum(FESTIVAL_DATES, {
  error: "Choose a valid festival date between Nov 26 and Dec 10, 2026.",
});

export const GarbaWorkshopDateSchema = z.enum(GARBA_WORKSHOP_DATES, {
  error: "Garba Workshop is only available on Nov 27 and Nov 29, 2026.",
});

const UniqueDaysCheck = z.refine<readonly string[]>((days) => new Set(days).size === days.length, {
  error: "Duplicate dates are not allowed.",
});
export const FestivalDaysSchema = z
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
