import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Hono, type Context } from "hono";
import type { CloudEnv } from "void";
import { CreateBookingRequestSchema } from "../src/domain";
import { LegacyBookingReplaySchema } from "../src/domain/legacy-booking";
import type { BookingConfirmation } from "../src/server/confirmation";

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

const { replayBooking } = await import("../src/server/create-booking");
const { POST: bookingRoute } = await import("../routes/api/bookings");
const { POST: replayRoute } = await import("../routes/api/bookings/replay");
async function callRoute(
  handler: typeof bookingRoute | typeof replayRoute,
  context: Context<CloudEnv>,
): Promise<Response> {
  const cloudContext = Object.assign(context, {
    redirect: () => {
      throw new Error("Unexpected redirect in booking route");
    },
  });
  const response = await handler(cloudContext);
  if (!(response instanceof Response)) {
    throw new Error("Booking route did not return a response");
  }
  return response;
}
const app = new Hono<CloudEnv>()
  .post("/api/bookings", (context) => callRoute(bookingRoute, context))
  .post("/api/bookings/replay", (context) => callRoute(replayRoute, context));

const CONFIRMATION: BookingConfirmation = {
  reference: "SU26-TEST1234",
  status: "confirmed",
  payment: { method: "simulated", status: "paid", amountCents: 1350 },
  booker: { fullName: "Asha Patel", email: "asha@example.com" },
  lines: [
    {
      sku: "day_pass_adult",
      label: "Day Pass – Adult",
      quantity: 1,
      days: ["2026-11-11"],
      unitPriceCents: 1500,
      subtotalCents: 1500,
      discountCents: 150,
      totalCents: 1350,
    },
  ],
  subtotalCents: 1500,
  discountCents: 150,
  totalCents: 1350,
  promoCode: "SEVA10",
  attendees: [],
};

const request = LegacyBookingReplaySchema.parse({
  idempotencyKey: "booking-original",
  selection: { day_pass_adult: { quantity: 1, days: ["2026-11-11"] } },
  promoCode: "SEVA10",
  booker: {
    fullName: "Asha Patel",
    email: "asha@example.com",
    phone: "214 555 0101",
    age: 40,
    isAttendingAsAdult: true,
  },
  attendees: { adults: [], children: [], toddlers: [] },
});

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
    const result = await replayBooking(request);

    expect(result).toEqual({ kind: "replayed", confirmation: CONFIRMATION });
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.loadInventory).not.toHaveBeenCalled();
  });

  it("replays an old-dated request through the booking API but rejects a new old-dated booking", async () => {
    expect(CreateBookingRequestSchema.safeParse(request).success).toBe(false);
    const body = JSON.stringify(request);
    const options = { method: "POST", headers: { "content-type": "application/json" }, body };
    const replay = await app.request("/api/bookings", options);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(CONFIRMATION);

    const changed = await app.request("/api/bookings", {
      ...options,
      body: JSON.stringify({ ...request, booker: { ...request.booker, fullName: "Changed Name" } }),
    });
    expect(changed.status).toBe(409);

    mocks.findBooking.mockResolvedValue([]);
    const missing = await app.request("/api/bookings", options);
    expect(missing.status).toBe(400);
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.loadInventory).not.toHaveBeenCalled();
  });

  it("replays older date-free bookings whose toddlers had no attendance dates", async () => {
    const oldRequest = {
      idempotencyKey: "legacy-no-dates",
      selection: { all_day_child: { quantity: 1 } },
      promoCode: null,
      booker: { ...request.booker, isAttendingAsAdult: false },
      attendees: {
        adults: [],
        children: [{ id: "c1", fullName: "Mira", age: 8 }],
        toddlers: [{ id: "t1", fullName: "Kiran", age: 2 }],
      },
    };
    mocks.findBooking.mockResolvedValue([
      {
        requestHash: "3697b3f05c051cf3fd9d8fe985ddc2f1404c9e325007732085579bd488ee7538",
        confirmationJson: JSON.stringify(CONFIRMATION),
      },
    ]);

    const response = await app.request("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(oldRequest),
    });

    expect(response.status).toBe(200);
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.loadInventory).not.toHaveBeenCalled();
  });

  it("rejects a changed request under the same key without reserving stock", async () => {
    const result = await replayBooking({
      ...request,
      booker: { ...request.booker, fullName: "Changed Name" },
    });

    expect(result).toEqual({ kind: "idempotency_conflict" });
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.loadInventory).not.toHaveBeenCalled();
  });

  it("does not create a booking when a replay-only check finds no matching key", async () => {
    mocks.findBooking.mockResolvedValue([]);
    const noDateRequest = LegacyBookingReplaySchema.parse({
      ...request,
      selection: { dandiya_sticks: { quantity: 1 } },
      booker: { ...request.booker, isAttendingAsAdult: false },
    });

    expect(await replayBooking(noDateRequest)).toEqual({ kind: "not_found" });
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.loadInventory).not.toHaveBeenCalled();
  });

  it.each([
    {
      selection: { dandiya_sticks: { quantity: 1 } },
      attendees: { adults: [], children: [], toddlers: [] },
    },
    {
      selection: { all_day_child: { quantity: 1 } },
      attendees: {
        adults: [],
        children: [{ id: "c1", fullName: "Mira", age: 8 }],
        toddlers: [],
      },
    },
  ])("never creates a date-free order through the replay-only API", async (order) => {
    mocks.findBooking.mockResolvedValue([]);
    const noDateRequest = {
      ...request,
      ...order,
      booker: { ...request.booker, isAttendingAsAdult: false },
    };
    const response = await app.request("/api/bookings/replay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(noDateRequest),
    });

    expect(response.status).toBe(404);
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.loadInventory).not.toHaveBeenCalled();
  });
});
