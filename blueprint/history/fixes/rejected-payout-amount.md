# Fix: rejected payout requests read as money out

**Type:** Fix
**Status:** verified

## The problem

On `/wallet`, a rejected payout request shows its full amount as a negative
figure in the Amount column, the same as an approved one:

| Date | Description | Status | Amount |
|---|---|---|---|
| Sep 1, 2026 | Payout request | Approved | -$50.00 |
| Sep 1, 2026 | Payout request, funds returned to your balance | Rejected | **-$50.00** |

Nothing left the balance on that second row. The hold was placed and released,
so the net effect is zero, and the available balance above the table proves it.
The number contradicts the figure it is meant to explain.

`lib/wallet.ts:86` negates every payout request's amount regardless of status:

    // Stored positive; shown as money leaving, matching the ledger's sign.
    amountMinor: -payout.amountMinor,

That is right for `PENDING` (funds are held, available has dropped) and right for
`APPROVED` (the money is gone). It is wrong for `REJECTED` only.

The status and the description already say what happened, so this is misleading
rather than broken, which is why it was left out of feature 6b rather than
folded into it.

## The fix

Make a payout row's amount mean **its net effect on available balance**, which
is what every other row in the table already means:

| Status | Net effect | Amount shown |
|---|---|---|
| `PENDING` | funds held | `-$50.00` |
| `APPROVED` | hold released, payout sent | `-$50.00` |
| `REJECTED` | hold released, nothing sent | `$0.00` |

Zeroing the column would hide how much was asked for, so the row carries the
requested figure into its description instead: "Payout request for $50.00, funds
returned to your balance".

**Must not break:**

- Balances stay summed from the ledger. This is a display change only, and
  `sumAvailableBalance` and `sumPendingEarnings` are not touched
- The seeded approved request keeps reading `-$440.00`. `e2e/portal.spec.ts`
  asserts that string and a 9 row count, so a regression here fails the browser
  smoke suite
- Pending requests keep showing the negative held amount, because the money
  really is out of reach while a request is open

## Build steps

- [x] **Step 1 - net effect, with its test** - in `lib/wallet.ts`, add a pure
  `payoutNetMinor(status, amountMinor)` returning `0` for `REJECTED` and
  `-amountMinor` otherwise, and use it where `getWalletHistory` builds the payout
  row. Add `requestedMinor` (always positive) to that row's shape so the page can
  name the figure. In `app/wallet/page.tsx`, extend `describe()` so a rejected
  row reads "Payout request for $50.00, funds returned to your balance" through
  `formatMinor`. Add `lib/wallet.test.ts` covering `payoutNetMinor` for all three
  statuses plus a zero amount.
  *Done when:* `npm test` passes with the new cases named; on `/wallet` a
  rejected request shows `$0.00` in Amount with its requested figure in the
  description, a pending request still shows the negative held amount, the
  seeded approved row still shows `-$440.00`; and `npm run build` and
  `npm run test:browser` both pass against a freshly seeded database.

## Verify

1. `npm run db:seed`, then open `/wallet`
2. Request $50.00. The new row reads `-$50.00`, Pending, and available drops
3. Reject it in Agency review. The row flips to `$0.00`, Rejected, description
   naming $50.00, and available returns to $1,284.50
4. Request $50.00 again and approve it. That row reads `-$50.00`, Approved
5. The seeded Jul 15 row still reads `-$440.00`, Approved
6. `npm test`, `npm run build`, and `npm run test:browser` all pass

## Notes for the AI

- Display only. Do not touch `sumAvailableBalance`, `sumPendingEarnings`, or any
  ledger write. No migration
- `WalletHistoryRow` is consumed only by `app/wallet/page.tsx`, so adding
  `requestedMinor` is contained
- Money stays integer end to end. Render through `formatMinor`
- Re-seed before `npm run test:browser`; the harness asserts exact seeded figures
- No em dashes in code, comments, or commit messages
