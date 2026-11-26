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
  getCoveredFestivalDays,
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
  EMPTY_BOOKER,
  createRandomId,
  isBookerAttendingAsAdult,
  validateDraft,
  type BookerDraft,
} from "./booking-request";
import {
  PersistedDraftSchema,
  PreviousDraftMigrationSchema,
  type LegacyPersistedDraft,
} from "./persisted-draft";
import { checkSavedBooking, type PreviousCheckState } from "./previous-booking";
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
  readonly previousDraft: LegacyPersistedDraft | null;
  readonly previousCheck: PreviousCheckState;
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
  checkPreviousBooking: () => Promise<void>;
  submitBooking: () => Promise<void>;
  startOver: () => void;
}

export type BookingStore = BookingState & BookingActions;

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
    previousDraft: null,
    previousCheck: { status: "idle" },
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
          const selection = updateSelection(state.selection, patch, state.attendees.toddlers);
          const coveredDays = new Set(getCoveredFestivalDays(selection));
          const attendees = {
            ...state.attendees,
            toddlers: state.attendees.toddlers.map((toddler) => ({
              ...toddler,
              attendingDays: toddler.attendingDays.filter((day) => coveredDays.has(day)),
            })),
          };
          const adjustedSelection = updateSelection(selection, {}, attendees.toddlers);
          return {
            selection: adjustedSelection,
            attendees: reconcileFor(adjustedSelection, state.booker, attendees),
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
          const toddler = {
            id: createRandomId("toddler"),
            fullName: "",
            age: undefined,
            attendingDays: [],
          };
          const attendees = {
            ...state.attendees,
            toddlers: [...state.attendees.toddlers, toddler],
          };
          return {
            selection: updateSelection(state.selection, {}, attendees.toddlers),
            attendees,
          };
        }),

      updateToddler: (id, patch) =>
        set((state) => {
          const attendees = {
            ...state.attendees,
            toddlers: replaceById(state.attendees.toddlers, id, patch),
          };
          return {
            selection: updateSelection(state.selection, {}, attendees.toddlers),
            attendees,
          };
        }),

      removeToddler: (id) =>
        set((state) => {
          const toddlers = state.attendees.toddlers.filter((toddler) => toddler.id !== id);
          // Fewer people can eat dinner, so extras may need trimming too.
          const selection = updateSelection(state.selection, {}, toddlers);
          return { selection, attendees: { ...state.attendees, toddlers } };
        }),

      checkPreviousBooking: async () => {
        const state = get();
        const previous = state.previousDraft;
        if (previous === null || state.previousCheck.status === "checking") {
          return;
        }
        set({ previousCheck: { status: "checking" } });
        const result = await checkSavedBooking(previous);
        if (!result.ok) {
          set({ previousCheck: { status: "failed", message: result.message } });
          return;
        }
        set({
          previousDraft: { ...previous, confirmation: result.confirmation },
          confirmation: result.confirmation,
          previousCheck: { status: "idle" },
          step: "confirmed",
        });
      },

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
      version: 2,
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
        previousDraft: state.previousDraft,
      }),
      migrate: (persisted, version) => {
        if (version !== 1) {
          throw new Error(`Unsupported saved booking version: ${version}`);
        }
        return PreviousDraftMigrationSchema.parse(persisted);
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error("Could not restore the saved booking.", error);
        }
      },
      merge: (persisted, current) => {
        if (persisted === undefined) {
          return current;
        }
        const parsed = PersistedDraftSchema.parse(persisted);
        return {
          ...current,
          ...parsed,
          step: parsed.confirmation ? "confirmed" : current.step,
        };
      },
    },
  ),
);
