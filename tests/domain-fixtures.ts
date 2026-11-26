import { BookerSchema, createEmptySelection, type TicketSelection } from "../src/domain";

export function makeValidBooker(overrides: Partial<Parameters<typeof BookerSchema.parse>[0]> = {}) {
  return {
    fullName: "Ananya Sharma",
    email: "ananya@example.com",
    phone: "(469) 555-0142",
    age: 34,
    isAttendingAsAdult: true,
    ...overrides,
  };
}

export function makeSelection(overrides: Partial<TicketSelection> = {}): TicketSelection {
  return {
    ...createEmptySelection(),
    ...overrides,
  };
}
