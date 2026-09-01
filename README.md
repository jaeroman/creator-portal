This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Project Overview
- A single-creator portal for working with a talent agency: connected channels, a unified post feed, and a wallet whose payout requests move through a real lifecycle.

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

## Chosen Slice
> I chose Slice B (Payout Request). I want features that have lifecycle, database work like history or records. I'm into logic and understanding how payout or this feature works like receiving payments, adding amounts amounting to the total balance, conditions to check whenever a payout is being made.

## Assumptions made
- Since we didn't have logins or other roles, I added stand-in controls for payout reviews and approval
- Added lifecycle for payment that are cleared and not cleared which then goes into the available balance

## What would I have built with more time
- Login/Auth, Roles
- Recent Posts page
- Page for Payout approvals
- Payout approve/reject description

## Changed by me
- How the history will look if the payout request is rejected, AI wanted to just put -$50.00 instead of $0 which can cause confusion to the user.
- Added the Stand-in controls to simulate the lifecycle