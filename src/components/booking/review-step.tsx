import { CircleAlert, CreditCard, Pencil } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { formatUsd } from "@/domain";
import type { QuoteState } from "@/hooks/use-quote";
import { isBookerAttendingAsAdult } from "@/store/booking-request";
import { useBookingStore } from "@/store/booking-store";
import { OrderSummary } from "./order-summary";
import { StepNav } from "./step-nav";

interface ReviewStepProps {
  readonly quote: QuoteState;
  readonly onRetryQuote: () => void;
}

export function ReviewStep({ quote, onRetryQuote }: ReviewStepProps) {
  const booker = useBookingStore((store) => store.booker);
  const attendees = useBookingStore((store) => store.attendees);
  const selection = useBookingStore((store) => store.selection);
  const submit = useBookingStore((store) => store.submit);
  const setStep = useBookingStore((store) => store.setStep);
  const submitBooking = useBookingStore((store) => store.submitBooking);

  const submitting = submit.status === "submitting";
  const bookerAttends = isBookerAttendingAsAdult({ selection, booker, promoCode: "", attendees });
  const people = [
    ...(bookerAttends ? [{ key: "booker", name: booker.fullName }] : []),
    ...attendees.adults.map((person) => ({ key: person.id, name: person.fullName })),
    ...attendees.children.map((person) => ({ key: person.id, name: person.fullName })),
    ...attendees.toddlers.map((person) => ({
      key: person.id,
      name: `${person.fullName} (under 5)`,
    })),
  ];

  const ready = quote.status === "ready";
  const blockedByQuote =
    ready &&
    (quote.quote.stockIssues.length > 0 ||
      (quote.quote.promo !== null && !quote.quote.promo.valid));
  const failure = submit.status === "failed" ? submit.failure : null;
  const canPay = ready && !blockedByQuote && !submitting && failure?.reason !== "closed";
  const retrying =
    failure !== null && (failure.reason === "offline" || failure.reason === "server");

  return (
    <div className="flex flex-col gap-8">
      <div className="lg:hidden">
        <OrderSummary quote={quote} onRetry={onRetryQuote} />
      </div>

      <section aria-labelledby="people-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 id="people-heading" className="font-heading text-2xl font-semibold">
            Who is coming
          </h3>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={submitting}
            onClick={() => setStep("group")}
          >
            <Pencil aria-hidden="true" data-icon="inline-start" />
            Edit
          </Button>
        </div>
        <p className="text-muted-foreground">
          Booked by {booker.fullName} ({booker.email}, {booker.phone}).
        </p>
        <ul className="flex flex-col gap-1">
          {people.map((person) => (
            <li key={person.key} className="text-foreground">
              {person.name}
            </li>
          ))}
          {people.length === 0 ? (
            <li className="text-muted-foreground">
              No one is attending; this is a souvenir order.
            </li>
          ) : null}
        </ul>
      </section>

      <Card className="bg-white/5 ring-white/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard aria-hidden="true" className="size-5" />
            <h3 className="font-heading text-2xl font-semibold">Payment</h3>
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            This is a practice payment. No card is needed and no money is taken. Your tickets and
            reference are still real in this system.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {failure ? (
            <Alert variant="destructive" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Your booking was not completed</AlertTitle>
              <AlertDescription>
                {failure.message}
                {retrying ? " If you try again, you will not be booked twice." : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="button"
            className="h-12 w-full text-base sm:w-fit sm:px-8"
            disabled={!canPay}
            aria-disabled={!canPay}
            onClick={() => void submitBooking()}
          >
            {submitting ? (
              <>
                <Spinner aria-hidden="true" data-icon="inline-start" />
                Processing…
              </>
            ) : ready ? (
              `${retrying ? "Try again: pay" : "Pay"} ${formatUsd(quote.quote.totalCents)}`
            ) : (
              "Updating your total…"
            )}
          </Button>
          <p role="status" aria-live="polite" className="sr-only">
            {submitting ? "Processing your booking" : ""}
          </p>
        </CardContent>
      </Card>

      <StepNav onBack={submitting ? undefined : () => setStep("group")}>
        <span />
      </StepNav>
    </div>
  );
}
