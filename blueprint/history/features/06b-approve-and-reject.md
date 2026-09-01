# Feature: Approve and reject

**From build-plan:** feature 6b
**Status:** verified

## Goal

Close the payout lifecycle. A pending request can now be approved or rejected
through clearly labelled stand-in agency controls, writing the
`PAYOUT_HOLD_RELEASE` and `PAYOUT` ledger rows that make the balance move
correctly and keeping `PayoutRequest.status` consistent with the rows behind it.

6a proved a request cannot be created for money that is not there. 6b has its
own money bug to prevent: a rejection releases held funds, so a request rejected
twice would credit the balance twice and invent money from nothing. The guard
against that is the point of this feature.

## Design reference

None. No mockup and no `prototypes/` folder. The look is settled by the shipped
surfaces: the bordered `bg-surface` panel used by the summary cards and the
request form, and the button styling from `ChannelActionButton`.

## Decisions this spec makes

| Question | Decision here |
|---|---|
| What actually prevents a double decision? | The conditional update, not the isolation level. `updateMany` carries `status: PENDING` in its where clause, so a second decision matches zero rows and writes no ledger entries. This is the pattern `setChannelConnection` already uses. Serializable and `withRetry` are reused for consistency with `createPayoutRequest`, but they are not what makes this correct |
| Where does the sign logic live? | A pure `decisionLedgerRows(decision, amountMinor)` returning the rows to write, so the signs and the net effect are unit tested without a database. The transaction just persists what it returns |
| Does a decision re-check the balance? | No. The funds are already held. Approval nets to zero (release plus payout), rejection is a pure positive release. Neither can overdraw, so there is no `checkAgainstBalance` on this path |
| Where do the controls live? | Their own "Agency review" panel on `/wallet`, between the request form and the transaction history. Not buttons inside the history table: the history is the creator's record, and these controls stand in for something that would sit behind the agency's own login. A separate panel labels that honestly and is trivial to delete later |
| Where does the confirmation message live? | On the panel, not on each row. A successful decision removes that request from the panel, so per-row state would unmount along with its own confirmation. One `useActionState` in the panel holds the message; a small `useFormStatus` button gives each row its own pending label |
| Does the panel disappear when nothing is pending? | No. It always renders, with an empty line when there is nothing to decide. If it unmounted after the last decision it would take the confirmation with it, which is the same bug one level up |
| Is a decision idempotent by key? | No key. A repeat decision is not a duplicate of one intent the way a resubmitted form is; it is an attempt to decide something already decided, and it reports that plainly. The conditional update makes it safe either way |
| Is the decision note user supplied? | No. A fixed stand-in note is written to `decisionNote` so the column records how the decision was made. No free-text input, and the note is not displayed, matching the seeded row whose note is also stored and not shown |
| New file or the existing payout module? | Stays in `lib/payout.ts`. `withRetry`, `TRANSACTION_OPTIONS`, and the retry predicate all live there and are what this reuses; splitting would mean widening a module-private surface only to cross a file boundary |
| Does `PAYOUT_STATUS_LABELS` get lifted out of the wallet page? | No. 6a left a note to lift it when a third file needs it. The panel lists only pending requests and names no statuses, so nothing here needs it. Do not refactor speculatively |
| Any read-path changes? | None. The decision rows carry `payoutRequestId`, so `getWalletHistory` already keeps them out of the standalone-entry list and already renders status and `decidedAt`. 6b writes; it changes no derivation |

## In scope

- `lib/payout.ts`: `parseDecision`, `decisionLedgerRows`, and
  `decidePayoutRequest`, the transaction that flips a pending request and
  appends its ledger rows
- `lib/payout.test.ts`: Vitest coverage of both pure additions
- `actions/payouts.ts`: `decidePayout`, a thin server action over that core
- `components/wallet/PayoutDecisionPanel.tsx`: the stand-in agency panel listing
  pending requests with Approve and Reject, its shared result message, and its
  empty state
- `app/wallet/page.tsx`: queries pending requests and renders the panel between
  the request form and the history
- Evidence that a request decided twice, including concurrently, moves the
  balance exactly once

## Out of scope

- Any change to how balances or history are derived. `lib/wallet.ts` is untouched
- A free-text decision note, a note input, or displaying `decisionNote`
- Cancelling a pending request, editing an amount, or reopening a decided request
- Bulk approve or reject, filtering, or paging the pending list
- Real agency authentication or an agency-side route. There is no auth in this
  build, which is exactly why these are stand-in controls
- Notifications when a payout changes status (deferred by decision)
- Post data (feature 4), the README (feature 7), deployment (feature 8)
- Adding browser tests, adding CI, or changing the Playwright harness

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - the pure decision logic, with its tests** - add to
  `lib/payout.ts`, with no database access:
  - `PayoutDecision`, the type `Exclude<PayoutStatus, typeof PayoutStatus.PENDING>`,
    so a decision can only ever be `APPROVED` or `REJECTED`.
  - `parseDecision(raw: unknown): PayoutDecision | null` - exact match on those
    two values and nothing else. No trimming and no case folding: the value comes
    from a hidden input this app renders, so anything else is malformed rather
    than sloppy. `PENDING` is rejected like any other string.
  - `decisionLedgerRows(decision, amountMinor): DecisionLedgerRow[]`, where a row
    is `{ type, amountMinor, description }`. `REJECTED` returns one
    `PAYOUT_HOLD_RELEASE` at `+amountMinor`. `APPROVED` returns that same release
    first, then a `PAYOUT` at `-amountMinor`, so the pair nets to zero and the
    ledger reads in the order the events happened.

  Add tests: reject returns exactly one row, positive, typed
  `PAYOUT_HOLD_RELEASE`, summing to `+amountMinor`; approve returns exactly two
  rows in that order with those signs, summing to `0`; both hold for an amount of
  1 minor unit and for 128450; `parseDecision` accepts `"APPROVED"` and
  `"REJECTED"` and returns null for `"PENDING"`, `"approved"`, `"APPROVED "`,
  `""`, a number, null, and undefined.
  *Done when:* `npm test` passes with these cases named in the output,
  `decisionLedgerRows(APPROVED, 5000)` sums to 0, and
  `decisionLedgerRows(REJECTED, 5000)` sums to 5000.

- [x] **Step 2 - the transactional decision, proven under a double decide** - add
  `decidePayoutRequest(client, { creatorId, payoutRequestId, decision })` to
  `lib/payout.ts`, returning a discriminated result rather than throwing for
  expected outcomes. Inside `withRetry`, open a transaction with the existing
  `TRANSACTION_OPTIONS` and within it:
  - read the request with `findFirst({ where: { id, creatorId } })`. Null returns
    `not-found`; a status other than `PENDING` returns `already-decided` carrying
    that status. The client supplies the request id, so the `creatorId` from
    `getCreator()` is part of every where clause.
  - mint one `decidedAt = new Date()` and use it for both the request and the
    ledger rows, so the decision timestamp and its entries agree exactly.
  - `updateMany({ where: { id, creatorId, status: PENDING }, data: { status: decision, decidedAt, decisionNote } })`.
    A `count` of 0 means another decision won the race, so return
    `already-decided` and write nothing.
  - `createMany` the rows from `decisionLedgerRows`, each with `creatorId`,
    `payoutRequestId`, and `createdAt: decidedAt`.
  - return `{ kind: "decided", decision, amountMinor }`. It carries the amount
    rather than the whole request because that is all the caller needs, and
    re-reading the updated row would be a query for nothing.

  No UI and no server action in this step.
  *Done when:* a throwaway `tsx` script against the seeded database shows all
  five, each starting from a fresh request created through
  `createPayoutRequest`: approving leaves available balance unchanged, sets
  status `APPROVED` with `decidedAt` and a note, and adds exactly one
  `PAYOUT_HOLD_RELEASE` and one `PAYOUT` row; rejecting raises available balance
  by exactly the requested amount, sets status `REJECTED`, and adds exactly one
  `PAYOUT_HOLD_RELEASE`; deciding an already decided request returns
  `already-decided`, writes zero rows, and leaves `decidedAt` and the note as the
  first decision set them; an unknown id returns `not-found` and writes nothing;
  and **two concurrent rejections of the same request** end with exactly one
  `PAYOUT_HOLD_RELEASE` row and available balance raised by the amount once, not
  twice. Re-seed with `npm run db:seed` afterwards.

- [x] **Step 3 - the panel and the server action** - add
  `decidePayout(prevState, formData)` to `actions/payouts.ts`, matching
  `requestPayout`: read `payoutRequestId` and `decision`, reject a missing or
  non-string id and a `parseDecision` of null, resolve the creator with
  `getCreator()` and never from the form, call `decidePayoutRequest(prisma, ...)`,
  map each result kind to a user-facing message, `console.error` and return a
  generic message on an unexpected throw, then `revalidatePath("/wallet")` on
  success. Reuse `PayoutActionState`.

  Add `components/wallet/PayoutDecisionPanel.tsx`, a client component taking the
  pending requests as `{ id, amountMinor, createdAt }[]`:
  - one `useActionState(decidePayout, null)` for the whole panel, so the message
    survives the row it came from being removed
  - one `<form action={formAction}>` per request, each with the id in a hidden
    input and two submit buttons carrying `name="decision"` with values
    `APPROVED` and `REJECTED`
  - a nested `DecisionButton` using `useFormStatus()` so only the submitting
    row's buttons disable and change label
  - each button's accessible name identifies its request, following
    `ChannelActionButton`: a visible "Approve" plus an `sr-only` amount and date
  - a heading saying these are stand-in controls and why, the error in a
    `role="alert"` and the confirmation in a `role="status"`
  - an empty line when nothing is pending. The panel always renders

  Render it on `/wallet` between the request form and the history, adding a
  `prisma.payoutRequest.findMany` for `status: PENDING`, ordered by `createdAt`
  ascending and selecting only `id`, `amountMinor`, and `createdAt`, to the
  existing `Promise.all`.
  *Done when:* in the browser, starting from a freshly seeded database with no
  pending requests, the panel renders its empty line; requesting $50.00 through
  the 6a form makes it appear in the panel with its amount and request date;
  rejecting it removes it from the panel, shows a confirmation that stays
  visible, raises the available card by exactly $50.00 without a manual reload,
  and flips its history row to Rejected with today's date and the returned-funds
  wording; approving a second $50.00 request leaves the available card unchanged,
  flips that history row to Approved with a date, and leaves the history row
  count unchanged; every button is reachable and operable by keyboard alone with
  a visible focus ring; and `npm run build` and `npm test` both pass.

## Files / areas

| Path | Change |
|---|---|
| `lib/payout.ts` | `parseDecision` and `decisionLedgerRows` in step 1, `decidePayoutRequest` in step 2. Reuses `withRetry` and `TRANSACTION_OPTIONS` |
| `lib/payout.test.ts` | Adds two describe blocks. Existing cases untouched |
| `actions/payouts.ts` | Adds `decidePayout`. `requestPayout` and `PayoutActionState` unchanged |
| `components/wallet/PayoutDecisionPanel.tsx` | New. Client component plus its nested submit button |
| `app/wallet/page.tsx` | One added query, one added element between the form and the history |
| `lib/wallet.ts` | Unchanged. The derivations already handle these rows |
| `prisma/schema.prisma` | Unchanged. `status`, `decidedAt`, and `decisionNote` shipped in feature 1, so no migration |

## Data / contracts

- `PayoutDecision = Exclude<PayoutStatus, typeof PayoutStatus.PENDING>`. Nothing
  in this feature may widen it back to the full status union
- `DecisionLedgerRow = { type: LedgerEntryType; amountMinor: number; description: string }`.
  The creator, the request id, and the timestamp are added by the caller, so the
  pure function stays free of ids and clocks
- `DecidePayoutResult` is a discriminated union, matching `CreatePayoutResult`:
  `{ kind: "decided"; decision: PayoutDecision; amountMinor: number }` |
  `{ kind: "already-decided"; status: PayoutStatus }` | `{ kind: "not-found" }`.
  Expected outcomes are values; only unexpected ones throw
- `decidePayoutRequest` takes a full `PrismaClient` for the same reason
  `createPayoutRequest` does: it opens the transaction, and a script must be able
  to drive it directly
- `PayoutActionState` is reused as is, so both payout actions report the same way

Ledger rows written on a decision, always with `payoutRequestId` set and
`createdAt` equal to `decidedAt`:

| Decision | Rows | Net effect on available |
|---|---|---|
| `REJECTED` | `PAYOUT_HOLD_RELEASE` at `+amount`, "Hold released on rejection" | Returns to the pre-request amount |
| `APPROVED` | `PAYOUT_HOLD_RELEASE` at `+amount`, "Hold released on approval", then `PAYOUT` at `-amount`, "Payout sent to the creator" | Unchanged, and history records the payout |

Nothing is ever updated or deleted in `LedgerEntry`. The only row this feature
updates is the `PayoutRequest` itself, whose status is a lifecycle field, not a
derived balance.

## Testing

**The test gate is on.** `AGENTS.md` declares `Test: npm test`, so step 1 ships
its tests in the same diff.

| Claim | Proven by |
|---|---|
| A rejection releases the hold once, positive | Vitest, `decisionLedgerRows` |
| An approval releases and pays out, netting zero | Vitest, `decisionLedgerRows` |
| Only `APPROVED` and `REJECTED` are accepted as a decision | Vitest, `parseDecision` |
| Approving leaves available balance unchanged | `tsx` script, step 2 |
| Rejecting returns exactly the held amount | `tsx` script, step 2 |
| A second decision writes nothing | `tsx` script, step 2 |
| **Two concurrent rejections credit the balance once** | `tsx` script, step 2, two concurrent calls against a real Neon transaction |
| The panel, its states, and the balance and history updates | Browser, step 3 |

`decidePayout` itself is not unit tested, matching 6a: the action is a thin shell
and the logic worth asserting sits in the two pure functions and the script.

**Do not add a Playwright spec for this feature.** `AGENTS.md` describes the
harness as read-only, and `e2e/portal.spec.ts` asserts exact seeded figures:
9 history rows, `$1,284.50` available, `$340.00` pending, and one payout row
reading Approved. Any request or decision left behind by the step 2 script or by
manual testing breaks those assertions. **Run `npm run db:seed` before
`npm run test:browser`.** Automating a mutating decision flow is a real harness
change and belongs in its own `/browser-tests` run.

Note for the manual path: a freshly seeded database has one payout request and it
is already `APPROVED`, so the panel starts empty. Create a pending request with
the 6a form before checking anything else.

## Notes for the AI

- **The conditional update is the guarantee.** Never replace
  `updateMany({ where: { ..., status: PENDING } })` with a read, a branch, and an
  unconditional `update`. That is the double-credit bug this feature exists to
  prevent
- `getCreator()` on the server, always. The request id comes from the form, so it
  is scoped by `creatorId` in every where clause
- Server components by default; only `PayoutDecisionPanel` gets `"use client"`
- Match `actions/accounts.ts` and `requestPayout`: the `{ success, error }` union,
  `console.error` before a generic message, `revalidatePath` last
- Money stays integer end to end. No `parseFloat`, no `/ 100`, no `toFixed`.
  Render through `formatMinor`
- Status is never signalled by colour alone, and the theme has no danger token.
  Reject is a plain button with words, not a red one
- Never update or delete a `LedgerEntry`. Append only
- Do not touch `lib/wallet.ts`, `getWalletHistory`, or `PAYOUT_STATUS_LABELS`.
  If a step seems to need one of them, the step has drifted
- No em dashes in code, comments, or commit messages
- Comment the why, not the what. The conditional update, the shared `decidedAt`,
  and the panel-level action state each deserve a line. The rest should not
