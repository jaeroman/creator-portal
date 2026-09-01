# Build Plan

> One of the two planning docs you provide. Write it directly, develop it through
> any AI conversation, or optionally run `/discovery`. Keep the items high-level
> even when `project-plan.md` is detailed; later `/feature` specs hold the depth
> for each build item.

The features that make up this project, high level and in rough build order, one
line each, no detail (that comes per feature). Rough is fine at first, but before
`/overview` runs this file should be shaped into a checkbox list the build loop
can track.

Keep it as a checklist. Run `/feature` with no number to spec the **next
unchecked** item, or `/feature 3` / `/feature "login"` to pick a specific one.
Completed features get checked off here, so the build plan doubles as your
progress tracker. A big item gets split into sub-items (4a, 4b, etc.) when you
spec it.

## Continuing after the initial build

This is a living roadmap, not a plan that freezes when the first release is
done. Keep completed items checked, then append new unchecked features as the
project grows. Optional milestone headings such as `## MVP` and `## Post-MVP`
keep a longer plan readable without changing how `/feature` finds the next
unchecked item.

Do not renumber completed features because their archived specs refer back to
those numbers. Continue with the next unused number. If a new feature materially
changes the product direction, users, data, stack, monetization, UI/UX, or
deployment, update the relevant part of `project-plan.md` too. Then re-run
`/overview` before spec'ing the feature.

You can edit this file directly or ask the AI to start a new feature by name. If
`/feature "team workspaces"` does not match an existing item, it will propose the
new build-plan line and any necessary project-plan changes, wait for approval,
refresh the overview, and then write the feature spec.

Scaffolding the app (create-next-app, etc.) and prototyping the look are
pre-build steps, not features (see the README), so don't list them here. Start
with your first real slice of functionality.

A common order that works well: build the core UI with placeholder data first,
then wire up data, auth, and integrations. Add deployment readiness only when
the app is worth shipping or a provider config change is part of the work. Adapt
it to your project.

## Format

Use checkboxes. Each item should be a feature-sized outcome, not a loose task or
a whole product area.

Good:

- [ ] 1. **Skill submission** - upload a skill package and save its metadata
- [ ] 2. **Validation result** - run checks and show pass/fail status for a skill
- [ ] 3. **Directory listing** - browse and filter published skills
- [ ] 4. **Deployment readiness** - configure Render or Vercel and verify the
  production build

Avoid:

- Upload stuff
- Database
- Make it look nice
- Auth, billing, dashboard, validation, and deploy

If your first pass is just rough bullets, that is okay. Run `/overview` after
filling both planning docs; it will flag plan-shape problems and can propose a
cleaned-up checkbox version before generating the project overview.

## MVP - the three-hour build box

- [x] 1. **Seeded portal data** - Prisma schema for creator, channel accounts,
  posts, ledger entries, and payout requests; first migration against Neon; seed
  script producing one creator, four channels, about a dozen posts, and a ledger
  that yields a real available balance and pending earnings
- [x] 2. **Portal shell** - shared layout and persistent navigation across the
  three routes
- [x] 3. **Connected accounts** - list each linked channel with connection state,
  follower count, and last synced time, with connect and disconnect actions that
  persist
- [ ] 4. **Recent posts feed** - unified list across channels sorted by date,
  showing thumbnail or title, source channel, date, and engagement numbers, with
  a channel filter held in the URL
- [x] 5. **Wallet overview** - available balance, pending earnings, and
  transaction history, every figure derived from the ledger
- [ ] 6. **Payout request lifecycle** - the depth slice. Request against
  available balance, overdraft rejection, idempotent submission, funds held while
  pending, approve and reject transitions, and correctness under concurrent
  requests, with Vitest coverage on the logic. Expect this to split into 6a and
  6b when spec'd
- [ ] 7. **README and handover** - which slice was built and why, how to run it,
  what is seeded versus real, and what was deliberately left out

## Deployment - outside the build box

- [ ] 8. **Vercel deployment** - Neon database through Vercel Storage, env vars,
  migration and seed on the deployed database, and a verified live URL

## Deferred

Not in scope now, listed so the decisions are not lost:

- Slice A, live post fetching from a real source
- Agency-side dashboard with its own authentication
- Notifications when a payout changes status
