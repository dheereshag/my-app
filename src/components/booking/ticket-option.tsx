import { useId } from "react";
import { FieldError } from "@/components/ui/field";
import {
  INITIAL_CATALOG_MAP,
  MAX_QUANTITY_PER_LINE,
  type FestivalDate,
  type SkuId,
} from "@/domain";
import { DayPicker } from "./day-picker";
import { QuantityStepper } from "./quantity-stepper";
import { TicketCard } from "./ticket-card";

interface FlatTicketOptionProps {
  readonly sku: SkuId;
  readonly quantity: number;
  readonly remaining: number;
  readonly note?: string;
  readonly maxQuantity?: number;
  readonly onChange: (quantity: number) => void;
}

/** A ticket with no day choice: all-day passes and souvenirs. */
export function FlatTicketOption({
  sku,
  quantity,
  remaining,
  note,
  maxQuantity = MAX_QUANTITY_PER_LINE,
  onChange,
}: FlatTicketOptionProps) {
  const label = INITIAL_CATALOG_MAP[sku].label;
  return (
    <TicketCard sku={sku} remaining={remaining} note={note}>
      <QuantityStepper
        label={label}
        value={quantity}
        max={Math.min(maxQuantity, remaining)}
        disabled={remaining <= 0}
        onChange={onChange}
      />
    </TicketCard>
  );
}

interface DayTicketOptionProps<D extends FestivalDate> {
  readonly sku: SkuId;
  readonly line: { readonly quantity: number; readonly days: readonly D[] };
  /** Days this ticket could be used on. */
  readonly dates: readonly D[];
  /** Subset of `dates` that can be chosen right now (e.g. days an entry ticket covers). */
  readonly enabledDates?: readonly FestivalDate[];
  readonly remaining: number;
  readonly maxQuantity?: number;
  readonly note?: string;
  /** Shown instead of the controls when the ticket cannot be chosen yet. */
  readonly blockedReason?: string;
  readonly error?: string;
  readonly showError: boolean;
  readonly onChange: (line: { quantity: number; days: D[] }) => void;
}

/** A ticket priced per person, per day: the person picks how many, then which days. */
export function DayTicketOption<D extends FestivalDate>({
  sku,
  line,
  dates,
  enabledDates,
  remaining,
  maxQuantity = MAX_QUANTITY_PER_LINE,
  note,
  blockedReason,
  error,
  showError,
  onChange,
}: DayTicketOptionProps<D>) {
  const hintId = useId();
  const label = INITIAL_CATALOG_MAP[sku].label;
  const daysChosen = Math.max(1, line.days.length);
  // Stock is counted in person-days, so more days leave room for fewer people.
  const maxByStock = Math.floor(remaining / daysChosen);

  return (
    <TicketCard sku={sku} remaining={remaining} note={note}>
      {blockedReason ? (
        <p className="text-sm text-muted-foreground">{blockedReason}</p>
      ) : (
        <QuantityStepper
          label={label}
          value={line.quantity}
          max={Math.min(maxQuantity, maxByStock)}
          disabled={remaining <= 0}
          onChange={(quantity) => onChange({ quantity, days: [...line.days] })}
        />
      )}
      {line.quantity > 0 && !blockedReason ? (
        <div className="flex flex-col gap-2">
          <p id={hintId} className="text-sm text-muted-foreground">
            Choose the days:
          </p>
          <DayPicker
            label={`Days for ${label}`}
            dates={dates}
            enabledDates={enabledDates}
            value={line.days}
            invalid={showError && Boolean(error)}
            describedBy={hintId}
            onChange={(days) => onChange({ quantity: line.quantity, days })}
          />
          {error && showError ? <FieldError>{error}</FieldError> : null}
        </div>
      ) : null}
    </TicketCard>
  );
}
