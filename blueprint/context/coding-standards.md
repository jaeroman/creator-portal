# Coding Standards

> Your conventions. Tuned by `/onboard` to the stack that actually exists here:
> Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4, ESLint 9,
> npm. Database, auth, and UI-kit choices are still open and marked `> TODO`.
> Edit this file whenever a convention becomes real.

## TypeScript

- Strict mode enabled
- No `any` types - use proper typing or `unknown`
- Define interfaces for all props, API responses, and data models
- Use type inference where obvious, explicit types where helpful

## React

- Functional components only (no class components)
- Use hooks for state and side effects
- Keep components focused - one job per component
- Extract reusable logic into custom hooks

## Next.js

- App Router, with routes at the repository root in `app/` (no `src/` directory)
- Import with the `@/*` alias, which maps to the project root
- Server components by default
- Only use `'use client'` when needed (interactivity, hooks, browser APIs)
- Use Server Actions for form submissions and simple mutations
- Use API routes when you need:
  - Webhooks (auth, payment, or Git provider callbacks)
  - File uploads with progress tracking
  - Long-running operations
  - Specific HTTP status codes or headers
  - Endpoints for future mobile/CLI clients
  - Third-party integrations
- Otherwise, fetch data directly in server components
- Dynamic routes for item/collection pages

## File Organization

- Pages: `app/[route]/page.tsx`
- Components: `components/[feature]/ComponentName.tsx`
- Server Actions: `actions/[feature].ts`
- Types: `types/[feature].ts`
- Lib/Utils: `lib/[utility].ts`

Only `app/` and `public/` exist so far. Create the others as the first feature
needs them rather than up front.

## Naming

- Components: PascalCase (`ItemCard.tsx`)
- Files: Match component name or kebab-case
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)

## Styling

- Tailwind CSS v4 for all styling
- CSS-first config: theme tokens live in `@theme` in `app/globals.css`, no `tailwind.config.js`
- No inline styles
- Light and dark are both handled through `prefers-color-scheme` in `app/globals.css`
- TODO: no component library is installed. Decide whether to add one (shadcn/ui or
  another) before the first UI-heavy feature.

## Database

> TODO: no database or ORM is installed. Record the choice, the migration
> workflow, and the deploy-time migration step here once the plans decide it.

## Data Fetching

- Server components fetch directly; client components go through Server Actions
- Validate every external input at the boundary (a schema library is not installed
  yet; add one with the first feature that takes user input)
- TODO: no auth provider is installed. Once one exists, scope every user-owned
  query by the authenticated user id from the server session, never a
  client-supplied id.

## Error Handling

- Use try/catch in Server Actions
- Return `{ success, data, error }` pattern from actions
- Surface user-friendly error messages in the UI; never leak raw errors or stack traces

## Testing

Vitest is configured and `npm test` is declared in `AGENTS.md`, so the test gate
is on. Config lives in `vitest.config.mts`; it collects `**/*.test.ts` only,
leaving Playwright's `e2e/*.spec.ts` alone, and resolves the `@/*` alias the same
way the app does.

When `AGENTS.md` declares a `Verify` command, treat it as the umbrella automated
gate. It combines only the checks this project actually has, in this order when
available: typecheck, tests, then build. The command does not enable an absent
test runner or replace focused evidence. It gives local work and optional CI one
exact command to run. `/ci` owns Verify and CI setup. `/tests` adds the real test
command to Verify when it already exists, but never creates CI only because
testing was configured.

**The opt-in switch is one signal: a `test` command in the Commands section of
`AGENTS.md`.** Declare one and **tests become a gate for logic-bearing steps**,
not an optional extra; leave it out and the loop verifies logic with the evidence
it already uses (run it, a screenshot, the build). Adding the runner is itself a
deliberate step, never a silent mid-step install. This is the single definition
of the switch; the skills and `ai-interaction.md` only point back here.

- **What to test (the scope rule):** pure logic where a wrong answer is possible -
  parsers, formatters, validators, id/slug builders, server actions. These have
  assertable inputs and outputs and real edge cases (empty, missing, malformed).
- **What not to test:** UI components and integration-level surfaces (render or
  export routes, anything driving a real browser or external service). Verify those
  with a screenshot and the build, not brittle unit tests.
- **The gate (when a runner is configured):** a build step that adds in-scope logic
  must ship a passing test in the same reviewable diff. The project's test command
  must be green before the step is approved, before any checkpoint commit, and
  before `/complete` merges. UI and integration-only steps are exempt and ride on
  screenshot plus build evidence.
- **When it's named:** the `/feature` spec's Testing section predicts the coverage,
  `/implement` writes the test with the step, and if a step surfaces logic the spec
  didn't foresee, add a focused test then.
- An empty suite should fail, not pass, so "no tests ran" never looks like "passed".
- Test files live next to source files (for example `feature.test.ts`).
- Run them via the project's test command (see Commands in `AGENTS.md`), not a
  hardcoded tool name.

Stack binding (swap for yours): a TypeScript app uses Vitest, `vi.mock()` for
external dependencies (Prisma, Clerk, etc.), and `vi.useFakeTimers()` for
time-dependent logic; a Python app would use pytest; a Go app `go test`.

## Browser Verification

For UI and integration behavior, prefer real browser evidence over reading the
code and assuming it works.

- Browser automation is separately opt-in through `/browser-tests`. That setup
  reuses a compatible runner or prefers Playwright for supported projects, then
  documents the exact command as `Browser tests` in `AGENTS.md`.
- When `Browser tests` is declared, add focused coverage for stable behavioral
  done-whens when it is proportionate, and run the documented command during
  `/check`. Do not assume it proves visual fidelity, real authenticated-profile
  behavior, browser chrome, or another claim the test does not observe.
- If no Browser tests command is declared, do not add a runner silently in the
  middle of an unrelated feature. Use the available dev server, browser
  screenshots, build output, API output, or manual evidence instead.
- Browser tests are not part of the default Verify command or CI unless the user
  separately chooses that slower gate.
- Browser evidence is especially important for flows that click, type, submit,
  navigate, download files, render complex layouts, or depend on client-side
  state.

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible

## Comments

Write code that explains itself; comment only what the code cannot say.
Over-commenting is a common AI tell, so resist it.

- Comment the **why**, not the **what**. Delete any comment that restates the code.
- No banner/header blocks, section dividers, or step-by-step narration of obvious
  code. A file does not need a comment announcing each region.
- A comment earns its place only when it captures something the code can't: a
  non-obvious decision, a gotcha or workaround, why a value is what it is, or a
  link to a spec or issue.
- Prefer self-documenting names and small functions over explanatory comments.
- Keep doc comments minimal: a one-line purpose on an exported type or function is
  plenty; don't write JSDoc that just repeats the signature.
- When in doubt, leave the comment out.

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages,
  READMEs, specs. They read as AI-generated.
- Use a hyphen for `term - description` separators; rephrase prose with commas,
  parentheses, or a colon. Avoid en dashes and the ellipsis character too.
