import {
  DANDIYA_MAX_PER_ORDER,
  FESTIVAL_DATES,
  GARBA_WORKSHOP_DATES,
  getCoveredFestivalDays,
  type SkuId,
} from "@/domain";
import type { FieldErrors } from "@/store/booking-request";
import { useBookingStore } from "@/store/booking-store";
import { getExtraLimits } from "@/store/selection";
import { DayTicketOption, FlatTicketOption } from "./ticket-option";

interface TicketSectionsProps {
  readonly remaining: (sku: SkuId) => number;
  readonly errors: FieldErrors;
  readonly showErrors: boolean;
}

export function EntryTicketsSection({ remaining, errors, showErrors }: TicketSectionsProps) {
  const selection = useBookingStore((store) => store.selection);
  const setSelection = useBookingStore((store) => store.setSelection);
  return (
    <section aria-labelledby="entry-heading" className="flex flex-col gap-4">
      <div>
        <h3 id="entry-heading" className="font-heading text-2xl font-semibold">
          Entry tickets
        </h3>
        <p className="text-muted-foreground">
          Everyone aged 5 and over needs an entry ticket. Children under 5 come free; you can add
          them in the next step.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DayTicketOption
          sku="day_pass_adult"
          line={selection.day_pass_adult}
          dates={FESTIVAL_DATES}
          remaining={remaining("day_pass_adult")}
          error={errors["selection.day_pass_adult.days"]}
          showError={showErrors}
          onChange={(line) => setSelection({ day_pass_adult: line })}
        />
        <DayTicketOption
          sku="day_pass_child"
          line={selection.day_pass_child}
          dates={FESTIVAL_DATES}
          remaining={remaining("day_pass_child")}
          error={errors["selection.day_pass_child.days"]}
          showError={showErrors}
          onChange={(line) => setSelection({ day_pass_child: line })}
        />
        <FlatTicketOption
          sku="all_day_adult"
          quantity={selection.all_day_adult.quantity}
          remaining={remaining("all_day_adult")}
          onChange={(quantity) => setSelection({ all_day_adult: { quantity } })}
        />
        <FlatTicketOption
          sku="all_day_child"
          quantity={selection.all_day_child.quantity}
          remaining={remaining("all_day_child")}
          onChange={(quantity) => setSelection({ all_day_child: { quantity } })}
        />
        <DayTicketOption
          sku="family_pass"
          line={selection.family_pass}
          dates={FESTIVAL_DATES}
          remaining={remaining("family_pass")}
          note="Each pass covers one day. Select multiple days to buy one pass per day."
          error={errors["selection.family_pass.days"]}
          showError={showErrors}
          onChange={(line) => setSelection({ family_pass: line })}
        />
      </div>
      {errors.selection && showErrors ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.selection}
        </p>
      ) : null}
    </section>
  );
}

export function ExtrasSection({ remaining, errors, showErrors }: TicketSectionsProps) {
  const selection = useBookingStore((store) => store.selection);
  const toddlers = useBookingStore((store) => store.attendees.toddlers);
  const setSelection = useBookingStore((store) => store.setSelection);
  const coveredDays = getCoveredFestivalDays(selection);
  const limits = getExtraLimits(selection, toddlers);
  const workshopDaysCovered = GARBA_WORKSHOP_DATES.filter((date) => coveredDays.includes(date));
  return (
    <section aria-labelledby="extras-heading" className="flex flex-col gap-4">
      <div>
        <h3 id="extras-heading" className="font-heading text-2xl font-semibold">
          Extras
        </h3>
        <p className="text-muted-foreground">Dinner and the workshop need a matching entry day.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FlatTicketOption
          sku="dandiya_sticks"
          quantity={selection.dandiya_sticks.quantity}
          remaining={remaining("dandiya_sticks")}
          maxQuantity={DANDIYA_MAX_PER_ORDER}
          onChange={(quantity) => setSelection({ dandiya_sticks: { quantity } })}
        />
        <DayTicketOption
          sku="dinner_plate"
          line={selection.dinner_plate}
          dates={FESTIVAL_DATES}
          enabledDates={coveredDays}
          remaining={remaining("dinner_plate")}
          maxQuantity={limits.dinnerPlates}
          blockedReason={
            coveredDays.length === 0
              ? "Choose an entry ticket above first. Dinner is per person, per day."
              : undefined
          }
          error={errors["selection.dinner_plate.days"]}
          showError={showErrors}
          onChange={(line) => setSelection({ dinner_plate: line })}
        />
        <DayTicketOption
          sku="garba_workshop"
          line={selection.garba_workshop}
          dates={GARBA_WORKSHOP_DATES}
          enabledDates={coveredDays}
          remaining={remaining("garba_workshop")}
          maxQuantity={limits.workshopPlaces}
          blockedReason={
            workshopDaysCovered.length === 0
              ? "Choose an entry ticket for Nov 27 or Nov 29 first. The workshop runs on those two days only."
              : undefined
          }
          error={errors["selection.garba_workshop.days"]}
          showError={showErrors}
          onChange={(line) => setSelection({ garba_workshop: line })}
        />
      </div>
    </section>
  );
}
