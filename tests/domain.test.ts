import { describe, expect, it } from "vite-plus/test";
import {
  ADULT_MIN_AGE,
  AdultAgeSchema,
  AdultAttendeeSchema,
  BOOKER_MIN_AGE,
  BookerAgeSchema,
  BookerSchema,
  CATALOG_ITEMS,
  CHILD_MAX_AGE,
  CHILD_MIN_AGE,
  ChildAgeSchema,
  ChildAttendeeSchema,
  CreateBookingRequestSchema,
  DANDIYA_MAX_PER_ORDER,
  EVENT_METADATA,
  FESTIVAL_DATES,
  FESTIVAL_DAYS,
  GARBA_WORKSHOP_DATES,
  INITIAL_CATALOG_MAP,
  INITIAL_PROMO_CODES,
  MAX_AGE,
  QuoteRequestSchema,
  TODDLER_MAX_AGE,
  TicketSelectionSchema,
  ToddlerAgeSchema,
  calculateQuote,
  createCatalogMap,
  createEmptySelection,
  createPromoMap,
  evaluatePromoCode,
  formatUsd,
  getCoveredFestivalDays,
  getExpectedOtherAdultCount,
  getRequiredAttendeeCounts,
  getRequiredAttendeeCountsForDay,
  isEventBookingClosed,
  reconcileAttendees,
  resolveRequestPromoCode,
  type AttendeeGroupDraft,
  type TicketSelection,
} from "../src/domain";

function makeValidBooker(overrides: Partial<Parameters<typeof BookerSchema.parse>[0]> = {}) {
  return {
    fullName: "Ananya Sharma",
    email: "ananya@example.com",
    phone: "(469) 555-0142",
    age: 34,
    isAttendingAsAdult: true,
    ...overrides,
  };
}

function makeSelection(overrides: Partial<TicketSelection> = {}): TicketSelection {
  return {
    ...createEmptySelection(),
    ...overrides,
  };
}

describe("Catalog & Festival Constants", () => {
  it("defines exact event metadata, dates, workshop dates, and age bounds", () => {
    expect(EVENT_METADATA).toEqual({
      name: "Sharad Utsav 2026",
      location: "Radha Krishna Temple, Allen, Texas",
      currency: "USD",
      dateRangeLabel: "Tue 10 Nov 2026 – Sat 14 Nov 2026",
      totalDays: 5,
    });

    expect(FESTIVAL_DATES).toEqual([
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
    ]);
    expect(FESTIVAL_DAYS.map((d) => `${d.date}:${d.weekday}`)).toEqual([
      "2026-11-10:Tue",
      "2026-11-11:Wed",
      "2026-11-12:Thu",
      "2026-11-13:Fri",
      "2026-11-14:Sat",
    ]);
    expect(GARBA_WORKSHOP_DATES).toEqual(["2026-11-11", "2026-11-13"]);

    expect(BOOKER_MIN_AGE).toBe(18);
    expect(ADULT_MIN_AGE).toBe(12);
    expect(CHILD_MIN_AGE).toBe(5);
    expect(CHILD_MAX_AGE).toBe(11);
    expect(TODDLER_MAX_AGE).toBe(4);
    expect(MAX_AGE).toBe(120);
    expect(DANDIYA_MAX_PER_ORDER).toBe(20);
    expect(isEventBookingClosed(new Date("2026-11-15T05:59:59.999Z"))).toBe(false);
    expect(isEventBookingClosed(new Date("2026-11-15T06:00:00.000Z"))).toBe(true);
  });

  it("defines all 8 SKUs with exact integer-cent prices and initial stock", () => {
    expect(CATALOG_ITEMS).toHaveLength(8);
    expect(INITIAL_CATALOG_MAP.day_pass_adult.priceCents).toBe(1500);
    expect(INITIAL_CATALOG_MAP.day_pass_adult.initialStock).toBe(380);

    expect(INITIAL_CATALOG_MAP.day_pass_child.priceCents).toBe(800);
    expect(INITIAL_CATALOG_MAP.day_pass_child.initialStock).toBe(260);

    expect(INITIAL_CATALOG_MAP.all_day_adult.priceCents).toBe(6000);
    expect(INITIAL_CATALOG_MAP.all_day_adult.initialStock).toBe(0);

    expect(INITIAL_CATALOG_MAP.all_day_child.priceCents).toBe(3000);
    expect(INITIAL_CATALOG_MAP.all_day_child.initialStock).toBe(140);

    expect(INITIAL_CATALOG_MAP.family_pass.priceCents).toBe(4000);
    expect(INITIAL_CATALOG_MAP.family_pass.initialStock).toBe(95);

    expect(INITIAL_CATALOG_MAP.dandiya_sticks.priceCents).toBe(500);
    expect(INITIAL_CATALOG_MAP.dandiya_sticks.initialStock).toBe(900);

    expect(INITIAL_CATALOG_MAP.dinner_plate.priceCents).toBe(1200);
    expect(INITIAL_CATALOG_MAP.dinner_plate.initialStock).toBe(1700);

    expect(INITIAL_CATALOG_MAP.garba_workshop.priceCents).toBe(2000);
    expect(INITIAL_CATALOG_MAP.garba_workshop.initialStock).toBe(2);
  });
});

describe("Pure Formatting, Day Coverage, and Attendee Reconciliation", () => {
  it("formats integer cents cleanly without floating-point artifacts", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(500)).toBe("$5.00");
    expect(formatUsd(1500)).toBe("$15.00");
    expect(formatUsd(14670)).toBe("$146.70");
    expect(formatUsd(120000)).toBe("$1,200.00");
    expect(formatUsd(-2000)).toBe("-$20.00");
  });

  it("computes covered festival days solely from active entry tickets", () => {
    const emptyCovered = getCoveredFestivalDays(
      makeSelection({
        dandiya_sticks: { quantity: 4 },
        day_pass_adult: { quantity: 0, days: ["2026-11-10"] },
      }),
    );
    expect(emptyCovered).toEqual([]);

    const mixedCovered = getCoveredFestivalDays(
      makeSelection({
        day_pass_adult: { quantity: 1, days: ["2026-11-14", "2026-11-10"] },
        family_pass: { quantity: 1, days: ["2026-11-11"] },
      }),
    );
    expect(mixedCovered).toEqual(["2026-11-10", "2026-11-11", "2026-11-14"]);

    const allDayChildCovered = getCoveredFestivalDays(
      makeSelection({
        all_day_child: { quantity: 1 },
      }),
    );
    expect(allDayChildCovered).toEqual([...FESTIVAL_DATES]);
  });

  it("computes required attendee counts and expected other adults correctly", () => {
    const selection = makeSelection({
      day_pass_adult: { quantity: 2, days: ["2026-11-10", "2026-11-11"] },
      day_pass_child: { quantity: 1, days: ["2026-11-10"] },
      all_day_child: { quantity: 1 },
      family_pass: { quantity: 1, days: ["2026-11-12", "2026-11-13"] },
    });

    expect(getRequiredAttendeeCounts(selection)).toEqual({
      adults: 4, // 2 day_pass_adult + 2 from family_pass
      children: 4, // 1 day_pass_child + 1 all_day_child + 2 from family_pass
    });
    expect(getRequiredAttendeeCountsForDay(selection, "2026-11-10")).toEqual({
      adults: 2,
      children: 2,
    });
    expect(getRequiredAttendeeCountsForDay(selection, "2026-11-12")).toEqual({
      adults: 2,
      children: 3,
    });
    expect(getExpectedOtherAdultCount(4, true)).toBe(3);
    expect(getExpectedOtherAdultCount(4, false)).toBe(4);
    expect(getExpectedOtherAdultCount(0, true)).toBe(0);
  });

  it("reconciles attendees purely while preserving filled fields and toddlers", () => {
    const initial: AttendeeGroupDraft = {
      adults: [
        { id: "a1", fullName: "Rohan Patel", age: 36, phone: "4695550101" },
        { id: "a2", fullName: "Meera Patel", age: 33 },
      ],
      children: [{ id: "c1", fullName: "Diya Patel", age: 8 }],
      toddlers: [
        {
          id: "t1",
          fullName: "Kabir Patel",
          age: 2,
          attendingDays: ["2026-11-11"],
        },
      ],
    };

    const expanded = reconcileAttendees(initial, 4, 2, { isAttendingAsAdult: true });
    expect(expanded.adults).toHaveLength(3);
    expect(expanded.adults[0]).toEqual(initial.adults[0]);
    expect(expanded.adults[1]).toEqual(initial.adults[1]);
    expect(expanded.adults[2].fullName).toBe("");
    expect(expanded.adults[2].id).toBeTruthy();

    expect(expanded.children).toHaveLength(2);
    expect(expanded.children[0]).toEqual(initial.children[0]);
    expect(expanded.children[1].fullName).toBe("");
    expect(expanded.toddlers).toEqual(initial.toddlers);

    const shrunk = reconcileAttendees(expanded, 1, 0, { isAttendingAsAdult: true });
    expect(shrunk.adults).toEqual([]);
    expect(shrunk.children).toEqual([]);
    expect(shrunk.toddlers).toEqual(initial.toddlers);

    const noAdults = reconcileAttendees(initial, 0, 1, { isAttendingAsAdult: true });
    expect(noAdults.adults).toEqual([]);
    expect(noAdults.children).toHaveLength(1);
    expect(initial.adults).toHaveLength(2);
  });
});

describe("Integer-Cent Pricing & Stock Calculation", () => {
  it("prices multi-day passes, family pass multi-day, dandiya, dinner, and workshop accurately", () => {
    const selection = makeSelection({
      day_pass_adult: { quantity: 2, days: ["2026-11-10", "2026-11-11"] }, // 2*2*1500 = 6000, stock 4
      day_pass_child: { quantity: 1, days: ["2026-11-10"] }, // 1*1*800 = 800, stock 1
      all_day_child: { quantity: 1 }, // 3000, stock 1
      family_pass: { quantity: 1, days: ["2026-11-12", "2026-11-13"] }, // 1*2*4000 = 8000, stock 2
      dandiya_sticks: { quantity: 3 }, // 3*500 = 1500, stock 3
      dinner_plate: { quantity: 2, days: ["2026-11-10", "2026-11-12"] }, // 2*2*1200 = 4800, stock 4
      garba_workshop: { quantity: 1, days: ["2026-11-11", "2026-11-13"] }, // 1*2*2000 = 4000, stock 2
    });

    const quote = calculateQuote(selection, INITIAL_CATALOG_MAP);
    expect(quote.hasStockIssues).toBe(false);
    expect(quote.stockUsageBySku).toEqual({
      day_pass_adult: 4,
      day_pass_child: 1,
      all_day_adult: 0,
      all_day_child: 1,
      family_pass: 2,
      dandiya_sticks: 3,
      dinner_plate: 4,
      garba_workshop: 2,
    });
    expect(quote.subtotalCents).toBe(28100);
    expect(quote.childTicketSubtotalCents).toBe(3800);
    expect(quote.discountCents).toBe(0);
    expect(quote.totalCents).toBe(28100);

    const lineSubtotalSum = quote.lineItems.reduce((sum, item) => sum + item.lineSubtotalCents, 0);
    expect(lineSubtotalSum).toBe(quote.subtotalCents);
  });

  it("flags sold-out all_day_adult and shared 2-spot garba_workshop stock overruns", () => {
    const soldOutAdult = calculateQuote(
      makeSelection({ all_day_adult: { quantity: 1 } }),
      INITIAL_CATALOG_MAP,
    );
    expect(soldOutAdult.hasStockIssues).toBe(true);
    expect(soldOutAdult.stockIssues[0]).toMatchObject({
      sku: "all_day_adult",
      requested: 1,
      available: 0,
    });

    const workshopOverPool = calculateQuote(
      makeSelection({
        day_pass_adult: { quantity: 2, days: ["2026-11-11", "2026-11-13"] },
        garba_workshop: { quantity: 2, days: ["2026-11-11", "2026-11-13"] },
      }),
      INITIAL_CATALOG_MAP,
    );
    expect(workshopOverPool.stockUsageBySku.garba_workshop).toBe(4);
    expect(workshopOverPool.hasStockIssues).toBe(true);
    expect(workshopOverPool.stockIssues[0]).toMatchObject({
      sku: "garba_workshop",
      requested: 4,
      available: 2,
    });

    const lowDandiyaCatalog = createCatalogMap({ dandiya_sticks: { remainingStock: 5 } });
    const dandiyaOverStock = calculateQuote(
      makeSelection({ dandiya_sticks: { quantity: 8 } }),
      lowDandiyaCatalog,
    );
    expect(dandiyaOverStock.hasStockIssues).toBe(true);
    expect(dandiyaOverStock.stockIssues[0]).toMatchObject({
      sku: "dandiya_sticks",
      requested: 8,
      available: 5,
    });

    // Shared 2-spot Garba Workshop pool: 1 spot remaining allows 1 night, rejects both nights
    const oneSpotWorkshopCatalog = createCatalogMap({ garba_workshop: { remainingStock: 1 } });
    const oneNightOk = calculateQuote(
      makeSelection({
        day_pass_adult: { quantity: 1, days: ["2026-11-11", "2026-11-13"] },
        garba_workshop: { quantity: 1, days: ["2026-11-13"] },
      }),
      oneSpotWorkshopCatalog,
    );
    expect(oneNightOk.hasStockIssues).toBe(false);
    expect(oneNightOk.stockUsageBySku.garba_workshop).toBe(1);

    const twoNightsBlocked = calculateQuote(
      makeSelection({
        day_pass_adult: { quantity: 1, days: ["2026-11-11", "2026-11-13"] },
        garba_workshop: { quantity: 1, days: ["2026-11-11", "2026-11-13"] },
      }),
      oneSpotWorkshopCatalog,
    );
    expect(twoNightsBlocked.hasStockIssues).toBe(true);
    expect(twoNightsBlocked.stockIssues[0]).toMatchObject({
      sku: "garba_workshop",
      requested: 2,
      available: 1,
    });
  });
});

describe("Promo Rules Engine", () => {
  const festivalDay = new Date("2026-11-10T18:00:00Z");

  it("applies SEVA10 with exact integer rounding and proportional line discount sum", () => {
    const quote = calculateQuote(
      makeSelection({
        day_pass_adult: { quantity: 1, days: ["2026-11-10"] }, // 1500
        day_pass_child: { quantity: 1, days: ["2026-11-10"] }, // 800
        dandiya_sticks: { quantity: 1 }, // 500
        dinner_plate: { quantity: 1, days: ["2026-11-10"] }, // 1200
        promoCode: "  seva10 ",
      }),
      INITIAL_CATALOG_MAP,
      INITIAL_PROMO_CODES,
      festivalDay,
    );
    expect(quote.subtotalCents).toBe(4000);
    expect(quote.discountCents).toBe(400);
    expect(quote.totalCents).toBe(3600);
    expect(quote.promo?.valid).toBe(true);

    const oddSubtotal = evaluatePromoCode("SEVA10", INITIAL_PROMO_CODES, 105, 0, festivalDay);
    expect(oddSubtotal.discountCents).toBe(11);

    const remainderQuote = calculateQuote(
      makeSelection({
        day_pass_adult: { quantity: 1, days: ["2026-11-10"] }, // 1500
        dinner_plate: { quantity: 1, days: ["2026-11-10"] }, // 1200
        promoCode: "FLAT20",
      }),
      INITIAL_CATALOG_MAP,
      INITIAL_PROMO_CODES,
      festivalDay,
    );
    expect(remainderQuote.discountCents).toBe(2000);
    expect(remainderQuote.lineItems.reduce((sum, line) => sum + line.discountCents, 0)).toBe(2000);
    expect(remainderQuote.lineItems.reduce((sum, line) => sum + line.lineTotalCents, 0)).toBe(700);
  });

  it("clamps FLAT20 at $0 floor so totalCents never goes negative", () => {
    const quote = calculateQuote(
      makeSelection({
        day_pass_adult: { quantity: 1, days: ["2026-11-10"] }, // 1500
        promoCode: "FLAT20",
      }),
      INITIAL_CATALOG_MAP,
      INITIAL_PROMO_CODES,
      festivalDay,
    );
    expect(quote.subtotalCents).toBe(1500);
    expect(quote.discountCents).toBe(1500);
    expect(quote.totalCents).toBe(0);
    expect(quote.lineItems[0].lineTotalCents).toBe(0);
  });

  it("applies KIDSFREE only to day_pass_child and all_day_child and surfaces Family Pass tip", () => {
    const quote = calculateQuote(
      makeSelection({
        day_pass_adult: { quantity: 1, days: ["2026-11-10"] }, // 1500
        day_pass_child: { quantity: 2, days: ["2026-11-10"] }, // 1600 -> free
        all_day_child: { quantity: 1 }, // 3000 -> free
        family_pass: { quantity: 1, days: ["2026-11-11", "2026-11-12"] }, // 8000 unaffected
        dinner_plate: { quantity: 1, days: ["2026-11-10"] }, // 1200 unaffected
        promoCode: "KIDSFREE",
      }),
      INITIAL_CATALOG_MAP,
      INITIAL_PROMO_CODES,
      festivalDay,
    );

    expect(quote.subtotalCents).toBe(15300);
    expect(quote.childTicketSubtotalCents).toBe(4600);
    expect(quote.discountCents).toBe(4600);
    expect(quote.totalCents).toBe(10700);
    expect(quote.kidsFreeFamilyTip).toBe(true);
    expect(quote.kidsFreeFamilyTipSavingsCents).toBe(2000); // 2 days * ($40 - $30)
    expect(quote.kidsFreeFamilyTipMessage).toContain("KIDSFREE");

    const dayChildLine = quote.lineItems.find((i) => i.sku === "day_pass_child");
    const allDayChildLine = quote.lineItems.find((i) => i.sku === "all_day_child");
    const familyLine = quote.lineItems.find((i) => i.sku === "family_pass");
    expect(dayChildLine?.lineTotalCents).toBe(0);
    expect(allDayChildLine?.lineTotalCents).toBe(0);
    expect(familyLine?.discountCents).toBe(0);
    expect(familyLine?.lineTotalCents).toBe(8000);
  });

  it("evaluates EXPIRED5 using injectable now, MAXEDOUT by count, and unknown codes", () => {
    const expiredResult = evaluatePromoCode(
      "EXPIRED5",
      INITIAL_PROMO_CODES,
      5000,
      0,
      new Date("2026-11-10T12:00:00Z"),
    );
    expect(expiredResult.valid).toBe(false);
    expect(expiredResult.status).toBe("expired");
    expect(expiredResult.discountCents).toBe(0);

    const beforeExpiryResult = evaluatePromoCode(
      "EXPIRED5",
      INITIAL_PROMO_CODES,
      5000,
      0,
      new Date("2026-10-15T12:00:00Z"),
    );
    expect(beforeExpiryResult.valid).toBe(true);
    expect(beforeExpiryResult.discountCents).toBe(250);

    const maxedResult = evaluatePromoCode("MAXEDOUT", INITIAL_PROMO_CODES, 5000, 0, festivalDay);
    expect(maxedResult.valid).toBe(false);
    expect(maxedResult.status).toBe("maxed_out");
    expect(maxedResult.discountCents).toBe(0);

    const availableMaxedOverride = evaluatePromoCode(
      "MAXEDOUT",
      createPromoMap({ MAXEDOUT: { usedCount: 99 } }),
      5000,
      0,
      festivalDay,
    );
    expect(availableMaxedOverride.valid).toBe(true);
    expect(availableMaxedOverride.discountCents).toBe(1000);

    const unknownResult = evaluatePromoCode("NOTREAL", INITIAL_PROMO_CODES, 5000, 0, festivalDay);
    expect(unknownResult.valid).toBe(false);
    expect(unknownResult.status).toBe("invalid");
    expect(unknownResult.discountCents).toBe(0);

    // calculateQuote respects promoState wrapper { code, promos } for expired/maxed/invalid
    const expiredQuote = calculateQuote(
      makeSelection({ day_pass_adult: { quantity: 1, days: ["2026-11-10"] } }),
      INITIAL_CATALOG_MAP,
      { code: "EXPIRED5", promos: INITIAL_PROMO_CODES },
      festivalDay,
    );
    expect(expiredQuote.promo?.status).toBe("expired");
    expect(expiredQuote.discountCents).toBe(0);
    expect(expiredQuote.totalCents).toBe(1500);
  });
});

describe("Zod v4 Validation & Cross-Field Rules", () => {
  it("enforces exact integer age boundaries across booker, adult, child, and toddler", () => {
    // Toddler: 0..4
    expect(ToddlerAgeSchema.safeParse(0).success).toBe(true);
    expect(ToddlerAgeSchema.safeParse(4).success).toBe(true);
    expect(ToddlerAgeSchema.safeParse(-1).success).toBe(false);
    expect(ToddlerAgeSchema.safeParse(5).success).toBe(false);
    expect(ToddlerAgeSchema.safeParse(2.5).success).toBe(false);

    // Child: 5..11
    expect(ChildAgeSchema.safeParse(5).success).toBe(true);
    expect(ChildAgeSchema.safeParse(11).success).toBe(true);
    expect(ChildAgeSchema.safeParse(4).success).toBe(false);
    expect(ChildAgeSchema.safeParse(12).success).toBe(false);
    expect(ChildAgeSchema.safeParse(11.5).success).toBe(false);
    expect(ChildAgeSchema.safeParse("8").success).toBe(false);

    // Adult: 12..120
    expect(AdultAgeSchema.safeParse(12).success).toBe(true);
    expect(AdultAgeSchema.safeParse(120).success).toBe(true);
    expect(AdultAgeSchema.safeParse(11).success).toBe(false);
    expect(AdultAgeSchema.safeParse(121).success).toBe(false);
    expect(AdultAgeSchema.safeParse(11.5).success).toBe(false);

    // Booker: 18..120
    expect(BookerAgeSchema.safeParse(18).success).toBe(true);
    expect(BookerAgeSchema.safeParse(120).success).toBe(true);
    expect(BookerAgeSchema.safeParse(17).success).toBe(false);
    expect(BookerAgeSchema.safeParse(121).success).toBe(false);
    expect(BookerAgeSchema.safeParse(-1).success).toBe(false);

    // Booker email, phone, and name trimming/bounds
    const validBooker = BookerSchema.safeParse(
      makeValidBooker({
        fullName: "  Ananya Sharma  ",
        email: "  ananya@example.com  ",
        phone: " +1 (469) 555-0142 ",
      }),
    );
    expect(validBooker.success).toBe(true);
    if (validBooker.success) {
      expect(validBooker.data.fullName).toBe("Ananya Sharma");
      expect(validBooker.data.email).toBe("ananya@example.com");
      expect(validBooker.data.phone).toBe("+1 (469) 555-0142");
    }

    expect(BookerSchema.safeParse(makeValidBooker({ fullName: " A " })).success).toBe(false);
    expect(BookerSchema.safeParse(makeValidBooker({ email: "not-an-email" })).success).toBe(false);
    expect(BookerSchema.safeParse(makeValidBooker({ phone: "123456" })).success).toBe(false);
    expect(BookerSchema.safeParse(makeValidBooker({ phone: "abcdefg1234567" })).success).toBe(
      false,
    );
    expect(
      BookerSchema.safeParse(makeValidBooker({ phone: "123456789012345678901" })).success,
    ).toBe(false);
  });

  it("enforces child attendee has ONLY id, fullName, age and adult phone rules", () => {
    expect(ChildAttendeeSchema.safeParse({ id: "c1", fullName: "Aarav", age: 9 }).success).toBe(
      true,
    );
    expect(
      ChildAttendeeSchema.safeParse({
        id: "c1",
        fullName: "Aarav",
        age: 9,
        email: "kid@example.com",
      }).success,
    ).toBe(false);
    expect(
      ChildAttendeeSchema.safeParse({
        id: "c1",
        fullName: "Aarav",
        age: 9,
        phone: "4695550199",
      }).success,
    ).toBe(false);

    const emptyPhoneAdult = AdultAttendeeSchema.safeParse({
      id: "a1",
      fullName: "Priya Rao",
      age: 30,
      phone: "",
    });
    expect(emptyPhoneAdult.success).toBe(true);
    if (emptyPhoneAdult.success) {
      expect(emptyPhoneAdult.data.phone).toBeUndefined();
    }

    expect(
      AdultAttendeeSchema.safeParse({
        id: "a1",
        fullName: "Priya Rao",
        age: 30,
        phone: "123",
      }).success,
    ).toBe(false);
  });

  it("validates festival dates, no duplicates, workshop Nov 11/13 restriction, and dandiya limits", () => {
    // Empty cart rejected
    expect(TicketSelectionSchema.safeParse(createEmptySelection()).success).toBe(false);

    // Standalone dandiya sticks allowed up to 20
    expect(
      TicketSelectionSchema.safeParse(makeSelection({ dandiya_sticks: { quantity: 20 } })).success,
    ).toBe(true);
    expect(
      TicketSelectionSchema.safeParse(makeSelection({ dandiya_sticks: { quantity: 21 } })).success,
    ).toBe(false);
    expect(
      TicketSelectionSchema.safeParse(makeSelection({ dandiya_sticks: { quantity: 1.5 } })).success,
    ).toBe(false);

    // Reject duplicate days and out-of-festival dates
    expect(
      TicketSelectionSchema.safeParse(
        makeSelection({
          day_pass_adult: { quantity: 1, days: ["2026-11-10", "2026-11-10"] },
        }),
      ).success,
    ).toBe(false);
    expect(
      TicketSelectionSchema.safeParse({
        day_pass_adult: { quantity: 1, days: ["2026-11-15"] },
      }).success,
    ).toBe(false);

    // Reject mutable days on all_day_adult
    expect(
      TicketSelectionSchema.safeParse({
        all_day_adult: { quantity: 1, days: ["2026-11-10"] },
      }).success,
    ).toBe(false);

    // Dinner Plate requires entry coverage on every chosen day
    expect(
      TicketSelectionSchema.safeParse(
        makeSelection({
          day_pass_adult: { quantity: 1, days: ["2026-11-10"] },
          dinner_plate: { quantity: 1, days: ["2026-11-10", "2026-11-11"] },
        }),
      ).success,
    ).toBe(false);
    expect(
      TicketSelectionSchema.safeParse(
        makeSelection({
          all_day_child: { quantity: 1 },
          dinner_plate: { quantity: 2, days: ["2026-11-10", "2026-11-14"] },
        }),
      ).success,
    ).toBe(true);

    // Garba Workshop requires Nov 11 or Nov 13 ONLY + entry coverage
    expect(
      TicketSelectionSchema.safeParse({
        day_pass_adult: { quantity: 1, days: ["2026-11-10"] },
        garba_workshop: { quantity: 1, days: ["2026-11-10"] },
      }).success,
    ).toBe(false);
    expect(
      TicketSelectionSchema.safeParse(
        makeSelection({
          day_pass_adult: { quantity: 1, days: ["2026-11-10"] },
          garba_workshop: { quantity: 1, days: ["2026-11-11"] },
        }),
      ).success,
    ).toBe(false);
    expect(
      TicketSelectionSchema.safeParse(
        makeSelection({
          day_pass_child: { quantity: 1, days: ["2026-11-11"] },
          garba_workshop: { quantity: 1, days: ["2026-11-11"] },
        }),
      ).success,
    ).toBe(true);
  });

  it("enforces attendee parity, booker attending rule, idempotencyKey, and rejects client prices", () => {
    const familyBooking = {
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      selection: makeSelection({
        family_pass: { quantity: 1, days: ["2026-11-11", "2026-11-13"] },
      }),
      promoCode: "SEVA10",
      booker: makeValidBooker({ isAttendingAsAdult: true }),
      attendees: {
        adults: [{ id: "a1", fullName: "Vikram Sharma", age: 36 }],
        children: [
          { id: "c1", fullName: "Riya Sharma", age: 7 },
          { id: "c2", fullName: "Aryan Sharma", age: 10 },
        ],
        toddlers: [
          {
            id: "t1",
            fullName: "Mira Sharma",
            age: 3,
            attendingDays: ["2026-11-11"],
          },
        ],
      },
    };

    const parsed = CreateBookingRequestSchema.safeParse(familyBooking);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(resolveRequestPromoCode(parsed.data)).toBe("SEVA10");
    }

    // Wrong adult count when booker is NOT attending
    expect(
      CreateBookingRequestSchema.safeParse({
        ...familyBooking,
        booker: makeValidBooker({ isAttendingAsAdult: false }),
      }).success,
    ).toBe(false);

    // isAttendingAsAdult = true disallowed when requiredAdults === 0
    expect(
      CreateBookingRequestSchema.safeParse({
        idempotencyKey: "req-dandiya-1",
        selection: makeSelection({ dandiya_sticks: { quantity: 2 } }),
        booker: makeValidBooker({ isAttendingAsAdult: true }),
        attendees: { adults: [], children: [], toddlers: [] },
      }).success,
    ).toBe(false);

    // Dandiya standalone with isAttendingAsAdult: false succeeds
    expect(
      CreateBookingRequestSchema.safeParse({
        idempotencyKey: "req-dandiya-2",
        selection: makeSelection({ dandiya_sticks: { quantity: 2 } }),
        booker: makeValidBooker({ isAttendingAsAdult: false }),
        attendees: { adults: [], children: [], toddlers: [] },
      }).success,
    ).toBe(true);

    // Missing/blank idempotencyKey rejected
    expect(
      CreateBookingRequestSchema.safeParse({
        ...familyBooking,
        idempotencyKey: "   ",
      }).success,
    ).toBe(false);

    // Reject client-supplied price/total tampering on QuoteRequest & CreateBookingRequest
    expect(
      QuoteRequestSchema.safeParse({
        selection: familyBooking.selection,
        totalCents: 0,
      }).success,
    ).toBe(false);
    expect(
      CreateBookingRequestSchema.safeParse({
        ...familyBooking,
        totalCents: 100,
      }).success,
    ).toBe(false);
  });
});
