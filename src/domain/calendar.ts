export const FESTIVAL_DATES = [
  "2026-11-26",
  "2026-11-27",
  "2026-11-28",
  "2026-11-29",
  "2026-11-30",
  "2026-12-01",
  "2026-12-02",
  "2026-12-03",
  "2026-12-04",
  "2026-12-05",
  "2026-12-06",
  "2026-12-07",
  "2026-12-08",
  "2026-12-09",
  "2026-12-10",
] as const;

export type FestivalDate = (typeof FESTIVAL_DATES)[number];

export const GARBA_WORKSHOP_DATES = ["2026-11-27", "2026-11-29"] as const;
export type GarbaWorkshopDate = (typeof GARBA_WORKSHOP_DATES)[number];

export const EVENT_METADATA = {
  name: "Sharad Utsav 2026",
  location: "Radha Krishna Temple, Allen, Texas",
  currency: "USD",
  dateRangeLabel: "Thu 26 Nov 2026 - Thu 10 Dec 2026",
  totalDays: FESTIVAL_DATES.length,
} as const;

// Midnight after the final festival day in Allen, Texas (CST).
export const EVENT_BOOKING_CLOSES_AT = "2026-12-11T06:00:00.000Z";

export function isEventBookingClosed(now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(EVENT_BOOKING_CLOSES_AT);
}

export interface FestivalDayInfo {
  readonly date: FestivalDate;
  readonly weekday: string;
  readonly shortDate: string;
  readonly label: string;
  readonly dayNumber: number;
  readonly hasGarbaWorkshop: boolean;
}

const FESTIVAL_DATE_SET = new Set<string>(FESTIVAL_DATES);
const GARBA_WORKSHOP_DATE_SET = new Set<string>(GARBA_WORKSHOP_DATES);
const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export const FESTIVAL_DAYS: readonly FestivalDayInfo[] = FESTIVAL_DATES.map((date, index) => {
  const day = new Date(`${date}T00:00:00Z`);
  const weekday = weekdayFormat.format(day);
  const shortDate = dateFormat.format(day);
  return {
    date,
    weekday,
    shortDate,
    label: `${weekday}, ${shortDate}`,
    dayNumber: index + 1,
    hasGarbaWorkshop: GARBA_WORKSHOP_DATE_SET.has(date),
  };
});

export function isFestivalDate(value: string): value is FestivalDate {
  return FESTIVAL_DATE_SET.has(value);
}

export function isGarbaWorkshopDate(value: string): value is GarbaWorkshopDate {
  return GARBA_WORKSHOP_DATE_SET.has(value);
}
