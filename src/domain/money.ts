/** Formats an integer cent amount as USD without floating-point arithmetic. */
export function formatUsd(cents: number): string {
  const safeCents = Number.isFinite(cents) ? Math.round(cents) : 0;
  const sign = safeCents < 0 ? "-" : "";
  const absCents = Math.abs(safeCents);
  const dollars = Math.trunc(absCents / 100);
  const remainder = absCents % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${String(remainder).padStart(2, "0")}`;
}
