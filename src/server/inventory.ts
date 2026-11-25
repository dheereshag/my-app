/**
 * Pure mapping from stored stock/promo rows to the domain's catalog and promo state.
 * No database imports, so it runs in unit tests.
 */

import {
  SKU_IDS,
  createCatalogMap,
  createPromoMap,
  type CatalogItemOverrides,
  type CatalogMap,
  type PromoDefinition,
  type PromoStateMap,
  type SkuId,
} from "../domain";

export interface StockRow {
  readonly sku: string;
  readonly remaining: number;
}

export interface PromoUsageRow {
  readonly code: string;
  readonly usedCount: number;
  readonly maxUses: number | null;
}

/** The live, server-owned state every quote and booking is priced against. */
export interface Inventory {
  readonly catalog: CatalogMap;
  readonly promos: PromoStateMap;
}

export interface AvailabilityItem {
  readonly sku: SkuId;
  readonly remaining: number;
}

/** What the public availability endpoint and the page loader expose: units left per SKU. */
export function listAvailability(inventory: Inventory): AvailabilityItem[] {
  return SKU_IDS.map((sku) => ({ sku, remaining: inventory.catalog[sku].remainingStock }));
}

export function buildInventory(
  stockRows: readonly StockRow[],
  promoRows: readonly PromoUsageRow[],
): Inventory {
  const remainingBySku = new Map(stockRows.map((row) => [row.sku, row.remaining]));
  const stockOverrides: CatalogItemOverrides = {};
  for (const sku of SKU_IDS) {
    const remaining = remainingBySku.get(sku);
    if (remaining !== undefined) {
      stockOverrides[sku] = { remainingStock: remaining };
    }
  }

  const promoOverrides: Partial<Record<string, Partial<PromoDefinition>>> = {};
  for (const row of promoRows) {
    promoOverrides[row.code] = { usedCount: row.usedCount, maxUses: row.maxUses };
  }

  return {
    catalog: createCatalogMap(stockOverrides),
    promos: createPromoMap(promoOverrides),
  };
}
