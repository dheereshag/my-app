import { describe, expect, it } from "vite-plus/test";
import {
  ADULT_MIN_AGE,
  BOOKER_MIN_AGE,
  CATALOG_ITEMS,
  CHILD_MAX_AGE,
  CHILD_MIN_AGE,
  DANDIYA_MAX_PER_ORDER,
  EVENT_METADATA,
  FESTIVAL_DATES,
  FESTIVAL_DAYS,
  GARBA_WORKSHOP_DATES,
  INITIAL_CATALOG_MAP,
  MAX_AGE,
  TODDLER_MAX_AGE,
  formatUsd,
  getCoveredFestivalDays,
  getExpectedOtherAdultCount,
  getRequiredAttendeeCounts,
  getRequiredAttendeeCountsForDay,
  isEventBookingClosed,
  reconcileAttendees,
  type AttendeeGroupDraft,
} from "../src/domain";
import { makeSelection } from "./domain-fixtures";

describe("Catalog & Festival Constants", () => {
  it("defines exact event metadata, dates, workshop dates, and age bounds", () => {
    expect(EVENT_METADATA).toEqual({
      name: "Sharad Utsav 2026",
      location: "Radha Krishna Temple, Allen, Texas",
      currency: "USD",
      dateRangeLabel: "Thu 26 Nov 2026 - Thu 10 Dec 2026",
      totalDays: 15,
    });

    expect(FESTIVAL_DATES).toEqual([
      "2026-11-26",
      "2026-11-27",
      "2026-11-28",
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
      "2026-12-05",
      "2026-12-06",
      "2026-12-07",
      "2026-12-08",
      "2026-12-09",
      "2026-12-10",
    ]);
    expect(FESTIVAL_DAYS.map((d) => `${d.date}:${d.weekday}`)).toEqual([
      "2026-11-26:Thu",
      "2026-11-27:Fri",
      "2026-11-28:Sat",
      "2026-11-29:Sun",
      "2026-11-30:Mon",
      "2026-12-01:Tue",
      "2026-12-02:Wed",
      "2026-12-03:Thu",
      "2026-12-04:Fri",
      "2026-12-05:Sat",
      "2026-12-06:Sun",
      "2026-12-07:Mon",
      "2026-12-08:Tue",
      "2026-12-09:Wed",
      "2026-12-10:Thu",
    ]);
    expect(GARBA_WORKSHOP_DATES).toEqual(["2026-11-27", "2026-11-29"]);

    expect(BOOKER_MIN_AGE).toBe(18);
    expect(ADULT_MIN_AGE).toBe(12);
    expect(CHILD_MIN_AGE).toBe(5);
    expect(CHILD_MAX_AGE).toBe(11);
    expect(TODDLER_MAX_AGE).toBe(4);
    expect(MAX_AGE).toBe(120);
    expect(DANDIYA_MAX_PER_ORDER).toBe(20);
    expect(isEventBookingClosed(new Date("2026-11-25T19:58:00.000Z"))).toBe(false);
    expect(isEventBookingClosed(new Date("2026-12-11T05:59:59.999Z"))).toBe(false);
    expect(isEventBookingClosed(new Date("2026-12-11T06:00:00.000Z"))).toBe(true);
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
        day_pass_adult: { quantity: 0, days: ["2026-11-26"] },
      }),
    );
    expect(emptyCovered).toEqual([]);

    const mixedCovered = getCoveredFestivalDays(
      makeSelection({
        day_pass_adult: { quantity: 1, days: ["2026-11-30", "2026-11-26"] },
        family_pass: { quantity: 1, days: ["2026-11-27"] },
      }),
    );
    expect(mixedCovered).toEqual(["2026-11-26", "2026-11-27", "2026-11-30"]);

    const allDayChildCovered = getCoveredFestivalDays(
      makeSelection({
        all_day_child: { quantity: 1 },
      }),
    );
    expect(allDayChildCovered).toEqual([...FESTIVAL_DATES]);
  });

  it("computes required attendee counts and expected other adults correctly", () => {
    const selection = makeSelection({
      day_pass_adult: { quantity: 2, days: ["2026-11-26", "2026-11-27"] },
      day_pass_child: { quantity: 1, days: ["2026-11-26"] },
      all_day_child: { quantity: 1 },
      family_pass: { quantity: 1, days: ["2026-11-28", "2026-11-29"] },
    });

    expect(getRequiredAttendeeCounts(selection)).toEqual({
      adults: 4, // 2 day_pass_adult + 2 from family_pass
      children: 4, // 1 day_pass_child + 1 all_day_child + 2 from family_pass
    });
    expect(getRequiredAttendeeCountsForDay(selection, "2026-11-26")).toEqual({
      adults: 2,
      children: 2,
    });
    expect(getRequiredAttendeeCountsForDay(selection, "2026-11-28")).toEqual({
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
          attendingDays: ["2026-11-27"],
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
