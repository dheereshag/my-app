import { CreateBookingRequestSchema, type CreateBookingRequest } from "../src/domain";
import { buildInventory } from "../src/server/inventory";

export const NOW = new Date("2026-11-01T12:00:00Z");

export const BOOKER = {
  fullName: "Asha Patel",
  email: "asha@example.com",
  phone: "214 555 0101",
  age: 40,
  isAttendingAsAdult: true,
};

export const SECOND_ADULT = { id: "adult-1", fullName: "Ravi Patel", age: 42 };

/** Two adults (booker + Ravi) on a Nov 27 day pass: the smallest valid booking. */
export function bookingInput(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "key-1",
    selection: { day_pass_adult: { quantity: 2, days: ["2026-11-27"] } },
    booker: BOOKER,
    attendees: { adults: [SECOND_ADULT], children: [], toddlers: [] },
    ...overrides,
  };
}

export function parse(overrides: Record<string, unknown> = {}): CreateBookingRequest {
  return CreateBookingRequestSchema.parse(bookingInput(overrides));
}

export function issueMessages(input: unknown): string[] {
  const result = CreateBookingRequestSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

export const FRESH = buildInventory([], []);
