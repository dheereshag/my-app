import { useEffect, useState } from "react";
import { useBookingStore } from "@/store/booking-store";

/**
 * The page is server-rendered, so the saved draft is read from sessionStorage
 * after mount. A refresh, or a dropped connection, never loses what was typed.
 */
export function useRestoreBooking(): { failed: boolean; clearFailure: () => void } {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void useBookingStore.persist.rehydrate().then(
      () => {
        if (active && !useBookingStore.persist.hasHydrated()) {
          setFailed(true);
        }
      },
      (error: unknown) => {
        console.error("Could not restore the saved booking.", error);
        if (active) {
          setFailed(true);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return { failed, clearFailure: () => setFailed(false) };
}
