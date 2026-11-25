import { FESTIVAL_DAYS, FESTIVAL_DATES, type FestivalDate } from "@/domain";

export function dayLabel(date: FestivalDate): string {
  return FESTIVAL_DAYS.find((day) => day.date === date)?.label ?? date;
}

export function shortDayLabel(date: FestivalDate): { weekday: string; shortDate: string } {
  const day = FESTIVAL_DAYS.find((entry) => entry.date === date);
  return { weekday: day?.weekday ?? "", shortDate: day?.shortDate ?? date };
}

/** "Wed, Nov 11 · Thu, Nov 12", or "All 5 days" when the whole festival is covered. */
export function formatDays(dates: readonly FestivalDate[]): string {
  if (dates.length === FESTIVAL_DATES.length) {
    return "All 5 days";
  }
  return dates.map(dayLabel).join(" · ");
}
