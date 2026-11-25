/**
 * Pure rules for editing a ticket selection in the UI. After every change the
 * selection is made self-consistent, so the person never has to untangle it:
 * extras only keep days that an entry ticket covers, and dinner/workshop
 * quantities never exceed the people who could use them. The server enforces
 * the same rules independently.
 */

import {
  DANDIYA_MAX_PER_ORDER,
  MAX_QUANTITY_PER_LINE,
  getCoveredFestivalDays,
  getRequiredAttendeeCounts,
  normalizeSelection,
  type FestivalDate,
  type PartialTicketSelection,
  type TicketSelection,
} from "../domain";

interface DayQuantity<D extends FestivalDate> {
  readonly quantity: number;
  readonly days: readonly D[];
}

/** A day-based ticket with no quantity has no days either. */
function withoutDaysWhenEmpty<D extends FestivalDate>(input: DayQuantity<D>): DayQuantity<D> {
  return input.quantity === 0 ? { quantity: 0, days: [] } : input;
}

/** Keeps only days that an entry ticket covers, and caps the quantity. */
function constrainExtra<D extends FestivalDate>(
  input: DayQuantity<D>,
  coveredDays: ReadonlySet<FestivalDate>,
  maxQuantity: number,
): DayQuantity<D> {
  const days = input.days.filter((day) => coveredDays.has(day));
  const lostEveryDay = days.length === 0 && input.days.length > 0;
  return {
    quantity: lostEveryDay ? 0 : Math.min(input.quantity, maxQuantity),
    days,
  };
}

export interface ExtraLimits {
  readonly dinnerPlates: number;
  readonly workshopPlaces: number;
}

/** Dinner is per person (toddlers can eat); the workshop is for ticketed people aged 5+. */
export function getExtraLimits(selection: TicketSelection, toddlerCount: number): ExtraLimits {
  const { adults, children } = getRequiredAttendeeCounts(selection);
  const ticketedPeople = adults + children;
  return {
    dinnerPlates: Math.min(MAX_QUANTITY_PER_LINE, ticketedPeople + toddlerCount),
    workshopPlaces: Math.min(MAX_QUANTITY_PER_LINE, ticketedPeople),
  };
}

export function updateSelection(
  current: TicketSelection,
  patch: PartialTicketSelection,
  toddlerCount: number,
): TicketSelection {
  const merged = normalizeSelection({ ...current, ...patch });
  const coveredDays = new Set(getCoveredFestivalDays(merged));
  const limits = getExtraLimits(merged, toddlerCount);

  return {
    ...merged,
    day_pass_adult: withoutDaysWhenEmpty(merged.day_pass_adult),
    day_pass_child: withoutDaysWhenEmpty(merged.day_pass_child),
    family_pass: withoutDaysWhenEmpty(merged.family_pass),
    dandiya_sticks: {
      quantity: Math.min(merged.dandiya_sticks.quantity, DANDIYA_MAX_PER_ORDER),
    },
    dinner_plate: constrainExtra(merged.dinner_plate, coveredDays, limits.dinnerPlates),
    garba_workshop: constrainExtra(merged.garba_workshop, coveredDays, limits.workshopPlaces),
  };
}
