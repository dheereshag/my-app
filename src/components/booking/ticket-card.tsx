import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { INITIAL_CATALOG_MAP, formatUsd, type SkuId } from "@/domain";

const LOW_STOCK_THRESHOLD = 10;

interface TicketCardProps {
  readonly sku: SkuId;
  /** Units left on the server. Zero shows "Sold out". */
  readonly remaining: number;
  /** Extra line under the description. */
  readonly note?: string;
  readonly children: ReactNode;
}

/** Name, price, availability and description of one thing that can be bought. */
export function TicketCard({ sku, remaining, note, children }: TicketCardProps) {
  const item = INITIAL_CATALOG_MAP[sku];
  const soldOut = remaining <= 0;

  return (
    <Card className="bg-white/5 ring-white/20">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="font-heading text-xl font-semibold">{item.label}</h3>
          {soldOut ? (
            <Badge variant="destructive" className="h-6 px-2.5 text-xs font-semibold">
              Sold out
            </Badge>
          ) : remaining <= LOW_STOCK_THRESHOLD ? (
            <Badge
              variant="outline"
              className="h-6 border-gold-accent px-2.5 text-xs font-semibold text-gold-accent"
            >
              Only {remaining} left
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          <span className="font-medium text-foreground">
            {formatUsd(item.priceCents)} {item.unitLabel}
          </span>
          {" · "}
          {item.description}
          {note ? ` ${note}` : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}
