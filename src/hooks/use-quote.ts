import { useCallback, useEffect, useState } from "react";
import { fetchQuote } from "@/store/booking-api";
import { parseQuoteRequest } from "@/store/booking-request";
import { useBookingStore } from "@/store/booking-store";
import type { QuoteResponse } from "@/server/quote";

/** What the order summary can show. The total always comes from the server. */
export type QuoteState =
  | { readonly status: "incomplete" }
  | { readonly status: "loading"; readonly previous: QuoteResponse | null }
  | { readonly status: "ready"; readonly quote: QuoteResponse }
  | { readonly status: "failed" };

const DEBOUNCE_MS = 250;

export function useQuote(): { readonly state: QuoteState; readonly retry: () => void } {
  const selection = useBookingStore((store) => store.selection);
  const promoCode = useBookingStore((store) => store.promoCode);
  const [state, setState] = useState<QuoteState>({ status: "incomplete" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = parseQuoteRequest({ selection, promoCode });
    if (request === null) {
      setState({ status: "incomplete" });
      return;
    }

    const controller = new AbortController();
    setState((current) => ({
      status: "loading",
      previous: current.status === "ready" ? current.quote : null,
    }));

    const timer = setTimeout(() => {
      fetchQuote(request, controller.signal).then(
        (quote) => setState({ status: "ready", quote }),
        () => {
          if (!controller.signal.aborted) {
            setState({ status: "failed" });
          }
        },
      );
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selection, promoCode, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, retry };
}
