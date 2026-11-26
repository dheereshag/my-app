import { describe, expect, it } from "vite-plus/test";
import { CreateBookingRequestSchema } from "../src/domain";
import { listAttendees, planBooking } from "../src/server/plan-booking";
import {
  NOW,
  BOOKER,
  SECOND_ADULT,
  FRESH,
  bookingInput,
  parse,
  issueMessages,
} from "./booking-fixtures";

describe("booking request rules the server re-checks", () => {
  it("rejects fields the client should never send (prices, totals)", () => {
    expect(issueMessages(bookingInput({ totalCents: 1 }))).not.toEqual([]);
    expect(
      issueMessages(
        bookingInput({
          selection: { day_pass_adult: { quantity: 2, days: ["2026-11-27"], priceCents: 1 } },
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
          day_pass_adult: { quantity: 1, days: ["2026-11-27"] },
          day_pass_child: { quantity: 1, days: ["2026-11-27"] },
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

  it("checks dinner and workshop quantities against attendance on each selected day", () => {
    const messages = issueMessages(
      bookingInput({
        selection: {
          family_pass: { quantity: 1, days: ["2026-11-27"] },
          day_pass_adult: { quantity: 1, days: ["2026-11-29"] },
          dinner_plate: { quantity: 2, days: ["2026-11-29"] },
          garba_workshop: { quantity: 2, days: ["2026-11-29"] },
        },
        attendees: {
          adults: [SECOND_ADULT, { id: "adult-2", fullName: "Meera Shah", age: 38 }],
          children: [
            { id: "child-1", fullName: "Kiran Patel", age: 8 },
            { id: "child-2", fullName: "Aarav Patel", age: 10 },
          ],
          toddlers: [],
        },
      }),
    );

    expect(messages).toContain(
      "Dinner Plate is per person, per day: 1 person attends on 2026-11-29, but 2 plates were requested.",
    );
    expect(messages).toContain(
      "Garba Workshop is one place per person: 1 ticketed person attends on 2026-11-29, but 2 places were requested.",
    );
  });

  it("requires toddler attendance dates to be covered by an entry ticket", () => {
    const messages = issueMessages(
      bookingInput({
        selection: { day_pass_adult: { quantity: 1, days: ["2026-11-27"] } },
        attendees: {
          adults: [],
          children: [],
          toddlers: [
            {
              id: "toddler-1",
              fullName: "Mira Patel",
              age: 3,
              attendingDays: ["2026-11-29"],
            },
          ],
        },
      }),
    );
    expect(messages).toContain(
      "A child under 5 needs an accompanying entry ticket for 2026-11-29.",
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
        toddlers: [
          {
            id: "toddler-1",
            fullName: "Mira Patel",
            age: 3,
            attendingDays: ["2026-11-27"],
          },
        ],
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
            toddlers: [
              {
                id: "toddler-1",
                fullName: "Mira Patel",
                age: 5,
                attendingDays: ["2026-11-27"],
              },
            ],
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("caps quantities, toddlers, dinner plates and workshop places", () => {
    expect(
      CreateBookingRequestSchema.safeParse(
        bookingInput({ selection: { day_pass_adult: { quantity: 31, days: ["2026-11-27"] } } }),
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
            day_pass_adult: { quantity: 2, days: ["2026-11-27"] },
            dinner_plate: { quantity: 3, days: ["2026-11-27"] },
          },
        }),
      ).some((message) => message.startsWith("Dinner Plate is per person")),
    ).toBe(true);

    expect(
      issueMessages(
        bookingInput({
          selection: {
            day_pass_adult: { quantity: 2, days: ["2026-11-27"] },
            garba_workshop: { quantity: 3, days: ["2026-11-27"] },
          },
        }),
      ).some((message) => message.startsWith("Garba Workshop is one place per person")),
    ).toBe(true);
  });

  it("requires unique attendee ids", () => {
    const messages = issueMessages(
      bookingInput({
        selection: { day_pass_adult: { quantity: 3, days: ["2026-11-27"] } },
        attendees: {
          adults: [SECOND_ADULT, { ...SECOND_ADULT, fullName: "Meera Shah" }],
        },
      }),
    );
    expect(messages).toContain("Each attendee must have a unique ID.");
  });
});
