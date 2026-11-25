import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Step } from "@/store/booking-store";

const STEPS: readonly { readonly id: Step; readonly label: string }[] = [
  { id: "tickets", label: "Tickets" },
  { id: "group", label: "Your group" },
  { id: "review", label: "Review & pay" },
  { id: "confirmed", label: "Done" },
];

export function BookingStepper({ step }: { readonly step: Step }) {
  const currentIndex = STEPS.findIndex((entry) => entry.id === step);

  return (
    <nav aria-label="Booking progress" className="flex flex-col gap-3">
      <Progress
        value={((currentIndex + 1) / STEPS.length) * 100}
        aria-label={`Step ${currentIndex + 1} of ${STEPS.length}`}
      />
      <ol className="grid grid-cols-4 gap-2 text-sm">
        {STEPS.map((entry, index) => {
          const done = index < currentIndex || step === "confirmed";
          const current = index === currentIndex && step !== "confirmed";
          return (
            <li
              key={entry.id}
              aria-current={current ? "step" : undefined}
              className={
                current
                  ? "flex items-center gap-2 font-semibold text-gold-accent"
                  : done
                    ? "flex items-center gap-2 text-foreground"
                    : "flex items-center gap-2 text-muted-foreground"
              }
            >
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs"
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className={current ? undefined : "sr-only sm:not-sr-only"}>
                {entry.label}
                {done ? <span className="sr-only"> (completed)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
