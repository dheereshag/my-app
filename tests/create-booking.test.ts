import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createEmptySelection } from "../src/domain";
import type { BookingConfirmation } from "../src/server/confirmation";
import { validateDraft, type BookingDraft } from "../src/store/booking-request";

const mocks = vi.hoisted(() => ({
  findBooking: vi.fn(),
  batch: vi.fn(),
  loadInventory: vi.fn(),
}));

vi.mock("void/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("void/db")>();
  return {
    ...original,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({ limit: mocks.findBooking }),
        }),
      }),
      batch: mocks.batch,
    },
  };
});

vi.mock("../src/server/inventory-store", () => ({
  loadInventory: mocks.loadInventory,
}));

const { createBooking } = await import("../src/server/create-booking");

const CONFIRMATION: BookingConfirmation = {
  reference: "SU26-TEST1234",
  status: "confirmed",
  payment: { method: "simulated", status: "paid", amountCents: 1350 },
  booker: { fullName: "Asha Patel", email: "asha@example.com" },
  lines: [],
  subtotalCents: 1500,
  discountCents: 150,
  totalCents: 1350,
  promoCode: "SEVA10",
  attendees: [],
};

const draft: BookingDraft = {
  selection: {
    ...createEmptySelection(),
    day_pass_adult: { quantity: 1, days: ["2026-11-11"] },
    promoCode: "STALE",
  },
  promoCode: "  SEVA10  ",
  booker: {
    fullName: "Asha Patel",
    email: "asha@example.com",
    phone: "214 555 0101",
    age: 40,
    isAttendingAsAdult: true,
  },
  attendees: { adults: [], children: [], toddlers: [] },
};

describe("booking replay compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findBooking.mockResolvedValue([
      {
        requestHash: "1d6ed80522c7290d8154aa2d8ce0d53f7740e0c65e7716135b96256622a7d397",
        confirmationJson: JSON.stringify(CONFIRMATION),
      },
    ]);
  });

  it("replays a previously stored request, even after the event closes", async () => {
    const parsed = validateDraft(draft, "booking-original");
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;

    const result = await createBooking(parsed.request, new Date("2026-11-25T00:00:00Z"));

    expect(result).toEqual({ kind: "replayed", confirmation: CONFIRMATION });
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.loadInventory).not.toHaveBeenCalled();
  });

  it("rejects a changed request under the same key without reserving stock", async () => {
    const parsed = validateDraft(draft, "booking-original");
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;

    const result = await createBooking({
      ...parsed.request,
      booker: { ...parsed.request.booker, fullName: "Changed Name" },
    });

    expect(result).toEqual({ kind: "idempotency_conflict" });
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.loadInventory).not.toHaveBeenCalled();
  });
});
