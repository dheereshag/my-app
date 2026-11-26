import { describe, expect, it } from "vite-plus/test";
import { buildInventory, listAvailability } from "../src/server/inventory";
import { buildConfirmation, listAttendees, planBooking } from "../src/server/plan-booking";
import { NOW, BOOKER, SECOND_ADULT, FRESH, parse } from "./booking-fixtures";

describe("planBooking: price and reservation come from the server", () => {
  it("prices a booking from the catalog and reserves person-days of stock", () => {
    const result = planBooking(
      parse({
        selection: {
          day_pass_adult: { quantity: 2, days: ["2026-11-27", "2026-11-28"] },
          dinner_plate: { quantity: 2, days: ["2026-11-27"] },
        },
      }),
      FRESH,
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2 adults x 2 days x $15 + 2 plates x $12 = $84, in integer cents
    expect(result.plan.quote.totalCents).toBe(8400);
    expect(result.plan.stockDecrements).toEqual([
      { sku: "day_pass_adult", units: 4 },
      { sku: "dinner_plate", units: 2 },
    ]);
    expect(result.plan.promoCode).toBeNull();
  });

  it("builds the confirmation from the server quote", () => {
    const request = parse({ promoCode: "SEVA10" });
    const result = planBooking(request, FRESH, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const confirmation = buildConfirmation(request, result.plan, "SU26-TEST1234");
    // $30 less 10% = $27.00
    expect(confirmation.totalCents).toBe(2700);
    expect(confirmation.payment.amountCents).toBe(2700);
    expect(confirmation.promoCode).toBe("SEVA10");
    expect(confirmation.reference).toBe("SU26-TEST1234");
  });
});

describe("planBooking: stock", () => {
  it("rejects new bookings after the festival closes", () => {
    const result = planBooking(parse(), FRESH, new Date("2026-12-11T06:00:00.000Z"));
    expect(result).toEqual({
      ok: false,
      rejection: {
        kind: "event_closed",
        message: "Sharad Utsav 2026 has ended. New bookings are closed.",
      },
    });
  });

  it("refuses the sold-out All-Day Pass – Adult", () => {
    const result = planBooking(
      parse({
        selection: { all_day_adult: { quantity: 1 } },
        attendees: { adults: [], children: [], toddlers: [] },
      }),
      FRESH,
      NOW,
    );

    expect(result.ok).toBe(false);
    if (result.ok || result.rejection.kind !== "stock") return;
    expect(result.rejection.issues).toEqual([
      expect.objectContaining({ sku: "all_day_adult", available: 0, requested: 1 }),
    ]);
  });

  it("allows the last 2 workshop places and refuses a third", () => {
    const withWorkshop = (quantity: number) =>
      parse({
        selection: {
          day_pass_adult: { quantity: 3, days: ["2026-11-27"] },
          garba_workshop: { quantity, days: ["2026-11-27"] },
        },
        attendees: {
          adults: [SECOND_ADULT, { id: "adult-2", fullName: "Meera Shah", age: 38 }],
          children: [],
          toddlers: [],
        },
      });

    expect(planBooking(withWorkshop(2), FRESH, NOW).ok).toBe(true);

    const refused = planBooking(withWorkshop(3), FRESH, NOW);
    expect(refused.ok).toBe(false);
    if (refused.ok || refused.rejection.kind !== "stock") return;
    expect(refused.rejection.issues[0]).toMatchObject({
      sku: "garba_workshop",
      available: 2,
      requested: 3,
    });
  });

  it("counts a workshop place on two nights as two units", () => {
    const result = planBooking(
      parse({
        selection: {
          day_pass_adult: { quantity: 2, days: ["2026-11-27", "2026-11-29"] },
          garba_workshop: { quantity: 2, days: ["2026-11-27", "2026-11-29"] },
        },
      }),
      FRESH,
      NOW,
    );
    expect(result.ok).toBe(false);
  });

  it("uses live stock rows, not the catalog defaults", () => {
    const inventory = buildInventory([{ sku: "day_pass_adult", remaining: 1 }], []);
    expect(listAvailability(inventory)).toContainEqual({ sku: "day_pass_adult", remaining: 1 });
    expect(planBooking(parse(), inventory, NOW).ok).toBe(false);
  });
});

describe("planBooking: promo codes", () => {
  const withPromo = (promoCode: string) => planBooking(parse({ promoCode }), FRESH, NOW);

  it("applies SEVA10 and FLAT20 to the whole booking", () => {
    const seva = withPromo("SEVA10");
    const flat = withPromo("FLAT20");
    expect(seva.ok && seva.plan.quote.totalCents).toBe(2700);
    expect(flat.ok && flat.plan.quote.totalCents).toBe(1000);
  });

  it("accepts KIDSFREE but leaves adult tickets at full price", () => {
    const result = withPromo("KIDSFREE");
    expect(result.ok && result.plan.quote.totalCents).toBe(3000);
  });

  it("treats codes case-insensitively and ignores surrounding spaces", () => {
    const result = withPromo("  seva10 ");
    expect(result.ok && result.plan.promoCode).toBe("SEVA10");
  });

  it("rejects EXPIRED5 after its expiry, but accepts it before (clock is injected)", () => {
    const after = withPromo("EXPIRED5");
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.rejection).toMatchObject({ kind: "promo" });

    const before = planBooking(
      parse({ promoCode: "EXPIRED5" }),
      FRESH,
      new Date("2026-10-01T00:00:00Z"),
    );
    expect(before.ok).toBe(true);
  });

  it("rejects MAXEDOUT, and honours live redemption counts", () => {
    expect(withPromo("MAXEDOUT").ok).toBe(false);

    const oneUseLeft = buildInventory([], [{ code: "MAXEDOUT", usedCount: 99, maxUses: 100 }]);
    const result = planBooking(parse({ promoCode: "MAXEDOUT" }), oneUseLeft, NOW);
    expect(result.ok && result.plan.quote.totalCents).toBe(2000);
  });

  it("rejects an unknown code instead of silently charging full price", () => {
    const result = withPromo("NOTACODE");
    expect(result.ok).toBe(false);
    if (!result.ok && result.rejection.kind === "promo") {
      expect(result.rejection.message).toContain("NOTACODE");
    }
  });
});

describe("listAttendees", () => {
  it("includes the booker only when attending", () => {
    const attending = listAttendees(parse());
    expect(attending[0]).toMatchObject({ fullName: "Asha Patel", kind: "adult" });

    const notAttending = listAttendees(
      parse({
        booker: { ...BOOKER, isAttendingAsAdult: false },
        attendees: {
          adults: [SECOND_ADULT, { id: "adult-2", fullName: "Meera Shah", age: 38 }],
        },
      }),
    );
    expect(notAttending.map((person) => person.fullName)).toEqual(["Ravi Patel", "Meera Shah"]);
  });
});
