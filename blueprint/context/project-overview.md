# Creator Portal - Project Overview

<!-- blueprint:source-hash caba5cdb91c0f6f0b38b6424971a8f1b6206a2ccff7efcbf239d867ff218e113 -->

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
slice a believable home. The build box is roughly three hours, with deployment
time on top.

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

1. **Seeded portal data** (shipped) - the Prisma schema, first migration, and a
   seed producing one creator, four channels, twelve posts, and a ledger whose
   sums give a real available balance and pending earnings.
2. **Portal shell** (shipped) - shared layout, persistent navigation, the theme
   tokens later features style against, and app-level loading, not-found, error,
   and global-error states. Renders per request rather than prerendering, so the
   database is never baked into the build.
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

Deferred by decision, not oversight: live post fetching from a real source, an
agency-side dashboard with its own auth, and payout status notifications.

## Data model

Postgres via Prisma. **All money is an integer count of minor units (US cents).**
No floats anywhere in the money path.

### Creator

- `id` (cuid) - primary key
- `displayName` (string)
- `handle` (string, unique)
- `createdAt` (DateTime)
- has many `ChannelAccount`, `LedgerEntry`, `PayoutRequest`

Exactly one row exists. Server code resolves it through `getCreator()` in
`lib/creator.ts`, never from a client-supplied id.

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

Seeded totals the later features are written against: pending earnings 34000
($340.00), available balance 128450 ($1,284.50).

### Payout lifecycle

| Event | Ledger written | Effect on available |
|---|---|---|
| Request submitted | `PAYOUT_HOLD` (negative) | Drops immediately |
| Request rejected | `PAYOUT_HOLD_RELEASE` (positive) | Returns to prior amount |
| Request approved | `PAYOUT_HOLD_RELEASE` (positive) and `PAYOUT` (negative) | Net unchanged, history shows the payout |

### Transaction history shape

Decided in project-plan §9. The wallet's history list is **not** raw ledger
rows. It is two sources merged and sorted by date:

- **one row per `PayoutRequest`**, carrying its amount, date, and status
  (`PENDING`, `APPROVED`, or `REJECTED`), collapsing the one to three ledger
  rows behind it into a single line
- **each `LedgerEntry` with a null `payoutRequestId`** as its own row, which is
  how earnings and adjustments stay visible

This is a display choice only. Every figure, balances included, is still summed
from the ledger. It does mean feature 5 reads `PayoutRequest` directly, so
feature 6's approve and reject must keep `PayoutRequest.status` consistent with
the ledger rows they write.

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
summary figures, tables for lists. Light and dark both work through the theme
tokens in `app/globals.css`.

Styling stays minimal on the three read surfaces so the payout flow gets the
time. Non-negotiable baseline: labelled form controls, visible focus states,
status never signalled by color alone, and honest empty, loading, and error
states wherever one can occur.

- `/` - redirects to `/accounts`
- `/accounts` - connected channels with connect and disconnect
- `/posts` - unified feed, filtered by `?channel=<platform>`
- `/wallet` - balance, pending earnings, transaction history, and the payout
  request flow

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

1. **The test gate is still off.** The plan commits to Vitest, but `AGENTS.md`
   declares no test command, so nothing enforces tests. Run `/tests` before
   feature 6 so the payout logic ships its coverage in the same diff. This is
   the only open item that blocks planned work.
2. **Two feature 1 decisions live only in its archive, not in the plans.**
   `blueprint/history/features/01-seeded-portal-data.md` settled them and the
   shipped code follows them, but `project-plan.md` §4 does not record either:
   - `ADJUSTMENT` is kept as a seed-only ledger type, exercised by exactly one
     seeded row, because no feature writes it
   - post thumbnails are local SVGs under `public/thumbnails/`, so
     `next.config.ts` needs no `images.remotePatterns`
   Fold them into §4 if the plan should be the record; otherwise the archive
   stands and this item can be deleted.
