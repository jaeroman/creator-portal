# Feature: Seeded portal data

**From build-plan:** feature 1
**Status:** verified

## Goal

Stand up the persistence layer the whole portal reads from: a Prisma schema for
creator, channel accounts, posts, ledger entries, and payout requests, a first
migration applied to the real Neon database, and a deterministic seed that
produces one creator, four channels, about a dozen posts, and a ledger whose
sums yield a real available balance and pending earnings.

Nothing renders yet. This feature exists so features 2 through 6 read persisted
rows instead of hardcoded arrays, and so the transaction behavior feature 6
depends on is proven early rather than discovered late.

## In scope

- Prisma installed, configured against Neon, and generating a typed client
- The full schema for all five models and their enums, exactly as locked in
  `project-overview.md`
- The first migration, applied to the real Neon database
- A shared Prisma client singleton for server code
- A deterministic, re-runnable seed script
- Local placeholder thumbnail assets the seed points at
- One evidence-only smoke check that a serializable interactive transaction
  commits over the pooled Neon connection (plan section 9 risk: verify in
  feature 1, not feature 6)
- `db:migrate` and `db:seed` scripts, plus `prisma generate` in the build

## Out of scope

- Any route, page, layout, or component. No UI at all
- Balance derivation helpers in app code (feature 5 owns `availableBalance` and
  `pendingEarnings` as shipped functions; this feature only proves the seeded
  ledger sums to the intended figures)
- Payout request creation, approval, rejection, or idempotency logic (feature 6)
- Connect and disconnect actions (feature 3)
- Installing Vitest or turning on the test gate (open question 5: run `/tests`
  after this feature, before feature 6)
- Deploying, seeding the deployed database, or `vercel.json` (feature 8)

## Decisions this spec makes

Three overview open questions land in this feature, because the seed has to
write the columns they cover. Flagged so they get confirmed at review rather
than discovered mid-build.

| Open question | Decision here |
|---|---|
| 3. `ADJUSTMENT` has no feature that writes it | Keep it, seed-only. The seed writes exactly one `ADJUSTMENT` row so the type is exercised and the enum stays honest |
| 4. Post thumbnails need a source | Local files. Four placeholder SVGs under `public/thumbnails/`, so `next.config.ts` needs no `images.remotePatterns` now or in feature 4. Two or three posts keep `thumbnailUrl` null so the nullable path is real |
| 6. Branch is `master` with no remote | Already resolved in fact: the branch is `main`. No action, and that overview line is stale |

Open question 2 (raw ledger rows versus grouped payout requests in the history
view) stays open. It is a feature 5 display choice, and the append-only seed
supports either.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - install and configure Prisma** - add `prisma` and
  `@prisma/client` pinned to the same 7.x version, plus any driver-adapter
  package that major requires. Create the Prisma config and datasource wiring
  reading `DATABASE_URL` (pooled, for queries) and `DIRECT_URL` (unpooled, for
  migrations); both already exist in `.env.local`. Add `.env.example` naming
  those two vars with placeholder values. Add `db:migrate` and `db:seed`
  scripts, put `prisma generate` in front of `next build`, gitignore the
  generated client output directory, and record the two new commands in the
  Commands section of `AGENTS.md`. No models yet.
  *Done when:* `npx prisma -v` prints a CLI and client on the same major and
  minor, `npx prisma validate` passes, and `npm run build` still succeeds.

- [x] **Step 2 - write the schema** - all five models (`Creator`,
  `ChannelAccount`, `Post`, `LedgerEntry`, `PayoutRequest`) and all four enums
  (`Platform`, `ChannelStatus`, `LedgerEntryType`, `PayoutStatus`), matching the
  Data model section of `project-overview.md` field for field, including every
  unique constraint, index, relation, and nullability listed there. Money
  columns are `Int` minor units. No database change in this step.
  *Done when:* `npx prisma format` leaves the file unchanged and
  `npx prisma validate` passes with all five models present.

- [x] **Step 3 - first migration and client singleton** - run the initial
  migration against Neon over `DIRECT_URL`, and add `lib/prisma.ts` holding the
  client singleton (globalThis cache, so dev hot reload does not open a new
  connection pool per reload).
  *Done when:* a migration folder exists under `prisma/migrations/` with real
  SQL, `npx prisma migrate status` reports the schema up to date with nothing
  pending, a `SELECT` against one of the new tables returns zero rows without
  error, and `npx tsc --noEmit` passes with `lib/prisma.ts` importing the
  generated client.

- [x] **Step 4 - seed the creator, channels, and posts** - `prisma/seed.ts`
  writing one creator, four `ChannelAccount` rows (one per platform, with at
  least one `DISCONNECTED` and at least one `lastSyncedAt` null, so the empty
  states feature 3 has to handle have real data behind them), and 12 posts
  spread unevenly across the connected channels with varied `postedAt` dates and
  engagement numbers. Add the four placeholder SVGs under `public/thumbnails/`;
  two or three posts keep `thumbnailUrl` null. The seed clears its own data in
  FK-safe order first, so re-running it is safe and produces the same result.
  *Done when:* `npm run db:seed` succeeds twice in a row and, after the second
  run, counts are exactly 1 creator, 4 channels, and 12 posts, with no
  duplicate-key error and no orphaned rows.

- [x] **Step 5 - seed the ledger and one decided payout** - append-only
  `LedgerEntry` rows, one historical `APPROVED` `PayoutRequest` carrying its
  `PAYOUT_HOLD`, `PAYOUT_HOLD_RELEASE`, and `PAYOUT` triple, and exactly one
  `ADJUSTMENT` row. The composition is free; the two totals are fixed, because
  features 5 and 6 assert against them:
  - `pendingEarnings` (sum where `type = EARNING_PENDING`) = **34000** ($340.00)
  - `availableBalance` (sum where `type != EARNING_PENDING`) = **128450** ($1,284.50)

  Every `PAYOUT_HOLD` and `PAYOUT` amount is negative; earnings, releases, and
  the adjustment are positive. Every payout-related row sets `payoutRequestId`.
  *Done when:* a query run after `npm run db:seed` prints the two sums as exactly
  34000 and 128450, no `LedgerEntry` has `amountMinor` of 0, and the seeded
  payout request's three ledger rows net to its negative payout amount.

- [x] **Step 6 - prove the serializable transaction over the pooled URL** -
  evidence only, no committed application code. Run a throwaway script from the
  scratchpad that opens an interactive Prisma transaction at `Serializable`
  isolation over the pooled `DATABASE_URL`, reads the ledger sum inside the
  transaction boundary, writes and rolls back a probe row, and reports what
  happened. This is the plan's "verify early" risk check for feature 6.
  *Done when:* the output shows the transaction opened at Serializable
  isolation, read the balance, and committed or rolled back cleanly over the
  pooled connection. If it fails, or needs a connection-string change
  (`pgbouncer=true`, `connection_limit=1`, or dropping `channel_binding`), the
  working configuration is applied and the finding is written into the Notes
  section below, so feature 6 inherits it instead of rediscovering it.

## Files / areas

| Path | Why |
|---|---|
| `package.json` | Prisma deps, `db:migrate` and `db:seed` scripts, `prisma generate` before `next build` |
| `prisma/schema.prisma` | the five models and four enums |
| `prisma.config.ts` | only if the installed Prisma major requires it for schema location, env loading, and seed config |
| `prisma/migrations/**` | the first migration SQL, committed |
| `prisma/seed.ts` | deterministic seed |
| `lib/prisma.ts` | client singleton, the first file in `lib/` |
| `public/thumbnails/*.svg` | four local placeholders, one per platform |
| `.env.example` | documents `DATABASE_URL` and `DIRECT_URL` for feature 8 |
| `.gitignore` | ignore the generated client output directory |
| `AGENTS.md` | Commands section gains the two db commands |

`.env.local` already holds working Neon credentials and stays untracked. Do not
commit it, and never print the password into a file, log, or commit message.

## Data / contracts

Load-bearing. Features 3, 4, 5, and 6 all read these shapes, so they are fixed
here and change only through the plans plus a re-run of `/overview`.

- **Models and enums:** exactly as written in the Data model section of
  `blueprint/context/project-overview.md`. That section is the source of truth
  for field names, types, nullability, uniques, and indexes.
- **Money:** every amount is `Int` minor units (US cents). No float anywhere in
  the money path, the seed included.
- **Signs:** `LedgerEntry.amountMinor` is signed. `PAYOUT_HOLD` and `PAYOUT` are
  negative; `EARNING_PENDING`, `EARNING_CLEARED`, `PAYOUT_HOLD_RELEASE`, and
  `ADJUSTMENT` are positive.
- **Derivations (locked here, implemented in feature 5, asserted by step 5):**
  - `pendingEarnings` = sum of `amountMinor` where `type = EARNING_PENDING`
  - `availableBalance` = sum of `amountMinor` where `type != EARNING_PENDING`
- **Seeded totals:** pending 34000, available 128450. Feature 5's UI and
  feature 6's tests are written against these numbers.
- **Creator resolution:** exactly one `Creator` row exists. Later features
  resolve it on the server by its unique `handle` or as the single row, never
  from a client-supplied id.

## Testing

No test runner is configured, so the test gate is off for this feature, and
nothing here is unit-testable pure logic in any case; it is schema, migration,
and data. Evidence is the command output named in each step's done-when, plus
`npm run build` before the feature closes.

- **Schema** - `prisma validate` and `prisma format`
- **Migration** - the committed SQL plus a clean `prisma migrate status`
- **Seed** - run it twice, then count rows and print the two ledger sums
- **Transaction risk** - step 6's script output
- **Build** - `npm run build` succeeds with `prisma generate` in front of it

Run `/tests` after this feature and before feature 6, so the payout logic can
ship its Vitest coverage in the same diff (overview open question 5).

## Notes for the AI

- **Do not run a framework scaffolder.** This is an overlay on an existing app.
- **Pin Prisma deliberately.** As of writing, `prisma@latest` on npm is
  `8.0.0-rc.12`, a release candidate, while `@prisma/client@latest` is `7.10.0`.
  A bare `npm i prisma @prisma/client` installs a mismatched pair. Install the
  7.x line for both, confirm with `npx prisma -v`, and record the exact
  installed version in this file when step 1 lands.
- **Follow the installed major's own conventions** for generator provider,
  client output path, env loading, and where the seed command is declared. Check
  what that version's `prisma init` produces rather than assuming the older
  `package.json` `prisma.seed` key or the `prisma-client-js` generator.
- **Two URLs, two jobs.** Queries use pooled `DATABASE_URL`; migrations use
  unpooled `DIRECT_URL`. Both already exist in `.env.local`.
- **Node 26 runs TypeScript directly**, so the seed can run as
  `node prisma/seed.ts` without adding `tsx` or `ts-node`. If type stripping
  trips on something, add `tsx` rather than fighting it.
- **Never store a derived balance in a column.** Invariant 1. The schema has no
  balance field and must not grow one.
- **Ledger rows are append-only.** The seed inserts; nothing in this feature
  updates or deletes a `LedgerEntry` except the seed's own full reset before it
  re-inserts.
- **Server-only.** `lib/prisma.ts` is never imported into a client component.
- **Conventions:** TypeScript strict, no `any`, the `@/*` import alias, no em
  dashes anywhere in generated content, and comments only where the code cannot
  speak for itself. See `blueprint/context/coding-standards.md`.
- **Step 6 findings get written here**, under a short "Neon transaction notes"
  heading, so feature 6 starts from proven behavior.

## Neon transaction notes

Findings from step 6, measured against the real pooled Neon connection. Feature
6 should start from these rather than rediscovering them.

1. **Interactive transactions work over the pooled URL as-is.** `SHOW
   transaction_isolation` inside the transaction returned `serializable`, the
   ledger sum read correctly inside the boundary, and both a rollback and a
   commit behaved. No connection-string change was needed: no `pgbouncer=true`,
   no `connection_limit=1`, and `channel_binding=require` stayed in place.

2. **One `PrismaClient` serializes concurrent interactive transactions.** Two
   `$transaction` calls fired with `Promise.all` on a single client did not
   overlap; the second began only after the first committed, on a different
   backend pid. Both committed, which looks like a passing concurrency test but
   proves nothing. A feature 6 test that wants real contention must build two
   separate clients.

3. **With genuine overlap, Postgres aborts the loser and Prisma reports
   `P2034`.** Two clients, each reading `availableBalance` then writing a hold,
   produced: A committed, B failed with `P2034` (write conflict / serialization
   failure), and exactly one probe row landed. This is invariant 4 working, but
   it surfaces as a thrown error, so the payout action must catch `P2034` and
   either retry or return a clean "please try again" result rather than leaking
   the raw error.

4. **Connecting to Neon costs about 1 to 2 seconds** on a cold pool, so
   concurrency tests need timeouts with headroom; the probes used 20s.
