import { getRequiredAttendeeCounts } from "../domain";
import { LegacyDraftRequestSchema } from "../domain/legacy-booking";
import { checkPreviousBooking, type ReplayCheckResult } from "./booking-api";
import type { LegacyPersistedDraft } from "./persisted-draft";

export type PreviousCheckState =
  | { readonly status: "idle" }
  | { readonly status: "checking" }
  | { readonly status: "failed"; readonly message: string };

export async function checkSavedBooking(
  previous: LegacyPersistedDraft,
): Promise<ReplayCheckResult> {
  const parsed = LegacyDraftRequestSchema.safeParse({
    idempotencyKey: previous.idempotencyKey,
    selection: previous.selection,
    promoCode: previous.promoCode,
    booker: {
      ...previous.booker,
      isAttendingAsAdult:
        previous.booker.isAttendingAsAdult &&
        getRequiredAttendeeCounts(previous.selection).adults > 0,
    },
    attendees: previous.attendees,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message:
        "This draft is incomplete, so we can't check it. Please contact the organizer before starting over.",
    };
  }
  return checkPreviousBooking(parsed.data);
}
