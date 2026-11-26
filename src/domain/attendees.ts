import { FESTIVAL_DATES, type FestivalDate, type GarbaWorkshopDate } from "./calendar";
import { FAMILY_PASS_ADULTS, FAMILY_PASS_CHILDREN } from "./catalog";
import { DraftTicketSelectionSchema } from "./selection-schema";

export interface DaySelectionInput {
  readonly quantity: number;
  readonly days: readonly FestivalDate[];
}

export interface FlatQuantityInput {
  readonly quantity: number;
}

type EntryQuantitySelection = {
  readonly [
    K in "day_pass_adult" | "day_pass_child" | "all_day_adult" | "all_day_child" | "family_pass"
  ]?: FlatQuantityInput;
};

export interface WorkshopSelectionInput {
  readonly quantity: number;
  readonly days: readonly GarbaWorkshopDate[];
}

export interface TicketSelection {
  readonly day_pass_adult: DaySelectionInput;
  readonly day_pass_child: DaySelectionInput;
  readonly all_day_adult: FlatQuantityInput;
  readonly all_day_child: FlatQuantityInput;
  readonly family_pass: DaySelectionInput;
  readonly dandiya_sticks: FlatQuantityInput;
  readonly dinner_plate: DaySelectionInput;
  readonly garba_workshop: WorkshopSelectionInput;
  readonly promoCode?: string | null;
}

export type PartialTicketSelection = {
  readonly [K in keyof TicketSelection]?: TicketSelection[K];
};

export interface RequiredAttendeeCounts {
  readonly adults: number;
  readonly children: number;
}

export interface AdultAttendeeDraft {
  readonly id: string;
  readonly fullName: string;
  readonly age?: number;
  readonly phone?: string;
}

export interface ChildAttendeeDraft {
  readonly id: string;
  readonly fullName: string;
  readonly age?: number;
}

export interface ToddlerAttendeeDraft {
  readonly id: string;
  readonly fullName: string;
  readonly age?: number;
  readonly attendingDays: readonly FestivalDate[];
}

export interface AttendeeGroupDraft {
  readonly adults: readonly AdultAttendeeDraft[];
  readonly children: readonly ChildAttendeeDraft[];
  readonly toddlers: readonly ToddlerAttendeeDraft[];
}

export interface ReconciledAttendeeGroup {
  readonly adults: AdultAttendeeDraft[];
  readonly children: ChildAttendeeDraft[];
  readonly toddlers: ToddlerAttendeeDraft[];
}

export interface BookerAttendeeFlag {
  readonly isAttendingAsAdult: boolean;
}

/** Creates an empty TicketSelection with zero quantities across all SKUs. */
export function createEmptySelection(): TicketSelection {
  return DraftTicketSelectionSchema.parse({});
}

/**
 * Returns the canonically sorted festival dates covered by at least one entry ticket (ages 5+).
 * Extras (dandiya, dinner plate, garba workshop) never grant entry coverage.
 */
export function getCoveredFestivalDays(
  selection: TicketSelection | PartialTicketSelection,
): FestivalDate[] {
  const covered = new Set<FestivalDate>();

  if (
    (selection.all_day_adult?.quantity ?? 0) > 0 ||
    (selection.all_day_child?.quantity ?? 0) > 0
  ) {
    for (const date of FESTIVAL_DATES) {
      covered.add(date);
    }
  }
  if ((selection.day_pass_adult?.quantity ?? 0) > 0) {
    for (const date of selection.day_pass_adult?.days ?? []) {
      covered.add(date);
    }
  }
  if ((selection.day_pass_child?.quantity ?? 0) > 0) {
    for (const date of selection.day_pass_child?.days ?? []) {
      covered.add(date);
    }
  }
  if ((selection.family_pass?.quantity ?? 0) > 0) {
    for (const date of selection.family_pass?.days ?? []) {
      covered.add(date);
    }
  }

  return FESTIVAL_DATES.filter((date) => covered.has(date));
}

/**
 * Returns the total number of ticketed adults (12+) and children (5..11)
 * implied by the selected entry tickets.
 */
export function getRequiredAttendeeCounts(
  selection: EntryQuantitySelection,
): RequiredAttendeeCounts {
  const adults =
    (selection.day_pass_adult?.quantity ?? 0) +
    (selection.all_day_adult?.quantity ?? 0) +
    (selection.family_pass?.quantity ?? 0) * FAMILY_PASS_ADULTS;
  const children =
    (selection.day_pass_child?.quantity ?? 0) +
    (selection.all_day_child?.quantity ?? 0) +
    (selection.family_pass?.quantity ?? 0) * FAMILY_PASS_CHILDREN;

  return { adults, children };
}

/** Returns the number of adult and child ticket holders attending on one day. */
export function getRequiredAttendeeCountsForDay(
  selection: TicketSelection | PartialTicketSelection,
  date: FestivalDate,
): RequiredAttendeeCounts {
  const familyPasses = selection.family_pass?.days.includes(date)
    ? selection.family_pass.quantity
    : 0;

  return {
    adults:
      (selection.day_pass_adult?.days.includes(date) ? selection.day_pass_adult.quantity : 0) +
      (selection.all_day_adult?.quantity ?? 0) +
      familyPasses * FAMILY_PASS_ADULTS,
    children:
      (selection.day_pass_child?.days.includes(date) ? selection.day_pass_child.quantity : 0) +
      (selection.all_day_child?.quantity ?? 0) +
      familyPasses * FAMILY_PASS_CHILDREN,
  };
}

/**
 * Computes how many other adult attendee records must be collected
 * once the booker's own attendance status is factored in.
 */
export function getExpectedOtherAdultCount(
  requiredAdults: number,
  isAttendingAsAdult: boolean,
): number {
  const safeRequired = Math.max(0, Math.trunc(requiredAdults));
  if (safeRequired === 0) {
    return 0;
  }
  return isAttendingAsAdult ? safeRequired - 1 : safeRequired;
}

function createAttendeeId(prefix: "adult" | "child"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Purely resizes adult and child attendee draft arrays to match ticket parity
 * while preserving already-entered attendee details and leaving toddlers untouched.
 */
export function reconcileAttendees(
  current: AttendeeGroupDraft,
  requiredAdults: number,
  requiredChildren: number,
  booker: BookerAttendeeFlag,
): ReconciledAttendeeGroup {
  const expectedAdults = getExpectedOtherAdultCount(requiredAdults, booker.isAttendingAsAdult);
  const expectedChildren = Math.max(0, Math.trunc(requiredChildren));

  const nextAdults: AdultAttendeeDraft[] = current.adults
    .slice(0, expectedAdults)
    .map((adult) => ({ ...adult }));
  while (nextAdults.length < expectedAdults) {
    nextAdults.push({
      id: createAttendeeId("adult"),
      fullName: "",
      age: undefined,
      phone: undefined,
    });
  }

  const nextChildren: ChildAttendeeDraft[] = current.children
    .slice(0, expectedChildren)
    .map((child) => ({ ...child }));
  while (nextChildren.length < expectedChildren) {
    nextChildren.push({
      id: createAttendeeId("child"),
      fullName: "",
      age: undefined,
    });
  }

  const nextToddlers: ToddlerAttendeeDraft[] = current.toddlers.map((toddler) => ({ ...toddler }));

  return {
    adults: nextAdults,
    children: nextChildren,
    toddlers: nextToddlers,
  };
}
