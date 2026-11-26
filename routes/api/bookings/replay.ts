import { defineHandler } from "void";
import { z } from "zod";
import { CreateBookingRequestSchema } from "@/domain";
import { LegacyBookingReplaySchema } from "@/domain/legacy-booking";
import { replayBooking } from "@/server/create-booking";

export const POST = defineHandler.withValidator({
  body: z.union([CreateBookingRequestSchema, LegacyBookingReplaySchema]),
})(async (c, { body }) => {
  const outcome = await replayBooking(body);
  switch (outcome.kind) {
    case "replayed":
      return c.json(outcome.confirmation, 200);
    case "idempotency_conflict":
      return c.json(
        {
          error: "Idempotency key reused",
          code: "idempotency_conflict" as const,
          message: "The previous booking does not match these details.",
        },
        409,
      );
    case "not_found":
      return c.json(
        {
          error: "Booking not found",
          code: "booking_not_found" as const,
          message: "No completed booking was found for these details.",
        },
        404,
      );
  }
});
