import { describe, expect, it } from "vite-plus/test";
import { CreateBookingRequestSchema, type CreateBookingRequest } from "../src/domain";
import { buildInventory, listAvailability } from "../src/server/inventory";
import { buildConfirmation, listAttendees, planBooking } from "../src/server/plan-booking";

const NOW = new Date("2026-11-01T12:00:00Z");

const BOOKER = {
  fullName: "Asha Patel",
  email: "asha@example.com",
  phone: "214 555 0101",
  age: 40,
  isAttendingAsAdult: true,
};

const SECOND_ADULT = { id: "adult-1", fullName: "Ravi Patel", age: 42 };

/** Two adults (booker + Ravi) on a Nov 11 day pass: the smallest valid booking. */
function bookingInput(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "key-1",
    selection: { day_pass_adult: { quantity: 2, days: ["2026-11-11"] } },
    booker: BOOKER,
    attendees: { adults: [SECOND_ADULT], children: [], toddlers: [] },
    ...overrides,
  };
}

function parse(overrides: Record<string, unknown> = {}): CreateBookingRequest {
  return CreateBookingRequestSchema.parse(bookingInput(overrides));
}

function issueMessages(input: unknown): string[] {
  const result = CreateBookingRequestSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

const FRESH = buildInventory([], []);

describe("planBooking: price and reservation come from the server", () => {
  it("prices a booking from the catalog and reserves person-days of stock", () => {
    const result = planBooking(
      parse({
        selection: {
          day_pass_adult: { quantity: 2, days: ["2026-11-11", "2026-11-12"] },
          dinner_plate: { quantity: 2, days: ["2026-11-11"] },
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
          day_pass_adult: { quantity: 3, days: ["2026-11-11"] },
          garba_workshop: { quantity, days: ["2026-11-11"] },
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
          day_pass_adult: { quantity: 2, days: ["2026-11-11", "2026-11-13"] },
          garba_workshop: { quantity: 2, days: ["2026-11-11", "2026-11-13"] },
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

describe("booking request rules the server re-checks", () => {
  it("rejects fields the client should never send (prices, totals)", () => {
    expect(issueMessages(bookingInput({ totalCents: 1 }))).not.toEqual([]);
    expect(
      issueMessages(
        bookingInput({
          selection: { day_pass_adult: { quantity: 2, days: ["2026-11-11"], priceCents: 1 } },
        }),
      ),
    ).not.toEqual([]);
  });

  it("will not put a 7-year-old on an adult ticket", () => {
    const messages = issueMessages(
      bookingInput({ attendees: { adults: [{ ...SECOND_ADULT, age: 7 }], children: [] } }),
    );
    expect(messages).toContain("Adult attendees must be at least 12 years old.");
  });

  it("will not put a 12-year-old on a child ticket", () => {
    const messages = issueMessages(
      bookingInput({
        selection: {
          day_pass_adult: { quantity: 1, days: ["2026-11-11"] },
          day_pass_child: { quantity: 1, days: ["2026-11-11"] },
        },
        attendees: {
          adults: [],
          children: [{ id: "child-1", fullName: "Kiran Patel", age: 12 }],
        },
      }),
    );
    expect(messages.some((message) => message.includes("require an adult ticket"))).toBe(true);
  });

  it("rejects nonsense ages: text, negative, fractional, huge", () => {
    for (const age of ["12", -1, 1.5, 1_000_000_000, null]) {
      const input = bookingInput({ attendees: { adults: [{ ...SECOND_ADULT, age }] } });
      expect(CreateBookingRequestSchema.safeParse(input).success).toBe(false);
    }
  });

  it("requires the booker to be 18 or older", () => {
    expect(issueMessages(bookingInput({ booker: { ...BOOKER, age: 17 } }))).toContain(
      "The person booking must be at least 18 years old.",
    );
  });

  it("keeps attendee counts matched to tickets", () => {
    expect(
      CreateBookingRequestSchema.safeParse(
        bookingInput({ attendees: { adults: [], children: [], toddlers: [] } }),
      ).success,
    ).toBe(false);
    expect(
      CreateBookingRequestSchema.safeParse(
        bookingInput({
          attendees: {
            adults: [SECOND_ADULT, { id: "adult-2", fullName: "Meera Shah", age: 38 }],
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("lets under-5s attend free, with no ticket, as extra attendees", () => {
    const request = parse({
      attendees: {
        adults: [SECOND_ADULT],
        children: [],
        toddlers: [{ id: "toddler-1", fullName: "Mira Patel", age: 3 }],
      },
    });
    const result = planBooking(request, FRESH, NOW);
    expect(result.ok && result.plan.quote.totalCents).toBe(3000);
    expect(listAttendees(request).map((person) => person.kind)).toEqual([
      "adult",
      "adult",
      "toddler",
    ]);
  });

  it("rejects an age-5 attendee as a toddler (5 needs a child ticket)", () => {
    expect(
      CreateBookingRequestSchema.safeParse(
        bookingInput({
          attendees: {
            adults: [SECOND_ADULT],
            toddlers: [{ id: "toddler-1", fullName: "Mira Patel", age: 5 }],
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("caps quantities, toddlers, dinner plates and workshop places", () => {
    expect(
      CreateBookingRequestSchema.safeParse(
        bookingInput({ selection: { day_pass_adult: { quantity: 31, days: ["2026-11-11"] } } }),
      ).success,
    ).toBe(false);

    const manyToddlers = Array.from({ length: 11 }, (_, index) => ({
      id: `toddler-${index}`,
      fullName: "Little One",
      age: 2,
    }));
    expect(
      CreateBookingRequestSchema.safeParse(
        bookingInput({ attendees: { adults: [SECOND_ADULT], toddlers: manyToddlers } }),
      ).success,
    ).toBe(false);

    expect(
      issueMessages(
        bookingInput({
          selection: {
            day_pass_adult: { quantity: 2, days: ["2026-11-11"] },
            dinner_plate: { quantity: 3, days: ["2026-11-11"] },
          },
        }),
      ).some((message) => message.startsWith("Dinner Plate is per person")),
    ).toBe(true);

    expect(
      issueMessages(
        bookingInput({
          selection: {
            day_pass_adult: { quantity: 2, days: ["2026-11-11"] },
            garba_workshop: { quantity: 3, days: ["2026-11-11"] },
          },
        }),
      ).some((message) => message.startsWith("Garba Workshop is one place per person")),
    ).toBe(true);
  });

  it("requires unique attendee ids", () => {
    const messages = issueMessages(
      bookingInput({
        selection: { day_pass_adult: { quantity: 3, days: ["2026-11-11"] } },
        attendees: {
          adults: [SECOND_ADULT, { ...SECOND_ADULT, fullName: "Meera Shah" }],
        },
      }),
    );
    expect(messages).toContain("Each attendee must have a unique ID.");
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
