## 1. The problem

Our temple runs a large multi-day festival every year. A few thousand people attend. Today, booking is a mess of spreadsheets and WhatsApp messages, and the volunteers on the door have no reliable list of who paid for what.

We want a page where a family can book their tickets for the festival in one go, pay, and receive a confirmation. It has to handle the awkward reality of how families actually attend: some come for one evening, some for the whole festival, children are priced differently from adults, toddlers come free, and there are extras like meals and workshops that only apply on certain days.

The hard part of this problem is not the screens. It is the **rules** — and making sure the amount charged is always correct, no matter what the person clicks.

---

## 2. The event

| Field | Value |
| --- | --- |
| Event name | Sharad Utsav 2026 |
| Location | Radha Krishna Temple, Allen, Texas |
| Festival dates | **Tue 10 Nov 2026 → Sat 14 Nov 2026** (5 days) |
| Currency | USD only |
| Booking closes | Midnight after the final festival day (Nov 15, 2026, Central Time) |

### Colour theme

This is the only design direction we are giving you. These are our real brand colours — please use them so the page feels like it belongs to us. Everything else about the layout, the flow, and the wording is your call.

| Token | Hex | Where we normally use it |
| --- | --- | --- |
| `primaryDark` | `#2C2C2C` | Main page background (our booking pages are dark) |
| `primary` | `#C99B24` | Primary buttons, selected states, highlights |
| `gold` | `#BC9226` | Borders, icons, accents |
| `brightGold` | `#D1AC3E` | Hover states on gold elements |
| `cream` | `#FDF3E4` | Light panels and cards sitting on the dark background |
| `heading` | `#291900` | Headings on a light background |
| `primary-text` | `#645743` | Body text on a light background |
| `white` | `#FFFFFF` | Body text on the dark background |
| `success` | `#28A736` | Confirmation messages |
| `error` | `#EF1F1F` | Validation and error messages |

A few notes:

- On the dark background we usually build cards from translucent white — roughly a `rgba(255,255,255,0.05)` fill with a `rgba(255,255,255,0.2)` border — rather than solid boxes.
- A serif for headings and a clean sans-serif for body text is our usual pairing. Any good serif is fine; you do not need our licensed fonts.
- Please do check your colour contrast. Gold on dark can look lovely and still be hard to read.

---

## 3. What can be bought

### Entry tickets — a person buys exactly one kind

| Ticket | Price | Who it is for | Which days |
| --- | --- | --- | --- |
| Day Pass – Adult | $15 per person, per day | Ages 12 and above | Any day or days the person chooses |
| Day Pass – Child | $8 per person, per day | Ages 5 to 11 | Any day or days the person chooses |
| All-Day Pass – Adult | $60 flat | Ages 12 and above | All 5 days. Cannot be changed. |
| All-Day Pass – Child | $30 flat | Ages 5 to 11 | All 5 days. Cannot be changed. |
| Family Pass | $40 flat | Covers 2 adults and 2 children | One single day |

### Extras

| Extra | Price | Notes |
| --- | --- | --- |
| Dandiya Sticks (pair) | $5 each | A souvenir. Any reasonable quantity. |
| Dinner Plate | $12 | Priced **per person, per day** |
| Garba Workshop | $20 each | Runs on **Nov 11 and Nov 13 only** |

### How much of each we have left

Your system needs to know its own stock and must never sell more than it has.

| Item | Remaining |
| --- | --- |
| Day Pass – Adult | 380 |
| Day Pass – Child | 260 |
| All-Day Pass – Adult | **0 — sold out** |
| All-Day Pass – Child | 140 |
| Family Pass | 95 |
| Dandiya Sticks | 900 |
| Dinner Plate | 1700 |
| Garba Workshop | **2** |

Two of those numbers are low or zero on purpose. Please make sure the page behaves sensibly in both cases.

### Promo codes

Your system should accept these five codes and behave differently for each. Work out the sensible behaviour and the sensible message for each one yourself.

| Code | What it is |
| --- | --- |
| `SEVA10` | 10% off the whole booking |
| `FLAT20` | $20 off the whole booking |
| `KIDSFREE` | Makes child tickets free. Adult tickets are unaffected. |
| `EXPIRED5` | A valid code that expired last month |
| `MAXEDOUT` | A valid code that has already been used its maximum number of times |

Anything else the person types is not a real code.

---

## 4. Who is coming

A booking is made by one person, on behalf of a group.

- We need enough detail about the **person booking** to contact them and to send their confirmation.
- We need enough detail about **everyone else in the group** for the volunteers on the door to check them in.
- The details we need for a child are not the same as the details we need for an adult. Think about which fields genuinely make sense for a nine-year-old.
- For children under 5, collect which festival dates they will attend. They are free and need no entry ticket, but their dates are needed to validate per-day dinner quantities.

The number of people we collect details for must always match the number of tickets being bought, and it must stay matched as the person changes their mind — which they will, several times, before they pay.

---

## 5. Age rules

Age drives the pricing, so it needs to be right.

| Age | Rule |
| --- | --- |
| **Under 5** | Free. No ticket needed at all. |
| **5 to 11** | Child. Must be on a child ticket. |
| **12 and above** | Adult. Must be on an adult ticket. |
| **The person booking** | Must be 18 or above, since they are the one paying. |

That table is the whole of what we are telling you. The wording of the messages, where you check, how you stop someone from buying an adult ticket for a seven-year-old, and what you do about anything the table does not cover — all of that is yours to decide.

Please assume people will type nonsense into an age field, and that some of them will be actively trying to get in cheaply.

---

## 6. What you are building

A working booking flow, front to back, deployed and usable by a stranger on a phone.

### The front end

A page that takes someone from "I want to come to the festival" to "here is my confirmation", handling every rule above. How you break that into steps or sections is entirely your choice.

### The back end

**You own the API.** We are not giving you endpoints or payload shapes — designing them is part of what we are assessing. Build whatever the front end needs, as Next.js route handlers or as a small separate service, whichever you prefer.

Whatever you build, please make sure of these four things:

1. **The server decides the price.** Prices, discounts, and the final amount are calculated on the server from the server's own data. Assume someone will open dev tools and edit whatever the browser sends.
2. **The server re-checks the rules.** Every rule in sections 3, 4 and 5 must hold even if the request arrives from something other than your own page.
3. **Stock is real.** A completed booking reduces what is available, and that reduction survives. Two people booking the last two workshop places at the same moment must not both succeed.
4. **The contract is documented.** A short table of your endpoints and their shapes in the README is fine. We want to see that you can define an interface, not just consume one.

A database is not required, but stock and completed bookings must persist across requests. Requirement 3 above also requires concurrent stock updates to be safe.

### Payment

Take the amount from your own server and show a payment step. A simulated payment is perfectly acceptable — a real Stripe **test mode** payment is a nice extra if you have the time. Never commit real keys.


## 7. What you should be looking at

Roughly in order of what matters most to us:

| Area | What we hope to see |
| --- | --- |
| Judgement | The cases you found on your own, and whether your decisions are sound and clearly explained |
| Correctness | The maths is right, every time, whatever the person clicks |
| Trusting the server | Prices, ages, stock and promo codes all decided server-side, never taken on trust from the browser |
| Code structure | Small, focused files. Business rules kept out of the UI. Names that explain themselves. |
| Your API design | Shapes that make sense, named well, documented |
| TypeScript | Types that model the domain and rule out impossible states. No `any`, no unsafe casts. |
| Edges and failures | Loading, empty, sold out, network loss, someone clicking Pay twice |
| Tests | The money and the age rules pinned down, and passing |
| Care for the user | Comfortable on a phone, usable with a keyboard, error messages that help rather than scold |

### A few things we would gently steer you away from

- The browser calculating the final amount and the server accepting it.
- Business rules that depend on matching text in a name or a label. If a rule can be broken by an admin renaming a ticket, it is not really a rule.
- One large component holding all of the state.
- Money handled so that a total can come out as `$146.70000000000002`.
- Validation that exists only in the UI.

### Things we would be delighted to see, if you have the time

- A clear state machine or reducer (zustand) for the booking flow, rather than many `useState` calls
- Money handled in integer cents
- Protection against a double-click creating two bookings
- Proper safety around the stock decrement when two people book at once
- A note on what you would change if this had to run ten different festivals with ten different rule sets

---