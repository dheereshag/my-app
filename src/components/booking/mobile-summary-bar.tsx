import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatUsd } from "@/domain";
import type { QuoteState } from "@/hooks/use-quote";
import { OrderSummary } from "./order-summary";

interface MobileSummaryBarProps {
  readonly quote: QuoteState;
  readonly onRetry: () => void;
}

function totalLabel(quote: QuoteState): string {
  if (quote.status === "ready") return formatUsd(quote.quote.totalCents);
  if (quote.status === "loading" && quote.previous) return formatUsd(quote.previous.totalCents);
  return "—";
}

/** On phones the order lives behind a sticky total, so it never competes with the form. */
export function MobileSummaryBar({ quote, onRetry }: MobileSummaryBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/20 bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-semibold text-gold-accent tabular-nums">{totalLabel(quote)}</p>
        </div>
        <Sheet>
          <SheetTrigger render={<Button variant="outline" className="h-11 px-5 text-base" />}>
            View order
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="font-heading text-2xl">Your order</SheetTitle>
              <SheetDescription>
                Prices are calculated by the temple's booking system.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <OrderSummary quote={quote} onRetry={onRetry} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
