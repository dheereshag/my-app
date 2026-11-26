import type { TicketSelection } from "./attendees";
import { formatUsd } from "./money";

export type PromoRuleKind = "percent" | "flat_cents" | "kids_free";

export interface PromoDefinition {
  readonly code: string;
  readonly kind: PromoRuleKind;
  readonly value: number;
  readonly description: string;
  readonly expiresAt: string | null;
  readonly maxUses: number | null;
  readonly usedCount: number;
  readonly isActive: boolean;
}

export type PromoStateMap = Record<string, PromoDefinition>;

const CANONICAL_PROMOS: readonly PromoDefinition[] = [
  {
    code: "SEVA10",
    kind: "percent",
    value: 10,
    description: "10% off the whole booking",
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    isActive: true,
  },
  {
    code: "FLAT20",
    kind: "flat_cents",
    value: 2000,
    description: "$20 off the whole booking",
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    isActive: true,
  },
  {
    code: "KIDSFREE",
    kind: "kids_free",
    value: 100,
    description: "Makes Day Pass – Child and All-Day Pass – Child tickets free",
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    isActive: true,
  },
  {
    code: "EXPIRED5",
    kind: "percent",
    value: 5,
    description: "5% off (expired Oct 31, 2026)",
    expiresAt: "2026-10-31T23:59:59Z",
    maxUses: null,
    usedCount: 0,
    isActive: true,
  },
  {
    code: "MAXEDOUT",
    kind: "flat_cents",
    value: 1000,
    description: "$10 off (redemption limit reached)",
    expiresAt: null,
    maxUses: 100,
    usedCount: 100,
    isActive: true,
  },
] as const;

/** Builds a PromoStateMap with optional per-code overrides (for tests or DB hydration). */
export function createPromoMap(
  overrides?: Partial<Record<string, Partial<PromoDefinition>>>,
): PromoStateMap {
  const map: PromoStateMap = {};
  for (const promo of CANONICAL_PROMOS) {
    const patch = overrides?.[promo.code];
    map[promo.code] = patch ? { ...promo, ...patch } : { ...promo };
  }
  if (overrides) {
    for (const [rawKey, patch] of Object.entries(overrides)) {
      const key = rawKey.trim().toUpperCase();
      if (!map[key] && patch && patch.kind && patch.code) {
        map[key] = {
          code: patch.code.trim().toUpperCase(),
          kind: patch.kind,
          value: patch.value ?? 0,
          description: patch.description ?? "",
          expiresAt: patch.expiresAt ?? null,
          maxUses: patch.maxUses ?? null,
          usedCount: patch.usedCount ?? 0,
          isActive: patch.isActive ?? true,
        };
      }
    }
  }
  return map;
}

export const INITIAL_PROMO_CODES: PromoStateMap = createPromoMap();

export type PromoStatus = "none" | "applied" | "expired" | "maxed_out" | "inactive" | "invalid";

export interface PromoEvaluationResult {
  readonly valid: boolean;
  readonly status: PromoStatus;
  readonly code: string;
  readonly kind: PromoRuleKind | null;
  readonly discountCents: number;
  readonly message: string;
}

export interface PromoStateWrapper {
  readonly code?: string | null;
  readonly promos?: PromoStateMap;
}

export type PromoStateInput =
  | PromoStateMap
  | PromoDefinition
  | PromoStateWrapper
  | null
  | undefined;

function isPromoDefinition(value: unknown): value is PromoDefinition {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    "code" in value &&
    typeof value.code === "string" &&
    "kind" in value &&
    typeof value.kind === "string" &&
    "value" in value &&
    typeof value.value === "number"
  );
}

function isPromoStateWrapper(value: unknown): value is PromoStateWrapper {
  if (typeof value !== "object" || value === null || isPromoDefinition(value)) {
    return false;
  }
  return "promos" in value || "code" in value;
}

function lookupPromoDefinition(
  normalizedCode: string,
  promoState: PromoStateInput,
): PromoDefinition | null {
  if (promoState === null) {
    return null;
  }
  if (promoState === undefined) {
    return INITIAL_PROMO_CODES[normalizedCode] ?? null;
  }
  if (isPromoDefinition(promoState)) {
    return promoState.code.trim().toUpperCase() === normalizedCode ? promoState : null;
  }
  if (isPromoStateWrapper(promoState)) {
    const source = promoState.promos ?? INITIAL_PROMO_CODES;
    return source[normalizedCode] ?? null;
  }
  return promoState[normalizedCode] ?? null;
}

/**
 * Evaluates a promo code against promo state and booking subtotals using pure integer math.
 * Accepts an injectable `now` Date so expiry validation is deterministic in tests.
 */
export function evaluatePromoCode(
  code: string | null | undefined,
  promoState: PromoStateInput,
  subtotalCents: number,
  childTicketSubtotalCents: number,
  now: Date = new Date(),
): PromoEvaluationResult {
  const normalized = (code ?? "").trim().toUpperCase();
  if (normalized.length === 0) {
    return {
      valid: false,
      status: "none",
      code: "",
      kind: null,
      discountCents: 0,
      message: "Enter a promo code to apply a discount.",
    };
  }

  const safeSubtotal = Math.max(0, Math.round(subtotalCents));
  const safeChildSubtotal = Math.min(
    safeSubtotal,
    Math.max(0, Math.round(childTicketSubtotalCents)),
  );
  const promo = lookupPromoDefinition(normalized, promoState);

  if (!promo) {
    return {
      valid: false,
      status: "invalid",
      code: normalized,
      kind: null,
      discountCents: 0,
      message: `Promo code "${normalized}" is not valid.`,
    };
  }

  if (!promo.isActive) {
    return {
      valid: false,
      status: "inactive",
      code: normalized,
      kind: promo.kind,
      discountCents: 0,
      message: `Promo code "${normalized}" is currently inactive.`,
    };
  }

  if (promo.expiresAt !== null) {
    const expiresMs = Date.parse(promo.expiresAt);
    if (!Number.isNaN(expiresMs) && now.getTime() > expiresMs) {
      return {
        valid: false,
        status: "expired",
        code: normalized,
        kind: promo.kind,
        discountCents: 0,
        message: `Promo code "${normalized}" expired on ${promo.expiresAt.slice(0, 10)}.`,
      };
    }
  }

  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return {
      valid: false,
      status: "maxed_out",
      code: normalized,
      kind: promo.kind,
      discountCents: 0,
      message: `Promo code "${normalized}" has reached its maximum number of redemptions.`,
    };
  }

  let discountCents = 0;
  let message = "";

  switch (promo.kind) {
    case "percent": {
      discountCents = Math.min(
        safeSubtotal,
        Math.max(0, Math.trunc((safeSubtotal * promo.value + 50) / 100)),
      );
      message = `${normalized} applied (${promo.value}% off: -${formatUsd(discountCents)}).`;
      break;
    }
    case "flat_cents": {
      discountCents = Math.min(safeSubtotal, Math.max(0, Math.trunc(promo.value)));
      message = `${normalized} applied (-${formatUsd(discountCents)}).`;
      break;
    }
    case "kids_free": {
      discountCents = safeChildSubtotal;
      message =
        discountCents > 0
          ? `${normalized} applied: individual child tickets are free (-${formatUsd(discountCents)}).`
          : `${normalized} applied, though your cart has no Day Pass – Child or All-Day Pass – Child tickets.`;
      break;
    }
  }

  return {
    valid: true,
    status: "applied",
    code: normalized,
    kind: promo.kind,
    discountCents,
    message,
  };
}

export function resolveQuotePromoCode(
  selection: TicketSelection,
  promoState: PromoStateInput,
): string | null | undefined {
  if (isPromoStateWrapper(promoState) && promoState.code !== undefined) {
    return promoState.code;
  }
  if (selection.promoCode !== undefined) {
    return selection.promoCode;
  }
  if (isPromoDefinition(promoState)) {
    return promoState.code;
  }
  return undefined;
}
