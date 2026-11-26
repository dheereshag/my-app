import { FieldLegend, FieldSet } from "@/components/ui/field";
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
  const groups = Array.from({ length: Math.ceil(dates.length / 5) }, (_, index) =>
    dates.slice(index * 5, index * 5 + 5),
  );

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const first = shortDayLabel(group[0]).shortDate;
        const last = shortDayLabel(group[group.length - 1]).shortDate;
        const groupLabel = groups.length > 1 ? `${first} - ${last}` : label;
        return (
          <FieldSet key={group[0]} className="gap-2">
            <FieldLegend variant="label" className={groups.length > 1 ? undefined : "sr-only"}>
              {groupLabel}
            </FieldLegend>
            <ToggleGroup
              multiple
              variant="outline"
              spacing={2}
              aria-label={groups.length > 1 ? `${label}, ${groupLabel}` : label}
              aria-describedby={describedBy}
              className="flex-wrap"
              value={value.filter((date) => group.includes(date))}
              onValueChange={(selected) =>
                onChange(
                  dates.filter((date) =>
                    group.includes(date) ? selected.includes(date) : value.includes(date),
                  ),
                )
              }
            >
              {group.map((date) => {
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
          </FieldSet>
        );
      })}
    </div>
  );
}
