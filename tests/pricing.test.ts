import { describe, expect, it } from "vite-plus/test";
import {
  FESTIVAL_DATES,
  INITIAL_CATALOG_MAP,
  INITIAL_PROMO_CODES,
  calculateQuote,
  createCatalogMap,
  createPromoMap,
  evaluatePromoCode,
} from "../src/domain";
import { makeSelection } from "./domain-fixtures";

describe("Integer-Cent Pricing & Stock Calculation", () => {
  it("keeps both all-day pass prices flat for all 15 days", () => {
    const adult = calculateQuote({ all_day_adult: { quantity: 1 } });
    const child = calculateQuote({ all_day_child: { quantity: 1 } });
    expect(adult.lineItems[0]?.days).toEqual([...FESTIVAL_DATES]);
    expect(adult.totalCents).toBe(6000);
    expect(child.lineItems[0]?.days).toEqual([...FESTIVAL_DATES]);
    expect(child.totalCents).toBe(3000);
  });

  it("normalizes partial selections and orders duplicate days for pricing", () => {
    const quote = calculateQuote({
      day_pass_adult: { quantity: 1, days: ["2026-11-30", "2026-11-26", "2026-11-30"] },
    });

    expect(quote.lineItems[0]?.days).toEqual(["2026-11-26", "2026-11-30"]);
    expect(quote.totalCents).toBe(3000);
  });

  it("prices multi-day passes, family pass multi-day, dandiya, dinner, and workshop accurately", () => {
    const selection = makeSelection({
      day_pass_adult: { quantity: 2, days: ["2026-11-26", "2026-11-27"] }, // 2*2*1500 = 6000, stock 4
      day_pass_child: { quantity: 1, days: ["2026-11-26"] }, // 1*1*800 = 800, stock 1
      all_day_child: { quantity: 1 }, // 3000, stock 1
      family_pass: { quantity: 1, days: ["2026-11-28", "2026-11-29"] }, // 1*2*4000 = 8000, stock 2
      dandiya_sticks: { quantity: 3 }, // 3*500 = 1500, stock 3
      dinner_plate: { quantity: 2, days: ["2026-11-26", "2026-11-28"] }, // 2*2*1200 = 4800, stock 4
      garba_workshop: { quantity: 1, days: ["2026-11-27", "2026-11-29"] }, // 1*2*2000 = 4000, stock 2
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
        day_pass_adult: { quantity: 2, days: ["2026-11-27", "2026-11-29"] },
        garba_workshop: { quantity: 2, days: ["2026-11-27", "2026-11-29"] },
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
        day_pass_adult: { quantity: 1, days: ["2026-11-27", "2026-11-29"] },
        garba_workshop: { quantity: 1, days: ["2026-11-29"] },
      }),
      oneSpotWorkshopCatalog,
    );
    expect(oneNightOk.hasStockIssues).toBe(false);
    expect(oneNightOk.stockUsageBySku.garba_workshop).toBe(1);

    const twoNightsBlocked = calculateQuote(
      makeSelection({
        day_pass_adult: { quantity: 1, days: ["2026-11-27", "2026-11-29"] },
        garba_workshop: { quantity: 1, days: ["2026-11-27", "2026-11-29"] },
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
  const festivalDay = new Date("2026-11-26T18:00:00Z");

  it("applies SEVA10 with exact integer rounding and proportional line discount sum", () => {
    const quote = calculateQuote(
      makeSelection({
        day_pass_adult: { quantity: 1, days: ["2026-11-26"] }, // 1500
        day_pass_child: { quantity: 1, days: ["2026-11-26"] }, // 800
        dandiya_sticks: { quantity: 1 }, // 500
        dinner_plate: { quantity: 1, days: ["2026-11-26"] }, // 1200
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
        day_pass_adult: { quantity: 1, days: ["2026-11-26"] }, // 1500
        dinner_plate: { quantity: 1, days: ["2026-11-26"] }, // 1200
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
        day_pass_adult: { quantity: 1, days: ["2026-11-26"] }, // 1500
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
        day_pass_adult: { quantity: 1, days: ["2026-11-26"] }, // 1500
        day_pass_child: { quantity: 2, days: ["2026-11-26"] }, // 1600 -> free
        all_day_child: { quantity: 1 }, // 3000 -> free
        family_pass: { quantity: 1, days: ["2026-11-27", "2026-11-28"] }, // 8000 unaffected
        dinner_plate: { quantity: 1, days: ["2026-11-26"] }, // 1200 unaffected
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
      new Date("2026-11-26T12:00:00Z"),
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
      makeSelection({ day_pass_adult: { quantity: 1, days: ["2026-11-26"] } }),
      INITIAL_CATALOG_MAP,
      { code: "EXPIRED5", promos: INITIAL_PROMO_CODES },
      festivalDay,
    );
    expect(expiredQuote.promo?.status).toBe("expired");
    expect(expiredQuote.discountCents).toBe(0);
    expect(expiredQuote.totalCents).toBe(1500);
  });
});
