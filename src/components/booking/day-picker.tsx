import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { FestivalDate } from "@/domain";
import { shortDayLabel } from "./day-labels";

interface DayPickerProps<D extends FestivalDate> {
  /** Accessible name for the group, e.g. "Days for Day Pass – Adult". */
  readonly label: string;
  readonly dates: readonly D[];
  /** Days that may be chosen; others are shown but disabled. Defaults to all of `dates`. */
  readonly enabledDates?: readonly FestivalDate[];
  readonly value: readonly D[];
  readonly invalid?: boolean;
  readonly describedBy?: string;
  readonly onChange: (days: D[]) => void;
}

export function DayPicker<D extends FestivalDate>({
  label,
  dates,
  enabledDates,
  value,
  invalid,
  describedBy,
  onChange,
}: DayPickerProps<D>) {
  return (
    <ToggleGroup
      multiple
      variant="outline"
      spacing={2}
      aria-label={label}
      aria-describedby={describedBy}
      className="flex-wrap"
      value={[...value]}
      onValueChange={(selected) => onChange(dates.filter((date) => selected.includes(date)))}
    >
      {dates.map((date) => {
        const { weekday, shortDate } = shortDayLabel(date);
        const enabled = enabledDates === undefined || enabledDates.includes(date);
        return (
          <ToggleGroupItem
            key={date}
            value={date}
            disabled={!enabled}
            aria-invalid={invalid ? true : undefined}
            className="min-h-11 min-w-20 flex-col gap-0 px-3 data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            <span className="text-xs opacity-80">{weekday}</span>
            <span>{shortDate}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
