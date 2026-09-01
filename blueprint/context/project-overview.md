# Creator Portal - Project Overview

<!-- blueprint:source-hash 519b905ea4914d71e58ea661fcb4543b5bda5955189df36a1b605c9f32c045c4 -->

> A single-creator portal for working with a talent agency: connected channels,
> a unified post feed, and a wallet whose payout requests move through a real
> lifecycle.

## Problem

A creator signed to a talent agency has their channels on four platforms, their
content history inside each platform's own dashboard, and the money they are
owed sitting in agency spreadsheets and email. There is no single place to see
what is connected, what was published, and what is payable.

This portal is that place. Three read-mostly surfaces answer "what is
connected", "what did I post", and "what am I owed", and one action lets the
creator request a payout against their balance.

**Deliberate shape.** Breadth is intentionally shallow and seeded. One slice,
the payout lifecycle, is built to production depth with real persistence, real
transactions, and real failure behavior. Everything else exists to give that
slice a believable home.

## Users

- **The creator** - the only user. Assumed already authenticated; the app always
  renders one seeded creator. There is no login, no OAuth, and no account
  switching.
- **Agency staff** - a concept, not a user. They approve or reject payouts. With
  auth out of scope there is no agency login, so approve and reject appear as
  clearly labelled stand-in controls inside the creator's own view.

No access tiers. Every route is open and always resolves to the seeded creator.

## Features

In build-plan order. Feature 6 is the headline.

1. **Seeded portal data** - the Prisma schema, first migration, and a seed that
   produces one creator, four channels, about a dozen posts, and a ledger with a
   real available balance and pending earnings.
2. **Portal shell** - shared layout and persistent navigation across the three
   routes.
3. **Connected accounts** - each linked channel with its connection state,
   follower count, and last synced time, plus connect and disconnect actions
   that persist.
4. **Recent posts feed** - one list across all channels sorted by date, showing
   thumbnail or title, source channel, date, and engagement, filterable by
   channel through the URL.
5. **Wallet overview** - available balance, pending earnings, and transaction
   history, every figure derived from the ledger.
6. **Payout request lifecycle (headline)** - request against available balance,
   overdraft rejection, idempotent submission, funds held while pending, approve
   and reject transitions, and correctness under concurrent requests, covered by
   Vitest. Expected to split into 6a and 6b when spec'd.
7. **README and handover** - which slice was built and why, how to run it, what
   is seeded versus real, and what was deliberately left out.
8. **Vercel deployment** - Neon through Vercel Storage, env vars, migration and
   seed against the deployed database, and a verified live URL. Sits outside the
   three-hour build box.

## Data model

Postgres via Prisma. **All money is an integer count of minor units (US cents).**
No floats anywhere in the money path.

### Creator

- `id` (cuid) - primary key
- `displayName` (string)
- `handle` (string, unique)
- `createdAt` (DateTime)
- has many `ChannelAccount`, `LedgerEntry`, `PayoutRequest`

Exactly one row exists. Features resolve it rather than taking a creator id from
the client.

### ChannelAccount

- `id` (cuid)
- `creatorId` (FK to Creator)
- `platform` (enum: `INSTAGRAM` | `YOUTUBE` | `TIKTOK` | `X`)
- `handle` (string) - the on-platform handle
- `status` (enum: `CONNECTED` | `DISCONNECTED`)
- `followerCount` (Int)
- `lastSyncedAt` (DateTime, nullable) - null when never synced
- unique on (`creatorId`, `platform`)
- has many `Post`

### Post

- `id` (cuid)
- `channelAccountId` (FK to ChannelAccount)
- `externalId` (string) - the platform's own id
- `title` (string) - title or caption, depending on platform
- `thumbnailUrl` (string, nullable)
- `postedAt` (DateTime)
- `viewCount`, `likeCount`, `commentCount` (Int)
- unique on (`channelAccountId`, `externalId`)
- index on (`channelAccountId`, `postedAt`)

### LedgerEntry

Append-only. Rows are never updated or deleted; a correction is a new row.

- `id` (cuid)
- `creatorId` (FK to Creator)
- `type` (enum: `EARNING_PENDING` | `EARNING_CLEARED` | `PAYOUT_HOLD` |
  `PAYOUT_HOLD_RELEASE` | `PAYOUT` | `ADJUSTMENT`)
- `amountMinor` (Int, **signed**) - holds and payouts are negative, earnings and
  releases positive
- `description` (string)
- `payoutRequestId` (FK to PayoutRequest, nullable) - set on the four
  payout-related types
- `createdAt` (DateTime)
- index on (`creatorId`, `createdAt`)

### PayoutRequest

- `id` (cuid)
- `creatorId` (FK to Creator)
- `amountMinor` (Int, must be > 0)
- `status` (enum: `PENDING` | `APPROVED` | `REJECTED`)
- `idempotencyKey` (string, **unique**) - minted when the form renders
- `createdAt` (DateTime), `decidedAt` (DateTime, nullable),
  `decisionNote` (string, nullable)
- has many `LedgerEntry`

> **Locked shapes.** Features 5 and 6 both depend on the two derivations below.
> Change them in the plans and re-run `/overview` rather than diverging in code.
>
> - `pendingEarnings` = sum of `amountMinor` where `type = EARNING_PENDING`
> - `availableBalance` = sum of `amountMinor` where `type != EARNING_PENDING`
>
> Available balance falls out of the signed ledger with no special cases, because
> a hold is already a negative row.

### Payout lifecycle

| Event | Ledger written | Effect on available |
|---|---|---|
| Request submitted | `PAYOUT_HOLD` (negative) | Drops immediately |
| Request rejected | `PAYOUT_HOLD_RELEASE` (positive) | Returns to prior amount |
| Request approved | `PAYOUT_HOLD_RELEASE` (positive) and `PAYOUT` (negative) | Net unchanged, history shows the payout |

### Invariants the build must hold

1. Balances are always derived by summing the ledger, never stored in a column
   that can drift from history.
2. Available balance excludes pending earnings and excludes funds held by an
   open request.
3. Ledger entries are append-only.
4. A payout can never be created for more than the available balance at the
   moment it commits, including under concurrent requests.
5. Submitting the same request twice yields one payout request, not two.

## Tech stack

- **Next.js 16 (App Router)** - server-rendered routes, server components by
  default
- **React 19** - UI
- **TypeScript (strict)** - no `any`
- **Tailwind CSS v4** - styling through CSS-first theme tokens in
  `app/globals.css`, no component library
- **Prisma ORM** - schema, migrations, and the transactional payout write
- **Neon Postgres** - provisioned through Vercel Storage; chosen over SQLite
  because Vercel's filesystem is ephemeral and because real isolation levels
  make invariant 4 provable
- **Server Actions** - all mutations; no API routes are needed at this scope
- **Vitest** - unit tests scoped to the payout and balance logic
- **npm** - package manager

**Care points carried from the plan:**

- The payout commit runs in a serializable transaction that re-reads available
  balance inside the transaction boundary
- Idempotency is enforced by the unique index, not by an application-level check
- Prisma needs the pooled URL for queries and a direct URL for migrations
- The Vercel build must run `prisma generate`

## Monetization

Not in v1. This is an internal portal, not a revenue product. In the real
arrangement the agency takes a commission on brand deals, which would surface as
ledger entries; modelling commission is out of scope.

## UI/UX

An operations tool, not a marketing page: plain, dense, readable. Cards for
summary figures, tables for lists. Light and dark both work through the existing
theme tokens.

Styling stays minimal on the three read surfaces so the payout flow gets the
time. Non-negotiable baseline: labelled form controls, visible focus states,
status never signalled by color alone, and honest empty, loading, and error
states wherever one can occur.

- `/accounts` - connected channels with connect and disconnect
- `/posts` - unified feed, filtered by `?channel=<platform>`
- `/wallet` - balance, pending earnings, transaction history, and the payout
  request flow

> TODO: the plan does not say what `/` renders. Redirecting to `/accounts` is the
> obvious call; confirm when feature 2 is spec'd.

## Deployment

- **Host:** Vercel, deployed from GitHub
- **App type:** Next.js App Router, server-rendered
- **Build:** `prisma generate && next build`
- **Start:** Vercel-managed
- **Database:** Neon Postgres created through Vercel's Storage tab, which injects
  the connection string into the deployment; pull locally with `vercel env pull`
- **Env vars:** `DATABASE_URL` (pooled), `DIRECT_URL` (direct, migrations only)
- **Migrations:** `prisma migrate deploy` before the app serves traffic
- **Seed:** run once by hand against the deployed database
- **Workers or cron:** none
- **Health check:** the three routes render seeded data
- **Domain:** not specified

Deployment time sits outside the three-hour build box.

## Open questions

> Resolve these in the plans and re-run `/overview`, or settle them when the
> affected feature is spec'd.

1. **Neon is a prerequisite of feature 1, not feature 8.** Feature 1 runs the
   first migration against a real database, so the Neon instance and a local
   `DATABASE_URL` must exist before any build work starts. Feature 8 covers only
   deploying the app.
2. **Transaction history display is undecided** (carried from project-plan §9):
   raw ledger rows, or each payout request grouped into one row with its status.
   The append-only design writes two rows on approval, so this choice changes
   what feature 5 renders.
3. **`ADJUSTMENT` has no feature that writes it.** It exists in the data model
   for ledger completeness. Either accept it as seed-only or drop it.
4. **Post thumbnails need a source decision.** Remote URLs require
   `images.remotePatterns` in `next.config.ts`; local placeholder files avoid
   that. Feature 4 must pick one.
5. **The test gate is not on yet.** The plan commits to Vitest, but `AGENTS.md`
   declares no test command, so nothing enforces tests. Run `/tests` after
   feature 1 so feature 6 can ship its coverage in the same diff.
6. **Branch is `master` with no remote.** `/complete` merges to `main`, and the
   plan targets a GitHub-connected Vercel deploy. Rename before the first push.
