import { defineHandler } from "void";
import { CreateBookingRequestSchema } from "@/domain";
import { createBooking } from "@/server/create-booking";

export const POST = defineHandler.withValidator({ body: CreateBookingRequestSchema })(async (
  c,
  { body },
) => {
  const outcome = await createBooking(body);

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
