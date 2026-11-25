/** Reads live stock and promo usage from D1, creating the rows from the catalog on first use. */

import { promoUsage, stock } from "@schema";
import { db } from "void/db";
import { INITIAL_CATALOG_MAP, INITIAL_PROMO_CODES, SKU_IDS } from "../domain";
import { buildInventory, type Inventory } from "./inventory";

const PROMO_COUNT = Object.keys(INITIAL_PROMO_CODES).length;

function readRows() {
  return Promise.all([db.select().from(stock), db.select().from(promoUsage)]);
}

/** Idempotent: existing rows keep their current counts, only missing ones are created. */
async function seedMissingRows(): Promise<void> {
  await db.batch([
    db
      .insert(stock)
      .values(SKU_IDS.map((sku) => ({ sku, remaining: INITIAL_CATALOG_MAP[sku].initialStock })))
      .onConflictDoNothing(),
    db
      .insert(promoUsage)
      .values(
        Object.values(INITIAL_PROMO_CODES).map((promo) => ({
          code: promo.code,
          usedCount: promo.usedCount,
          maxUses: promo.maxUses,
        })),
      )
      .onConflictDoNothing(),
  ]);
}

export async function loadInventory(): Promise<Inventory> {
  let [stockRows, promoRows] = await readRows();
  if (stockRows.length < SKU_IDS.length || promoRows.length < PROMO_COUNT) {
    await seedMissingRows();
    [stockRows, promoRows] = await readRows();
  }
  return buildInventory(stockRows, promoRows);
}
