# Sharad Utsav 2026: festival booking

A family books tickets, tells us who is coming, pays, and gets a confirmation, all on the homepage.
Built with [Void](https://void.cloud) (Vite + Cloudflare Workers + D1), React, Zustand and Zod.
The festival runs Nov 26–Dec 10, 2026.

```bash
pnpm install
pnpm exec void db migrate   # create the tables in the local D1 database
pnpm dev                    # http://localhost:5173
pnpm test                   # unit tests
pnpm type-check && pnpm exec vp lint && pnpm exec vp fmt --check && pnpm build
```

Stock and promo rows are created from the catalog on first use, so there is no seed step.

## How it is put together

| Layer         | Where                                                     | What it owns                                                                                              |
| ------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Domain (pure) | `src/domain/`                                             | Catalog, prices in integer cents, ages, promo rules, quote maths, Zod schemas. No UI, no database.        |
| Server        | `src/server/`, `routes/api/`, `db/`                       | Loads live stock, decides whether a booking can be sold, writes it atomically.                            |
| Client state  | `src/store/`                                              | One Zustand store for the flow, plus pure helpers for keeping the selection and attendee list consistent. |
| UI            | `src/components/booking/`, `src/components/ui/`, `pages/` | Presentation only. Prices on screen come from the server.                                                 |

Rules live in the domain and are shared: the browser runs the same Zod schemas to show inline errors early, and the
server runs them again on every request. A request that skips the page hits the same rules.

## API

All bodies are JSON. Money is always integer cents. Validation failures use Void's shape
`400 { "error": "Validation failed", "issues": [{ "slot": "body", "issues": [{ "message", "path" }] }] }`.
Other errors use `{ "error", "code", "message", ... }`.

| Method and path             | Purpose                                                           | Success                                                                                                              | Errors                                                                                                       |
| --------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `GET /api/availability`     | Units left per SKU (display only)                                 | `200 { items: [{ sku, remaining }] }`                                                                                |                                                                                                              |
| `POST /api/quote`           | The price of a selection, with promo and stock checked            | `200` [Quote](#quote)                                                                                                | `400` validation                                                                                             |
| `POST /api/bookings`        | Re-validate everything, reserve stock, store the booking, confirm | `201` [Confirmation](#confirmation); `200` same body if the idempotency key was already used by an identical request | `400` validation, `409 stock_conflict`, `409 idempotency_conflict`, `410 event_closed`, `422 promo_rejected` |
| `POST /api/bookings/replay` | Check an existing booking without creating or changing one        | `200` original [Confirmation](#confirmation)                                                                         | `400` validation, `404 booking_not_found`, `409 idempotency_conflict`                                        |

### Request bodies

```jsonc
// POST /api/quote
{
  "selection": {
    "day_pass_adult":  { "quantity": 2, "days": ["2026-11-27"] },
    "day_pass_child":  { "quantity": 0, "days": [] },
    "all_day_adult":   { "quantity": 0 },
    "all_day_child":   { "quantity": 0 },
    "family_pass":     { "quantity": 0, "days": [] },
    "dandiya_sticks":  { "quantity": 0 },
    "dinner_plate":    { "quantity": 0, "days": [] },
    "garba_workshop":  { "quantity": 0, "days": [] }   // days only "2026-11-27" or "2026-11-29"
  },
  "promoCode": "SEVA10"                                  // optional, null for none
}

// POST /api/bookings
{
  "idempotencyKey": "booking-ab12...",                   // 1 to 128 chars, one per booking attempt
  "selection": { /* as above */ },
  "promoCode": null,
  "booker":    { "fullName", "email", "phone", "age", "isAttendingAsAdult" },
  "attendees": {
    "adults":   [{ "id", "fullName", "age", "phone"? }],  // everyone aged 12+ except the booker
    "children": [{ "id", "fullName", "age" }],            // ages 5 to 11
    "toddlers": [{ "id", "fullName", "age", "attendingDays": ["2026-11-27"] }] // ages 0 to 4, free, no ticket
  }
}
```

The replay endpoint accepts the same booking body, including a request for the previous Nov 10–14 dates.
It only returns an existing matching booking; it never creates one or changes stock. A previous-date request
to `/api/bookings` can also replay an existing matching booking, but cannot create a new booking.

The request schemas are strict: an unknown field (`totalCents`, `priceCents`, ...) is a `400`, never ignored.

### Quote

```jsonc
{
  "currency": "USD",
  "lines": [{ "sku", "label", "quantity", "days": [], "unitPriceCents", "subtotalCents", "discountCents", "totalCents" }],
  "subtotalCents": 3000, "discountCents": 300, "totalCents": 2700,
  "promo": { "code", "valid", "status", "message" } | null,   // status: applied | expired | maxed_out | invalid | inactive
  "stockIssues": [{ "sku", "label", "requested", "available", "message" }],
  "requiredAdults": 2, "requiredChildren": 0,
  "tip": "..." | null                                         // e.g. KIDSFREE does not discount a Family Pass
}
```

### Confirmation

```jsonc
{
  "reference": "SU26-YHRZ78AB", "status": "confirmed",
  "payment": { "method": "simulated", "status": "paid", "amountCents": 2700 },
  "booker": { "fullName", "email" },
  "lines": [ /* as in Quote */ ], "subtotalCents", "discountCents", "totalCents", "promoCode": "SEVA10" | null,
  "attendees": [{ "kind": "adult" | "child" | "toddler", "fullName", "age", "attendingDays": ["2026-11-27"] | null }]
}
```

## Where the four requirements are enforced

1. **The server decides the price.** `src/server/quote.ts` prices every quote and booking from the catalog and live stock. No price, total or discount is accepted from the browser, and the schemas reject them. The page shows totals returned by `/api/quote`; nothing is added up in the browser.
2. **The server re-checks the rules.** The route validators use `QuoteRequestSchema` and `CreateBookingRequestSchema` (ages, ticket and age match, booker 18+, attendee counts equal to tickets, days, extras need entry cover, quantity caps). `planBooking` then checks stock and promo.
3. **Stock is real.** `src/server/create-booking.ts` writes the booking, the stock decrements and the promo use in one `db.batch`. The tables carry `CHECK (remaining >= 0)` and `CHECK (used_count <= max_uses)`, so a booking that would oversell fails and the whole batch rolls back. Checked by firing three simultaneous bookings for the last two workshop places: one succeeded, two got `409`, stock ended at 0, never below.
4. **The contract is documented.** This section.

**Double click.** The Pay button ignores a second click while a request is running, and the server treats `idempotencyKey` as unique: the same key with the same request returns the original confirmation (`200`), the same key with a different request is a `409`. A retry after a dropped connection is therefore safe, and the key is kept until the booking succeeds.

## Decisions I made where the brief left room

- **A promo code that cannot be used blocks the booking** (`422`) with its reason, rather than quietly charging full price. In the page, an unusable code is shown next to the field as you type.
- **KIDSFREE** only discounts the Day Pass and All-Day Pass child tickets. Adults, extras and the Family Pass are unaffected; if a Family Pass is in the cart the page says how switching would save money.
- **Percent discounts round half up in whole cents**, and the discount is split across lines by largest remainder so line discounts always add up to the total.
- **Ages decide the ticket.** Adult attendees must be 12+, children on a child ticket 5 to 11, and under-5s are free and need no ticket. A 7-year-old cannot be placed on an adult ticket, and a 12-year-old cannot be placed on a child ticket; the message says which ticket fits. Ages must be whole numbers: text, negatives, fractions and absurd values are rejected, and the form ignores characters that cannot be part of a number.
- **The booker** must be 18+ and may or may not come. If they come they take one of the adult places; the form then asks for one fewer other adult.
- **Under-5s** are recorded for the door list, capped at 10 per booking, and their attendance dates must be covered by entry tickets. They count towards dinner on those dates but not the workshop.
- **Extras follow the people, per day.** Dinner plates cannot exceed the people attending on each selected date; workshop places cannot exceed ticketed people (5+) on each selected workshop date. The selected dates must be covered by entry tickets. When someone removes a day or a ticket, the page drops extras that no longer fit instead of leaving an invalid order.
- **Stock is counted in person-days.** Day Pass, Family Pass and Dinner Plate stock is used up once per person per day. **Garba Workshop's 2 places are one shared pool** across Nov 27 and Nov 29. Existing stock and promo counts are retained when the dates change.
- **Family Pass** covers 2 adults and 2 children for one day; choosing several days buys one pass per day.
- **All-Day Passes** cover all 15 festival dates at the existing flat prices: $60 for adults and $30 for children.
- **Quantity caps:** 30 per ticket line and 20 pairs of Dandiya Sticks per booking.
- **Bookings close at midnight after the final festival day (Dec 11, 2026, Central Time).** Festival dates are fixed data; promo expiry takes an injected `now`, which is how the tests pin EXPIRED5.
- **Payment is simulated.** The page says so plainly and asks for no card details. The booking is real: stock is reduced and the confirmation is stored.
- **Confirmation is shown on the page and saved to the session** so a refresh keeps it. No email is sent.
- **Previous dates remain historical.** Existing confirmations retain their original dates. An unfinished old draft offers a replay-only check before the person starts a separate booking.

## Edge cases handled

Sold out (All-Day Pass – Adult) is shown and disabled. Low stock (Garba Workshop, 2 left) is shown and caps the quantity. If stock changes before payment the person is sent back to the tickets step with the exact item. A slow, failed or offline request shows a plain message and a retry that cannot double-book. Totals show a skeleton while updating, then the last good number. A half-filled form survives a refresh (session storage, validated on load). Focus moves to the new step's heading, and to the first invalid field on a failed Continue.

## Tests

`pnpm test` covers the catalog and attendee rules (`tests/domain.test.ts`), pricing and promos (`tests/pricing.test.ts`), validation (`tests/validation.test.ts`, `tests/booking-validation.test.ts`), server decisions (`tests/plan-booking.test.ts`), client rules (`tests/booking-draft.test.ts`), and historical replay and draft recovery (`tests/create-booking.test.ts`, `tests/previous-draft.test.ts`). The unit runner mocks D1; atomic writes rely on D1's transactional batch and constraints.

## Known limits

- **One day set per ticket type.** A ticket type has a single list of days, so two adults on the same Day Pass type share their days. Different days for different people need a different ticket type (for example an All-Day Pass for one and a Day Pass for the other).
- **No hold on stock while someone pays.** Stock is taken when the booking is placed, after payment. With a real processor you would reserve first, then confirm from the payment webhook.
- **No door-team screen yet.** The `attendees` table has everyone who is coming; there is no endpoint or page for volunteers.
- **`db.batch` atomicity** comes from D1. It was checked locally (a failing CHECK rolls back earlier statements) and relies on D1's documented transactional batch in production.

## If this had to run ten festivals

Add a `festival_id` to `stock`, `promo_usage` and `bookings`, and load the catalog, prices, dates, promo codes and age bands from per-festival rows instead of `src/domain/catalog.ts` constants. Make the rules data, not code: each ticket gets `ageMin`/`ageMax`, `daysMode` (`any`, `fixed`, `single`), per-person or per-booking pricing, and each extra declares which days it runs on and which entry cover it needs. Rules are already keyed by SKU id, never by label, so renaming a ticket cannot break one. The catalog also carries `ageGroup`, `lockedAllDays` and `allowedDates`, but today the schemas and pricing hard-code those rules per SKU; the real work is making them read these fields. Scope idempotency keys and references by festival, and key the page by festival slug.
