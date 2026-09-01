# Feature: Portal shell

**From build-plan:** feature 2
**Status:** verified

## Goal

Give the portal its frame: one shared layout with a header, persistent
navigation across `/accounts`, `/posts`, and `/wallet`, a theme token set the
next four features style against, and honest app-level loading, not-found, and
error states.

Nothing in this feature reads channel, post, or ledger data. It exists so
features 3 through 6 drop their real surfaces into a working shell instead of
each inventing chrome, and so the accessibility baseline (visible focus, status
never by color alone) is set once rather than retrofitted.

## Design reference

None. No mockup and no `prototypes/` folder exists, and the target is described
in prose only: an operations tool, plain and dense, cards for figures and tables
for lists. Nothing here recreates an existing design, so there is nothing to
capture. Features 3 through 6 inherit the tokens this feature locks.

## Decisions this spec makes

| Question | Decision here |
|---|---|
| Overview open question: what does `/` render? | Redirect to `/accounts`, the overview's own suggested call. A server-side `redirect()` in `app/page.tsx`, so routing stays in app code rather than `next.config.ts` |
| Does the header read the database? | Yes. It shows the seeded creator's display name and handle through a new shared resolver, which proves the shell is wired to real data and gives features 3 through 6 one place to resolve the creator. The cost is a failure path in the layout, which step 5 covers with `app/global-error.tsx` |
| What happens to the create-next-app boilerplate assets? | Step 2 proposes deleting `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, and `window.svg` once nothing imports them. Confirm at that step's review; the seeded `public/thumbnails/*.svg` stay |

## In scope

- A theme token set in `app/globals.css` (`@theme`, Tailwind v4 CSS-first),
  light and dark through `prefers-color-scheme`, replacing the create-next-app
  two-token placeholder
- Real app metadata (title and description) in place of "Create Next App"
- The three route files as minimal placeholders, so navigation actually
  navigates
- `/` redirecting to `/accounts`
- `lib/creator.ts` with the shared single-creator resolver, load-bearing for
  features 3 through 6
- A header showing the portal name plus the seeded creator's display name and
  handle
- Persistent client-side navigation with an active state that is not signalled
  by color alone
- App-level `loading`, `not-found`, `error`, and `global-error` boundaries

## Out of scope

- Any channel, post, ledger, or payout data on screen. The three pages are
  placeholders until features 3, 4, and 5 fill them
- Connect and disconnect actions (feature 3), the channel filter (feature 4),
  balance derivation and money formatting (feature 5), the payout flow
  (feature 6)
- A component library, a dark-mode toggle, a mobile hamburger menu, breadcrumbs,
  or a settings or profile route. Three links fit at every width
- Installing Vitest or turning on the test gate. That stays `/tests`, run after
  this feature and before feature 6 (overview open question 5)
- Deployment config (feature 8)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - theme tokens and app metadata** - replace the two placeholder
  variables in `app/globals.css` with the token set the shell and the next four
  features style against: page background, raised surface, foreground, muted
  foreground, border, and one accent, each defined for light and redefined
  under `prefers-color-scheme: dark`, exposed through `@theme inline` so
  Tailwind utilities resolve against them. Delete the
  `body { font-family: Arial, Helvetica, sans-serif }` rule, which currently
  overrides the Geist font the layout already loads. Set `metadata.title` to
  "Creator Portal" and write a real description. No layout or component work in
  this step.
  *Done when:* `npm run build` passes, the boilerplate page at `/` still renders,
  the browser tab reads "Creator Portal", body text renders in Geist rather than
  Arial, and switching the OS to dark changes the page colors.

- [x] **Step 2 - route skeletons and the home redirect** - add
  `app/accounts/page.tsx`, `app/posts/page.tsx`, and `app/wallet/page.tsx` as
  minimal server components, each rendering its `h1` and one line naming the
  feature that will fill it. Replace the create-next-app boilerplate in
  `app/page.tsx` with a server-side redirect to `/accounts`. Give each route a
  per-page `metadata.title`. Then propose deleting the five now-unused
  boilerplate SVGs in `public/` and wait for the go-ahead before removing them.
  *Done when:* visiting `/` lands on `/accounts` with the URL changed, all three
  routes render their own heading and title, no `next/image` import or Vercel
  template link remains in `app/`, and `npm run build` passes.

- [x] **Step 3 - creator resolver and header** - add `lib/creator.ts` exporting
  `getCreator()`, which resolves the single seeded `Creator` row on the server
  and throws a clear, actionable error when no row exists (pointing at
  `npm run db:seed`). Add `components/shell/PortalHeader.tsx` as a server
  component rendering the portal name plus the creator's display name and
  handle, and render it from `app/layout.tsx` above a `main` wrapper holding the
  shared max-width container. This is the shell's only database read.
  *Done when:* the header shows the seeded display name and handle on all three
  routes, `npx tsc --noEmit` passes, `lib/creator.ts` is imported only by server
  code, and each page's content sits inside the shared container rather than
  full bleed.

- [x] **Step 4 - persistent navigation** - add
  `components/shell/PortalNav.tsx`, the one client component in this feature,
  using `usePathname()` to mark the current route. Three `next/link` items:
  Accounts, Posts, Wallet. The active item carries `aria-current="page"` and a
  visible non-color cue (weight plus an underline or rule), because status is
  never signalled by color alone. Every link keeps a visible focus ring. Render
  it from the layout so it persists across navigation.
  *Done when:* clicking each nav item changes the route without a full page
  reload, the header and nav do not remount or flicker, the active item has both
  `aria-current="page"` in the DOM and a cue visible in a grayscale screenshot,
  and tabbing through the nav shows a focus ring on every link.

- [x] **Step 5 - loading, not-found, and error boundaries** - add
  `app/loading.tsx` (a quiet placeholder inside the shell), `app/not-found.tsx`
  (unknown route, with a link back to `/accounts`), `app/error.tsx` (client
  component, friendly message plus a `reset()` retry, no raw error or stack),
  and `app/global-error.tsx` to catch a failure in the layout itself, which is
  now possible because the header reads the database.
  *Done when:* `/nope` renders the 404 inside the shell chrome, temporarily
  throwing in `app/accounts/page.tsx` shows the friendly error with a working
  retry and no stack trace on screen, temporarily breaking `getCreator()` shows
  the global error page rather than an unhandled crash, both temporary changes
  are reverted, and `npm run build` passes.

## Files / areas

| Path | Why |
|---|---|
| `app/globals.css` | the theme tokens features 3 through 6 style against |
| `app/layout.tsx` | metadata, header and nav composition, `main` container |
| `app/page.tsx` | boilerplate out, redirect to `/accounts` in |
| `app/accounts/page.tsx` | placeholder, filled by feature 3 |
| `app/posts/page.tsx` | placeholder, filled by feature 4 |
| `app/wallet/page.tsx` | placeholder, filled by features 5 and 6 |
| `app/loading.tsx`, `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` | the honest states the plan requires |
| `components/shell/PortalHeader.tsx` | server component, portal name plus creator identity |
| `components/shell/PortalNav.tsx` | the only `'use client'` file here |
| `lib/creator.ts` | shared creator resolution, load-bearing |
| `public/*.svg` (five boilerplate files) | proposed deletion in step 2, confirmed at review |

`components/` does not exist yet; this feature creates it, following the File
Organization section of `coding-standards.md`.

## Data / contracts

Load-bearing. Features 3 through 6 build directly on these, so they are fixed
here and change only through a spec revision, not in passing.

- **Routes:** `/accounts`, `/posts`, `/wallet`, with `/` redirecting to
  `/accounts`. Feature 4 adds `?channel=<platform>` to `/posts` and must not
  move the path.
- **Creator resolution:** `getCreator()` in `lib/creator.ts` is the only way
  server code resolves the creator. It takes no arguments, resolves the single
  seeded row, and never accepts a client-supplied id (overview: features resolve
  it rather than taking a creator id from the client). Its return type is the
  generated Prisma `Creator`.
- **Theme tokens:** the names chosen in step 1 are the shared vocabulary.
  Features 3 through 6 use those utilities rather than raw hex values or new
  one-off variables.
- **Component location:** shared chrome lives in `components/shell/`. Feature
  components go in `components/<feature>/`.
- **No new database reads in the layout** beyond `getCreator()`. Per-route data
  is each feature's own concern.

## Testing

No `test` command is declared in the Commands section of `AGENTS.md`, so the
test gate is off for this feature. No `Browser tests` command is declared
either, so browser evidence is the dev server plus screenshots, not an automated
harness. Nothing here is the pure logic the scope rule targets: `getCreator()`
is thin data access, and the rest is layout and routing.

Evidence per step is the done-when above, gathered against `npm run dev`, with
`npm run build` as the final automated gate (no `Verify` command exists yet).

Specifically:

- **Navigation** - click all three items, confirm no full reload and no header
  remount
- **Active state** - inspect the DOM for `aria-current="page"`, and take one
  grayscale screenshot to prove the cue survives without color
- **Focus** - tab through header and nav, confirm a visible ring on every link
- **Dark mode** - switch the OS theme and screenshot both
- **Error states** - the temporary throws in step 5, reverted before the step
  closes
- **Build** - `npm run build` passes at the end of every step

Run `/tests` after this feature and before feature 6, so the payout logic ships
its Vitest coverage in the same diff (overview open question 5).

## Notes for the AI

- **Server components by default.** `PortalNav` is the only `'use client'` file
  in this feature, and only because it reads `usePathname()`. `app/error.tsx`
  and `app/global-error.tsx` are client components by framework requirement.
- **Never import `lib/prisma.ts` or `lib/creator.ts` into a client component.**
  The header is a server component and passes nothing sensitive downward.
- **Tailwind v4 is CSS-first.** Tokens go in `@theme` in `app/globals.css`. Do
  not create a `tailwind.config.js`. No inline styles, no component library.
- **Keep the token set small.** Six or so tokens the shell actually uses. Do not
  design a system for features that have not been spec'd.
- **Accessibility is a baseline, not a step.** Visible focus states, status
  never by color alone, real landmarks (`header`, `nav`, `main`), and one `h1`
  per page.
- **`app/layout.tsx` already uses Next 16 typed layout props** (`LayoutProps`)
  and loads Geist. Preserve both; the font currently loses to a stray `body`
  rule that step 1 removes.
- **Do not delete files without asking.** Step 2 proposes the boilerplate SVG
  cleanup and waits.
- **The placeholder pages are deliberately thin.** A heading and one line. Do
  not build tables, cards, or empty states that features 3 through 5 own.
- **Conventions:** TypeScript strict, no `any`, the `@/*` import alias, comments
  only where the code cannot speak for itself, and no em dashes in any generated
  content. See `blueprint/context/coding-standards.md`.

## Implementation notes

Two things the spec did not foresee, both found by step 5's probes and both
already applied.

1. **The shell renders per request.** `app/layout.tsx` exports
   `dynamic = "force-dynamic"`. Without it every route prerendered at build
   time, which baked the creator into the build, made `next build` require a
   reachable database, and left the error boundaries unreachable at runtime.
   The spec's premise for `global-error.tsx` (a layout failure is possible
   because the header reads the database) only holds with dynamic rendering.
   Features 3 through 6 inherit per-request rendering.

2. **The loading state sits on the three routes, not the root.** A root
   `app/loading.tsx` wraps `app/page.tsx` too, so `redirect("/accounts")` fired
   inside a Suspense boundary and degraded from an HTTP 307 to a client-side
   redirect. The markup now lives in `components/shell/RouteLoading.tsx`, with
   a one-line `loading.tsx` re-export in each of the three route folders. `/`
   returns a real 307 again.
