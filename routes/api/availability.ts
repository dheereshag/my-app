import { defineHandler } from "void";
import { listAvailability } from "@/server/inventory";
import { loadInventory } from "@/server/inventory-store";

/** Units left per SKU. Display only: every quote and booking re-checks stock on the server. */
export const GET = defineHandler(async () => {
  return { items: listAvailability(await loadInventory()) };
});
