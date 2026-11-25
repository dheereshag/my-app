/**
 * Single owner of the booking flow's client state (see docs/zustand/persist.md).
 * Business rules live in ../domain and ./selection; this file only wires them to
 * user actions and makes sure the attendee list always matches the tickets.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  MAX_TODDLERS_PER_BOOKING,
  createEmptySelection,
  getRequiredAttendeeCounts,
  reconcileAttendees,
  type AttendeeGroupDraft,
  type PartialTicketSelection,
  type ReconciledAttendeeGroup,
  type TicketSelection,
} from "../domain";
import type { BookingConfirmation } from "../server/confirmation";
import { postBooking, type BookingFailure } from "./booking-api";
import {
  createRandomId,
  isBookerAttendingAsAdult,
  validateDraft,
  type BookerDraft,
} from "./booking-request";
import { PersistedDraftSchema } from "./persisted-draft";
import { updateSelection } from "./selection";

export type Step = "tickets" | "group" | "review" | "confirmed";

export type SubmitState =
  | { readonly status: "idle" }
  | { readonly status: "submitting" }
  | { readonly status: "failed"; readonly failure: BookingFailure };

type AdultDraft = ReconciledAttendeeGroup["adults"][number];
type ChildDraft = ReconciledAttendeeGroup["children"][number];
type ToddlerDraft = ReconciledAttendeeGroup["toddlers"][number];

interface BookingState {
  readonly step: Step;
  readonly selection: TicketSelection;
  readonly promoCode: string;
  readonly booker: BookerDraft;
  readonly attendees: ReconciledAttendeeGroup;
  readonly idempotencyKey: string;
  readonly confirmation: BookingConfirmation | null;
  readonly submit: SubmitState;
}

interface BookingActions {
  setStep: (step: Step) => void;
  setSelection: (patch: PartialTicketSelection) => void;
  setPromoCode: (promoCode: string) => void;
  setBooker: (patch: Partial<BookerDraft>) => void;
  updateAdult: (id: string, patch: Partial<Omit<AdultDraft, "id">>) => void;
  updateChild: (id: string, patch: Partial<Omit<ChildDraft, "id">>) => void;
  addToddler: () => void;
  updateToddler: (id: string, patch: Partial<Omit<ToddlerDraft, "id">>) => void;
  removeToddler: (id: string) => void;
  submitBooking: () => Promise<void>;
  startOver: () => void;
}

export type BookingStore = BookingState & BookingActions;

const EMPTY_BOOKER: BookerDraft = {
  fullName: "",
  email: "",
  phone: "",
  age: undefined,
  isAttendingAsAdult: true,
};

function freshState(): BookingState {
  return {
    step: "tickets",
    selection: createEmptySelection(),
    promoCode: "",
    booker: EMPTY_BOOKER,
    attendees: { adults: [], children: [], toddlers: [] },
    idempotencyKey: createRandomId("booking"),
    confirmation: null,
    submit: { status: "idle" },
  };
}

/** Resizes the adult and child lists to the tickets, keeping what has been typed. */
function reconcileFor(
  selection: TicketSelection,
  booker: BookerDraft,
  attendees: AttendeeGroupDraft,
): ReconciledAttendeeGroup {
  const { adults, children } = getRequiredAttendeeCounts(selection);
  return reconcileAttendees(attendees, adults, children, {
    isAttendingAsAdult: isBookerAttendingAsAdult({ selection, booker, promoCode: "", attendees }),
  });
}

function replaceById<T extends { readonly id: string }>(
  items: readonly T[],
  id: string,
  patch: Partial<Omit<T, "id">>,
): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export const useBookingStore = create<BookingStore>()(
  persist(
    (set, get) => ({
      ...freshState(),

      setStep: (step) => set({ step }),

      setSelection: (patch) =>
        set((state) => {
          const selection = updateSelection(
            state.selection,
            patch,
            state.attendees.toddlers.length,
          );
          return {
            selection,
            attendees: reconcileFor(selection, state.booker, state.attendees),
            submit: { status: "idle" },
          };
        }),

      setPromoCode: (promoCode) => set({ promoCode, submit: { status: "idle" } }),

      setBooker: (patch) =>
        set((state) => {
          const booker = { ...state.booker, ...patch };
          return { booker, attendees: reconcileFor(state.selection, booker, state.attendees) };
        }),

      updateAdult: (id, patch) =>
        set((state) => ({
          attendees: {
            ...state.attendees,
            adults: replaceById(state.attendees.adults, id, patch),
          },
        })),

      updateChild: (id, patch) =>
        set((state) => ({
          attendees: {
            ...state.attendees,
            children: replaceById(state.attendees.children, id, patch),
          },
        })),

      addToddler: () =>
        set((state) => {
          if (state.attendees.toddlers.length >= MAX_TODDLERS_PER_BOOKING) {
            return state;
          }
          const toddler = { id: createRandomId("toddler"), fullName: "", age: undefined };
          return {
            attendees: { ...state.attendees, toddlers: [...state.attendees.toddlers, toddler] },
          };
        }),

      updateToddler: (id, patch) =>
        set((state) => ({
          attendees: {
            ...state.attendees,
            toddlers: replaceById(state.attendees.toddlers, id, patch),
          },
        })),

      removeToddler: (id) =>
        set((state) => {
          const toddlers = state.attendees.toddlers.filter((toddler) => toddler.id !== id);
          // Fewer people can eat dinner, so extras may need trimming too.
          const selection = updateSelection(state.selection, {}, toddlers.length);
          return { selection, attendees: { ...state.attendees, toddlers } };
        }),

      submitBooking: async () => {
        // Single flight: a second click while a request is running does nothing.
        if (get().submit.status === "submitting") {
          return;
        }
        const state = get();
        const validation = validateDraft(state, state.idempotencyKey);
        if (!validation.valid) {
          set({
            submit: {
              status: "failed",
              failure: {
                reason: "invalid",
                message: "Some details need another look. Please review them.",
              },
            },
          });
          return;
        }

        set({ submit: { status: "submitting" } });
        const result = await postBooking(validation.request);

        if (result.ok) {
          set({ confirmation: result.confirmation, step: "confirmed", submit: { status: "idle" } });
          return;
        }
        // Tickets or promo changed under the customer: send them back to fix it.
        const needsTicketChange =
          result.failure.reason === "stock" || result.failure.reason === "promo";
        set({
          submit: { status: "failed", failure: result.failure },
          ...(needsTicketChange ? { step: "tickets" as const } : {}),
        });
      },

      startOver: () => set(freshState()),
    }),
    {
      name: "sharad-utsav-2026-booking",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      // The page is server-rendered, so storage is read after mount (see useRestoreBooking).
      skipHydration: true,
      partialize: (state) => ({
        selection: state.selection,
        promoCode: state.promoCode,
        booker: state.booker,
        attendees: state.attendees,
        idempotencyKey: state.idempotencyKey,
        confirmation: state.confirmation,
      }),
      merge: (persisted, current) => {
        const parsed = PersistedDraftSchema.safeParse(persisted);
        if (!parsed.success) {
          return current;
        }
        return {
          ...current,
          ...parsed.data,
          step: parsed.data.confirmation ? "confirmed" : current.step,
        };
      },
    },
  ),
);
