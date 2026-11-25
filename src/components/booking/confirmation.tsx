import { CircleCheck, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EVENT_METADATA, formatUsd } from "@/domain";
import type { BookingConfirmation } from "@/server/confirmation";
import { useBookingStore } from "@/store/booking-store";
import { formatDays } from "./day-labels";
import { ReceiptLines } from "./receipt-lines";

const KIND_LABEL: Record<BookingConfirmation["attendees"][number]["kind"], string> = {
  adult: "Adult",
  child: "Child",
  toddler: "Under 5",
};

export function Confirmation({
  confirmation,
  allowNewBooking = true,
}: {
  readonly confirmation: BookingConfirmation;
  readonly allowNewBooking?: boolean;
}) {
  const startOver = useBookingStore((store) => store.startOver);

  return (
    <div className="flex flex-col gap-8">
      <section
        className="cream-surface flex flex-col gap-2 rounded-xl bg-card p-6 text-card-foreground"
        data-surface="cream"
        aria-labelledby="reference-label"
      >
        <p className="flex items-center gap-2 text-sm font-medium text-success-foreground">
          <CircleCheck aria-hidden="true" className="size-5" />
          Booking confirmed
        </p>
        <p id="reference-label" className="text-sm">
          Your booking reference. Show it at the door.
        </p>
        <p className="font-mono text-3xl font-semibold tracking-wider break-all text-foreground">
          {confirmation.reference}
        </p>
        <p className="text-sm">
          {EVENT_METADATA.name} · {EVENT_METADATA.location}. Please keep this page or write the
          reference down.
        </p>
      </section>

      <section aria-labelledby="receipt-heading" className="flex flex-col gap-3">
        <h3 id="receipt-heading" className="font-heading text-2xl font-semibold">
          What you booked
        </h3>
        <ReceiptLines lines={confirmation.lines} />
        <Separator />
        <dl className="flex flex-col gap-1.5">
          {confirmation.discountCents > 0 ? (
            <div className="flex justify-between text-sm text-muted-foreground">
              <dt>Promo {confirmation.promoCode}</dt>
              <dd className="tabular-nums">-{formatUsd(confirmation.discountCents)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between text-lg font-semibold">
            <dt>Total (practice payment)</dt>
            <dd className="text-gold-accent tabular-nums">
              {formatUsd(confirmation.payment.amountCents)}
            </dd>
          </div>
        </dl>
      </section>

      {confirmation.attendees.length > 0 ? (
        <section aria-labelledby="door-heading" className="flex flex-col gap-3">
          <h3 id="door-heading" className="font-heading text-2xl font-semibold">
            On the door list
          </h3>
          <ul className="flex flex-col gap-1">
            {confirmation.attendees.map((person, index) => (
              <li key={`${person.fullName}-${index}`}>
                {person.fullName}{" "}
                <span className="text-muted-foreground">
                  ({KIND_LABEL[person.kind]}, age {person.age}
                  {person.attendingDays?.length ? ` · ${formatDays(person.attendingDays)}` : ""})
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="outline" className="h-11" onClick={() => window.print()}>
          <Printer aria-hidden="true" data-icon="inline-start" />
          Print or save
        </Button>
        {allowNewBooking ? (
          <Button type="button" className="h-11" onClick={startOver}>
            Start a new booking
          </Button>
        ) : null}
      </div>
    </div>
  );
}
