import { useEffect, useRef } from "react";
import { EVENT_METADATA } from "@/domain";
import { useAvailability } from "@/hooks/use-availability";
import { useQuote } from "@/hooks/use-quote";
import { useRestoreBooking } from "@/hooks/use-restore-booking";
import type { AvailabilityItem } from "@/server/inventory";
import { useBookingStore, type Step } from "@/store/booking-store";
import { BookingStepper } from "./booking-stepper";
import { Confirmation } from "./confirmation";
import { EventClosed } from "./event-closed";
import { GroupStep } from "./group-step";
import { MobileSummaryBar } from "./mobile-summary-bar";
import { OrderSummary } from "./order-summary";
import { PreviousDraftRecovery } from "./previous-draft-recovery";
import { ReviewStep } from "./review-step";
import { TicketStep } from "./ticket-step";

const STEP_TITLE: Record<Step, string> = {
  tickets: "Choose your tickets",
  group: "Who is coming?",
  review: "Review and pay",
  confirmed: "You are booked!",
};

export function BookingFlow({
  availability,
  bookingClosed,
}: {
  readonly availability: readonly AvailabilityItem[];
  readonly bookingClosed: boolean;
}) {
  const step = useBookingStore((store) => store.step);
  const confirmation = useBookingStore((store) => store.confirmation);
  const previousDraft = useBookingStore((store) => store.previousDraft);
  const startOver = useBookingStore((store) => store.startOver);
  const submit = useBookingStore((store) => store.submit);
  const { remaining, refresh } = useAvailability(availability);
  const { state: quote, retry } = useQuote();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  const restore = useRestoreBooking();

  // Moving between steps: put focus on the new heading so screen-reader and keyboard users land at the top.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  // Numbers can go stale while someone fills in the form: refresh at the review step and after a stock conflict.
  const stockConflict = submit.status === "failed" && submit.failure.reason === "stock";
  useEffect(() => {
    if (step === "review" || stockConflict) {
      void refresh();
    }
  }, [step, stockConflict, refresh]);

  if (restore.failed || (previousDraft !== null && confirmation === null)) {
    return (
      <PreviousDraftRecovery
        restoreFailed={restore.failed}
        onStartOver={() => {
          startOver();
          restore.clearFailure();
        }}
      />
    );
  }

  if (bookingClosed && confirmation === null) {
    return <EventClosed />;
  }

  const showSummary = !bookingClosed && step !== "confirmed";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#booking"
        className="sr-only rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to booking
      </a>

      <header className="border-b border-white/20">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8">
          <p className="text-sm font-medium tracking-widest text-gold-accent uppercase">
            {EVENT_METADATA.location}
          </p>
          <h1 className="font-heading text-4xl font-semibold sm:text-5xl">{EVENT_METADATA.name}</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            {previousDraft !== null && confirmation !== null
              ? `This confirmation is for the original festival dates. New bookings are for ${EVENT_METADATA.dateRangeLabel}.`
              : bookingClosed
                ? `This event has ended. Your booking for ${EVENT_METADATA.dateRangeLabel} is shown below.`
                : `Book your family's tickets for ${EVENT_METADATA.dateRangeLabel} in one go. Choose tickets, tell us who is coming, and get your confirmation.`}
          </p>
        </div>
      </header>

      <main id="booking" className="mx-auto max-w-6xl px-4 pt-8 pb-32 lg:pb-16">
        <BookingStepper step={step} />

        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex flex-col gap-6">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-heading text-3xl font-semibold outline-none sm:text-4xl"
            >
              {STEP_TITLE[step]}
            </h2>

            {step === "tickets" ? <TicketStep remaining={remaining} quote={quote} /> : null}
            {step === "group" ? <GroupStep /> : null}
            {step === "review" ? <ReviewStep quote={quote} onRetryQuote={retry} /> : null}
            {step === "confirmed" && confirmation ? (
              <Confirmation confirmation={confirmation} allowNewBooking={!bookingClosed} />
            ) : null}
          </div>

          {showSummary ? (
            <aside aria-label="Order summary" className="hidden lg:block">
              <div className="sticky top-6 flex flex-col gap-4 rounded-xl border border-white/20 bg-white/5 p-5">
                <h2 className="font-heading text-2xl font-semibold">Your order</h2>
                <OrderSummary quote={quote} onRetry={retry} />
              </div>
            </aside>
          ) : null}
        </div>
      </main>

      {showSummary ? <MobileSummaryBar quote={quote} onRetry={retry} /> : null}
    </div>
  );
}
