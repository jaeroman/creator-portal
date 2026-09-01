# Feature: Connected accounts

**From build-plan:** feature 3
**Status:** verified

## Goal

Fill `/accounts` with the creator's four linked channels: platform, on-platform
handle, connection state, follower count, and last synced time, plus connect and
disconnect actions that persist to the database.

This is the first surface that reads feature 1's seeded data and the first that
takes user input, so it sets two patterns features 4 through 6 inherit: how a
route queries scoped-to-the-creator data, and how a Server Action mutates it and
reports failure honestly.

## Design reference

None. No mockup and no `prototypes/` folder exists. The target is prose only:
an operations tool, plain and dense, tables for lists. Feature 2 locked the
theme tokens this feature styles against, so there is nothing visual to
recreate.

## Decisions this spec makes

| Question | Decision here |
|---|---|
| What do connect and disconnect actually do? | Flip `ChannelAccount.status` and, on connect only, stamp `lastSyncedAt` with the current time. Project-plan section 9 fixes this: "connect and disconnect flip stored state and stamp a fake sync time. No real OAuth, and the UI says so" |
| Does disconnect clear `lastSyncedAt`? | No. The schema comment says the field is "null until the channel has synced at least once", so null means never synced, not currently disconnected. Clearing it would erase the difference between the seeded X channel (never connected) and a channel that synced and was later disconnected |
| Cards or a table? | Table. The overview's UI rule is cards for summary figures, tables for lists, and four channels with five fields each is a list. Wrapped in a horizontal scroll container so a narrow viewport never forces the page body to scroll sideways |
| Schema library now, or later? | Not now. `coding-standards.md` says add one with the first feature that takes user input, which is this one, but the entire input surface is a channel id and a two-value intent, and the id is validated by the row lookup itself. Feature 6's payout amount is where parsing an untrusted number earns a schema library. **Flagged in the review packet as reversible** |
| Where does platform display naming live? | `lib/platforms.ts`, not this route. Feature 4 needs the same enum-to-label mapping for the posts feed and its `?channel=` filter, so it is a shared contract from the start |

## In scope

- `/accounts` querying the creator's `ChannelAccount` rows through `getCreator()`
- A table row per channel: platform label and handle, follower count, connection
  status, last synced time, and one action control
- `lib/platforms.ts`, the shared `Platform` enum to display-label mapping
- `lib/format.ts`, shared count and timestamp formatting
- `actions/accounts.ts`, one Server Action that connects or disconnects a channel
  and revalidates the route
- Pending and error states on the action, plus an empty state when no channels
  exist
- Visible on-screen disclosure that connect and disconnect are stand-ins, not
  real OAuth

## Out of scope

- Real OAuth, a provider redirect, token storage, or any network call to a
  platform. Explicitly a non-goal in project-plan section 3
- Adding, removing, or renaming channels. The four seeded rows are the set
- Post data (feature 4), any money figure or ledger read (features 5 and 6)
- Installing a schema library, a component library, or a test runner. `/tests`
  stays a separate explicit step before feature 6
- Sorting, filtering, or pagination controls on this table
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

- [x] **Step 1 - shared helpers and the read-only table** - add
  `lib/platforms.ts` exporting a `Platform` to display-label map (`YOUTUBE` to
  "YouTube", `TIKTOK` to "TikTok", `INSTAGRAM` to "Instagram", `X` to "X") and
  `lib/format.ts` exporting a follower count formatter and a last-synced
  formatter, both pinned to a fixed locale and UTC so a server-rendered string
  cannot disagree with the client. Rewrite `app/accounts/page.tsx` as a server
  component that resolves the creator, loads their channels ordered by follower
  count descending, and renders them in a table with a caption: Channel (label
  plus handle), Followers, Status, Last synced. Render never-synced as a clear
  "Never" rather than a blank cell, and render an honest empty state when the
  creator has no channels. No buttons and no mutation in this step.
  *Done when:* `/accounts` lists all four seeded channels in follower order
  (TikTok, YouTube, Instagram, X), the X row reads "Disconnected" and "Never",
  status is readable in a grayscale screenshot, the table does not make the page
  body scroll horizontally at 375px wide, and `npm run build` passes.

- [x] **Step 2 - the connect and disconnect action, end to end** - add
  `actions/accounts.ts` with a server action typed
  `(prevState: ChannelActionState, formData: FormData)` so it can drive
  `useActionState` directly. It reads `channelId` and `intent` from the form,
  rejects anything that is not a non-empty id plus `connect` or `disconnect`,
  and applies the change with a guarded `updateMany` whose `where` includes the
  creator id, the channel id, and the expected current status. Connect sets
  `CONNECTED` and stamps `lastSyncedAt` with the current time; disconnect sets
  `DISCONNECTED` and leaves `lastSyncedAt` alone. A zero-row result means the
  channel was already in the target state or does not belong to this creator,
  and is reported as a failure rather than a silent success. Return the
  `{ success, error }` shape from `coding-standards.md`, catch and log the real
  error server-side, and surface only a friendly message. Call
  `revalidatePath("/accounts")` on success. Add
  `components/accounts/ChannelActionButton.tsx`, the one client component, which
  wraps the row's form in `useActionState`, disables the button while pending to
  stop a double submit, and renders the returned error inline in its own row
  rather than at the top of the page. Add the visible note that these controls
  stand in for a real OAuth connection.
  *Done when:* disconnecting a connected channel flips it to "Disconnected" and
  the row persists across a hard reload, connecting the X channel flips it to
  "Connected" and replaces "Never" with a real timestamp, disconnecting again
  leaves that timestamp in place, the database reflects each change when queried
  directly, the button shows a pending label and is disabled while in flight, no
  raw error text or stack reaches the screen, and `npm run build` passes.

- [x] **Step 3 - failure probes and the accessibility pass** - prove the states
  the happy path cannot, and repair whatever the probes surface. Force the
  action to fail (submit an intent the row is already in) and confirm the
  friendly message renders inline with the rest of the table still usable.
  Confirm every button has an accessible name naming its channel rather than a
  bare "Connect", every control shows a visible focus ring, the status column
  and any error are legible without color, and the table reads correctly in both
  themes and at 375px.
  *Done when:* the forced failure renders inline and recovers on the next valid
  submit, tabbing reaches every button with a visible ring, a grayscale
  screenshot still distinguishes connected from disconnected, light and dark
  screenshots are both correct, the browser console is clean through a full
  connect and disconnect cycle, and `npm run build` passes.

## Files / areas

| Path | Why |
|---|---|
| `app/accounts/page.tsx` | placeholder out, the real channel table in |
| `lib/platforms.ts` | new. Shared enum-to-label map, load-bearing for feature 4 |
| `lib/format.ts` | new. Shared count and timestamp formatting |
| `actions/accounts.ts` | new. The first Server Action in the project |
| `components/accounts/ChannelActionButton.tsx` | new. The only client component here, added in step 2 |

`actions/` and `components/accounts/` do not exist yet; this feature creates
them, following the File Organization section of `coding-standards.md`.

## Data / contracts

- **Creator scoping.** The page resolves the creator through `getCreator()` and
  the action scopes its `where` by that creator id. No channel id from the
  client is ever trusted on its own, matching the overview's rule that server
  code never takes a creator id from the client.
- **Connect writes two fields, disconnect writes one.** Connect sets `status`
  and `lastSyncedAt`; disconnect sets only `status`. Feature 4 reads
  `lastSyncedAt` presentationally and must not assume it is null when
  disconnected.
- **`lib/platforms.ts` is the single source of platform labels.** Feature 4's
  channel filter uses the same map. Do not re-declare labels in a route.
- **No ledger, post, or payout read on this route.** Those belong to features 4
  through 6.
- **Action return shape** is `{ success: true }` or
  `{ success: false, error: string }`, the pattern `coding-standards.md`
  prescribes for Server Actions. The action takes `(prevState, formData)` so it
  drives `useActionState` without an adapter.
- **Form field names are fixed:** `channelId` and `intent`, where `intent` is
  exactly `connect` or `disconnect`. The client component and the action agree
  on these two names and nothing else.

## Testing

No `test` command is declared in the Commands section of `AGENTS.md`, so the
test gate is off, and `blueprint/config.json` sets
`verification.logicTests: "when-configured"`, so this feature is not blocked on
a runner. The action's branch logic is thin enough that the done-when evidence
covers it; feature 6 is where `/tests` earns its place, and open question 1 in
the overview already calls for running it before then.

No `Browser tests` command is declared either, so browser evidence is
`npm run dev` plus direct observation and screenshots, not an automated harness.
`npm run build` is the final automated gate; no `Verify` command exists yet.

Specifically:

- **Persistence** - after each action, query `ChannelAccount` directly and
  confirm the stored row matches what the page shows. A page that only looks
  right is not proof
- **The guard** - submit an action for a channel already in the target state and
  confirm it reports a failure rather than a silent success
- **Never-synced** - the X channel proves both the "Never" render and the
  connect-stamps-a-time path
- **Non-color status** - one grayscale screenshot per step that changes the table
- **Both themes** - light and dark screenshots at the end
- **Console** - no errors or failed requests during an action

## Notes for the AI

- **Server components by default.** The page and the table are server
  components. `ChannelActionButton` is the only client file, and only because it
  needs `useActionState`.
- **Never import `lib/prisma.ts`, `lib/creator.ts`, or `actions/accounts.ts`
  internals into a client component.** The client component receives a bound
  action and plain props, nothing else.
- **The route already renders per request.** `app/layout.tsx` exports
  `dynamic = "force-dynamic"` (feature 2's implementation note). Do not add
  another rendering directive; do still call `revalidatePath` so the client
  router cache updates after a mutation.
- **Honest states are required, not optional.** Empty, pending, and error each
  have a real render. Never leave a failed action silent.
- **Do not leak the raw error.** Log it server-side, show a friendly message.
- **Use the feature 2 tokens.** `bg-surface`, `border-border`, `text-muted`,
  `text-foreground`, `outline-accent`. No raw hex, no inline styles, no new
  one-off CSS variables, no `tailwind.config.js`.
- **Status is never signalled by color alone.** The status cell carries a word,
  not just a dot.
- **Keep the table dense and plain.** No icons, no avatars, no platform logos,
  no animation. This surface is deliberately quiet so feature 6 gets the time.
- **Conventions:** TypeScript strict, no `any`, the `@/*` import alias, comments
  only where the code cannot speak for itself, and no em dashes in any generated
  content. See `blueprint/context/coding-standards.md`.

## Implementation notes

**One repair during step 2, found by the step's own failure probes.** A zero-row
`updateMany` was reported as "That channel is already connected", which is a lie
when the id simply is not this creator's. The action now distinguishes the two
on the failure path only: it re-reads the row scoped to the creator, answers
"That channel could not be found." when there is none, and keeps the stale-page
message when there is. The happy path still costs one query.

**No browser was available for this run.** Playwright is not installed and this
feature's Out of scope section keeps it that way, so the visual done-whens were
proved structurally rather than by screenshot, and two were not proved at all.

What was verified, and how:

| Claim | Evidence |
|---|---|
| Four channels in follower order, X reads Disconnected and Never | Rendered HTML from the dev server |
| Connect flips status and stamps `lastSyncedAt` | Real server action POST, then a direct database read |
| Disconnect flips status and preserves `lastSyncedAt` | Same, timestamp unchanged across the write |
| Stale submit, unsupported intent, empty id, and unknown id each fail | Four probes, each returning its own `role="alert"` message with the row unchanged |
| Failure recovers on the next valid submit | Forced failure, then a successful connect on the same row |
| Every button names its channel | Accessible name computed from the rendered markup: "Disconnect TikTok", "Disconnect YouTube", "Disconnect Instagram", "Connect X" |
| Status survives without color | The status cell carries the literal word and no color utility |
| Focus ring and `sr-only` are real | Both utilities found compiled in the served stylesheet, `outline-color: var(--accent)` |
| No raw hex or inline styles | Grep across the five feature files |
| Typecheck, lint, build | `npx tsc --noEmit`, `npm run lint`, `npm run build`, all clean |

Three claims the agent could not observe, all resolved at completion:

- **Light and dark rendering.** Closed structurally: every token the feature
  uses (`surface`, `border`, `muted`, `foreground`, `accent`) is redefined under
  `prefers-color-scheme: dark` in the served stylesheet, and the feature
  introduces no color that is not a token
- **A clean browser console through a connect and disconnect cycle.** Confirmed
  by the user at `/complete`
- **The table at 375px**, where `overflow-x-auto` scrolls the table rather than
  the page body. Confirmed by the user at `/complete`

**Test residue.** The probes moved the X channel through connect and disconnect
several times. It was reset to its seeded state (`DISCONNECTED`, `lastSyncedAt`
null) at the end, so the database matches the seed.
