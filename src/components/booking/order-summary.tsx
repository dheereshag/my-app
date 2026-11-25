import { CircleAlert, Lightbulb } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUsd } from "@/domain";
import type { QuoteState } from "@/hooks/use-quote";
import type { QuoteResponse } from "@/server/quote";
import { ReceiptLines } from "./receipt-lines";

interface OrderSummaryProps {
  readonly quote: QuoteState;
  readonly onRetry: () => void;
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={
        strong
          ? "flex items-baseline justify-between text-lg font-semibold"
          : "flex items-baseline justify-between text-sm text-muted-foreground"
      }
    >
      <dt>{label}</dt>
      <dd className={strong ? "text-gold-accent tabular-nums" : "tabular-nums"}>{value}</dd>
    </div>
  );
}

function QuoteDetails({ quote, dimmed }: { quote: QuoteResponse; dimmed: boolean }) {
  return (
    <div className="flex flex-col gap-4" aria-busy={dimmed} data-dimmed={dimmed || undefined}>
      <ReceiptLines lines={quote.lines} dimmed={dimmed} />

      <Separator />

      <dl className="flex flex-col gap-1.5">
        <TotalRow label="Subtotal" value={formatUsd(quote.subtotalCents)} />
        {quote.discountCents > 0 && quote.promo ? (
          <TotalRow
            label={`Promo ${quote.promo.code}`}
            value={`-${formatUsd(quote.discountCents)}`}
          />
        ) : null}
        <TotalRow strong label="Total" value={formatUsd(quote.totalCents)} />
      </dl>

      {quote.promo && quote.promo.valid ? (
        <p role="status" className="text-sm text-success-foreground">
          {quote.promo.message}
        </p>
      ) : null}

      {quote.stockIssues.length > 0 ? (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Not enough left</AlertTitle>
          <AlertDescription>
            {quote.stockIssues.map((issue) => (
              <span key={issue.sku} className="block">
                {issue.message}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      {quote.tip ? (
        <Alert>
          <Lightbulb aria-hidden="true" />
          <AlertDescription>{quote.tip}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

/** The server-calculated order. Nothing here is computed in the browser. */
export function OrderSummary({ quote, onRetry }: OrderSummaryProps) {
  return (
    <div aria-live="polite" className="flex flex-col gap-4">
      {quote.status === "incomplete" ? (
        <p className="text-muted-foreground">
          Choose your tickets and days to see your total. Nothing is charged until you pay.
        </p>
      ) : null}

      {quote.status === "loading" && quote.previous === null ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-7 w-full" />
          <span className="sr-only">Updating your total</span>
        </div>
      ) : null}

      {quote.status === "loading" && quote.previous !== null ? (
        <QuoteDetails quote={quote.previous} dimmed />
      ) : null}

      {quote.status === "ready" ? <QuoteDetails quote={quote.quote} dimmed={false} /> : null}

      {quote.status === "failed" ? (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>We couldn't update your total</AlertTitle>
          <AlertDescription>
            Check your connection. Your choices are saved.
            <Button type="button" variant="outline" className="mt-2 h-11" onClick={onRetry}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
