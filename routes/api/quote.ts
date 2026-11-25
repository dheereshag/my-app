import { defineHandler } from "void";
import { QuoteRequestSchema } from "@/domain";
import { loadInventory } from "@/server/inventory-store";
import { buildQuote, toQuoteResponse } from "@/server/quote";

/** The only source of prices the browser displays. */
export const POST = defineHandler.withValidator({ body: QuoteRequestSchema })(async (
  _c,
  { body },
) => {
  return toQuoteResponse(buildQuote(body, await loadInventory(), new Date()));
});
