import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { cn } from "@/lib/utils";
import type { SkuId } from "@/domain";
import type { BookingDate } from "@/domain/legacy-booking";
import { formatUsd } from "@/domain";
import { formatDays } from "./day-labels";

export interface ReceiptLine {
  readonly sku: SkuId;
  readonly label: string;
  readonly quantity: number;
  readonly days: readonly BookingDate[];
  readonly subtotalCents: number;
}

export function ReceiptLines({
  lines,
  dimmed = false,
}: {
  readonly lines: readonly ReceiptLine[];
  readonly dimmed?: boolean;
}) {
  return (
    <ItemGroup className={cn("gap-1", dimmed && "opacity-60")}>
      {lines.map((line) => (
        <Item key={line.sku} size="sm" className="items-start px-0">
          <ItemContent>
            <ItemTitle className="line-clamp-none">
              {line.label} × {line.quantity}
            </ItemTitle>
            {line.days.length > 0 ? (
              <ItemDescription className="line-clamp-none">{formatDays(line.days)}</ItemDescription>
            ) : null}
          </ItemContent>
          <ItemActions className="tabular-nums">{formatUsd(line.subtotalCents)}</ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}
