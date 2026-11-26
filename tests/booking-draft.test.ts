import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createEmptySelection } from "../src/domain";
import type { BookingConfirmation } from "../src/server/confirmation";
import { parseQuoteRequest, validateDraft, type BookingDraft } from "../src/store/booking-request";
import { PersistedDraftSchema } from "../src/store/persisted-draft";
import { updateSelection } from "../src/store/selection";

const postBooking = vi.hoisted(() => vi.fn());

vi.mock("../src/store/booking-api", () => ({ postBooking }));

// sessionStorage does not exist in Node; the store persists drafts there.
vi.stubGlobal("sessionStorage", {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
});

const { useBookingStore } = await import("../src/store/booking-store");

const CONFIRMATION: BookingConfirmation = {
  reference: "SU26-TEST1234",
  status: "confirmed",
  payment: { method: "simulated", status: "paid", amountCents: 3000 },
  booker: { fullName: "Asha Patel", email: "asha@example.com" },
  lines: [],
  subtotalCents: 3000,
  discountCents: 0,
  totalCents: 3000,
  promoCode: null,
  attendees: [],
};

function store() {
  return useBookingStore.getState();
}

describe("booking request and draft compatibility", () => {
  it("cleans the draft promo without sending a stale nested code or client prices", () => {
    const draft: BookingDraft = {
      selection: {
        ...createEmptySelection(),
        day_pass_adult: { quantity: 1, days: ["2026-11-27"] },
        promoCode: "STALE".repeat(10),
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

    const booking = validateDraft(draft, "booking-original");
    expect(booking.valid).toBe(true);
    if (!booking.valid) return;
    expect(booking.request.promoCode).toBe("SEVA10");
    expect(booking.request.selection).not.toHaveProperty("promoCode");
    expect(parseQuoteRequest({ ...draft, promoCode: "  " })?.promoCode).toBeNull();
    const blankPromo = validateDraft({ ...draft, promoCode: "  " }, "booking-original");
    expect(blankPromo.valid && blankPromo.request.promoCode).toBeNull();

    const unsorted = validateDraft(
      {
        ...draft,
        selection: {
          ...draft.selection,
          day_pass_adult: { quantity: 1, days: ["2026-11-29", "2026-11-27"] },
        },
      },
      "booking-original",
    );
    expect(unsorted.valid && unsorted.request.selection.day_pass_adult.days).toEqual([
      "2026-11-29",
      "2026-11-27",
    ]);

    const tampered = { ...draft, selection: { ...draft.selection, totalCents: 1 } };
    expect(validateDraft(tampered, "booking-original").valid).toBe(false);
  });

  it("restores older drafts and confirmations without toddler attendance dates", () => {
    const saved = PersistedDraftSchema.safeParse({
      selection: createEmptySelection(),
      promoCode: "",
      booker: {
        fullName: "Asha Patel",
        email: "asha@example.com",
        phone: "214 555 0101",
        age: 40,
        isAttendingAsAdult: true,
      },
      attendees: {
        adults: [],
        children: [],
        toddlers: [{ id: "t1", fullName: "Mira", age: 3 }],
      },
      idempotencyKey: "booking-original",
      confirmation: {
        ...CONFIRMATION,
        attendees: [{ kind: "toddler", fullName: "Mira", age: 3 }],
      },
    });

    expect(saved.success).toBe(true);
    if (!saved.success) return;
    expect(saved.data.idempotencyKey).toBe("booking-original");
    expect(saved.data.attendees.toddlers[0].attendingDays).toEqual([]);
    expect(saved.data.confirmation?.attendees[0].attendingDays).toBeNull();
  });
});

describe("updateSelection keeps a selection self-consistent", () => {
  const base = createEmptySelection();

  it("clears days when a day ticket quantity drops to zero", () => {
    const withTickets = updateSelection(
      base,
      { day_pass_adult: { quantity: 2, days: ["2026-11-27"] } },
      [],
    );
    const cleared = updateSelection(withTickets, { day_pass_adult: { quantity: 0, days: [] } }, []);
    expect(cleared.day_pass_adult).toEqual({ quantity: 0, days: [] });
  });

  it("drops dinner and workshop days that no entry ticket covers any more", () => {
    const full = updateSelection(
      base,
      {
        day_pass_adult: { quantity: 2, days: ["2026-11-27", "2026-11-28"] },
        dinner_plate: { quantity: 2, days: ["2026-11-27", "2026-11-28"] },
        garba_workshop: { quantity: 1, days: ["2026-11-27"] },
      },
      [],
    );
    const narrowed = updateSelection(
      full,
      { day_pass_adult: { quantity: 2, days: ["2026-11-28"] } },
      [],
    );
    expect(narrowed.dinner_plate.days).toEqual(["2026-11-28"]);
    expect(narrowed.garba_workshop).toEqual({ quantity: 0, days: [] });
  });

  it("caps dinner plates to the people in the booking and workshop places to ticket holders", () => {
    const selection = updateSelection(
      base,
      {
        day_pass_adult: { quantity: 2, days: ["2026-11-27"] },
        dinner_plate: { quantity: 9, days: ["2026-11-27"] },
        garba_workshop: { quantity: 9, days: ["2026-11-27"] },
      },
      [
        {
          id: "toddler-1",
          fullName: "Mira",
          age: 2,
          attendingDays: ["2026-11-27"],
        },
      ],
    );
    expect(selection.dinner_plate.quantity).toBe(3); // 2 ticketed + 1 toddler
    expect(selection.garba_workshop.quantity).toBe(2); // toddlers cannot take the workshop
  });

  it("uses the smallest attendance count across selected extra days", () => {
    const selection = updateSelection(
      base,
      {
        day_pass_adult: { quantity: 2, days: ["2026-11-27", "2026-11-28"] },
        dinner_plate: { quantity: 5, days: ["2026-11-27", "2026-11-28"] },
      },
      [],
    );
    expect(selection.dinner_plate.quantity).toBe(2);
  });
});

describe("booking store", () => {
  beforeEach(() => {
    postBooking.mockReset();
    store().startOver();
  });

  it("keeps the attendee list matched to the tickets as the person changes their mind", () => {
    store().setSelection({ day_pass_adult: { quantity: 3, days: ["2026-11-27"] } });
    expect(store().attendees.adults).toHaveLength(2); // booker attends as the third adult

    const firstId = store().attendees.adults[0]?.id ?? "";
    store().updateAdult(firstId, { fullName: "Ravi Patel", age: 42 });

    store().setSelection({ day_pass_child: { quantity: 2, days: ["2026-11-27"] } });
    expect(store().attendees.children).toHaveLength(2);

    store().setSelection({ day_pass_adult: { quantity: 2, days: ["2026-11-27"] } });
    expect(store().attendees.adults).toHaveLength(1);
    expect(store().attendees.adults[0]).toMatchObject({ id: firstId, fullName: "Ravi Patel" });

    store().setBooker({ isAttendingAsAdult: false });
    expect(store().attendees.adults).toHaveLength(2);

    store().setSelection(createEmptySelection());
    expect(store().attendees).toEqual({ adults: [], children: [], toddlers: [] });
  });

  it("clears toddler dates when entry coverage is removed", () => {
    store().setSelection({
      day_pass_adult: { quantity: 2, days: ["2026-11-27", "2026-11-28"] },
    });
    store().addToddler();
    const toddlerId = store().attendees.toddlers[0]?.id ?? "";
    store().updateToddler(toddlerId, { attendingDays: ["2026-11-27", "2026-11-28"] });

    store().setSelection({
      day_pass_adult: { quantity: 2, days: ["2026-11-28"] },
    });

    expect(store().attendees.toddlers[0]?.attendingDays).toEqual(["2026-11-28"]);
  });

  it("sends the same booking only once when Pay is clicked twice", async () => {
    store().setSelection({ day_pass_adult: { quantity: 2, days: ["2026-11-27"] } });
    store().setBooker({
      fullName: "Asha Patel",
      email: "asha@example.com",
      phone: "214 555 0101",
      age: 40,
    });
    const adultId = store().attendees.adults[0]?.id ?? "";
    store().updateAdult(adultId, { fullName: "Ravi Patel", age: 42 });

    let finish: (value: { ok: true; confirmation: BookingConfirmation }) => void = () => undefined;
    postBooking.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    const first = store().submitBooking();
    const second = store().submitBooking();
    expect(store().submit.status).toBe("submitting");

    finish({ ok: true, confirmation: CONFIRMATION });
    await Promise.all([first, second]);

    expect(postBooking).toHaveBeenCalledTimes(1);
    expect(store().step).toBe("confirmed");
    expect(store().confirmation?.reference).toBe("SU26-TEST1234");
  });

  it("does not call the server for an incomplete booking", async () => {
    store().setSelection({ day_pass_adult: { quantity: 2, days: ["2026-11-27"] } });
    await store().submitBooking();
    expect(postBooking).not.toHaveBeenCalled();
    expect(store().submit).toMatchObject({ status: "failed", failure: { reason: "invalid" } });
  });

  it("returns to the tickets step when stock changed, and keeps the same key for retries", async () => {
    store().setSelection({ day_pass_adult: { quantity: 2, days: ["2026-11-27"] } });
    store().setBooker({
      fullName: "Asha Patel",
      email: "asha@example.com",
      phone: "214 555 0101",
      age: 40,
    });
    const adultId = store().attendees.adults[0]?.id ?? "";
    store().updateAdult(adultId, { fullName: "Ravi Patel", age: 42 });
    store().setStep("review");
    const key = store().idempotencyKey;

    postBooking.mockResolvedValue({
      ok: false,
      failure: { reason: "stock", message: "Some tickets are gone.", details: [] },
    });
    await store().submitBooking();

    expect(store().step).toBe("tickets");
    expect(store().idempotencyKey).toBe(key);
  });
});
