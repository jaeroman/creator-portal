---
name: build-order-payout-first
description: "Feature 4 (posts feed) is deliberately deferred; build order is 5, then /tests, then 6, then 4."
metadata: 
  node_type: memory
  type: project
  originSessionId: a8fc18a9-96d6-4d49-9ec3-2887247e10ca
  modified: 2026-09-01T13:34:44.825Z
---

On 2026-09-01, after feature 3 merged, the user chose to skip build-plan feature
4 (Recent posts feed) and build in this order instead:

1. Feature 5, Wallet overview
2. `/tests`, wiring Vitest
3. Feature 6, Payout request lifecycle (the headline slice)
4. Feature 4, Recent posts feed, last

**Why:** the project has a roughly three-hour build box and feature 6 is the one
slice meant to reach production depth. Feature 4 is a shallow read-only surface
with nothing downstream depending on it, so it is the only safe thing to defer.
The `/tests` step sits before 6 because the plan promises Vitest coverage for
concurrency, overdraft, and idempotency, and that coverage should ship in the
same diff as the logic.

**How to apply:** use `/feature 5` and `/feature 6` explicitly. Plain `/feature`
picks the next unchecked build-plan item, which is still 4. Do not renumber the
build plan; archived specs refer back to those numbers.
