import { describe, expect, it } from "vite-plus/test";
import {
  AdultAgeSchema,
  AdultAttendeeSchema,
  BookerAgeSchema,
  BookerSchema,
  ChildAgeSchema,
  ChildAttendeeSchema,
  CreateBookingRequestSchema,
  QuoteRequestSchema,
  TicketSelectionSchema,
  ToddlerAgeSchema,
  ToddlerAttendeeSchema,
  createEmptySelection,
  resolveRequestPromoCode,
} from "../src/domain";
import { makeValidBooker, makeSelection } from "./domain-fixtures";

describe("Zod v4 Validation & Cross-Field Rules", () => {
  it.each([-1, 1.5])("reports invalid quantities (%s) without throwing", (quantity) => {
    const result = CreateBookingRequestSchema.safeParse({
      idempotencyKey: "booking-original",
      selection: { day_pass_adult: { quantity, days: ["2026-11-27"] } },
      booker: makeValidBooker(),
      attendees: { adults: [], children: [], toddlers: [] },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.path.join(".") === "selection.day_pass_adult.quantity",
        ),
      ).toBe(true);
    }
  });

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
    expect(BookerSchema.safeParse(makeValidBooker({ phone: "+1 (2) 3-4.5 67" })).success).toBe(
      true,
    );
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

  it("validates festival dates, no duplicates, workshop dates, and dandiya limits", () => {
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
          day_pass_adult: { quantity: 1, days: ["2026-11-26", "2026-11-26"] },
        }),
      ).success,
    ).toBe(false);
    expect(
      TicketSelectionSchema.safeParse({
        day_pass_adult: { quantity: 1, days: ["2026-11-27"] },
        garba_workshop: { quantity: 1, days: ["2026-11-27", "2026-11-27"] },
      }).success,
    ).toBe(false);
    expect(
      ToddlerAttendeeSchema.safeParse({
        id: "t1",
        fullName: "Mira",
        age: 3,
        attendingDays: ["2026-11-27", "2026-11-27"],
      }).success,
    ).toBe(false);
    expect(
      TicketSelectionSchema.safeParse({
        day_pass_adult: { quantity: 1, days: ["2026-11-15"] },
      }).success,
    ).toBe(false);

    // Reject mutable days on all_day_adult
    expect(
      TicketSelectionSchema.safeParse({
        all_day_adult: { quantity: 1, days: ["2026-11-26"] },
      }).success,
    ).toBe(false);

    // Dinner Plate requires entry coverage on every chosen day
    expect(
      TicketSelectionSchema.safeParse(
        makeSelection({
          day_pass_adult: { quantity: 1, days: ["2026-11-26"] },
          dinner_plate: { quantity: 1, days: ["2026-11-26", "2026-11-27"] },
        }),
      ).success,
    ).toBe(false);
    expect(
      TicketSelectionSchema.safeParse(
        makeSelection({
          all_day_child: { quantity: 1 },
          dinner_plate: { quantity: 2, days: ["2026-11-26", "2026-11-30"] },
        }),
      ).success,
    ).toBe(true);

    // Garba Workshop requires Nov 27 or Nov 29 ONLY + entry coverage
    expect(
      TicketSelectionSchema.safeParse({
        day_pass_adult: { quantity: 1, days: ["2026-11-26"] },
        garba_workshop: { quantity: 1, days: ["2026-11-26"] },
      }).success,
    ).toBe(false);
    expect(
      TicketSelectionSchema.safeParse(
        makeSelection({
          day_pass_adult: { quantity: 1, days: ["2026-11-26"] },
          garba_workshop: { quantity: 1, days: ["2026-11-27"] },
        }),
      ).success,
    ).toBe(false);
    expect(
      TicketSelectionSchema.safeParse(
        makeSelection({
          day_pass_child: { quantity: 1, days: ["2026-11-27"] },
          garba_workshop: { quantity: 1, days: ["2026-11-27"] },
        }),
      ).success,
    ).toBe(true);
  });

  it("preserves top-level and nested promo precedence for API requests", () => {
    const selection = {
      day_pass_adult: { quantity: 1, days: ["2026-11-27"] },
      promoCode: " SEVA10 ",
    };

    expect(resolveRequestPromoCode(QuoteRequestSchema.parse({ selection }))).toBe("SEVA10");
    expect(
      resolveRequestPromoCode(QuoteRequestSchema.parse({ selection, promoCode: null })),
    ).toBeNull();
    expect(resolveRequestPromoCode(QuoteRequestSchema.parse({ selection, promoCode: "  " }))).toBe(
      "",
    );
  });

  it("enforces attendee parity, booker attending rule, idempotencyKey, and rejects client prices", () => {
    const familyBooking = {
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      selection: makeSelection({
        family_pass: { quantity: 1, days: ["2026-11-27", "2026-11-29"] },
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
            attendingDays: ["2026-11-27"],
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
