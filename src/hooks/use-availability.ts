import { useCallback, useState } from "react";
import { fetch } from "void/client";
import type { SkuId } from "@/domain";
import type { AvailabilityItem } from "@/server/inventory";

/** Units left per SKU. Starts from the server-rendered values and can be refreshed. */
export function useAvailability(initial: readonly AvailabilityItem[]) {
  const [items, setItems] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/availability");
      setItems(response.items);
    } catch {
      // Keep showing the last known numbers; the server re-checks stock on every quote and booking.
    }
  }, []);

  const remaining = useCallback(
    (sku: SkuId): number => items.find((item) => item.sku === sku)?.remaining ?? 0,
    [items],
  );

  return { remaining, refresh };
}
