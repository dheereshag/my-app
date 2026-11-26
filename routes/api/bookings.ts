import { defineHandler } from "void";
import { z } from "zod";
import { CreateBookingRequestSchema } from "@/domain";
import { LegacyBookingReplaySchema } from "@/domain/legacy-booking";
import { createBooking, replayBooking } from "@/server/create-booking";

const BookingRequestSchema = z.union([
  CreateBookingRequestSchema.transform((request) => ({ kind: "current" as const, request })),
  LegacyBookingReplaySchema.transform((request) => ({ kind: "legacy" as const, request })),
]);

export const POST = defineHandler.withValidator({ body: BookingRequestSchema })(async (
  c,
  { body },
) => {
  if (body.kind === "legacy") {
    const replay = await replayBooking(body.request);
    if (replay.kind === "replayed") {
      return c.json(replay.confirmation, 200);
    }
    if (replay.kind === "idempotency_conflict") {
      return c.json(
        {
          error: "Idempotency key reused",
          code: "idempotency_conflict" as const,
          message: "This booking reference was already used for a different request.",
        },
        409,
      );
    }
    return c.json(
      {
        error: "Previous dates unavailable",
        code: "previous_dates" as const,
        message:
          "No matching previous booking was found. New bookings need current dates and valid attendee details.",
      },
      400,
    );
  }

  const outcome = await createBooking(body.request);

  switch (outcome.kind) {
    case "created":
      return c.json(outcome.confirmation, 201);
    case "replayed":
      return c.json(outcome.confirmation, 200);
    case "idempotency_conflict":
      return c.json(
        {
          error: "Idempotency key reused",
          code: "idempotency_conflict" as const,
          message:
            "This booking reference was already used for a different request. Start a new booking.",
        },
        409,
      );
    case "stock_conflict":
      return c.json(
        {
          error: "Availability changed",
          code: "stock_conflict" as const,
          message: "Some of your tickets are no longer available. Nothing was charged.",
          issues: outcome.issues,
        },
        409,
      );
    case "promo_rejected":
      return c.json(
        {
          error: "Promo code not usable",
          code: "promo_rejected" as const,
          message: outcome.message,
        },
        422,
      );
    case "event_closed":
      return c.json(
        {
          error: "Event closed",
          code: "event_closed" as const,
          message: outcome.message,
        },
        410,
      );
  }
});
