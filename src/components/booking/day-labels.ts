import { EVENT_METADATA, FESTIVAL_DAYS, FESTIVAL_DATES, type FestivalDate } from "@/domain";
import type { BookingDate } from "@/domain/legacy-booking";

const historicalDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function dayLabel(date: BookingDate): string {
  return (
    FESTIVAL_DAYS.find((day) => day.date === date)?.label ??
    historicalDateFormat.format(new Date(`${date}T00:00:00Z`))
  );
}

export function shortDayLabel(date: FestivalDate): { weekday: string; shortDate: string } {
  const day = FESTIVAL_DAYS.find((entry) => entry.date === date);
  return { weekday: day?.weekday ?? "", shortDate: day?.shortDate ?? date };
}

/** Labels selected days, or the full festival when every date is selected. */
export function formatDays(dates: readonly BookingDate[]): string {
  if (
    dates.length === FESTIVAL_DATES.length &&
    FESTIVAL_DATES.every((date) => dates.includes(date))
  ) {
    return `All ${EVENT_METADATA.totalDays} days`;
  }
  return dates.map(dayLabel).join(" · ");
}
