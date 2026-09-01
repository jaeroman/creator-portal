# Feature: Request a payout

**From build-plan:** feature 6a
**Status:** verified

## Goal

Let the creator request a payout against their available balance, and make that
one write correct under pressure: an amount parsed without ever touching a
float, an overdraft that writes nothing, a double submit that yields one request
and not two, and a hold that drops the balance the moment it commits, including
when two requests race.

This is the depth slice the rest of the portal exists to host. Everything before
it reads; this writes, and it is the only place in the project where a wrong
answer costs money. 6b adds the approve and reject side once a request can exist.

## Design reference

None. No mockup and no `prototypes/` folder. The look is already settled by the
three shipped surfaces: theme tokens from feature 2, the table pattern from
feature 3, the summary cards from feature 5. The form is a labelled input and a
button inside the same bordered `bg-surface` panel the cards use.

## Decisions this spec makes

| Question | Decision here |
|---|---|
| Where does the transactional write live? | `lib/payout.ts` as `createPayoutRequest(client, input)`, not in the action. `lib/wallet.ts` was built to take a client for exactly this. Keeping the core free of `FormData` and `revalidatePath` is what makes the concurrency race provable from a plain `tsx` script, since a server action calling `revalidatePath` throws outside a request context |
| How is a dollar string turned into cents? | Integer parsing only. Split on `.`, parse each side with `Number.parseInt`, then `dollars * 100 + cents`. Never `Number.parseFloat(x) * 100`, which turns `"0.29"` into `28.999999999999996` and truncates to 28. This is the most likely money bug in the feature and it gets a named test |
| What does the overdraft check compare against? | The balance re-read **inside** the transaction, never the number the page rendered. The rendered figure is already stale by the time the form posts |
| What enforces idempotency? | The unique index on `PayoutRequest.idempotencyKey`. The action does not pre-check for an existing key, because a pre-check is itself a race. A `P2002` on insert is caught and reported as success, since the request the user asked for does exist |
| Where does the key come from? | Minted by `crypto.randomUUID()` in the server component when the form renders, carried in a hidden input. `revalidatePath` re-renders the page after a successful submit, so the next genuine request gets a fresh key while a double-click, a retry, or a back-button resubmit reuses the old one |
| What happens on a serialization failure? | Bounded retry. Postgres raises `40001` and Prisma surfaces `P2034` when SSI catches the race. Retrying re-enters the transaction, re-reads the now lower balance, and usually turns the loser into a clean overdraft rejection rather than an error. Three attempts, then a plain "your balance changed" message |
| Is the concurrency guarantee unit tested? | No, and pretending otherwise would be dishonest. Vitest covers the pure logic, which is what the build plan asks for. Invariant 4 needs two real transactions racing in real Postgres, so it is proven by a script and written up as evidence |
| Does this add browser tests? | No. `AGENTS.md` states the Playwright harness is read-only and never mutates portal state, and it runs against whatever `DATABASE_URL` points at. A payout spec would write to that database and break the seeded-count assertions in `e2e/portal.spec.ts`. See Testing for the re-seed rule |
| Where does the form sit on the page? | Between the summary cards and the transaction history, so the balance it draws against is directly above it |

## In scope

- `lib/payout.ts`: amount parsing, the overdraft check, the retry predicate and
  wrapper, and `createPayoutRequest`, the serializable transaction that re-reads
  available balance and writes the request plus its `PAYOUT_HOLD` row
- `lib/payout.test.ts`: Vitest coverage of every pure function above
- `actions/payouts.ts`: `requestPayout`, a thin server action over that core
- `components/wallet/PayoutRequestForm.tsx`: the labelled amount input, submit
  state, error and success messaging
- `/wallet` renders the form, mints the idempotency key, and disables the form
  with an explanation when available balance is zero or below
- Evidence that two racing requests cannot both commit

## Out of scope

- Approve and reject, the stand-in agency controls, and the `PAYOUT_HOLD_RELEASE`
  and `PAYOUT` rows they write. All of that is 6b
- Cancelling or editing a pending request
- Any limit on how many requests may be open at once. Several can be pending;
  each holds its own funds and available balance already reflects all of them
- A minimum payout amount, fees, or payout destinations
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

- [x] **Step 1 - the pure payout logic, with its tests** - add `lib/payout.ts`
  holding four functions and no database access at all:
  - `parseAmountMinor(raw: unknown): ParsedAmount` - returns
    `{ ok: true; amountMinor }` or `{ ok: false; error }`. Rejects a non-string.
    Trims, then strips a leading `$`, spaces, and thousands commas. Requires
    `/^\d+(\.\d{1,2})?$/` on what remains. Converts with integer arithmetic only:
    parse the dollars, parse the cents padded to two digits, return
    `dollars * 100 + cents`. Rejects zero. Rejects anything above `2_147_483_647`,
    because `PayoutRequest.amountMinor` is a Postgres `int4` and an overflow would
    surface as a raw driver error instead of a message.
  - `checkAgainstBalance(amountMinor, availableMinor)` - `{ ok: true }` or
    `{ ok: false; error }`. Equal to the balance passes; one minor unit over
    fails. A zero or negative balance gets its own message.
  - `isRetryableTransactionError(error: unknown): boolean` - true only for a
    serialization failure. Corrected during step 2 against the real runtime
    shape: Prisma 7 through a driver adapter does not raise `P2034`, it throws a
    `DriverAdapterError` whose `cause` carries
    `{ originalCode: "40001", kind: "TransactionWriteConflict" }`. Match the
    SQLSTATE and that kind as well as the documented `P2034`. Not `P2002`, not
    anything else.
  - `withRetry<T>(attempt: () => Promise<T>, maxAttempts = 3): Promise<T>` -
    re-runs only when `isRetryableTransactionError` says so, rethrows otherwise,
    and rethrows the last error when attempts run out. Generic over the callback
    so it needs no Prisma types and stays testable with a plain fake.

  Add `lib/payout.test.ts` covering: `"25"` to 2500, `"25.50"` to 2550, `"0.29"`
  to 29 (the float trap), `"1,284.50"` to 128450, `"$25"` to 2500, `"25."`
  rejected, `"25.005"` rejected, `""`, `"abc"`, `"-5"`, `"0"`, `"0.00"`, a
  non-string, and an over-`int4` amount all rejected with a message; the balance
  check at exactly the balance, one over, and against zero; the retry wrapper
  succeeding after two write conflicts, giving up after three, not retrying
  `P2002`, and recognising both the `P2034` and the `DriverAdapterError` shapes.
  *Done when:* `npm test` passes with these cases named in the output, and
  `parseAmountMinor("0.29")` returns 29 rather than 28.

- [x] **Step 2 - the transactional write, proven under a race** - add
  `createPayoutRequest(client, { creatorId, amountMinor, idempotencyKey })` to
  `lib/payout.ts`, returning a discriminated result rather than throwing for
  expected outcomes. Inside `withRetry`, open
  `client.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })`
  and within it: call `sumAvailableBalance(tx, creatorId)`, apply
  `checkAgainstBalance`, and on failure return an `overdrawn` result without
  writing. On success create the `PayoutRequest` with status `PENDING`, then
  create one `LedgerEntry` of type `PAYOUT_HOLD` with `amountMinor` negated and
  `payoutRequestId` set. Catch `P2002` on `idempotencyKey` outside the
  transaction, re-read the existing request, and return it as a `duplicate`
  result. Give the transaction an explicit `timeout` and `maxWait` so a retried
  race does not trip Prisma's 5s default. No UI and no server action in this step.
  *Done when:* a throwaway `tsx` script against the seeded database shows all
  four: a valid request creates exactly one `PayoutRequest` and one `PAYOUT_HOLD`
  row and drops available from 128450 to the expected figure; an overdraft
  returns `overdrawn` and adds zero rows of either kind; the same idempotency key
  submitted twice leaves exactly one request; and two concurrent `70000` requests
  against a 128450 balance end with exactly one `PayoutRequest`, available at
  58450, and never a negative balance. Re-seed with `npm run db:seed` afterwards.

- [x] **Step 3 - the form and the server action** - add `actions/payouts.ts` with
  `requestPayout(prevState, formData)` returning a `PayoutActionState` shaped like
  `ChannelActionState` in `actions/accounts.ts`: read `amountDollars` and
  `idempotencyKey`, reject a missing or non-string key, `parseAmountMinor`,
  resolve the creator with `getCreator()` and never from the form, call
  `createPayoutRequest(prisma, ...)`, map its result to a user-facing message,
  `console.error` and return a generic message on an unexpected throw, then
  `revalidatePath("/wallet")` on success. Add
  `components/wallet/PayoutRequestForm.tsx`, a client component using
  `useActionState`, with a real `<label htmlFor>` on the amount input,
  `inputMode="decimal"`, the key in a hidden input, a button that disables and
  changes label while pending, the error in a `role="alert"` and the confirmation
  in a `role="status"`. Render it on `/wallet` between the cards and the history,
  minting the key with `crypto.randomUUID()` in the server component and passing
  available balance in so a zero or negative balance renders an explanation
  instead of a live form.
  *Done when:* in the browser, requesting $50.00 shows a confirmation, the
  available card drops by exactly $50.00 without a manual reload, and a new
  Pending row appears in the history; requesting more than the balance shows the
  overdraft message and leaves both figures and the row count unchanged;
  submitting the form twice without reloading (double-click, or Enter twice)
  produces one Pending row, not two; `""`, `"abc"`, and `"0"` are each refused
  with a specific message and no write; the input is reachable and submittable by
  keyboard alone with a visible focus ring; and `npm run build` and `npm test`
  both pass.

## Files / areas

| Path | Change |
|---|---|
| `lib/payout.ts` | New. Pure helpers in step 1, `createPayoutRequest` in step 2 |
| `lib/payout.test.ts` | New. Vitest coverage of the pure helpers |
| `actions/payouts.ts` | New. `requestPayout`, a thin shell over the core |
| `components/wallet/PayoutRequestForm.tsx` | New. Client component |
| `app/wallet/page.tsx` | Mints the idempotency key, renders the form |
| `lib/wallet.ts` | Unchanged. Called with a transaction client, as designed |
| `prisma/schema.prisma` | Unchanged. `PayoutRequest` and its unique index already shipped in feature 1, so no migration |

## Data / contracts

Load-bearing, because 6b calls into all of it:

- `ParsedAmount` and the result type of `createPayoutRequest` are discriminated
  unions with an `ok` or `kind` tag, not thrown errors. Expected outcomes are
  values; only unexpected ones throw
- `createPayoutRequest(client, input)` takes a full `PrismaClient`, because it
  opens the transaction and `$transaction` does not exist on a
  `Prisma.TransactionClient`. The helpers it calls inside the boundary, such as
  `sumAvailableBalance`, still take the union that `lib/wallet.ts` defines. The
  parameter exists so a script can pass `prisma` directly
- `PayoutActionState` follows `ChannelActionState`:
  `{ success: true; message: string } | { success: false; error: string } | null`
- The `PAYOUT_HOLD` row this writes is what 6b's `PAYOUT_HOLD_RELEASE` reverses.
  Its sign is negative and its `payoutRequestId` is always set, which is what
  keeps it out of `getWalletHistory`'s standalone-entry list
- `PAYOUT_STATUS_LABELS` currently sits in `app/wallet/page.tsx` with a comment
  saying to lift it when a third file needs it. This feature is the second file
  only if the form names statuses; leave it where it is unless step 3 actually
  needs it, and let 6b do the lift

Ledger row written on request: `type: PAYOUT_HOLD`, `amountMinor: -amount`,
`description: "Payout request hold"`, `payoutRequestId` set. Nothing else is
written and nothing is ever updated or deleted.

## Testing

**The test gate is on.** `AGENTS.md` declares `Test: npm test`, so step 1 and
step 2 each ship their evidence in the same diff.

| Claim | Proven by |
|---|---|
| Dollar strings become the right integer cents | Vitest, `lib/payout.test.ts` |
| The overdraft boundary is exact | Vitest |
| A serialization failure retries and a duplicate-key error does not | Vitest, with a fake that throws `P2034` and `P2002` |
| A valid request writes one request and one hold | `tsx` script, step 2 |
| An overdraft writes nothing | `tsx` script, step 2 |
| One idempotency key yields one request | `tsx` script, step 2 |
| **Two racing requests cannot both commit** | `tsx` script, step 2, two concurrent calls against a real Neon transaction |
| The form, its states, and the balance update | Browser, step 3 |

**Do not add a Playwright spec for this feature.** `AGENTS.md` describes the
harness as read-only, and `e2e/portal.spec.ts` asserts exact seeded figures:
9 history rows, `$1,284.50` available, `$340.00` pending. Any payout left behind
by manual testing or by the step 2 script breaks those assertions. **Run
`npm run db:seed` before `npm run test:browser`.** Automating a mutating payout
flow is a real harness change and belongs in its own `/browser-tests` run, not
smuggled into this feature.

## Notes for the AI

- **The pooled connection is the known risk.** `project-plan.md` section 9 flags
  it: an interactive transaction needs session affinity, and a transaction-mode
  pooler can refuse to hold one. Prove `$transaction` works over the app's
  `DATABASE_URL` at the very start of step 2, before building on it. If it fails,
  stop and report rather than quietly switching the whole app to `DIRECT_URL`
- `getCreator()` on the server, always. Nothing reads a creator id from the form
- Server components by default; only `PayoutRequestForm` gets `"use client"`
- Match `actions/accounts.ts`: the `{ success, error }` union, `console.error`
  before returning a generic message, `revalidatePath` last
- Money stays integer end to end. No `parseFloat`, no `/ 100`, no `toFixed`.
  Render through `formatMinor`
- Status is never signalled by colour alone, and the theme has no danger token.
  Follow the existing pattern: `role="alert"` plus words
- Never update or delete a `LedgerEntry`. Append only
- No em dashes in code, comments, or commit messages
- Comment the why, not the what. The signs, the isolation level, and the int4
  ceiling deserve a line each. The rest should not
