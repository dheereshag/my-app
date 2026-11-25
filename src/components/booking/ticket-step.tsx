import { useState } from "react";
import { ArrowRight, CircleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DANDIYA_MAX_PER_ORDER,
  FESTIVAL_DATES,
  GARBA_WORKSHOP_DATES,
  getCoveredFestivalDays,
  type SkuId,
} from "@/domain";
import type { QuoteState } from "@/hooks/use-quote";
import { validateTickets } from "@/store/booking-request";
import { useBookingStore } from "@/store/booking-store";
import { getExtraLimits } from "@/store/selection";
import { focusFirstInvalid } from "./focus";
import { PromoField } from "./promo-field";
import { StepNav } from "./step-nav";
import { DayTicketOption, FlatTicketOption } from "./ticket-option";

interface TicketStepProps {
  readonly remaining: (sku: SkuId) => number;
  readonly quote: QuoteState;
}

export function TicketStep({ remaining, quote }: TicketStepProps) {
  const selection = useBookingStore((store) => store.selection);
  const toddlerCount = useBookingStore((store) => store.attendees.toddlers.length);
  const submit = useBookingStore((store) => store.submit);
  const setSelection = useBookingStore((store) => store.setSelection);
  const setStep = useBookingStore((store) => store.setStep);
  const [showErrors, setShowErrors] = useState(false);

  const errors = validateTickets(selection);
  const coveredDays = getCoveredFestivalDays(selection);
  const limits = getExtraLimits(selection, toddlerCount);
  const workshopDaysCovered = GARBA_WORKSHOP_DATES.filter((date) => coveredDays.includes(date));

  const stockIssues = quote.status === "ready" ? quote.quote.stockIssues : [];
  const promoRejected =
    quote.status === "ready" && quote.quote.promo !== null && !quote.quote.promo.valid;
  const bookingFailure =
    submit.status === "failed" &&
    (submit.failure.reason === "stock" || submit.failure.reason === "promo")
      ? submit.failure
      : null;

  function handleContinue() {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      focusFirstInvalid();
      return;
    }
    if (stockIssues.length > 0 || promoRejected) {
      setShowErrors(true);
      return;
    }
    setStep("group");
  }

  return (
    <div className="flex flex-col gap-8">
      {bookingFailure ? (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Your booking was not placed</AlertTitle>
          <AlertDescription>
            {bookingFailure.message}
            {bookingFailure.reason === "stock"
              ? bookingFailure.details.map((detail) => (
                  <span key={detail} className="block">
                    {detail}
                  </span>
                ))
              : null}
          </AlertDescription>
        </Alert>
      ) : null}

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
          note="The days can't be changed."
          onChange={(quantity) => setSelection({ all_day_adult: { quantity } })}
        />
        <FlatTicketOption
          sku="all_day_child"
          quantity={selection.all_day_child.quantity}
          remaining={remaining("all_day_child")}
          note="The days can't be changed."
          onChange={(quantity) => setSelection({ all_day_child: { quantity } })}
        />
        <DayTicketOption
          sku="family_pass"
          line={selection.family_pass}
          dates={FESTIVAL_DATES}
          remaining={remaining("family_pass")}
          note="One pass covers one day; choose several days for several passes."
          error={errors["selection.family_pass.days"]}
          showError={showErrors}
          onChange={(line) => setSelection({ family_pass: line })}
        />
        {errors.selection && showErrors ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.selection}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="extras-heading" className="flex flex-col gap-4">
        <div>
          <h3 id="extras-heading" className="font-heading text-2xl font-semibold">
            Extras
          </h3>
          <p className="text-muted-foreground">
            Dinner and the workshop need a matching entry day.
          </p>
        </div>

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
              ? "Choose an entry ticket for Nov 11 or Nov 13 first. The workshop runs on those two days only."
              : undefined
          }
          error={errors["selection.garba_workshop.days"]}
          showError={showErrors}
          onChange={(line) => setSelection({ garba_workshop: line })}
        />
      </section>

      <PromoField quote={quote} />

      {showErrors && stockIssues.length > 0 ? (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Not enough left</AlertTitle>
          <AlertDescription>
            {stockIssues.map((issue) => (
              <span key={issue.sku} className="block">
                {issue.message}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}
      {showErrors && promoRejected ? (
        <p role="alert" className="text-sm text-destructive">
          Fix or clear the promo code to continue.
        </p>
      ) : null}

      <StepNav>
        <Button type="button" className="h-11 px-6 text-base" onClick={handleContinue}>
          Continue
          <ArrowRight aria-hidden="true" data-icon="inline-end" />
        </Button>
      </StepNav>
    </div>
  );
}
