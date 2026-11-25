import { defineHandler, defineHead, type InferProps } from "void";
import { isEventBookingClosed } from "@/domain";
import { listAvailability } from "@/server/inventory";
import { loadInventory } from "@/server/inventory-store";

export type Props = InferProps<typeof loader>;

/** Live stock for the first paint; the booking itself re-checks everything on the server. */
export const loader = defineHandler(async () => {
  const bookingClosed = isEventBookingClosed();
  return {
    bookingClosed,
    availability: bookingClosed ? [] : listAvailability(await loadInventory()),
  };
});

export const head = defineHead<Props>(() => ({
  title: "Book tickets | Sharad Utsav 2026",
  meta: [
    {
      name: "description",
      content:
        "Book family tickets, dinner and workshop places for Sharad Utsav 2026 at Radha Krishna Temple, Allen, Texas.",
    },
  ],
}));
