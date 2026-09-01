# Project Plan

> One of the two planning docs you provide. Use as much detail as the project
> needs, including rationale, constraints, examples, edge cases, and explicit
> exclusions that should guide later feature work. Draft it directly, develop it
> through any AI conversation, or optionally run `/discovery` for a guided deep
> planning session. The content is always yours to direct. When it is filled in,
> run `/overview` to generate the project overview from this plus `build-plan.md`.

## 1. Problem - What problem are we solving?

A creator signed with a talent agency has their working life spread across
places: channel presence on four platforms, content history in each platform's
own dashboard, and money owed sitting in agency spreadsheets and email threads.
There is no single view of what is connected, what was published, and what they
are owed.

This portal is that view. Three read-mostly surfaces answer "what is connected",
"what did I post", and "what am I owed", and one action surface lets the creator
request a payout against their balance.

Deliberate shape: this is a focused build, roughly three hours for the app plus
separate deployment time. Breadth is intentionally shallow and seeded. One
slice, the payout request lifecycle, is built to production depth with real
persistence, real transactions, and real failure behavior. The reasoning goes in
the README.

## 2. Users - Who is this for?

**The creator (the only user).** Signed to the agency, active on several
platforms, opens the portal to check on their channels and, occasionally, to ask
for their money. Assumed already authenticated; the portal always shows one
seeded creator.

**Agency staff (a concept, not a user).** They approve or reject payout
requests. With authentication out of scope there is no agency login, so approve
and reject appear as clearly labelled stand-in controls in the creator's view.

Explicitly not users: multiple creators, account switching, agency
administrators with their own dashboard.

## 3. Features - What does the MVP need?

- Connected accounts: linked channels with connection state, follower count,
  last synced time, and connect/disconnect actions that persist
- Recent posts: one unified feed across channels, filterable by channel
- Wallet: available balance, pending earnings, and transaction history
- Payout request: creator requests a withdrawal that moves through a real
  pending to approved or rejected lifecycle

**Non-goals**, each a deliberate exclusion rather than an oversight:

- Authentication, real OAuth, login screens, account switching
- Live post fetching from a real source (Slice A, not the slice chosen)
- Multiple creators, agency-side dashboard, role-based permissions
- Notifications, email, multi-currency, tax handling, real payment rails

## 4. Data - What are we storing?

Postgres via Prisma. All money is stored as integer minor units (cents, USD) to
avoid float error.

- **Creator** - one seeded row: display name, handle
- **ChannelAccount** - platform (Instagram, YouTube, TikTok, X), handle,
  connection state, follower count, last synced timestamp
- **Post** - belongs to a channel account: title, thumbnail, posted date, view,
  like, and comment counts
- **LedgerEntry** - append-only, signed amounts. Types: pending earning, cleared
  earning, payout hold, hold release, payout, adjustment
- **PayoutRequest** - amount, status (pending, approved, rejected), a unique
  idempotency key, created and decided timestamps

**Invariants the build must hold:**

1. Balances are always derived by summing ledger entries, never stored in a
   column that can drift from history
2. Available balance excludes pending earnings and excludes funds held by an
   open payout request
3. Ledger entries are append-only. A correction is a new entry, never an edit
4. A payout can never be created for more than the available balance at the
   moment it is committed, including under concurrent requests
5. Submitting the same request twice yields one payout request, not two

**Lifecycle mechanics:** submitting creates a hold that reduces available
balance immediately. Rejection releases the hold. Approval releases the hold and
records the payout, leaving available balance unchanged and history readable.

## 5. Tech - What stack are we using?

- Next.js 16 (App Router), React 19, TypeScript strict
- Tailwind CSS v4, CSS-first theme tokens, no component library
- Prisma ORM against Neon Postgres, provisioned through Vercel Storage
- Server Actions for mutations; no API routes needed for this scope
- Vitest for unit tests, scoped to the payout and balance logic
- npm

**Why Postgres over SQLite:** the target is Vercel, whose filesystem is
read-only and ephemeral, so SQLite writes would not survive. Postgres also
supplies real isolation levels, which is what makes the concurrency guarantee in
invariant 4 provable rather than asserted.

**Known technical care points:**

- Payout commits run inside a serializable transaction that re-reads available
  balance inside the transaction boundary
- Idempotency is a unique database index on the request key, so the guarantee
  lives in the database rather than in application checks
- Prisma needs the pooled connection for queries and a direct connection for
  migrations
- The Vercel build must run `prisma generate`

## 6. Monetize - How will this make money?

Not applicable. This is an internal portal, not a revenue product. In the real
arrangement the agency takes a commission on brand deals, which would appear as
ledger entries; modelling commission is out of scope here.

## 7. UI/UX - How should this look and feel?

Three routes under a shared shell with persistent navigation: `/accounts`,
`/posts`, `/wallet`. Plain, dense, and readable, like an operations tool rather
than a marketing page. Cards for summary figures, tables for lists.

Light and dark both work through the theme tokens already in `app/globals.css`.

Given the time box, styling stays minimal on the three read surfaces so the
payout flow gets the attention. Baseline quality that is not negotiable: labelled
form controls, visible focus states, status never communicated by color alone,
and honest empty, loading, and error states on any surface that can hit one.

## 8. Deployment - Where and how will this ship?

- **Host:** Vercel, deployed from GitHub
- **App type:** Next.js App Router, server-rendered
- **Build:** `prisma generate && next build`
- **Start:** Vercel-managed
- **Database:** Neon Postgres created through Vercel's Storage tab, so
  `DATABASE_URL` is injected into the deployment; pull it locally with
  `vercel env pull`
- **Env vars:** `DATABASE_URL` (pooled), `DIRECT_URL` (direct, migrations only)
- **Migrations:** `prisma migrate deploy` before the app serves traffic
- **Seed:** run once by hand against the deployed database
- **Workers or cron:** none
- **Health check:** the three routes render seeded data

Deployment time sits outside the three-hour build box.

## 9. Risks, assumptions, and open items

- **Assumption:** pending earnings are earned but not yet clearable, and payouts
  draw only against available balance
- **Assumption:** connect and disconnect flip stored state and stamp a fake sync
  time. No real OAuth, and the UI says so
- **Risk:** Prisma interactive transactions over a pooled connection need the
  connection configured correctly. Verify early, in feature 1, not in feature 6
- **Risk:** the deployed database holds obviously seeded data on a public URL.
  Acceptable for a demo, worth a README line
- **TODO:** decide whether transaction history shows raw ledger entries or
  groups each payout request into one row with its status

## 10. Success criteria - how this is judged

1. All three surfaces render real persisted data, not hardcoded arrays
2. A payout request above available balance is rejected with a clear message and
   writes nothing
3. Submitting the same request twice produces exactly one payout request
4. Two concurrent requests that would together exceed the balance cannot both
   succeed
5. Approve and reject each move the balance correctly, and history stays
   consistent with the displayed figures
6. Ledger sums always equal the displayed available balance
7. Tests pass, the build passes, and the deployed URL works
8. The README states which slice was built and why
