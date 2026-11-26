import { AlertCircleIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { QuoteState } from "@/hooks/use-quote";
import { useBookingStore } from "@/store/booking-store";

interface PromoFieldProps {
  readonly quote: QuoteState;
}

export function PromoField({ quote }: PromoFieldProps) {
  const promoCode = useBookingStore((store) => store.promoCode);
  const setPromoCode = useBookingStore((store) => store.setPromoCode);

  const promo = quote.status === "ready" && promoCode.trim() !== "" ? quote.quote.promo : null;

  return (
    <Field>
      <FieldLabel htmlFor="promo-code">Promo code (optional)</FieldLabel>
      <Input
        id="promo-code"
        value={promoCode}
        maxLength={32}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={promo !== null && !promo.valid ? true : undefined}
        aria-describedby="promo-feedback"
        className="h-11 max-w-xs text-base uppercase"
        onChange={(event) => setPromoCode(event.target.value)}
      />
      <FieldDescription id="promo-feedback" role="status" aria-live="polite">
        {promo === null ? (
          "Have a code from the temple? Enter it and your total updates."
        ) : (
          <span
            className={
              promo.valid
                ? "flex items-start gap-2 text-success-foreground"
                : "flex items-start gap-2 text-error-foreground"
            }
          >
            {promo.valid ? (
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
            ) : (
              <HugeiconsIcon
                icon={AlertCircleIcon}
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
            )}
            {promo.message}
          </span>
        )}
      </FieldDescription>
    </Field>
  );
}
