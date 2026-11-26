import { useState } from "react";
import { AlertCircleIcon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SkuId } from "@/domain";
import type { QuoteState } from "@/hooks/use-quote";
import { validateTickets } from "@/store/booking-request";
import { useBookingStore } from "@/store/booking-store";
import { focusFirstInvalid } from "./focus";
import { PromoField } from "./promo-field";
import { StepNav } from "./step-nav";
import { EntryTicketsSection, ExtrasSection } from "./ticket-sections";

interface TicketStepProps {
  readonly remaining: (sku: SkuId) => number;
  readonly quote: QuoteState;
}

export function TicketStep({ remaining, quote }: TicketStepProps) {
  const selection = useBookingStore((store) => store.selection);
  const submit = useBookingStore((store) => store.submit);
  const setStep = useBookingStore((store) => store.setStep);
  const [showErrors, setShowErrors] = useState(false);

  const errors = validateTickets(selection);

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
          <HugeiconsIcon icon={AlertCircleIcon} aria-hidden="true" />
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

      <EntryTicketsSection remaining={remaining} errors={errors} showErrors={showErrors} />
      <ExtrasSection remaining={remaining} errors={errors} showErrors={showErrors} />

      <PromoField quote={quote} />

      {showErrors && stockIssues.length > 0 ? (
        <Alert variant="destructive" role="alert">
          <HugeiconsIcon icon={AlertCircleIcon} aria-hidden="true" />
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
          <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden="true" data-icon="inline-end" />
        </Button>
      </StepNav>
    </div>
  );
}
