import { useEffect } from "react";
import { useBookingStore } from "@/store/booking-store";

/**
 * The page is server-rendered, so the saved draft is read from sessionStorage
 * after mount. A refresh, or a dropped connection, never loses what was typed.
 */
export function useRestoreBooking(): void {
  useEffect(() => {
    void useBookingStore.persist.rehydrate();
  }, []);
}
