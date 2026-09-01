# Feature: Wallet overview

**From build-plan:** feature 5
**Status:** verified

## Goal

Fill `/wallet` with the two balance figures and the transaction history, every
number summed from the ledger rather than read from a stored column.

This is the feature that makes the money model visible, and it is the last one
before the headline payout slice. Feature 6 does not add its own balance
arithmetic: it calls what this feature builds, from inside a serializable
transaction. So the derivations here are written to be callable against a
transaction client from the start, not retrofitted later.

## Design reference

None. No mockup and no `prototypes/` folder exists. The overview's rule is the
whole brief: cards for summary figures, tables for lists, plain and dense.
Feature 2 locked the theme tokens and feature 3 set the table pattern this
follows.

## Decisions this spec makes

| Question | Decision here |
|---|---|
| Where does the balance arithmetic live? | `lib/wallet.ts`, as functions taking a Prisma client as their first argument so feature 6 can pass its transaction client. This is the single reason feature 6 can re-read available balance inside its transaction boundary without duplicating the sums |
| How is money formatted without floats? | Cents come from `abs % 100`, an exact integer modulo. Dollars come from `(abs - cents) / 100`, dividing a value already known to be a multiple of 100, which is exact. Never `minor / 100` handed to `Intl` as a currency value, which would derive the cents from a binary fraction |
| Which date does a payout request row sort by? | `createdAt`, the request date, because that is when the hold moved the balance. `decidedAt` appears in the row as secondary text when set |
| What amount does a payout row show? | The requested amount, negative, for all three statuses, with the Status column carrying the difference. A rejected request is labelled and its description says the funds returned. The alternative, showing zero for rejected, hides that the request happened. **See the note under Data / contracts: this list is a statement of events, not a running balance** |
| Newest first or oldest first? | Newest first, like a statement |
| Does this feature read `PayoutRequest`? | Yes, directly. The overview's Transaction history shape section already establishes this, and it is why feature 6 must keep `PayoutRequest.status` consistent with the ledger rows it writes |

## In scope

- `lib/wallet.ts`: available balance, pending earnings, and the merged history,
  each scoped to the creator and each accepting a Prisma client
- `formatMinor` added to `lib/format.ts`, integer-only currency formatting
- `/wallet` rendering two summary cards and the transaction history table
- `components/wallet/SummaryCard.tsx`, used twice
- Honest empty state for a creator with no ledger history

## Out of scope

- The payout request form, the amount input, overdraft rejection, idempotency,
  holds, and the approve and reject controls. All of that is feature 6
- Writing any ledger row. This feature only reads
- A running balance column, date filtering, pagination, CSV export, or charts
- Installing Vitest. `/tests` runs immediately after this feature, before
  feature 6
- Post data (feature 4, deferred), deployment (feature 8)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - money formatting and the ledger derivations** - add
  `formatMinor(amountMinor: number): string` to `lib/format.ts`, formatting from
  integer parts only: negative sign, whole dollars grouped, then the remainder
  padded to two digits. Add `lib/wallet.ts` with `sumAvailableBalance` and
  `sumPendingEarnings`, both taking `(client, creatorId)` where `client` is a
  `PrismaClient` or a transaction client, and both summing `amountMinor` through
  a single `aggregate` rather than loading rows. `sumPendingEarnings` filters
  `type = EARNING_PENDING`; `sumAvailableBalance` filters `type != EARNING_PENDING`
  and must return 0, not null, when the creator has no matching rows. No UI in
  this step.
  *Done when:* a throwaway script prints `availableBalance = 128450` and
  `pendingEarnings = 34000` against the seeded database, `formatMinor` returns
  `$1,284.50`, `$340.00`, `-$440.00`, `$0.00`, and `$0.05` for 128450, 34000,
  -44000, 0, and 5, an empty ledger sums to 0 rather than null, and
  `npx tsc --noEmit` passes.

- [x] **Step 2 - the summary cards** - add
  `components/wallet/SummaryCard.tsx`, a server component taking a label, a
  formatted value, and a short explanatory line. Rewrite `app/wallet/page.tsx`
  to resolve the creator, call both derivations, and render two cards: Available
  balance and Pending earnings. The explanatory lines carry the meaning the
  numbers cannot: available balance excludes pending earnings and anything held
  by an open request, pending earnings are earned but not yet clearable.
  *Done when:* `/wallet` shows `$1,284.50` available and `$340.00` pending, both
  figures match a direct database sum, the cards read correctly in light and
  dark, a browser test asserts both figures, and `npm run build` and
  `npm run test:browser` pass.

- [x] **Step 3 - the transaction history** - add `getWalletHistory(client,
  creatorId)` to `lib/wallet.ts`, returning a discriminated union of rows built
  from two reads: every `PayoutRequest` for the creator, and every `LedgerEntry`
  whose `payoutRequestId` is null. Merge and sort by date descending. Render the
  result under the cards as a table matching the feature 3 pattern: Date,
  Description, Status, Amount, with the amount right-aligned and tabular. Ledger
  rows show their description and a status of a dash or similar; payout rows
  show their status word and, when decided, the decision date. Render the honest
  empty state when there are no rows.
  *Done when:* the table shows exactly 9 rows for the seeded creator, newest
  first, starting with the 2026-08-29 pending earning of `$155.00` and ending
  with the 2026-06-05 cleared earning of `$425.00`, the single approved payout
  request appears as one row dated 2026-07-15 for `-$440.00` rather than as its
  three underlying ledger rows, no row is signalled by color alone, a browser
  test asserts the row count, the ordering, and the collapsed payout row, and
  `npm run build` and `npm run test:browser` pass.

## Files / areas

| Path | Why |
|---|---|
| `lib/format.ts` | `formatMinor` joins the existing formatters |
| `lib/wallet.ts` | new. The derivations and history assembly, load-bearing for feature 6 |
| `app/wallet/page.tsx` | placeholder out, cards and history in |
| `components/wallet/SummaryCard.tsx` | new. Used twice here, likely again in feature 6 |
| `e2e/portal.spec.ts` | extended with the wallet assertions, staying read-only like the rest of the file |

The `WalletHistoryRow` union lives in `lib/wallet.ts` beside the function that
builds it rather than in a `types/` file, matching how feature 3 kept its own
narrow types local. Promote it if a third file needs it.

## Data / contracts

Load-bearing. Feature 6 builds directly on these.

- **The two derivations are fixed by the overview** and must not drift:
  - `pendingEarnings` = sum of `amountMinor` where `type = EARNING_PENDING`
  - `availableBalance` = sum of `amountMinor` where `type != EARNING_PENDING`
- **Both take a Prisma client as the first argument**, typed to accept a
  transaction client. Feature 6 calls `sumAvailableBalance(tx, creatorId)`
  inside its serializable transaction. Do not close over the module-level
  `prisma` singleton inside these functions. The type already exists: `Prisma`
  is re-exported from `@/lib/generated/prisma/client`, so the parameter type is
  `PrismaClient | Prisma.TransactionClient`. Verified present before this spec
  was written, since the whole shape of feature 6 depends on it.
- **Balances are never stored.** No cached column, no denormalized total. This
  is invariant 1 and the reason both functions exist.
- **All money is signed integer minor units.** `formatMinor` is the only place
  that turns one into a string. No component formats money itself.
- **The history list is a statement of events, not a running balance.** It
  deliberately shows a payout request as one row instead of its one to three
  ledger rows, so its amounts do not sum to available balance. The balances come
  from the ledger sums above, which is the honest source. Do not add a running
  balance column implying otherwise.
- **`PayoutRequest.status` is read here**, so feature 6's approve and reject
  must keep it consistent with the ledger rows they write.

## Testing

No `test` command is declared in `AGENTS.md`, so the unit gate is off for this
feature and `verification.logicTests` is `when-configured`.

`AGENTS.md` does declare `Browser tests: npm run test:browser`, so that gate is
on. The harness resolves the running dev server's port from `.next/dev/lock`
rather than assuming 3000, and its existing smoke spec is read-only by design.
This feature is read-only too, so it extends `e2e/portal.spec.ts` rather than
mutating seeded state.

Add focused coverage for the done-whens that are stable and behavioral:

- `/wallet` renders `$1,284.50` available and `$340.00` pending
- the history table has exactly 9 rows, newest first
- **the approved payout appears as one row for `-$440.00`**, and the three
  ledger rows behind it (`PAYOUT_HOLD`, `PAYOUT`, `PAYOUT_HOLD_RELEASE`) do not
  appear separately. This is the assertion worth having, because the collapse is
  the one non-obvious thing this feature does

Keep out of the harness what it cannot honestly observe: light and dark
rendering, spacing, and card layout stay direct-observation claims.

`npm run build` remains the final automated gate; no `Verify` command exists.

**This is the last feature that ships untested logic, by plan.** `formatMinor`,
`sumAvailableBalance`, `sumPendingEarnings`, and `getWalletHistory` are exactly
the pure logic the scope rule in `coding-standards.md` targets, and feature 6
builds its concurrency and idempotency guarantees on top of them. `/tests` runs
next and should cover these four before feature 6 starts. Name them explicitly
when it does:

- `formatMinor` at zero, negative, sub-dollar, and grouped-thousands values
- both sums against an empty ledger, returning 0 rather than null
- `getWalletHistory` collapsing a payout request into one row and ordering the
  merged list correctly

Specifically for this feature:

- **Figures match the database** - compare both card values against a direct
  aggregate query, not against each other
- **The collapse is real** - the approved payout appears once, and its three
  ledger rows do not appear separately
- **Both themes** - light and dark on the cards and the table
- **Empty state** - reasoned or probed, since the seed always has rows

**A known gap this feature cannot close.** The seed contains exactly one payout
request and it is `APPROVED`, so the `PENDING` and `REJECTED` rows are written
here but never rendered against real data. Feature 6 creates the first of each.
Its check must confirm both render correctly, including that a rejected request
reads as returned rather than as money taken. Do not treat this feature's green
history table as proof those two branches work.

## Notes for the AI

- **Server components throughout.** Nothing here needs interactivity, so this
  feature adds no `'use client'` file. Feature 6 brings the first one to
  `/wallet`.
- **Never import `lib/prisma.ts` or `lib/wallet.ts` into a client component.**
- **Sum in the database, not in JavaScript.** Use Prisma `aggregate` for the two
  balances. Loading every ledger row to reduce it in memory would work at seed
  scale and be wrong at any other.
- **`formatMinor` must not divide by 100 in floating point.** Integer parts
  only. This is the plan's rule, and step 1's done-when checks the edge values
  that would expose a shortcut.
- **Reuse the feature 3 table pattern** in `app/accounts/page.tsx`: the
  `overflow-x-auto` wrapper, the shared cell class, `scope` on headers, and a
  `sr-only` caption. Do not invent a second table style.
- **Status is never signalled by color alone**, including payout status. Use the
  word.
- **Use the feature 2 tokens**, no raw hex, no inline styles, no
  `tailwind.config.js`.
- **The route already renders per request** through the layout's
  `dynamic = "force-dynamic"`. Do not add another rendering directive.
- **Conventions:** TypeScript strict, no `any`, the `@/*` import alias, comments
  only where the code cannot speak for itself, and no em dashes in any generated
  content. See `blueprint/context/coding-standards.md`.

## Implementation notes

**`formatDate` was added alongside `formatMinor`.** The spec named only the
money formatter, but a statement wants dates without times, and
`formatTimestamp` carries a time the history rows do not need. Same fixed locale
and UTC pinning as the existing formatters.

**Payout status labels live in `app/wallet/page.tsx` for now.** Feature 6 renders
the same three words on the request flow. Lift the map into a shared module the
first time a second file needs it rather than duplicating it.

**One judgment call worth a second opinion.** The spec said ledger rows show a
dash in the Status column, and they do. The effect is that a cleared earning and
a pending earning look identical in that column, even though only one is
spendable. The information is still on the page twice over, in each row's
description and in the Pending earnings card, and the two pending rows do sum to
the card's $340.00. Showing "Cleared" and "Not cleared" there instead would make
it visible per row, at the cost of the word "Pending" meaning two different
things in one column, once for an uncleared earning and once for an open payout
request. Left as spec'd; cheap to change.

Verified against the seeded database, rendered rows read back from the page:

| Claim | Evidence |
|---|---|
| `availableBalance = 128450`, `pendingEarnings = 34000` | Both sums run through `lib/wallet.ts` against the real database |
| `formatMinor` at the edges | 128450, 34000, -44000, 0, 5, 99, 100, -5, 1000000 all correct, including `$0.05` and `-$0.05` |
| Empty ledger sums to 0, not null | Queried with an id that owns no rows, both functions returned the number 0 |
| 9 history rows, newest first | Aug 29 `$155.00` first through Jun 5 `$425.00` last |
| The payout collapses | One row, Jul 15, `-$440.00`, Approved, decided Jul 17. Its three ledger rows do not appear |
| Status never by color | Every status cell carries a word, or a dash with an `sr-only` "No status" |
| Browser gate | `npm run test:browser`, 4 passed, including two new wallet tests |
| Typecheck, lint, build | `npx tsc --noEmit`, `npm run lint`, `npm run build`, all clean |

**Not proved here, by design.** The seed holds one payout request and it is
`APPROVED`, so the `PENDING` and `REJECTED` rows still have never rendered
against real data. Feature 6 creates the first of each and owns that check.
