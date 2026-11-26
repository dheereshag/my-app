import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { BookingConfirmation } from "../src/server/confirmation";

const api = vi.hoisted(() => ({
  postBooking: vi.fn(),
  checkPreviousBooking: vi.fn(),
}));
vi.mock("../src/store/booking-api", () => api);

const storage = new Map<string, string>();
vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});

const { useBookingStore } = await import("../src/store/booking-store");
const storageKey = "sharad-utsav-2026-booking";

const oldDraft = {
  selection: {
    day_pass_adult: { quantity: 1, days: ["2026-11-11"] },
    day_pass_child: { quantity: 0, days: [] },
    all_day_adult: { quantity: 0 },
    all_day_child: { quantity: 0 },
    family_pass: { quantity: 0, days: [] },
    dandiya_sticks: { quantity: 0 },
    dinner_plate: { quantity: 0, days: [] },
    garba_workshop: { quantity: 0, days: [] },
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
  idempotencyKey: "booking-original",
  confirmation: null,
};

const oldConfirmation: BookingConfirmation = {
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

describe("previous booking drafts", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    useBookingStore.getState().startOver();
  });

  it("keeps an old unfinished draft across migration and refresh", async () => {
    storage.set(storageKey, JSON.stringify({ state: oldDraft, version: 1 }));
    await useBookingStore.persist.rehydrate();

    expect(useBookingStore.getState().previousDraft).toMatchObject(oldDraft);
    await useBookingStore.persist.rehydrate();
    expect(useBookingStore.getState().previousDraft?.idempotencyKey).toBe("booking-original");
  });

  it("checks the original request and restores its confirmation", async () => {
    storage.set(storageKey, JSON.stringify({ state: oldDraft, version: 1 }));
    await useBookingStore.persist.rehydrate();
    api.checkPreviousBooking.mockResolvedValue({ ok: true, confirmation: oldConfirmation });

    await useBookingStore.getState().checkPreviousBooking();

    expect(api.checkPreviousBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "booking-original",
        promoCode: "SEVA10",
        selection: expect.objectContaining({
          day_pass_adult: { quantity: 1, days: ["2026-11-11"] },
        }),
      }),
    );
    expect(useBookingStore.getState().confirmation).toEqual(oldConfirmation);
    expect(useBookingStore.getState().step).toBe("confirmed");
    expect(api.postBooking).not.toHaveBeenCalled();
  });

  it("retains a draft when a check fails or the details are incomplete", async () => {
    storage.set(storageKey, JSON.stringify({ state: oldDraft, version: 1 }));
    await useBookingStore.persist.rehydrate();
    api.checkPreviousBooking.mockResolvedValue({ ok: false, message: "No booking found yet." });

    await useBookingStore.getState().checkPreviousBooking();
    expect(useBookingStore.getState().previousCheck).toEqual({
      status: "failed",
      message: "No booking found yet.",
    });
    expect(useBookingStore.getState().previousDraft?.idempotencyKey).toBe("booking-original");

    storage.set(
      storageKey,
      JSON.stringify({
        state: { ...oldDraft, booker: { ...oldDraft.booker, fullName: "" } },
        version: 1,
      }),
    );
    await useBookingStore.persist.rehydrate();
    api.checkPreviousBooking.mockClear();
    await useBookingStore.getState().checkPreviousBooking();
    expect(api.checkPreviousBooking).not.toHaveBeenCalled();
    expect(useBookingStore.getState().previousCheck).toMatchObject({ status: "failed" });
    expect(useBookingStore.getState().previousDraft?.idempotencyKey).toBe("booking-original");
  });

  it("restores a previously confirmed booking with its original dates", async () => {
    storage.set(
      storageKey,
      JSON.stringify({ state: { ...oldDraft, confirmation: oldConfirmation }, version: 1 }),
    );
    await useBookingStore.persist.rehydrate();

    expect(useBookingStore.getState().step).toBe("confirmed");
    expect(useBookingStore.getState().confirmation?.lines[0].days).toEqual(["2026-11-11"]);
  });

  it("checks a date-free old draft without creating a booking", async () => {
    const dateFree = {
      ...oldDraft,
      selection: {
        ...oldDraft.selection,
        day_pass_adult: { quantity: 0, days: [] },
        all_day_child: { quantity: 1 },
      },
      attendees: {
        adults: [],
        children: [{ id: "c1", fullName: "Mira", age: 8 }],
        toddlers: [],
      },
    };
    storage.set(storageKey, JSON.stringify({ state: dateFree, version: 1 }));
    await useBookingStore.persist.rehydrate();
    api.checkPreviousBooking.mockResolvedValue({ ok: false, message: "No booking found yet." });

    await useBookingStore.getState().checkPreviousBooking();

    expect(api.checkPreviousBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        booker: expect.objectContaining({ isAttendingAsAdult: false }),
        selection: expect.objectContaining({ all_day_child: { quantity: 1 } }),
      }),
    );
    expect(api.postBooking).not.toHaveBeenCalled();
    expect(useBookingStore.getState().previousDraft?.idempotencyKey).toBe("booking-original");
  });

  it("preserves an older toddler request that had no attendance dates", async () => {
    const older = {
      ...oldDraft,
      attendees: {
        adults: [],
        children: [],
        toddlers: [{ id: "t1", fullName: "Kiran", age: 2 }],
      },
    };
    storage.set(storageKey, JSON.stringify({ state: older, version: 1 }));
    await useBookingStore.persist.rehydrate();
    api.checkPreviousBooking.mockResolvedValue({ ok: false, message: "No booking found yet." });

    await useBookingStore.getState().checkPreviousBooking();

    expect(api.checkPreviousBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        attendees: expect.objectContaining({
          toddlers: [{ id: "t1", fullName: "Kiran", age: 2 }],
        }),
      }),
    );
  });

  it("leaves an unreadable saved draft untouched", async () => {
    const saved = JSON.stringify({ state: { ...oldDraft, selection: null }, version: 1 });
    storage.set(storageKey, saved);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await useBookingStore.persist.rehydrate();

    expect(useBookingStore.persist.hasHydrated()).toBe(false);
    expect(storage.get(storageKey)).toBe(saved);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
