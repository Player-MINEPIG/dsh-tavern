# Development changelog


## 2026-08-22 — Make swipe generation immediately visible

- Displayed the reply position from the first variant onward, beginning at `1/1` instead of waiting for a second swipe.
- Added an optimistic RP-only thinking projection as soon as “generate next swipe” is clicked. It preserves the user turn, temporarily replaces the old assistant display, restores it on failure, and yields to the new session only after the existing atomic branch/timeline workflow succeeds.


## 2026-08-22 — Separate character sort modes and recover missing cards

- Replaced mixed character ordering with explicit recently-updated, name A–Z, and custom modes; drag handles are active only in custom mode and saved custom order survives mode switches.
- Added bounded deleted-character tombstones, a centralized missing-character sidebar section, unique SHA/name recovery, manual relinking, catalog CAS and atomic descendant-session selection updates.
- Added per-playthrough character relinking to every playthrough menu. It migrates only the selected playthrough tree, warns when the target falls outside SHA/unique-name automatic classification, and preserves an explicit user override through the v2 lifecycle API.


## 2026-08-22 — Stabilize RP admission and add character-card ordering

- Deferred the Mowan workspace admission overlay until the authoritative workspace read finishes. A valid existing binding no longer renders a transient selection dialog while switching modes; failures and confirmed missing bindings still open the blocking gate.
- Renamed the ordinary-session notice around its actual boundary: the session is not attached to a playthrough in the selected RP workspace. The notice no longer implies that a stale character selection alone makes the session part of a playthrough.
- Added preset-style pointer dragging for character-card groups in the RP sidebar. Before customization, cards sort by `updatedAt` descending and then name/ID A→Z; dragging persists an exact resource order without rewriting card documents or timestamps.
- Added the v1 `PUT /characters/order` resource contract, bounded durable `characterOrder` state, deletion cleanup, optimistic UI updates with authoritative read-back, and API/client/store regressions.
- Rebuilt the browser bundle and completed the full suite with 488 passing, 2 fixture-dependent skips, and 0 failures.
## 2026-08-22 — Require a verified RP workspace before entering Mowan

- Added a blocking first-run workspace admission view that consumes the public DSH workspace list and the existing v2 workspace authority.
- Required an explicit user choice even for a single candidate; no browser-side workspace truth or automatic selection was added.
- Kept the gate open through PUT and authoritative GET read-back. Missing lists, stale paths and read/write failures remain recoverable through retry or a return to native DSH mode.

## 2026-08-22 — Add grouped 2.0 release verification

- Added `npm run verify:2.0` for named history, managed-document/CAS/path, claim/logging, chrome/workspace-admission, and package-boundary evidence, followed by build and pack dry-run.
- Made Windows path-hardening tests fall back to junctions, so external/root-in reparse points and parent replacement before rename execute instead of silently passing or skipping when directory symlinks require extra privileges.
- Replaced the live-Host placeholder assertion with real, read-only requests to the running DSH chrome and workspace authority; no live data is mutated by this smoke test.
- Kept mutating Host/browser checks separate: multi-tab notification, first-run visual states and disable/uninstall fallback remain manual release gates.


## 2026-08-22 — Align the unbound-session notice with the native composer

- Constrained the RP unbound-session notice with DSH's inherited `--dsh-composer-card-max-width` instead of filling the conversation-wide dock after history exists.
- Kept the notice centered with a 100% fallback, so host or plugin composer-width changes remain authoritative without hashed DOM selectors or a copied pixel width.

## 2026-08-22 — Separate conversation display scaling from UI settings

- Added a Mowan-only Conversation Settings surface with independent 75%–150% controls for RP body/greeting text and durable-QA message actions.
- Persisted the two values in bounded `conversation-settings.json` through the separate v1 `/conversation-settings` contract; UI language/global panel scale remain in `ui-settings.json`.
- Applied local CSS variables only to the RP chat, blank-playthrough opening dock, and message action row. Native DSH, the composer, Tavern resource panels, prompts, history, and exports are unchanged.

## 2026-08-22 — Detach mismatched character sessions from playthroughs

- Added the v2 `POST /playthroughs/:id/detach-session` lifecycle endpoint. It removes the target session variants and descendant branches from Tavern timeline metadata while preserving sibling branches, DSH sessions, source history, and the empty playthrough.
- Added a v1 character-selection membership guard with structured 409 conflicts and a bundled confirmation modal. Confirmed changes detach first and retry the original selection; cancellation changes nothing.
- Vacant playthroughs now accept a fresh blank root session on the next create action, preserving their title and number.
- Kept the rc.8 shell-owned outer New Session control untouched. The ordinary-session `+` guides users back to native mode; README and usage docs record why the outer control cannot be intercepted through a public seam.

## 2026-08-21 — Scope swipe motion to the changed reply

- Added the swiped timeline `nodeId` to the one-shot transition intent.
- Kept the greeting, common QA prefix and target user bubble stationary; only
  the selected assistant reply and any divergent descendant branch now move.
- Returned the actual source node from context-output retry so its animation
  follows the nearest reusable real-user QA rather than the context row.

## 2026-08-21 — Animate atomic RP swipe handoffs

- Retained the outgoing conversation snapshot until the destination session
  finished loading, then rendered both snapshots for a directional handoff.
- Added previous/next swipe motion with reduced-motion fallback, bounded
  in-memory snapshot reuse across host remounts, and a timed cleanup fallback.
- Kept stale snapshots non-interactive and excluded them from current-session
  live-node projection while the destination loads.

## 2026-08-21 — Preserve the RP view across swipe sessions

- Kept the registered RP conversation view mounted while resolving a session
  switch and reused it when the destination belongs to the same playthrough.
- Deferred view removal until the destination is confirmed as another
  playthrough or a non-RP session, eliminating adapter-driven full-view flashes.

## 2026-08-21 — Lock greeting selection after play starts

- Removed greeting navigation from the RP transcript after the first real
  user turn while keeping the chosen opening visible.
- Limited `greeting-reference` to first-turn assembly; later requests retain
  the selected card but do not repeatedly inject its opening text.

## 2026-08-21 — Document session branches over surface replacement

- Documented that DSH surface replacements can themselves be replaced while
  the append-only source events remain available for transcript and audit.
- Recorded why the current one-message replacement primitive cannot atomically
  restore an arbitrary user/assistant sequence or act as a per-request history
  projection.
- Kept RP swipe and rollback on public DSH branch sessions so native history,
  tool pairing, compaction, original Chat and uninstall fallback remain valid;
  Tavern timeline metadata only composes those sessions into a playthrough tree.

## 2026-08-21 — Branch RP timelines and retry from message actions

- Added additive `parentVariantId` and active `head` timeline fields so each swipe can own a different downstream branch while DSH messages remain authoritative pointers.
- Put previous/next/retry on the normal message action row. Context-triggered output retries the nearest preceding real user turn and never resends injected context as human input.
- Added same-playthrough rollback by reusing the existing DSH branch and inherited-range validation without creating a catalog row; removed the hide action and retired hidden projection.
- Kept card greeting metadata outside assistant output regex so an output-only “keep `<正文>`” rule cannot erase the opening dock.

## 2026-08-21 — Order display regex and freeze manual overrides

- Added drag ordering inside each global, preset, and character regex source;
  saved resource order is the native `regex_scripts` array order.
- Manual `displayOverride` is now final display text and bypasses subsequent
  macro/regex passes while still using Markdown and DOMPurify rendering.
- Empty overrides remain explicit and keep the restore-original action.

## 2026-08-21 — Edit displayed replies inside the conversation

- Replaced the browser single-line prompt with an inline, resizable multiline
  editor at the assistant reply position.
- Save still writes only the timeline `displayOverride`; Cancel or Escape
  discards the draft, and the DSH message remains unchanged.

## 2026-08-21 — Preserve and render DSH message origin

- Added additive `origin` provenance to v2 session messages without changing
  the model-facing `role`; context injections retain bounded producer, form,
  and summary metadata for independent frontends.
- The RP view now hides reasoning and DSH context injections completely instead
  of rendering user bubbles or expandable rows; native DSH chat remains the
  inspection surface. Context-triggered parent output cannot be retried or
  swiped, and the controller refuses to resend context as human input.
- Display regex that removes the complete assistant output also removes its
  action row while preserving non-visual provenance and the timeline pointer.

## 2026-08-21 — Export current presets as SillyTavern JSON

- Added `GET /pmp-dsh-tavern/api/v1/presets/:id/export` as an attachment
  response compatible with the existing preset import path and SillyTavern
  Chat Completion presets.
- Export starts from the preserved ST source so unknown extensions survive,
  then projects the current Tavern name, sampling values, prompts, order, and
  enabled flags so edits cannot be hidden behind a stale `source.raw` copy.
- Tavern-only `systemPromptMode` remains internal because ST has no matching
  preset field; this read-only route does not change resource selection.
- Added a preset-panel `Export JSON` button that reuses the public attachment
  endpoint; the toolbar auto-fits columns and wraps on narrow panels without
  changing the two-column binding controls.

## 2026-08-21 — Preserve world-book keyword delimiters while editing

- Replaced the lossy parse-and-immediate-join keyword inputs with an editor
  projection that retains in-progress English and Chinese comma delimiters.
- Parsed keyword arrays still update on every edit, while external resource
  changes reconcile the displayed text and document-aware keys prevent local
  input state from leaking between world books.

Verification: full build and test suite; 418 passed, 4 skipped, 0 failed.

## 2026-08-21 — Document independent RP frontend integration

- Documented forked, independent DSH-plugin, and independent Web-client delivery
  models for third-party RP frontends.
- Defined `pmpDshTavernChrome.when()` as the public mode-lifecycle seam while
  leaving slot ownership and conflict handling to DSH public contracts.
- Explicitly documented that configuration-file replacement, a frontend
  provider registry, and a dynamic bundle loader do not exist in 2.0.
## 2026-08-21 — Compose Tavern forks from public play APIs

- Added a reply-tail action that branches the adopted DSH session at the
  selected assistant event, copies the playthrough through that QA, and opens
  the new playthrough root session.
- The copied target variant is rebound to the child session so stable focus
  returns to the continuation session instead of the ancestor. Source timeline
  metadata and DSH messages remain unchanged.
- The client verifies the inherited durable user/assistant range before any
  workspace write and uses catalog CAS for the final catalog append.

## 2026-08-21 — Integrate session/import mutation operation logs

- Added content-free, fail-soft operation logging for session create, branch, user-message, and import-context bind/unbind mutations via Host ctx.logger.
- Each request has one operation id and one terminal success/failure; staged logs cover validation, Host create/fork/prompt, import prepare/bind/unbind, selection/lineage copy, and authority/history locks.
- GET messages/focus/import-context, chrome, browser logs, and persistent exporters remain quiet/out of scope. user-message logs only the Host acceptance stage and never text, length, or summary.

Verification: test/play-session-import-log.test.mjs, related session tests, and git diff --check; no bundled client artifact was refreshed.
## 2026-08-21 — Integrate workspace mutation operation logs

- Integrated the task-11 fail-soft operation context into `PUT /workspace`, `POST /workspace/dirs`, and `PUT /workspace/files?path=` for ordinary files and managed catalog/timeline documents. Each mutation has one operation id and staged start/validation/begin/commit/success or failure records; GET/list stay quiet.
- Logging remains content-free and fail-soft; HTTP responses and existing stable error codes are unchanged. Session/import/chrome and browser/persistent exporters remain outside this task.

Verification: `test/play-file-mutation-log.test.mjs`, `test/play-workspace.test.mjs`, `test/play-timeline.test.mjs`; no bundled client artifact was refreshed.

## 2026-08-21 — Add fail-soft backend operation log utility

- Added `packages/play/src/operation-log.js` and the root play export for a
  content-free operation context using Cordis `ctx.logger`.
- Logs use a stable single-line plugin prefix, one operation id across stages,
  bounded identifiers, and a single terminal result with duration/error code.
- Unknown fields and content-bearing values are ignored; logger failures never
  alter business results. Workspace endpoint integration is recorded in the task entry above; session/import integration remains scheduled for task 13.

Verification: `test/play-operation-log.test.mjs`; no bundled client artifact was refreshed.

This is the staged implementation log for dsh-tavern. It is kept separately
from the product README so reviewers can follow intent, decisions, verification,
and known limits chronologically.

## 2026-08-21 — Add catalog-authoritative playthrough focus

- Implemented the catalog-authoritative playthrough-id focus endpoint with empty-timeline root-session fallback.
- Kept explicit path focus for migration, removed the no-path default, and stopped timeline PUT from changing activeTimelinePath.
- Bundled client migration remains task 08; catalog/timeline failure states have explicit stable error codes.

Verification: test/play-sessions.test.mjs; full suite pending task 07 review.

## 2026-08-21 — Freeze the remaining v2 release-hardening contracts

- Accepted complete Host history pagination without a plugin page cap; model
  context overflow remains owned by DSH rather than a Tavern summarizer.
- Accepted read/write catalog validation, revision/CAS writes, playthrough-id
  focus, import-context claim lineage, and practical path TOCTOU hardening as
  release blockers rather than silently treating the reviewed risks as done.
- Kept playthrough lifecycle as a composition of public atomic APIs. Mutation
  stages will use backend `ctx.logger` with operation ids and no resource or
  conversation bodies; browser and persistent logging remain deferred.

Documentation only; runtime implementation and rc.8 verification remain open.

## 2026-08-20 — Use one opening layout with or without greeting

- Cards without greeting now keep the same opening container and import-footer
  placement as cards with greeting; only the greeting content slot is empty.
- Removed the separate no-greeting import layout branch.

Verification: focused opening-layout test and production client build.

## 2026-08-20 — Keep the import action inside the greeting container

- The unbound empty-playthrough import action is now rendered as the greeting
  row's footer instead of a negatively offset sibling.
- Cards without a greeting retain the same action in the standalone opening
  position; bound replace/unbind controls remain below imported history.

Verification: focused chat-state/layout test and production client build.

## 2026-08-20 — Move import binding into the empty-playthrough opening

- Removed import from the sidebar playthrough menu. Empty playthroughs expose
  a centered import action below their greeting; once bound, the controls move
  below the imported records and become replace/unbind actions.
- Imported history remains read-only and marks its latest QA explicitly. The
  frontend reads the session binding as authority rather than inferring it
  from catalog metadata.
- Controls disappear immediately when a user node, running turn, durable QA,
  or consumed binding makes the playthrough immutable; the backend enforces
  the same lock independently.

Verification: chat-state, import lifecycle, client-contract, i18n, and
production build tests.

## 2026-08-20 — Manage import context on an existing empty session

- Added stable v2 GET/PUT/DELETE operations at
  `/sessions/:id/import-context` so third-party RP frontends can inspect, bind,
  replace, or clear an import-context reference without creating replacement
  DSH sessions.
- Mutations are locked after a user/assistant message, an open turn, or context
  consumption and return `409 PLAY_IMPORT_CONTEXT_LOCKED`.
- Responses expose binding path/hash/state, bounded counts, and claim identity/event-seq metadata without content; imported
  dialogue content stays in the existing jailed workspace file. Pending bindings are claimed only from the public pending-input projection; parser-level QA/context caps are not applied.

Verification: import-runtime, session-handler, route, and Host-adapter tests.

## 2026-08-20 — Preserve imported context through playthrough export

- HTML, SillyTavern JSONL, and portable bundle exports now include the
  read-only imported greeting/QA before later DSH-backed timeline turns.
- Portable bundles carry the immutable import-context document and restore it
  on reimport without turning those records into DSH history.
- Import rereads the context, empty timeline, catalog row, and copied character
  selection before navigation. This detects partial writes but does not claim
  atomic rollback from the current composition API.

Verification: focused import/export tests and production client build.

## 2026-08-20 — Keep playthrough IO in the sidebar only

- Removed the duplicate `conversation.input.left` registration from the RP
  occupancy lifecycle.
- Import, export, and rename remain available from each playthrough's sidebar
  menu; the native DSH composer and its left-side extension surface are left
  untouched.

Verification: focused occupancy/menu tests and production client build.

## 2026-08-20 — Reuse the latest authoritative empty playthrough

- Creating a playthrough now opens the character's highest-numbered existing
  playthrough when it is still empty instead of appending another empty row.
- Empty means no timeline QA, no imported QA, no DSH user/assistant message,
  and no incomplete turn. A greeting-only import remains an opening choice and
  therefore does not make the playthrough nonempty.
- The check reads DSH messages through the existing v2 contract and fails on
  unreadable state instead of treating uncertainty as an empty playthrough.

Verification: focused lifecycle tests and production client build.

## 2026-08-20 — Number and rename playthrough projections

- New and imported playthroughs receive a character-local monotonic title such
  as `1周目`; the underlying DSH session keeps the Host-owned
  `角色卡名 + 时间` title so native Chat remains easy to inspect.
- The assigned ordinal is stored in Tavern catalog extension data. Legacy
  entries without the field participate by their existing character-local
  order, and renamed titles do not affect later allocation.
- The sidebar playthrough menu can rename a single Tavern projection. The
  operation changes only `catalog.json`, rereads it for verification, and does
  not rename or rewrite the authoritative DSH session.

Verification: focused create/import/i18n/shell tests and production client
build.
## 2026-08-21 — Accept the playthrough lifecycle and opening import surface

- The character-card sidebar now creates a numbered `x周目` under the selected
  character, reuses the nearest preceding empty playthrough instead of adding
  unbounded blank entries, and exposes playthrough rename. A new playthrough
  remains a real blank DSH session; no greeting, imported QA, or fabricated
  user/assistant message is written during creation.
- The empty-session opening is rendered in the same native composer dock as the
  greeting. Previous/next greeting controls remain in the outer positions;
  import controls occupy the center footer. A card without a greeting still
  keeps the empty opening area and its action layout.
- External history is now bound to the current empty playthrough rather than
  creating a second playthrough/session. The opening surface can bind, rebind,
  or unbind the imported context. After binding it previews the latest three
  imported QA pairs; after unbinding it returns to the selected greeting.
  Binding and unbinding are locked after a DSH user/assistant message, an open
  turn, or one-shot context consumption. The server repeats this check; hiding
  the client controls is not the authority.
- The loader injects a bound import as escaped, read-only and explicitly
  untrusted context for the first actual request. It is not a DSH durable
  message and does not enter `timeline.json`; normal `turn/end` changes the
  binding from `pending` to `consumed`. Retry/abort semantics remain a review
  item (see [`PLAY_REVIEW.md`](PLAY_REVIEW.md)).

Verification: production client build, 347 tests passed and 2 skipped; the
opening greeting, three-QA preview, bind/rebind/unbind, and playthrough
lifecycle passed user acceptance on DSH 0.1.0-rc.8.

## 2026-08-20 — Review the playthrough lifecycle boundary

- Added [`PLAY_REVIEW.md`](PLAY_REVIEW.md), a read-only review of the v2
  playthrough implementation at `6ede09d`.
- Recorded the remaining lifecycle risks: cross-client catalog/timeline lost
  updates, half-created Host sessions after downstream failure, silently
  truncated history pagination, import-context retry semantics, filesystem
  TOCTOU hardening, catalog uniqueness/path validation, and ambiguous default
  focus selection.
- Confirmed the current native-first boundaries that must remain: Host RPC and
  public session projections stay authoritative, imported history remains a
  bounded untrusted context, and the client does not write fabricated DSH
  messages.

## 2026-08-20 — Move the default-view adapter out of the view ring

- Kept the accepted native-chat-store adapter semantics, but mounted its
  null-rendering component in the session-scoped `conversation.input.dock`.
- Reusing the same public store handle and session scope still supplies the
  native `setView('rp')` action; the adapter retires immediately after its one
  attempt.
- The adapter no longer registers a second `conversation.view` entry with
  `id: 'chat'`, so an unrendered first WebUI frame cannot expose a duplicate
  Chat tab.
- No DSH source, DOM, native Chat registration, or second store is modified.

Verification: focused default-view/occupancy tests and production client build.

## 2026-08-20 — Default new playthroughs to the selectable RP view

- Kept DSH's native Conversation view installed and separately selectable,
  while naming the Tavern projection `RP视图` and making it the initial view
  for a newly opened playthrough whose DSH chat store has no explicit view.
- The plugin briefly shadows the `chat` cell with an adapter that reuses the
  native chat entry's public store handle, calls the existing `setView('rp')`
  action, and then unregisters itself. It does not replace the DSH
  conversation plugin, create a second chat store, or mutate the DOM.
- The adapter fails closed: if the native store handle is not exposed, it is
  not registered; if its owner props are unavailable at render time, it
  retires without changing the native view. This prevents a stale `chat` tab
  from surviving a future DSH contract change.
- User acceptance passed on DSH 0.1.0-rc.8 after verifying both the automatic
  switch and removal of the transient `chat` occupancy.

Verification: focused default-view/occupancy tests, production client build,
and full 306-test suite (304 pass, 2 skip).

## 2026-08-20 — Keep reasoning out of the Mowan body projection

- Completed Mowan turns now project only DSH `content` parts whose type is
  `text`; structured `reasoning` remains in DSH's authoritative message but is
  not flattened into the role-play body. Empty legacy content arrays still
  fall back to the compatibility `text` field.
- During a live turn, Mowan shows “正在思考…” / “Thinking…” only until the
  first assistant text block appears. Once body streaming begins, the text
  itself is the activity indicator and no “responding” label remains.
- Regex, Markdown/other rich-text rendering, and a configurable body font size
  remain separate follow-up items.

Verification: chat/load/export/import focused tests, full 304-test suite
(302 pass, 2 skip), and production client build.

## 2026-08-20 — Document native-first frontend compatibility policy

- Performed a read-only audit of the Mowan client against DSH rc.6's documented
  slots, stores, Host operations, Session events, and public package exports.
  No feature code changed in this audit.
- Recorded the native seams already reused by the launcher, sidebar,
  conversation, live projection, scrolling, clean-session flow, RP lock, prompt
  assembly, Trace, and theme styling.
- Recorded migration candidates in the public UI-primitives package
  (`MessageText`/`MarkdownText`, `DisclosureRow`, `Menu`, icons/`Tooltip`,
  `Modal`, and clipboard helpers), while explicitly rejecting imports from DSH
  source paths or unexported conversation internals.
- Kept Tavern-owned semantics custom where DSH has no equivalent model:
  playthrough timelines, cross-session adopted variants, greetings, display
  regex, selection composition, and the RP-root path jail.
- Corrected the in-progress protocol to describe the current collapsible
  reasoning projection and DSH-scrollport-based entry/user-message behavior.
- Follow-up product decisions keep user/assistant content on a Tavern-owned
  frontend pipeline fed by authoritative DSH content, because card, preset,
  and bundle display rules may intentionally conflict with native rendering.
  Rendered output remains display-only and is never written to DSH or timeline.
- Public `Menu`, `Modal`, `Input`, `Button`, and `writeClipboard` migrations are
  approved follow-ups. Removing the duplicate `conversation.input.left` import
  and export control remains a separate minimal-change task.

## 2026-08-20 — Scroll Mowan only for entry and user messages

- A newly mounted Mowan conversation scrolls to its bottom after the current
  playthrough finishes loading, so switching from native DSH opens at the
  latest turn rather than the top of history.
- After mount, only a newer DSH user-node sequence triggers one additional
  scroll to the bottom. Assistant partial growth, finalization, and Tavern
  timeline reconciliation do not move the reader away from the reply start.
- User acceptance passed after the implementation was aligned with DSH's
  Conversation scrollport and `chatScroll` semantics; no fixed composer-height
  compensation remains.

Verification: `test/play-chat-model.test.mjs`, full 304-test suite (302 pass,
2 skip), and production client build.

## 2026-08-20 — Preserve the Mowan conversation mount across live status updates

- Session-list `running` and `blank` changes no longer unregister and
  asynchronously recreate the Mowan `conversation.view`. The existing React
  view and its scroll container remain mounted while a prompt starts and runs.
- Occupancy is reclassified only when the frontend mode, current session/cwd,
  or an explicit Tavern refresh can change playthrough membership. A refresh
  that resolves to the same playthrough updates the binding without remounting
  the view.
- Conversation and input-left registrations are synchronized independently,
  so declaration changes no longer restart the shared observer or tear down an
  unrelated entry.

Verification: `test/play-chat-occupancy.test.mjs`, focused occupancy/chat tests,
full 303-test suite (301 pass, 2 skip), and production client build.

## 2026-08-20 — Mowan follows DSH live conversation state

- The play conversation consumes DSH's public `useSession` projection directly:
  a durable user node appears immediately without waiting for the assistant or
  for Tavern timeline reconciliation.
- While the agent is running, Mowan shows an explicit responding state and
  renders incremental assistant `text` blocks from DSH's `partial` projection.
  Structured reasoning remains separate and is not flattened into the body.
- Completed live rows disappear as soon as the same event range is adopted by
  `timeline.json`; `/v2/messages` remains the durable reconciliation source and
  no second streaming API was added.

Verification: `test/play-chat-model.test.mjs`, full 303-test suite (301 pass,
2 skip), and production client build.

## 2026-08-20 — Accepted launcher and frontend-mode behavior

- The floating launcher always displays `DT`. Left click immediately expands or
  collapses the menu; rapid repeated clicks repeat that default action, and
  double-click has no special behavior.
- Right-click toggles the frontend display mode. The menu exposes the exact
  labels “切换到自定义前端模式” / “切换到 DSH 原生模式” and can show
  “当前：魔丸” / “当前：DSH 原生”. The hover title is “切换前端显示模式”
  and does not use Lingzhu/Mowan promotional wording.
- The menu remains mounted while opening. Its contents fade in after the 220 ms
  container expansion completes, preventing the first-row switch button from
  flashing. This behavior has passed user acceptance.

## 2026-08-20 — Host New Session baseline and acceptance observations

- DSH native New Session currently inherits the preset and other Tavern
  selection/settings from the previously focused session by Host behavior. This
  is a Host baseline, not a promise that native New Session starts blank.
- The acceptance pass observed the following without inferring root causes:
  an unbound-character-card notice whose width does not match the conversation
  bar; starting a new playthrough from the Mowan character-card sidebar showed
  `host.createDirectory needs browse capability` and did not auto-bind the
  character card; an inherited-configuration new session did not automatically
  switch RP safety mode with the character card; a new session from a bound
  character card was not grouped into the new playthrough; and regex supplied
  by presets/character cards was not recognized.

## 2026-08-20 — Play workspace directory creation contract corrected

- `POST /v2/workspace/dirs` now creates directories directly through
  `PlayWorkspaceStore` inside the bound RP root's path jail. It does not depend
  on the global native directory picker or `apiProxy.host.createDirectory`, so
  both native and browse Host modes are supported.
- The path jail still rejects absolute paths, `..`, symlink escapes, and file
  conflicts. The earlier Host-only wording remains in the historical 2026-08-19
  implementation entry; the current API contract is the one documented above.

## 2026-08-20 — Launcher clicks are immediate and literal

- Every left click immediately performs the normal menu toggle; rapid clicks
  repeat that same action and double-click has no separate binding.
- Right click suppresses the browser context menu and uses the same
  transactional Lingzhu/Mowan switch as the explicit menu action.

Verification: test/play-chrome-client.test.mjs, test/client-shell.test.mjs.

## 2026-08-19 — Character groups create verified empty playthroughs

- Each character group exposes an icon-only, named new-playthrough action.
- Existing character sessions seed the complete Tavern selection through the
  v2 session-copy contract; a card with no session uses the existing v1
  selection mutation after creating the blank session.
- The controller writes `nodes: []`, stores character/root ownership only in
  playthrough ext, then rereads catalog and timeline before navigation.
- Catalog writes are serialized and a same-character double click shares one
  in-flight transaction. No greeting, user message, or assistant turn is
  appended during creation.

## 2026-08-19 — Ordinary sessions keep native Chat with an additive notice

- Mowan registers one additive `conversation.input.dock` row and never
  shadows Chat or the composer for an ordinary session.
- The notice classifies workspace membership before character selection, so a
  stale binding outside the configured role-play workspace remains ordinary.
- The row is non-blocking, hides while classification is unresolved, and is
  disposed completely when the chrome returns to Lingzhu mode.

## 2026-08-19 — Mowan projects sessions through the workspace slot

- Play chrome shadows only the official sidebar.workspaces cell at priority
  -100; returning to native chrome disposes the entry and restores DSH.
- RP classification starts with the selected DSH workspace account, then
  timeline/root-session membership, then cached character selection.
- Playthrough sessions are hidden under character → playthrough rows;
  unassigned card sessions stay in a collapsed subgroup and ordinary/external
  sessions stay in the collapsed bottom group.
- Character selection reads are invalidatable, deduplicated, and capped at
  four concurrent requests. Timeline damage is reported with its file path.
- The empty state can bind an existing DSH workspace, with a second
  confirmation for paths covered by the backend system-disk warning policy.
- Native New Session and ctx.workspaces.startSession are not patched.

## 2026-08-19 — Chrome switch is keyboard reachable

- The launcher menu exposes an explicit Lingzhu/Mowan switch with current-mode
  text, title, and aria label.
- Menu activation and pointer double-click share the same transactional
  controller, including PUT-before-render and failure rollback.

Verification: test/play-chrome-client.test.mjs, test/client-shell.test.mjs.
## 2026-08-19 — Lingzhu/Mowan chrome is transactional

- The single floating launcher defaults to the blue-black native chrome and
  switches to the red-black play chrome on double-click.
- A delayed single-click keeps menu opening distinct from double-click, while
  pointer dragging suppresses both actions.
- Chrome changes reach the UI only after PUT /v2/chrome succeeds and sync
  across browser windows without storing a second client-side source of truth.

Verification: test/play-chrome-client.test.mjs, test/client-shell.test.mjs.

## 2026-08-19 — Live play client follows the real wire contract

- Added one v1/v2 requester for chrome, workspace, catalog, timeline, sessions, focus, and greeting selection.
- Workspace JSON files are parsed from `{ content }` and written back as JSON strings in that envelope.
- Session messages retain `ContentPart[]` and integer/null `seq`, with a separate safe display-text projection.
- Timeline paths must point to the actual `timeline.json` file; catalog character ownership lives in `ext`.

Verification: `test/play-client-contract.test.mjs`.

## 2026-08-19 — Greeting removed from play timeline contract

- Timeline nodes now represent real QA spans only; `kind: "greeting"` is rejected.
- New playthroughs use an empty `nodes` array until the first real turn.
- Greeting remains character/session-selection data and is not materialized as a DSH event.

Verification: `test/play-timeline.test.mjs`, `test/play-sessions.test.mjs`.

## 2026-08-19 — Play dirs use Host createDirectory only

Purpose: keep directory creation on the Host browse API so path joining stays
on one OS-native implementation.

- `POST /v2/workspace/dirs` calls `createDirectory({ path, name })` for each
  missing segment. It does not fall back to local `mkdir`. Missing Host
  capability returns `501 PLAY_HOST_UNAVAILABLE` and writes nothing.

Verification: `test/play-workspace.test.mjs`.


## 2026-08-19 — Align profile section and browser events with `pmp-dsh-tavern`

Purpose: finish the identity rename so Host assembly and bundled UI events use
the same plugin id as the Cordis package.

- Host system section is now `pmp-dsh-tavern:profile` (`PROFILE_SECTION`).
  After upgrade the plugin only registers this name, so assembly never
  includes `dsh-tavern:profile`. Replace-mode keeps the current profile
  section and `rp:policy`.
- Browser CustomEvents are `pmp-dsh-tavern:refresh` and
  `pmp-dsh-tavern:ui-settings`. Old `dsh-tavern:*` event names are not
  dispatched. `dist/client.js` is rebuilt.

Verification: `test/host-contract.test.mjs`, `test/client-shell.test.mjs`,
`test/identity.test.mjs`, plus `npm run build`.


## 2026-08-19 — Play API: 405, derived focus, default session create

Purpose: match HTTP method semantics, keep focus a derived session id, and stop
requiring a character card to create a play session.

- Known v2 paths with the wrong method return `405 PLAY_METHOD_NOT_ALLOWED`.
  `404` is only for paths that do not exist.
- `GET /v2/focus` returns `{ ok, sessionId }` only. `POST /focus` is 405.
- `POST /v2/sessions` without a bound character uses DSH `session.create`
  (no extra title). Title `{characterName} {UTC stamp}` only when a character
  name is available. `copySelection` runs only when `selectionFromSessionId`
  is provided.

Verification: `test/play-chrome.test.mjs`, `test/play-sessions.test.mjs`.


## 2026-08-19 — Play session meta API

Purpose: wrap DSH `session.create` / `fork` / `prompt(queue)` / `history` as
plugin HTTP without writing timeline nodes or posting focus.

- `POST /v2/sessions` titles the session `{characterName} {UTC stamp}` when a
  character name is available; otherwise it leaves DSH's default title.
  Optional Tavern selection is copied only with `selectionFromSessionId`.
  The new session is `insertSessionBefore`'d into the bound play workspace.
  It does not write `timeline.json`.
- `POST .../branch { atEventId }` maps eventId to log seq. Open-turn
  `fork-unavailable` / `OPEN_TURN` become HTTP 409. Branch does not prompt.
- `POST .../user-message { text }` is the next user utterance only, mode
  `queue`. `GET .../messages` returns Message.id plus seq and `incompleteTurn`.
- `GET /v2/focus` is read-only `deriveFocus` (`sessionId` only). `POST /focus`
  is 405.
- Host calls go through `ctx.get('apiProxy')` when present. Unit tests mock
  that face. Live coverage is opt-in (`DSH_TAVERN_PLAY_LIVE=1`).

Verification: `test/play-sessions.test.mjs`.


## 2026-08-19 — Play timeline/catalog validation and deriveFocus

Purpose: keep playthrough pointer files valid without writing a stored focus
session, and derive focus from the last rendered QA node.

- `PUT /workspace/files` validates `timeline.json` and `catalog.json` before
  disk write. Illegal kind, missing event seq pointers, or `focusSessionId`
  return 400 and leave no file.
- `deriveFocus(timeline)` is the adopted variant `sessionId` of the last
  non-hidden `qa` node. Greeting-only timelines have `sessionId: null`.
  Unused older swipe variants are ignored. This module does not read DSH
  events.

Verification: `test/play-timeline.test.mjs`.


## 2026-08-19 — Play workspace files/dirs path jail

Purpose: bind one existing play-workspace directory and read/write plugin
files without leaving that root or registering extra DSH workspaces.

- `GET/PUT /pmp-dsh-tavern/api/v2/workspace` persist the chosen root in
  plugin data. First selection returns swipe-disk (and system-disk when
  applicable) warnings. The directory must already exist.
- `POST /workspace/dirs` stays inside the bound root via Host
  `createDirectory` (no local mkdir fallback). `GET/PUT /workspace/files`
  stay inside the bound root: `..`, absolute paths, and symlink escape
  return 400/403 and do not write. Unbound roots return 409.
  `archiveSession` is not used.
- Host `workspaces.create` is optional in this module (filled in M4). Unit
  tests use temporary directories.

Verification: `test/play-workspace.test.mjs` plus `npm test`.


## 2026-08-19 — Play chrome GET/PUT `/v2/chrome`

Purpose: persist the global native/play surface switch independently of RP
and of the current DSH session, as the first v2 play-surface route.

- New `packages/play` owns chrome storage (`chrome.json`) and the v2 HTTP
  dispatcher. Loader mounts it on the existing `/pmp-dsh-tavern/api` prefix
  via `secureTavernApi`; GET/PUT `/pmp-dsh-tavern/api/v2/chrome` are live.
- Default mode is `native`. `PUT { "mode": "play" }` is atomic and survives
  store recreation. Illegal modes and unknown fields return 400. There is no
  `POST /chrome`. Chrome does not read or write RP selection.
- Documented in [docs/API.md](API.md) (v2 stable vs v1 bundled).

Verification: `test/play-chrome.test.mjs` plus `npm test`.


## 2026-08-19 — Plugin identity `pmp-dsh-tavern` and v1 HTTP root

Purpose: stop colliding with other DSH plugins named `dsh-tavern`, and put the
existing resource API under a versioned prefix before play-surface v2 routes
land on the same Host prefix.

- Package name, Cordis id, installer plugin name, browser bundle id, and the
  Host `export const name` are now `pmp-dsh-tavern`. Shared constants live in
  `packages/identity.js` (`PLUGIN_ID`, `API_ROOT`, `API_V1`, `API_V2`).
- HTTP is mounted at `/pmp-dsh-tavern/api`. Existing resource routes moved to
  `/pmp-dsh-tavern/api/v1/...`. The old `/dsh-tavern/api` root is not
  registered and returns 404. There is no dual-root compatibility window.
- Browser clients, launcher storage key, and `data-plugin-css` attributes
  follow the new id. Host system section was later renamed to
  `pmp-dsh-tavern:profile` (same day; see the identity-alignment entry).
- Data and backup directories follow the new package name:
  `node_modules/pmp-dsh-tavern/data/` and `backups/pmp-dsh-tavern/`.

Verification: `npm test` plus a leftover-path scan of `packages/` and
`scripts/` for callable `/dsh-tavern/api` roots.


## 2026-08-18 — RP secure mode and delegated subagent snapshot

Purpose: add a session overlay for roleplay that pins a read-only file sandbox
and refuses high-risk tools, without making RP a DSH agent preset. Delegated
children then start from the same Tavern binding as “new session with current
settings”, so candidate replies and multi-character scenes share the bound
preset, character, user and world books unless the parent writes a narrower
spawn prompt.

- RP is stored on `SessionSelectionStore.selection.rp`. Binding a character
  card can auto-enter RP (`rpFollowCharacter`, default on). Leave with the
  card switch or `/rp off`. The chat permission chip cannot lift the lock.
- High-risk tools are refused by `tools.guard` and the current agent is
  cancelled: writes, shell, `run_code`, `web_fetch`, any `sandbox_permissions`,
  `grep`, workspace-outside `read`/`read_image`/`glob`, and secret filenames.
  Subagent spawn itself is allowed. Child violations alert on the parent
  session and cancel only that child.
- Optional `rp:policy` (order 45) is a short lock notice, editable in UI
  settings and stored as `rp-policy.json`. Identity and style stay in the
  preset or character card; spawn-composition instructions are not injected.
- `ensureAgent()` copies the parent selection for `delegationDepth > 0` the
  same way ordinary forks already did. The snapshot is independent. Children
  inherit the RP lock from the ancestor chain.
- Product inventory of blocked vs allowed tools is in `docs/RP_SECURE_MODE.md`.

Verification: `npm test` completed 218 tests (217 passed, zero failed, one
opt-in external fixture skipped). `node scripts/install.mjs` refreshed the
isolated tavern test profile. DeepSec L1/L2 on the published tree reported 15
findings, all false positives (`RegExp.exec` classified as Python `exec`, PNG
base64 alphabet, and minified `dist/client.js` URL templates as high-entropy
secrets). Tracked files have no API keys, private-key headers or workstation
paths. README `D:\DSH\review` and `/Users/you/` are install placeholders.
`docs/dev-plans/` remains gitignored.

## 2026-08-18 — Character-card editing and public-doc cleanup

Purpose: let users create and edit character cards like presets and world books,
store one current card document instead of a parallel original, and keep
published docs limited to outsider-facing guides.

- Added blank V2 character-card creation (`POST /dsh-tavern/api/characters`) and
  import-after-edit for name, nickname, description, personality, scenario,
  default/alternate greetings, example dialogue, creator notes, system prompt,
  post-history instructions, tags, creator and character version. Save remains
  separate from session binding; embedded `character_book` still edits only in
  the world-book panel.
- Greeting lists can be added, edited and removed. Saving clamps each session's
  `greetingIndex` instead of unbinding. Switching the bound card's greeting or
  system/PHI strategy shows the same unapplied warning as world-book selection
  until bind/update.
- Stopped storing a second copy of card JSON. JSON import and create write only
  `characters/<id>.json`. PNG import keeps a cover image with `chara`/`ccv3`
  stripped. There is no original-file export; JSON/PNG export is the current
  `source.raw`. Cards without a cover use
  `packages/tavern-format/assets/character-placeholder.png`. The browse
  dropdown shows the card name only, without a format suffix.
- Moved implementation, acceptance, research and working plans under the
  gitignored `docs/dev-plans/` tree (`in-progress/` and `archive/`). Public docs
  keep installation, usage, architecture, loader contract, message flow, prompt
  pipeline, changelog, world-book design and README screenshots.
- Updated README, usage, installation, architecture, loader contract, prompt
  pipeline and message-flow text so they no longer claim cards cannot be created
  or that original artifacts are stored/exported.
- DeepSec L1/L2 on the published tree reported 12 findings, all false positives
  (`RegExp.exec` classified as Python `exec`, and the PNG base64 alphabet as a
  high-entropy secret). Tracked files have no API keys, private-key headers or
  workstation paths.

Verification: `npm test` completed 198 tests (197 passed, zero failed, one
opt-in external fixture skipped). `npm run build` regenerated `dist/client.js`.
`git check-ignore` confirms `docs/dev-plans/` is excluded from the published
tree.

## 2026-08-15 — Version 1.0.0 and public UI gallery

Purpose: prepare the reviewed framework for its first stable public release and
make the README's module overview visible on GitHub and in the npm package.

- Raised the root package and lockfile version from `0.1.0` to `1.0.0`; DSH
  dependency/version references elsewhere remain unchanged.
- Added the project-owner-approved launcher, UI settings, preset, character,
  world-book, user and new-session screenshots under `docs/assets/`, and placed
  each image beside the matching README module description.
- Changed the package allowlist from one launcher filename to `docs/assets` so
  every README image is present when the README is rendered from a packaged
  artifact as well as from GitHub.
- Documented that character cards can be imported, inspected, managed, bound
  and loaded, but cannot be created in this plugin because dedicated character
  authoring tools already provide a better creation workflow.
- Inspected PNG ancillary chunks: every screenshot contains only a `Software =
Snipaste` text field and no path, key, author or location metadata.

Verification: `npm run check` rebuilt the versioned bundle and completed 185
tests (184 passed, zero failed, one opt-in external fixture skipped).
`npm run pack:check` produced `dsh-tavern-1.0.0.tgz` with 74 files and all seven
README screenshots.

## 2026-08-15 — New-session primary action color parity

Purpose: keep the session-creation surface visually consistent with the
accepted preset, character, world-book and user sidebars.

- Changed the session-template primary action style from DSH's generic
  `button-primary-fill` token, which resolves to black in the current host
  theme, to the shared `state-business-primary` blue token used by the other
  Tavern binding panels.
- The change covers both primary paths: creating from the current Tavern
  settings and creating from the selected template. Secondary template-library
  actions remain visually secondary.
- Added a client-shell regression test that checks the shared token and both
  primary action bindings.

Verification: `node --test test/client-shell.test.mjs` completed 14 tests with
zero failures; `npm run check` rebuilt the browser bundle and completed 185
tests (184 passed, zero failed, one opt-in external fixture skipped).

## 2026-08-15 — Public release-candidate documentation refresh

Purpose: present the integrated plugin as one reviewable public product while
preserving early feature documents as historical evidence rather than stale
current instructions.

- Rebuilt the Chinese README in the approved order: table of contents, project
  introduction, script/manual/Agent installation, concise module usage,
  characteristics, security risks and upstream references. The install section
  now explains default script behavior before custom profile/DSH_HOME parameters,
  and every platform example includes the install command as well as startup.
- Added only the project-owner-supplied DT launcher screenshot to the README;
  removed the other screenshot placeholders because detailed UI demonstration
  will be provided by the project video.
- Added `docs/USAGE.zh-CN.md` with detailed launcher, preset, character,
  three-source world-book, user, template/new-session, Trace and data-lifecycle
  workflows.
- Replaced the old three-feature integration checklist with the current release
  scope, automatic/manual acceptance status, known non-blocking limits and
  main/tag/push gates. Reworked the review guide around the unified loader,
  security, copyright and package boundaries.
- Updated architecture, loader, message-flow, prompt-pipeline, install and
  module-document statuses. Early worktree plans/research remain in place but
  are labelled historical; obsolete claims that current-input activation or
  integration were still future work were corrected.
- Kept the README honest about loopback-without-auth, prompt injection, secret
  handling, unsafe regex, replace mode, indirect running-agent mutations,
  embedded-book import diagnostics and incomplete ST message topology.

Verification from the complete working tree: `npm run check` rebuilt the client
and completed 185 tests (184 passed, zero failed, one opt-in external fixture
skipped); the final `npm run pack:check` listed 74 files, including all seven
README UI images while excluding other docs, tests, runtime data and
caches. Two consecutive builds produced identical client SHA-256
`DE02FCE650C5B6023F3F74C614A3C3995EE8BDA5434ABB1B3780EBC41C56BA09`.
`git diff --check`, local Markdown-link validation and scans for machine paths,
private-key headers and common credential shapes passed. Full post-refactor
manual browser acceptance was not repeated; the owner performed a visual/basic
operation spot-check without finding an obvious regression.

## 2026-08-15 — Semantic-key-only i18n; legacy source-copy replacement removed

Purpose: make a third UI language a catalog-plus-registry change, not a
business-component rewrite or a Chinese-literal replacement table.

- Split browser i18n into `packages/client/src/i18n/runtime.js` and per-locale
  catalogs under `packages/client/src/i18n/catalogs/`. The previous
  `packages/client/src/i18n.js` import path remains a thin re-export.
- Deleted `LEGACY_SOURCE_CATALOGS`, `LEGACY_REPLACEMENTS`, and runtime Chinese
  source-copy scanning. `translateVisibleText()` is now an identity helper.
- `translate()` falls back through the current locale, then `DEFAULT_UI_LOCALE`,
  then `common.unavailable`; it no longer special-cases `zh-CN`.
- `PanelHeader` uses the complete `panel.close` template with the title as a
  raw interpolation, so locales can own word order.
- Migrated launcher, settings, preset, character, world-book, user, session
  template, and Tavern Trace visible copy, confirmations, empty states, errors,
  and accessibility labels onto semantic keys. Resource names, keywords, and
  other runtime values stay on the `rawText` / `uiMessage` raw-parameter
  boundary.
- Adding a language still requires a catalog file, a locale-registry entry, and
  catalog/display tests. This does not mean a third production language is
  fully translated; shipping locales remain `zh-CN` and `en`.

Verification: `npm run check` rebuilt `dist/client.js` twice with a stable
SHA-256 and completed 184 tests: 183 passed, none failed, and the opt-in
copyrighted fixture was skipped. `npm run pack:check` produced a 67-file
package including `packages/client/src/i18n/catalogs/{zh-CN,en,index}.js` and
`runtime.js`; tests, docs, and local caches were excluded. Isolated-profile
browser acceptance from `THIRD_LANGUAGE_MIGRATION.md` §7 was not executed in
this environment.

## 2026-08-15 — Runtime mutation and remaining audit boundaries documented

Purpose: distinguish implemented running-agent selection guards from a global
configuration lock, and record the remaining i18n/import hardening debt without
changing the accepted runtime behavior.

- Documented that explicit preset, character, user and world-book session
  binding writes return 409 while the corresponding agent is running.
- Recorded unguarded indirect mutations: applying a complete configuration to
  an existing target, deleting referenced resources, editing bound resource
  content and changing a user's world-book relationship.
- Recorded the missing direct world-book guard regression test and the need for
  a loader-owned affected-session mutation policy before claiming global
  immutability.
- Classified the hard-coded `zh-CN` translation fallback and concatenated
  `PanelHeader` accessibility label as defects; documented the roughly 300
  legacy literal translations as a two-language migration bridge rather than a
  third-language-ready contract.
- Added a separate third-language migration specification with the required
  catalog/runtime boundaries, prohibited text-replacement shortcuts, raw-data
  invariants, synthetic-locale tests and isolated-profile manual acceptance.
- Clarified that the aggregate 10,000-entry world-book budget is intentionally
  deterministic and first-come by source order, while character import's lack
  of an early embedded-book structure guard remains defense-in-depth debt even
  though runtime parsing safely rejects it.

Verification: documentation-only change; source and generated bundle were not
modified.

## 2026-08-15 — Explicit per-session preset binding

Purpose: make the preset panel follow the same resource-versus-session boundary
as character cards, users and standalone world books.

- Separated the browsed preset from the current session's applied preset. The
  catalog dropdown now loads an editable resource without changing runtime
  selection; a primary Bind/Update action and a separate Unbind action are the
  only client operations that write the session selection.
- Creating or importing a preset opens it for review but no longer binds it as
  a side effect. The panel shows both the authoritative current-session binding
  and an explicit warning when the browsed resource differs.
- Added the existing-session context warning: changing a bound preset affects
  later requests only and never rewrites durable history. The Host also rejects
  preset binding changes while that session's agent is running, matching the
  character, user and world-book race boundary.
- Added Simplified Chinese/English copy with semantic messages around dynamic
  preset names; imported names remain byte-for-byte unchanged.

Verification: `npm run check` completed 185 tests: 184 passed, none failed, and
the opt-in copyrighted fixture was skipped. In an isolated installed profile,
an initially unbound blank session displayed one browsed preset as unapplied;
Bind changed the authoritative note and action state, and Unbind restored the
original unbound state without closing or deleting the resource. The page and
owned DSH process were closed and loopback port 53123 was verified free.

## 2026-08-15 — Accepted baseline, bounded World Books, minimized active view, and locale contract

Purpose: preserve the user-accepted functional state before addressing the
subsequent security and i18n review without mixing those changes into the
rollback point.

- Recorded accepted commit `fdf9fd27254359feb3fe0f1016141683db529784` as the
  annotated tag `accepted-functional-pre-hardening-20260815`.
- Added one shared pre-normalization World Book structure guard for standalone
  and embedded resources: 10,000 entries, depth 32, 100,000 nodes, 1 MiB per
  string and 1,024 characters per object key. The loader additionally caps the
  aggregate matcher input from all resource sources at 10,000 entries and emits
  a diagnostic instead of traversing an overflowing resource.
- Removed full `compiledPrompt` content from `GET /active`; selection, bounded
  resource summaries, diagnostics and audit metadata remain available. DSH's
  request/header remains the authority for the system content actually sent.
- Centralized locale ids, native labels and the default locale in one shared
  contract used by the settings UI, browser translator and server validation.
  Every semantic catalog must have the same key set. The legacy static-copy
  bridge is locale-bundled rather than hardcoded to English.
- Migrated every destructive, unsaved-change and historical-session confirmation
  to whole-sentence semantic keys. Dynamic resource names remain byte-for-byte
  unchanged; automated tests reject confirmation calls that bypass this path.

Verification: `npm run check` rebuilt the browser bundle and completed 182
tests: 181 passed, none failed, and the opt-in copyrighted local fixture was
skipped. `npm run pack:check` reported a 63-file package containing both new
shared modules and no tests or runtime data. An isolated install loaded one DT
launcher, exposed the two registry-defined locale options, switched the full
settings panel to English and back to the preserved Chinese/125% state, and
returned an `/active` response without `compiledPrompt`. The test tab was
closed, the owned DSH process was stopped, and its loopback port was verified
free.

## 2026-08-15 — User-bound world books visible in the World Book panel

Purpose: make all three runtime world-book sources reviewable and consistently
editable from the World Book sidebar.

- Added a dedicated user-bound source section beside explicit session books and
  character-card embedded books. It identifies the current user, lists books in
  saved relationship order, marks session duplicates as deduplicated, and
  explains the effective combination order.
- Added user relationship editing through the same loader-owned API used by the
  User panel. Both panels now expose one authoritative relationship, explicit
  unsaved state and shared refresh behavior rather than duplicating data.
- Added a per-book content-edit action that opens the canonical standalone
  editor in the same sidebar, so user-bound books can be edited without
  creating a second document or divergent draft.
- Added complete Simplified Chinese and English semantic messages so resource
  names remain untranslated while all surrounding status copy follows the UI
  language.

Verification:

- `npm run check` rebuilt the browser bundle and completed 176 tests: 175
  passed, none failed, and the opt-in external copyrighted fixture was skipped.
- `npm run pack:check` retained the 61-file release boundary.
- Isolated loopback DSH/browser runs showed the bound user and inherited book,
  refreshed the still-open panel to the explicit no-user state after a session
  switch, and retained the separate embedded character-book section. A second
  round trip added and saved another user book from the World Book panel, then
  removed and saved it to restore the original relationship with no dirty
  state. A final UI check opened the bound book's content action and confirmed
  the canonical standalone document and status were loaded. All owned DSH
  processes were stopped and their ports verified free.

## 2026-08-15 — Template preview and semantic i18n hardening

Purpose: make saved template intent reviewable and remove the common source of
partially translated dynamic sentences found during manual acceptance.

- Added derived template-content summaries and a structured preview of preset,
  character/greeting/switches, user and ordered standalone world books. Template
  updates remain intentionally sourced only from the current session; localized
  guidance directs configuration changes to the DT launcher panels.
- Promoted Trace storage/keyword messages, world-book session/entry metadata,
  character-book preservation status and template guidance to full semantic
  catalog keys. Dynamic resource names, ids and keywords remain raw.
- Documented the semantic-first i18n extension contract: `uiMessage` for full
  dynamic sentences, `uiText` only as a legacy short-fragment bridge, and
  `rawText` for pure runtime data.
- Made standalone and character-bound world books visually separate source
  sections. The character section is always visible and has an explicit empty
  state instead of disappearing when no embedded book is bound.

Verification:

- `npm run check` rebuilt the client and completed 175 tests: 174 passed,
  none failed, and the opt-in external copyrighted fixture was skipped.
- `npm run pack:check` retained the 61-file release boundary.
- An isolated loopback DSH/browser run displayed a stored template's resolved
  preset, character/greeting/switches, user and ordered books; fully English
  Trace storage, keyword, placement and diagnostic copy; both visually separate
  world-book sources and their empty/bound states; and the localized embedded
  `character_book` status. Imported Chinese resource names and keywords remained
  unchanged.

## 2026-08-15 — Phase 3 integration acceptance

Purpose: combine the four independently developed Phase 3 features without
weakening their ownership, safety, or user-visible contracts.

- Integrated current-input world-book activation, user-bound world books,
  clean-session configuration templates, and global UI settings/i18n on the
  dedicated `feature/phase3-integration` branch.
- Resolved shared loader/API composition so the single secured Tavern prefix
  serves all resources while one loader owns pending input, effective
  world-book selection, session templates, and profile assembly.
- Expanded the launcher from four resource entries to six surfaces while
  preserving drag geometry, non-binding status semantics, and both the clean
  session and UI settings panels.
- Extended the explicit `rawText`/`uiText` boundary to the newly integrated
  session-template and user/world-book relationship UI. Resource names,
  keywords, diagnostics, server errors, session IDs, and template names remain
  verbatim when the interface language changes.
- Updated README capabilities, usage, storage paths, compatibility limits and
  roadmap, plus the architecture, loader, prompt-pipeline and full DSH message
  flow documents. The local execution contract remains outside the repository.

Verification:

- `npm run check` rebuilt `dist/client.js` and completed 172 tests: 171 passed,
  none failed, and the opt-in external copyrighted fixture was skipped.
- `npm run pack:check` succeeded with 61 release files and excluded tests,
  implementation-only documents, runtime data, caches and the local plan.
- Installed into an isolated DSH profile and booted a loopback-only Web host.
  Browser acceptance confirmed all six launcher surfaces, immediate English and
  115% scaling, successful current-settings clean-session navigation, default
  restoration, and the new settings/template/user-world-book API reads. The
  owned DSH process was stopped and its test port verified closed afterward.
- Tracked-file scans found no workstation paths, API keys, bearer tokens or
  private-key material.

## 2026-08-15 — Phase 3 world-book early activation

Purpose: let the current claimed input participate in world-book matching
before the first system assembly without changing DSH message ownership.

- Added the loader-owned `PendingInputProjection`, reconstructed exclusively
  from public `agent/inbox/spliced` Session events. It handles next-turn and
  next-step insertion, replacement, cancellation and claim semantics without
  reading the private Inbox or appending any event.
- Added one bounded `ActivationContext` combining durable messages with the
  current claimed batch, deduplicated by stable message id and consumed once
  at the first assembly. Message, character and pending-queue retention all
  have configurable defaults and absolute hard limits.
- Kept world-book format/policy pure and passed the activation value through
  the loader adapter. A new one-step-session regression proves current input
  activates lore in step 1 with no empty step, extra model call or fake
  durable message.
- Extended Tavern Trace with only turn/step-associated counts, truncation,
  deduplication and claim event sequence metadata. No input body or body hash
  is persisted.
- Updated the runtime UI explanations and the architecture, loader, message
  flow, prompt pipeline and Trace contracts. Detailed acceptance is recorded
  in `docs/world-book-early/IMPLEMENTATION_AND_ACCEPTANCE.md`.

Verification:

- `npm run check` rebuilt `dist/client.js` and completed 137 tests: 136 passed,
  none failed, and the opt-in external copyrighted fixture was skipped.
- `npm run pack:check` included the new projection in the expected 50-file
  package and excluded tests, implementation docs, runtime data and local
  execution contracts.

## 2026-08-15 — Phase 3 user-bound world books

Purpose: let each three-field user resource select zero or more independent
world books while keeping runtime composition in the unified loader.

- Added a loader-owned, atomic `user-world-book-bindings.json` policy with
  strict IDs, per-user book count, user count, state byte and pre-parse read
  limits. User descriptions and world-book documents remain unchanged.
- Defined actual composition as session-explicit books first, followed by the
  selected user's saved books, with stable ID deduplication. Switching or
  unbinding a user never alters the session-explicit list.
- Added secured GET/PUT relationship routes under each user, catalog-backed
  validation, structured errors, and cleanup when either a user or world book
  is deleted.
- Extended the user panel with world-book viewing/editing, separate save
  actions, visible dirty state, discard warnings and draft preservation across
  shared refresh events.
- Made active view/launcher consume the effective book set and added explicit,
  user-bound, effective and duplicate provenance to loader audit and Tavern
  Trace. The final profile still comes from the single world-book adapter and
  a duplicate book is matched/projected once.
- Added implementation/acceptance documentation and synthetic tests for
  persistence, limits, API validation, cleanup, session isolation, deduped
  profile output, UI state and Trace provenance.
- Verification: `npm run check` rebuilt `dist/client.js` and passed 141 tests
  with zero failures; the existing opt-in external acceptance fixture was the
  only skipped test. `npm run pack:check` succeeded with 51 release files,
  including the new loader policy and browser state helper while excluding
  tests, docs, runtime data and caches.

## 2026-08-15 — Clean sessions and Tavern configuration templates

Purpose: start a clean DSH conversation while carrying only the current or saved Tavern resource configuration.

- Added bounded, atomic configuration-template storage with create/name, persistent selection, rename/update and delete workflows.
- Added current-settings and template preview/apply APIs under the existing secured Tavern dispatcher. Missing preset, character/greeting, user or independent world-book ids remain visible as structured diagnostics and block creation.
- Used DSH rc.6's public `workspaces.connectWorkspace()` New Session seam and `sessions.open()` navigation seam. Direct/private SessionRuntime creation, history forks and fabricated messages are not used.
- Applied the complete target selection only after DSH returns a real blank session and before navigation. Preview and apply both validate resources; capacity/write failures retain the previous store state and never navigate.
- Added the **新会话** launcher panel and shared refresh hand-off. Templates contain only preset, character/greeting/switches, user and world-book selection fields; durable history, Trace, Inbox and running state are absent by construction.
- Added store, API, client-workflow, architecture and launcher regressions plus `docs/session-template/IMPLEMENTATION_AND_ACCEPTANCE.md`.
- Verification: `npm run check` rebuilt the browser bundle and completed 142 tests with zero failures; the one skipped case remains the opt-in external acceptance fixture.

## 2026-08-15 — i18n raw-data boundary review fix

Purpose: prevent localized rendering from treating resource and runtime data
as interface copy, and remove partial-English creation labels.

- Added explicit `rawText` and tagged `uiText` boundaries. Raw values remain
  verbatim when rendered as children or accessibility properties; interpolated
  UI sentences translate only their literal fragments.
- Audited the composition root plus preset, character, world-book, user, and
  Tavern Trace clients. Resource names, user input, prompt and entry names,
  comments, diagnostics, server errors, identifiers, timestamps, keywords,
  and other runtime values are now explicitly preserved.
- Added complete English catalog entries for new preset, prompt, and user
  labels, plus regressions for Chinese-named resources rendered in `option`
  and `span` children and for missing-key fallback behavior.
- Verification: focused i18n/settings/shell tests passed 23/23. `npm run check`
  built the client and completed 144 passing tests, zero failures, with the one
  opt-in local acceptance fixture skipped.

## 2026-08-15 — Global Tavern UI settings and unified i18n

Purpose: add presentation-only language and scaling controls without changing
DSH UI, Tavern resources, session bindings, or the single-shell architecture.

- Added a fifth surface to the existing draggable `DT` launcher for
  Simplified Chinese / English and 75%–150% Tavern UI scaling, with immediate
  application, failure rollback, and restore-default behavior.
- Added one shared catalog-backed rendering boundary for the launcher, preset,
  character, standalone/embedded world-book, user, and Tavern Trace clients.
  Missing semantic keys return a stable localized fallback rather than the raw
  key, while resource form values remain untouched.
- Added global `ui-settings.json` persistence and secured
  `GET`/`PUT`/`DELETE /dsh-tavern/api/ui-settings`. The write schema is an exact
  locale/scale whitelist with a 1 KiB request/file cap and atomic replacement.
- Kept one `shell.overlay`, one root API prefix, and one Host profile section;
  scale styles are scoped to Tavern roots and launcher geometry now accounts
  for the active scale.
- Added focused persistence/API/i18n/scaled-geometry regression tests and
  `docs/ui-settings-i18n/IMPLEMENTATION_AND_ACCEPTANCE.md`.
- Verification: `npm run check` built the client and completed 140 passing
  tests, zero failures, with the one opt-in local acceptance fixture skipped.

## 2026-08-15 — Deterministic local-package refresh

Purpose: prevent a development install from loading a mixed package after a
source file is replaced while other files remain pnpm hardlinks.

- Reproduced a real failed boot where the installed `index.js` reflected the
  security commit through its existing hardlink, while a recreated
  `session-policy.js` retained the pre-commit inode and lacked the newly
  exported class.
- Added post-add package materialization. The installer resolves the installed
  target, verifies that it is inside the selected DSH profile, removes only the
  package manifest's declared shipped paths, and copies fresh independent
  files from the current worktree. Plugin `data/` and pnpm nested dependencies
  are not touched.
- Added a cross-platform synthetic regression proving stale code is replaced,
  plugin data survives, and later source edits no longer mutate the installed
  copy through a hardlink.
- Verification: `npm run check` completed 131 tests with zero failures and the
  one opt-in local fixture skipped. A real refresh of the isolated integration
  profile preserved its data, produced matching source/installed SHA-256 for
  `session-policy.js`, booted DSH Web on `127.0.0.1:53105`, and returned HTTP
  200 from both the root page and secured preset API. The verification process
  was then stopped and port 53105 confirmed free.

## 2026-08-15 — Second security review hardening

Purpose: close the network, resource-amplification and durable-state gaps found
after the functionally accepted integration build, without weakening ST
round-trip behavior or silently changing old session bindings.

- Added a real TCP peer check in front of every `/dsh-tavern/api/*` route.
  Loopback Host/origin headers no longer let a non-loopback client through;
  remote clients require a separate explicit `security.allowRemoteClients`
  opt-in in addition to an allowed Host.
- Removed the exported preset/character route installers that could register
  handlers without the root security wrapper. Pure API handlers remain
  available for the one secured root dispatcher and isolated tests.
- Added a default 512 KiB, absolute 2 MiB UTF-8 limit to the compiled Tavern
  profile, plus pre-assembly lore byte and 4,096-entry guards so an overflow
  check does not first concatenate all selected books. Lower-ranked lore is
  omitted as complete entries with diagnostics; static profile overflow fails
  explicitly. ST `ignoreBudget` cannot bypass these Host limits.
- Split embedded Character Book editing from the 32 MiB raw character artifact
  boundary: PATCH is now 4 MiB, runs through the shared Character Book parser,
  has explicit depth/node/string/entry bounds, retains unknown extension data,
  and cannot create a stored character document above 16 MiB.
- Migrated `session-selections.json` to schema v2 with `updatedAt`, strict
  selection-field normalization, transactional bounded writes, 2,048-session
  and 4 MiB defaults, and an 8 MiB pre-parse read ceiling. Capacity failure is
  explicit rather than silently evicting durable user intent; a deletion seam
  is ready for a future authoritative DSH lifecycle event.
- Made `{{original}}` replacement preserve `$&`/`$1`-style text literally and
  restricted unsafe-regex compatibility flags to unique `i/m/s/u/v` values.
- Added focused regression coverage for spoofed loopback Host headers,
  IPv4-mapped loopback, explicit remote opt-in, profile overflow/lore omission,
  embedded-book request and structure limits, literal replacement, regex flags,
  schema migration, capacity failure, deletion and transactional persistence.
- Verification: `npm run check` rebuilt the browser bundle and completed 130
  tests with zero failures; the one skipped test remains the opt-in local
  copyrighted acceptance fixture. `npm run pack:check` produced the expected
  49-file dry-run package without test data or local plans.

## 2026-08-15 — Pending-input seam correction and roadmap alignment

Purpose: preserve the last accepted runtime behavior while correcting the
technical plan after finding an earlier public DSH event boundary.

- Verified that every Inbox insertion, replacement, cancellation and claim is
  durably represented by `agent/inbox/spliced`, and that synchronous
  `session/event` observers run before the live Inbox projection mutates and
  before the claimed batch enters system assembly.
- Kept the accepted implementation description honest: it still scans durable
  history only. Planned a loader-owned, in-memory `PendingInputProjection` and
  structured `ActivationContext` instead of an empty model step, private Inbox
  access or post-request Trace recomputation.
- Unified README, message-flow, architecture, loader, prompt-pipeline,
  world-book and Trace documents around that current-versus-planned boundary.
- Expanded the public roadmap with acceptance boundaries for current-input
  activation, UI scale/language settings and user-to-world-book bindings.

## 2026-08-15 — Four-view DSH/DT message-flow review

Purpose: make the host flow, plugin flow, integration delta and resulting full
request path independently reviewable instead of mixing them in one diagram.

- Rebuilt `DSH_MESSAGE_FLOW.md` around four explicit views: native DSH, DT's
  control/data planes, DT's public-hook changes, and the complete integrated
  model-step sequence.
- Added a hook-by-hook impact table and a final mapping for `system`, `messages`,
  `tools` and call config, including append-versus-replace behavior.
- Kept the claimed-input/world-book boundary adjacent to the complete flow so
  Trace timing cannot be mistaken for same-step lore injection.
- Corrected UI and README wording from ambiguous "next round" language to the
  exact boundary: the next agent step may occur after a tool call inside the
  same visible user turn, or it may be the next user turn.

## 2026-08-15 — Product-owned launcher identity and honest Trace timing

Purpose: identify the entry point as dsh-tavern rather than implying that the
compatibility plugin is an official SillyTavern surface, and verify whether a
later Trace scan can safely include the just-claimed user input.

- Changed the red/black/white launcher monogram from `ST` to `DT`, meaning
  dsh-tavern. SillyTavern remains the compatible content format, not the UI's
  product identity.
- Verified against the installed DSH agent loop that system prompt assembly
  completes before the public `agent/pre-step` waterfall exposes claimed user
  messages. `agent/request` runs later and only changes call configuration.
- Kept Trace bound to the assembly actually used by the request. Recomputing a
  match after `agent/pre-step` would display the current keyword while the lore
  was absent from that request's frozen system prompt, so it would be a false
  audit rather than a timing fix.
- Documented the required upstream seam: either a hook after claim and before
  assembly, or a supported same-step system reassembly request.

## 2026-08-15 — World-book UI clarity and compact Trace

Purpose: make the accepted standalone/embedded world-book composition
unambiguous in the UI and make keyword decisions explainable without expanding
Trace into an incomplete per-resource insertion debugger.

- External standalone books now keep their internal title when present and
  otherwise derive a clean title from the imported filename without `.json`.
  Catalog and editor labels no longer append raw format identifiers.
- Split the world-book panel into explicit standalone and character-bound
  sections. Export links now use the same button box, typography and decoration
  as neighboring actions.
- Added a separate applied-selection snapshot. Changed checkboxes show a clear
  unapplied warning and the primary action says so; when the warning is absent,
  the visible binding equals the server-persisted session binding.
- Raised default body/control typography across preset, character, world-book,
  user and Trace panels. The accepted launcher geometry and behavior remain
  unchanged; configurable scale/language belongs to a later settings surface.
- Tavern Trace now separates configured main/secondary keywords from keywords
  actually matched this turn. It remains resource-level for preset, character
  and user; no resource body, prompt body, header body or history is copied.
- Keyword editors accept both Chinese and English commas and state this in the
  labels. The user session-bind action now uses the shared primary blue style.
- Literal matcher coverage now includes Chinese and English main keywords. The
  Trace UI also states the existing DSH timing boundary: current claimed input
  is normally unavailable until the following system assembly.
- Added regression coverage proving that `personaDescription` and `{{persona}}`
  consume a user description at most once. `{{user}}` remains a name macro and
  may intentionally occur wherever a preset author placed it.

Verification:

- `npm run check` completed 121 tests: 120 passed, none failed, and the optional
  external copyrighted-fixture test skipped because no reviewer path was set.
- Synthetic import tests cover internal names, filename fallback and suffix
  removal. Matcher/Trace tests verify configured-versus-matched keyword data
  while rejecting user content from the persisted record.

## 2026-08-15 — Phase 2 resource and audit integration

Purpose: combine the independently reviewed standalone world-book, user,
launcher-status and Tavern Trace branches without allowing any one branch to
replace another module's client, API dispatcher, loader adapter or tests.

- Kept one installable plugin and one secured `/dsh-tavern/api/*` prefix while
  dispatching preset, character, user, world-book and Trace routes.
- Registered character, user and world-book adapters in one
  `TavernProfileLoader`; independent and embedded books use the same matcher.
- Kept one browser overlay and combined real preset, character, world-book and
  user panels with the session-aware red/green status projection. Chinese menu
  labels and the implemented user surface replace the feature branch's
  planning placeholder.
- Regenerated the browser bundle after every conflict resolution rather than
  selecting either generated bundle side.
- Updated README and technical contracts so completed independent world books,
  users, launcher status and Trace are no longer described as future work.

Verification:

- `npm run check` completed 116 tests: 115 passed, none failed, and the optional
  external copyrighted-fixture test skipped because no reviewer path was set.
- `npm run pack:check` produced the expected 49-file package and excluded tests,
  review documents, runtime data and the local untracked roadmap.
- An isolated DSH profile installed and restored prior plugin data, started on
  a loopback-only test port, and returned HTTP 200 for the web app plus active,
  world-book, user and Trace endpoints.
- Synthetic HTTP smoke resources were created, bound together to one test
  session, observed in the loader active view, deleted, and verified absent
  with both session references cleared.
- Browser verification found exactly one draggable `ST` launcher, confirmed
  red/black/white styling, red/green selection dots, titles for all four
  resources, persistent drag position, panel switching with the launcher still
  present, editable embedded entries, and an official sibling Tavern Trace tab.
- Tracked-file scans found no workstation path, external fixture name, local
  roadmap reference, private-key block or common API-key pattern.

## 2026-08-15 — Standalone World Info / World Book library

Purpose: add independently managed SillyTavern World Info resources without
duplicating the accepted pure matcher or moving Host injection ownership out of
the unified Tavern loader.

- Added the `world-book-library` use-case layer with bounded JSON import,
  creation, normalized known-field editing, deletion, original-format export,
  atomic persistence and reload-safe catalog summaries.
- Preserved imported book-level and entry-level unknown fields across edits and
  exports by retaining the parser's raw source snapshot while accepting only
  known editable model fields from update requests.
- Added same-origin API routes for CRUD/export and per-session zero/one/many
  bindings. Deleting a standalone book removes its ids from all saved session
  selections and never touches a character card or its embedded book.
- Connected standalone and embedded books to one world-book adapter and the
  existing deterministic matcher/loader projection. Selected standalone books
  retain selection order; entries retain insertion-order stability and each
  book's configured token budget.
- Replaced the planning-only World Info surface with standalone import/create,
  multi-binding, edit/export/delete controls for titles, primary and secondary
  keys, secondary logic, enabled/constant state, case/whole-word matching,
  position, order, probability and content. The accepted character-card
  embedded-book editor remains available in the same surface.
- Added only self-authored synthetic fixture content and automated coverage for
  CRUD reload, unknown-field round trips, API lifecycle, session isolation,
  binding effects, multi-book composition, stable ordering and independent
  embedded-book behavior.

Verification is recorded in
`docs/world-book-library/IMPLEMENTATION_AND_ACCEPTANCE.md`.

- `npm run check` built the browser bundle and completed 91 tests: 90 passed,
  none failed and the optional external-fixture acceptance test skipped because
  no reviewer path was configured.
- `npm run pack:check` succeeded with 39 release files and excluded tests,
  docs, fixtures, runtime data and local caches.
- Architecture and sensitive-information scans found no reverse Host seam,
  machine-specific path, local roadmap reference, private-key material or
  common credential-shaped value introduced by this module.

## 2026-08-15 — Per-session user resources (feature/user-profiles)

Purpose: add a deliberately narrow user/persona resource without introducing
avatars or allowing Tavern content to replace the DSH Agent identity.

- Added an exact `{ id, name, description }` user document store under
  `data/users/`, with atomic CRUD persistence, traversal-safe ids, bounded
  text, and rejection of every additional field including avatar metadata.
- Added same-origin JSON CRUD and per-session selection APIs plus a complete
  create/edit/save/bind/unbind/delete management panel in the shared Tavern
  launcher.
- Extended loader-owned `SessionSelectionStore` with one nullable `userId` per
  session; normal fork/subagent semantics continue to be owned by the same
  policy, and deletion clears all matching bindings.
- Added a user adapter to the unified `TavernProfileLoader`. The selected name
  supplies existing `{{user}}` macros; the description consumes the official
  `personaDescription` marker (plus explicit user-description aliases) or the
  `{{persona}}` placement exactly once.
- Added a stable fallback before fallback character fields with
  `USER_PERSONA_MARKER_FALLBACK` diagnostics when no enabled persona marker or
  explicit persona macro exists.
- Kept one `dsh-tavern:profile` Host section. User resources do not register a
  Host seam, change append/replace policy, modify DSH agent identity, or create
  history messages.
- Added synthetic-only persistence/API/runtime tests and a real-loader snapshot
  covering session isolation, immediate switching, restart restoration, macro
  and marker placement, fallback, unbinding, deletion cleanup and one-copy
  request contribution.

Verification is recorded in `docs/user/ACCEPTANCE.md`.

## 2026-08-15 — Tavern Trace bounded-persistence hardening

Purpose: cap the aggregate audit footprint and synchronous hot-path work after
review found that independent session/record limits still admitted a multi-GiB
theoretical JSON file and response.

- Added an 8 MiB default and hard maximum for the complete canonical Trace
  state, lowered the per-record default and hard maximum to 64 KiB, and made
  all four configurable count/byte limits clamp to explicit hard caps.
- Evict the oldest records by `updatedAt`/`recordedAt` across all sessions until
  the exact serialized UTF-8 state fits; reject a record that cannot fit even
  as the only record without changing memory or disk.
- Made writes transactional and reuse the one budget-checked serialization for
  atomic replacement. A pending supersede plus its replacement now share one
  batch write.
- Added safe startup handling for oversized legacy files, API total/current
  byte metadata, an independently bounded GET body, and UI total-budget status.
- Added multi-session synthetic tests for memory, disk, reload, GET response,
  oldest eviction, newest retention, hard caps and single-record rejection.
- Documented that normal capture still synchronously serializes/writes/renames
  the bounded file twice per request (begin and finalize), may block the Node
  event loop according to storage latency, uses no background Promise, is not
  `fsync`-durable, and can transiently occupy about twice the budget during
  atomic replacement.

Verification: the targeted Trace/Host/world-book suite passed 20/20;
`npm run check` rebuilt the browser bundle and passed 88 tests with 0 failures
and 1 optional external-fixture skip. `npm run pack:check` succeeded with 40
release files and excluded docs, tests, runtime data and local fixtures.

## 2026-08-15 — Tavern Trace audit view

Purpose: explain the exact per-request Tavern resource assembly and world-book
matcher decisions without adding model-visible messages or unsupported custom
DSH Session events.

- Added a `Tavern Trace` tab through DSH's public additive
  `conversation.view` slot, parallel to Conversation and Trajectory.
- Bound the exact Tavern system-assembly snapshot to public `agent/request`
  turn/step/attempt identifiers, then linked it to the effective public
  `request/header` event by seq and hashes. DSH header remains authoritative.
- Added accepted/rejected world-book decision metadata: matched primary and
  secondary keywords, secondary logic, explicit probability roll, budget,
  token cost, requested position, applied position and approximation state.
- Added plugin-owned atomic bounded JSON persistence and a read-only same-origin
  API because DSH rc.6 has no stable third-party persistent Session event-type
  registration seam. Current defaults are 128 sessions, 128 records per
  session, 64 KiB per record and 8 MiB total after the bounded-persistence
  hardening above; Trace persistence failure cannot veto a model request.
- Persisted only resource summaries, matcher metadata and SHA-256 values. Full
  preset/character/user/world-book content, history, system/header bodies,
  tool payloads and model messages are never stored by Trace.
- Documented implementation, recovery/alignment boundaries and acceptance in
  `docs/tavern-trace/`.

Verification: `npm run check` rebuilt the browser bundle and completed 85/85
executed tests; the one optional external-fixture test skipped because no path
was supplied. `npm run pack:check` succeeded with 40 release files, including
the Trace module and generated client while excluding tests, docs, runtime
data and caches. All new acceptance fixtures are synthetic and test-owned.

## 2026-08-15 — Session-aware Tavern launcher status

Purpose: make the single floating Tavern launcher an always-available,
session-scoped summary of the resources selected for the active conversation.

- Restyled the draggable launcher as a red, black and white `ST` ball while
  preserving its saved position, clamped placement and expansion animation.
- Added current Preset, Character, World Book and User titles beside their
  launcher actions. Multiple selected world books show every resolved name and
  an explicit book count.
- Added glowing green selected dots and red unselected dots. World-book dots
  intentionally ignore matched-entry and active-entry fields, so they never
  imply that lore matched the current turn.
- Made active-view refresh generation-safe across session switches and wired a
  shared browser refresh event through preset and character CRUD/selection
  operations. The event updates the launcher without requiring the drawer to be
  closed or reopened.
- Kept the launcher mounted above the resource side panel, retained one overlay
  registration, and added consistent Escape behavior for the expanded menu and
  open panel.
- Added a backward-compatible UI projection for existing loader
  `selection/resources/selected` fields and optional future `catalog/catalogs`
  fields, without changing resource stores, APIs or Host seams.

Verification:

- `node --test test/client-shell.test.mjs` passed 7/7 focused launcher tests.
- `npm run check` built the browser bundle and passed 84 tests; the optional
  external copyrighted-fixture test skipped because no reviewer fixture was
  supplied. There were no failures.
- `npm run pack:check` passed with the expected 35 files and did not include
  tests, module review docs, runtime data or any local roadmap/fixture.
- Diff hygiene, sensitive-value, machine-path and backend-boundary scans were
  clean; only browser client composition, generated client output, focused
  tests and review documentation changed.

## 2026-08-15 — Pre-merge publication hygiene

Purpose: ensure the accepted integration can be merged and published without
machine-specific directories, credentials, private fixtures or generated
copies of third-party content in the tracked tree.

- Replaced local checkout, worktree, profile, package-store and external
  fixture paths in review/research documents with repository-relative paths,
  descriptive placeholders or environment variables.
- Changed the optional copyrighted preset acceptance test to read only the
  reviewer-supplied `DSH_TAVERN_ACCEPTANCE_FIXTURE`; when unset, the test skips
  instead of assuming a developer-machine location.
- Kept platform path behavior covered with programmatically assembled synthetic
  paths that do not identify any workstation.
- Re-scanned tracked source, generated client code and documentation for local
  absolute paths, user names, private-key headers and common API/token formats.
  Credential-related text that remains describes placeholder test policy and
  contains no credential value.

Verification:

- With `DSH_TAVERN_ACCEPTANCE_FIXTURE` pointing to the external file, the full
  build and 81/81 tests passed without copying it into the worktree.
- `npm run pack:check` produced the expected 35-file package; tests, docs,
  runtime data and the external fixture were absent.
- Tracked-tree scans returned no machine-specific absolute path, user name,
  private-key header or common API/token-shaped value. The remaining word
  `credential` appears only in prose stating that acceptance used a disposable
  placeholder rather than a real credential.

## 2026-08-15 — Recoverable Windows refresh interruption

Purpose: make repeated installation recover after Windows rejects pnpm's atomic
profile-manifest rename, without losing the plugin-local preset/character data
or getting stuck between `remove` and `add`.

- Diagnosed the reported `EPERM` as a profile refresh attempted while the
  isolated DSH Node child from the prior acceptance smoke test was still alive;
  the outer command process had stopped but its child had not.
- Made refresh state depend on the profile manifest instead of only a leftover
  `node_modules/dsh-tavern` directory. An interrupted state now performs a
  direct repair add rather than a second failing remove.
- Replaced random OS-temporary recovery copies with a deterministic
  `<DSH_HOME>/backups/dsh-tavern/pending-refresh-<profile>/data` location.
  Subsequent installer runs reuse and automatically restore pending data, then
  delete the pending copy only after success.
- Added tests for manifest registration and interrupted-refresh command
  selection, while retaining the normal remove/add refresh test.

Verification:

- `npm run check` passed 81/81 tests, including both the ordinary refresh and
  interrupted-manifest repair paths.
- Repaired the real isolated profile from its removed-dependency state, restored
  all six retained data files, and verified every file hash with zero mismatch.
- Ran a second real remove/add refresh using the new persistent recovery path.
  It restored all six files, kept the dependency registered, produced zero hash
  mismatches, and removed the pending directory only after success.

## 2026-08-15 — Security hardening after the accepted functional baseline

Purpose: preserve the user-accepted behavior as an immutable review point, then
reduce browser/API exposure and prevent untrusted ST regex keys from blocking
the synchronous DSH host process.

- Tagged commit `65ffc08` as `accepted-functional-2026-08-15` before changing
  implementation or documentation.
- Added a single security wrapper around the unified Tavern API. It accepts
  loopback Host values by default, requires same-origin mutation requests,
  rejects browser-simple or unexpected mutation media types, and emits
  no-cache, no-sniff and no-referrer response headers.
- Added an explicit `security.allowedHosts` escape hatch for deployments behind
  a separately authenticated and encrypted reverse proxy. This is documented as
  Host permission rather than authentication.
- Removed local storage paths from preset and character catalog responses and
  their UI surfaces.
- Disabled native JavaScript `/regex/flags` world-book keys by default, retained
  an explicit `worldBook.allowUnsafeRegex` compatibility switch, bounded regex
  source length, and limited scans to the most recent 64 KiB by default.
- Added distinct loader diagnostics for disabled, overlong and invalid regex
  keys, plus scan truncation.
- Documented semantic prompt injection, local-process/API trust, secret
  propagation, non-loopback deployment, and unsafe-regex residual risks in the
  product README.

Verification:

- `npm run check` rebuilt the browser bundle and passed 79/79 tests, including
  Host/origin/media-type rejection, explicit network-host permission, regex
  opt-in/length behavior, loader diagnostics and scan truncation.
- `npm run pack:check` produced the expected 35-file package with the security
  wrapper included and no tests, runtime data or external copyrighted fixture.
- Refreshed the isolated integration profile and booted the real DSH Host on
  loopback. HTTP smoke tests returned 200 for reads, 403 for a forged Host and
  cross-origin write, 415 for a disallowed media type, and reached the business
  404 for a valid same-origin JSON write.
- In the real browser UI, opened the Tavern launcher/preset panel, loaded the
  existing catalog without exposing its storage path, created a synthetic
  preset through the secured POST path, and removed it through the secured
  DELETE path. The isolated Host and browser tab were then closed.

## 2026-08-15 — Draggable launcher and editable embedded World Info

Purpose: make the unified entry feel like one coherent control and expose the
actual ST entry definitions users need to understand and change activation.

- Made the `T` launcher draggable with viewport clamping, persisted position,
  click-versus-drag suppression, and left/right plus up/down expansion toward
  available screen space.
- Replaced the abrupt detached menu with one animated rounded surface that
  grows from the ball and keeps the four resource choices inside it.
- Replaced the World Info source-only view with an ST-style embedded
  Character Book editor. Collapsed rows show constant, disabled, or keyword
  activation; expanded rows edit primary/secondary keys and logic, content,
  enable/constant flags, case/whole-word behavior, insertion position and
  order. Entries can be added, deleted, reloaded and saved.
- Added an atomic character-world-book update API. It updates the plugin's
  normalized character document and JSON export while preserving the original
  imported PNG/JSON artifact byte-for-byte.
- Kept runtime truth separate from editing: this is a resource editor, not a
  fabricated trigger-time log. `request/header` remains the final message-flow
  audit source.

Verification: `npm run check` passed 73/73 tests. An isolated installed DSH
showed one expandable launcher, all four menu choices, seven real embedded
entries with their trigger summaries, complete edit fields, dirty/save state,
and clean discard on close/reopen without modifying the source card.

Follow-up: kept the floating ball mounted while any resource sidebar is open.
Its expanded menu now marks the active resource and switches panels directly,
so navigation no longer requires closing the current sidebar first.

## 2026-08-15 — Unified Tavern launcher and message-flow audit

Purpose: remove competing preset/character controls, expose the integrated
World Info runtime honestly, and document the exact DSH request boundary.

- Replaced separate preset and character header/overlay launchers with one
  round `T` launcher and a single menu for preset, World Info, character card,
  and the planned user/persona surface.
- Kept only one shell overlay registration and one z-index owner; all feature
  panels now open from that owner, eliminating cross-module stacking order.
- Added a World Info sidebar that reads the loader active view, lists embedded
  character-book resources and diagnostics, and marks standalone import as a
  planned capability rather than exposing a non-functional control.
- Corrected the character-card UI: embedded `character_book` is matched by the
  unified loader while the card is bound and stops contributing after unbind.
- Added `docs/DSH_MESSAGE_FLOW.md`, verified against installed DSH rc.6 source,
  covering Inbox claim, system assembly, durable message projection,
  `agent/request`, `request/header`, streaming, plugin hooks and same-turn lore
  limitations.

## 2026-08-14 — Parallel world-book format and matching slice

Purpose: make ST world-book semantics independently testable while loader and
character-card work continued in isolated worktrees.

- Added loss-preserving standalone World Info and embedded Character Book
  parsing/export, deterministic matching, ordering, groups, explicit
  probability rolls and token-budget projection.
- Kept parser/matcher free of DSH Host, session, storage and UI dependencies.
- Added an explicit loader bridge for before/after entries and honest
  diagnostics for depth, outlet and other unsupported placements.
- Read-only compatibility scans covered SillyTavern source examples and 94
  TauriTavern books; no inspected third-party content entered the repository.

Verification on `feature/world-book-compat`: 42/42 tests and package preview
passed at commit `1489e11570a712a882cc2b72461fc70bff8605f1`.

## 2026-08-14 — Three-module integration slice

Purpose: prove preset, character-card and world-book features compose through
one loader and one per-session selection policy before any main merge.

- Integrated the three completed feature branches in the separate
  `feature/tavern-integration` worktree; `main` remains unchanged.
- Registered `createCharacterAdapter()` and the embedded-world-book adapter in
  the sole Host loader rather than introducing additional prompt hooks.
- Routed character API bindings through `SessionSelectionStore`, added one-way
  migration from the character module's pre-loader binding file, and cleared
  references on deletion.
- Activated selected cards' embedded Character Books through the shared pure
  parser/matcher/loader bridge. Standalone world-book ids report an explicit
  not-yet-installed-store diagnostic.
- Added a synthetic end-to-end Host test proving character fields and matching
  lore enter one profile while creator notes stay out, plus migration coverage.
- Real DSH smoke testing exposed that two overlapping prefix registrations let
  the broad preset API shadow character routes. Replaced them with one Tavern
  API prefix and an internal path dispatcher; preset, character library and
  character-selection endpoints then all returned successful responses.
- Made the world-book snapshot assertion newline-independent across Windows,
  macOS and Linux.

Known boundary: world-book matching can inspect existing durable history but
not the same-turn user input because DSH does not expose it in the public
system-assembly context. Standalone world-book CRUD/UI and advanced recursive,
sticky/cooldown/delay/vector execution remain future slices.

## 2026-08-14 — Unified loader and session policy (feature/tavern-loader)

Purpose: establish the runtime boundary that lets preset, character-card and
world-book format modules develop in parallel without each registering its own
DSH prompt hooks.

- Added loader-owned, durable per-session resource selections with legacy global
  preset fallback, regular-fork snapshot inheritance, and empty subagent policy.
- Made the preset browser API/client send and resolve the active DSH session id;
  two conversations can now explicitly choose different presets or no preset.
- Replaced the preset-only Host section with one `dsh-tavern:profile` section and
  kept preset-only compiled output stable.
- Added `TavernProfileLoader` adapter seams for normalized character cards and
  activated world-book entries.
- Added a pure `compileTavernProfile()` coordinator for ST markers, character
  main/PHI overrides with `{{original}}`, lore before/after placement, fallback
  fields, macro sanitization and explicit greeting/PHI/depth diagnostics.
- Kept DSH durable history authoritative: `chatHistory` is consumed as a marker
  and never copied into system text; no assistant history or private session
  events are fabricated.
- Added loader audit snapshots with resource summaries, diagnostics, active lore
  ids and a deterministic fingerprint; DSH `request/header` remains the final
  source of truth.
- Added API, Host, profile composition, persistence, fork and subagent tests.
- Added `docs/LOADER_CONTRACT.md` as the required merge contract for the parallel
  character-card and world-book branches.

Verification:

- `npm run check`: 30/30 tests passed after rebuilding `dist/client.js`.
- `npm run pack:check`: package preview succeeded with the new loader files.
- Installed the local package into an isolated DSH home, confirmed it in the web
  profile, composed the full config, and booted the web host on an ephemeral
  port without a plugin load error.

## 2026-08-14 — Stage 1: contract and package skeleton

Purpose: establish the installable package boundary and document compatibility
choices before implementation.

Changes:

- Defined one installable `dsh-tavern` root package with a Host entry, browser
  bundle entry, and dsh bundle patch.
- Reserved `packages/tavern-format` for host-independent ST parsing/compilation
  and `packages/preset` for dsh integration.
- Added a repository-level `data/` ignore rule. Runtime imports must never be
  committed, including the copyrighted acceptance fixture.
- Recorded the first-pass integration and compatibility contracts in
  `docs/REVIEW_GUIDE.md`.

Verification at this stage:

- Confirmed all three Git worktrees are independent and this branch is
  `feature/prompt-preset-gpt`.
- Read only the field/type shape of the acceptance fixture. No fixture content
  or file was written into this repository.
- Confirmed dsh `0.1.0-rc.6` exposes the right `details` slot,
  `systemPrompt.section()`, and the `agent/request` call-config waterfall.

## 2026-08-14 — Stage 2: format core, persistence, API, and Host seams

Purpose: make preset behavior testable independently of the browser before UI
work begins.

Changes:

- Added a pure ST Chat Completion preset parser with `100001` prompt-order
  selection, lossless raw-field retention, normalized editable prompts, and
  supported dsh call-config projection.
- Added deterministic-testable ST macro evaluation (`setvar/getvar`, user/char,
  random, dice, last-message placeholders) plus removal of unresolved braces
  that conflict with dsh prompt variables.
- Added a plugin-local atomic JSON store with traversal-safe ids, create,
  import, update, select, delete, reload, compiled prompt, and call-config
  views.
- Added a bounded same-origin JSON API under `/dsh-tavern/api`.
- Registered the selected prompt through `systemPrompt.section()` and supported
  sampling values through `agent/request`.
- Added synthetic unit/contract tests plus an in-place, structure-only test for
  the copyrighted acceptance file.

## 2026-08-14 — Stage 3: right sidebar and complete CRUD workflow

Purpose: expose the tested Host behavior as a SillyTavern-style, always-nearby
conversation control rather than a settings-only page.

Changes:

- Added a right `details` panel contribution and opened it by default when the
  dsh layout service becomes ready.
- Added a conversation-header `预设` utility that reopens the panel after the
  user closes it.
- Added browser workflows for JSON file import, create-and-select, selection,
  edit/save, delete, and status/error reporting.
- Added sampling controls, compatibility-only ST parameter controls, and an
  ordered prompt editor with enable, role, content, add, move, and delete.
- Added an API-level test covering import, selection, active compiled preview,
  and creation through the same endpoints used by the UI.

## 2026-08-14 — Stage 4: installed-plugin and message-path acceptance

Purpose: verify the packaged result through a real dsh Web profile, including
the durable request record, rather than stopping at unit-level mocks.

Changes and findings:

- Installed this worktree with `dsh plugin --profile web add file:...` into an
  isolated temporary `DSH_HOME` and confirmed both Host and client entries load.
- Reasserted the default details-panel open during the short dsh session-layout
  bootstrap window; this avoids the Host restoring the closed width after the
  plugin's first open request.
- Imported the named copyrighted fixture in place. It produced 140 editable
  prompts, 20 enabled non-marker prompts, selected order `character_id: 100001`,
  and a 4,776-character compiled plugin section without unresolved strict dsh
  macros. No fixture content was copied to this worktree or test output.
- Exercised browser create, edit, save, switch-away, and switch-back behavior.
  The created preset restored `temperature: 0.42` and `maxTokens: 888` after
  reselection and was stored below the installed plugin's `data/` directory.
- Submitted real dsh session prompts with both the imported and UI-created
  presets selected. Their durable `request/header` records contained the
  dsh-tavern preset marker/name and the selected sampling values; no unresolved
  `{{...}}` macro reached either request header.
- Ran `npm run check`: build plus all 9 tests passed. Ran package dry-run and
  confirmed the copyrighted fixture, runtime `data/`, docs, and tests are absent
  from the publish payload.

## 2026-08-14 — Stage 5: cross-platform lifecycle scripts

Purpose: replace platform-specific command snippets with repeatable plugin
installation and safe removal commands.

Changes:

- Added Node.js install and uninstall entry points for Windows, macOS, and Linux.
- Avoided shell evaluation; argument arrays carry profiles, paths, local package
  specs, and optional pnpm store directories directly to dsh.
- Made uninstall back up plugin-local preset data under `DSH_HOME/backups` by
  default before package removal, with explicit destination and no-backup modes.
- Added dry-run/help modes, profile-name validation, path normalization, and
  cross-platform unit tests.
- Added the standalone `docs/INSTALLATION.md` reviewer/operator guide.

Verification:

- `npm run check` passed 13/13 tests.
- A unique temporary `DSH_HOME` completed install, test-preset creation,
  uninstall-time backup, and removal. The installed package disappeared while
  the backup retained one preset plus its selected id.
- Windows execution used the located npm `dsh.ps1` shim through system
  PowerShell with an argument array. No user shell interpolation was involved.
- The exact temporary lifecycle directory was removed after verification.

## 2026-08-14 — Stage 6: blank-session launcher

Purpose: make preset import and selection reachable before the first message.

Changes:

- Confirmed an installed plugin could have a healthy Host API and mounted client
  tree while dsh compressed the session-scoped `details` column to zero width.
- Added an additive `shell.overlay` launcher and drawer, which are root-scoped
  and therefore usable while the current session is still blank and dsh refuses
  to expand the session-scoped details column.
- Hide the overlay surface automatically when the native details column is open;
  the existing conversation-header button remains the reopen control after a
  turn.

## 2026-08-14 — Stage 7: session synchronization and prompt policy

Purpose: remove stale or misleading sidebar state and make prompt-order and
system-prompt policy explicit.

Changes:

- Replaced the initial empty catalog with an explicit loading state, so a new
  conversation no longer briefly claims that no preset is selected.
- Subscribed the global launcher to dsh's current session id and made the native
  panel refresh whenever its session id changes.
- Made catalog plus selected-preset detail an atomic, generation-guarded refresh;
  late responses from an older session can no longer overwrite current UI.
- Added a shared refresh event when either launcher opens the panel, fixing stale
  state after the host keeps a collapsed details subtree mounted.
- Added direct HTML drag ordering with a handle immediately left of each prompt's
  enabled checkbox; removed the detail-only up/down controls.
- Added an opt-in per-preset system prompt mode. The default appends to dsh;
  advanced replace mode removes other system sections while preserving tools,
  runtime contexts, variables, and execution-layer enforcement.
- Added `docs/PROMPT_PIPELINE.md` documenting the ST pipeline, TauriTavern host and
  Agent changes, current DSH mapping, context contamination, and future world
  book/character-card seams.

Verification:

- `npm run check` built the client and passed 16/16 tests, including the new
  system-assembly preservation and pure reorder contracts.

## 2026-08-14 — Stage 8: mutually exclusive sidebar surfaces

Purpose: eliminate duplicate launch buttons and double-close behavior after an
active conversation's native details panel is collapsed.

Changes:

- Confirmed the isolated user profile contains one `dsh-tavern` dependency and
  one bundle entry; reinstalling without uninstalling did not duplicate it.
- Restricted the root floating launcher/drawer to the no-session or blank-session
  state where dsh does not provide a usable conversation header.
- Active sessions now expose only the native details panel plus its header
  launcher. Closing that panel cannot reveal a still-open overlay drawer.
- The blank-session drawer no longer asks the native details layout to open, so
  the two surfaces cannot become open at the same time.
- Added a pure visibility-policy test for missing, blank, and active sessions.

Verification:

- `npm run check` built the client and passed 17/17 tests.
- In a disposable installed profile, the blank state exposed one floating
  launcher and one drawer; one close removed the drawer.
- After a test turn created an active session, there was one header launcher,
  zero floating buttons, and one visible native panel. One close collapsed the
  panel from about 359 px to 0 px; one header click reopened it.

## 2026-08-14 — Stage 9: explicit drag origin and drop position

Purpose: make prompt reordering visually predictable before the pointer is
released.

Changes:

- Collapse the dragged source prompt into a primary-color horizontal bar so its
  original position remains visible.
- Render a dashed placeholder box labelled `松开后放置于此` at the exact
  insertion boundary.
- Resolve the boundary from the upper or lower half of the prompt under the
  pointer, including a distinct drop target after the final prompt.
- Convert the visible insertion boundary to the post-removal array index with a
  pure helper, avoiding off-by-one moves when dragging downward.

Verification:

- `npm run check` built the client and passed 18/18 tests.
- Boundary tests cover moving the first prompt to the end, the last prompt to
  the beginning, and a no-op drop immediately after the source.

## 2026-08-14 — Stage 10: format/use-case/runtime boundary split

Purpose: establish the shared architecture before merging preset into `main`,
so character cards and world books do not copy the preset feature's former Host
coupling.

Changes:

- Kept one installable and releasable `dsh-tavern` root package while splitting
  its internals into `tavern-format`, `preset`, and `tavern-loader`.
- Moved DSH prompt compilation and supported call-config projection out of the
  pure format adapter and into `tavern-loader`.
- Removed Host registration from the preset use-case entry; the root `main` now
  points to the loader, which composes store, API projection, system prompt, and
  request hooks.
- Added public subpath exports for library/use-case/runtime consumers without
  presenting them as independently installable DSH plugins.
- Added `docs/ARCHITECTURE.md` with the single-plugin decision, dependency rule,
  parser-library rationale, future resource seams, and pre-merge acceptance
  gates.
- Added an automated boundary test preventing obvious Host dependencies from
  flowing back into the format or store layers.

Verification:

- `npm run check` rebuilt the accepted browser bundle and passed 19/19 tests,
  including the external fixture's in-place structural check.
- `npm run pack:check` included all three internal layers in one 16-file package
  and excluded docs, tests, runtime data, caches, and the copyrighted fixture.
- A fresh isolated DSH profile installed one root plugin, loaded
  `packages/tavern-loader/src/index.js`, booted its real HTTP API, and returned
  the expected compiled marker and call config for a synthetic selected preset.

## 2026-08-14 — Stage 11: reliable local-package refresh

Purpose: prevent pnpm's unchanged `file:` resolution from installing a new
package manifest while leaving newly added source files absent.

Changes:

- Reproduced an existing-profile failure where `package.json` pointed to
  `tavern-loader` but the installed package still contained only the former
  preset and format directories.
- Confirmed pnpm `--force` still reported `Already up to date` and did not repair
  a deliberately removed loader directory.
- Made repeated install detect an existing plugin and perform remove/add rather
  than relying on pnpm's local-directory freshness decision.
- Preserve plugin-local `data/` in a temporary recovery directory during the
  refresh, restore it after add, and retain the recovery path if refresh fails.
- Reuse the pnpm store recorded by an existing profile when `--store-dir` is
  omitted, while continuing to prefer an explicit command-line store.
- Kept first install, dry-run, explicit profile, custom `DSH_HOME`, and custom
  pnpm store behavior unchanged.

Verification:

- A deliberately removed installed loader directory was restored by repeated
  install while its synthetic selected preset remained present.
- The existing isolated profile, originally linked to a separate pnpm store,
  refreshed successfully, retained two preset files and
  its selected state, and booted the Web/API surface on port `53101`.
- `npm run check` passed 21/21 tests, including store detection and the
  remove/add dry-run contract.

## 2026-08-14 — Stage 12: public repository preparation

Purpose: make the accepted preset slice understandable and legally distributable
before merging it into `main` and publishing the repository.

Changes:

- Replaced the scaffold README with a user-facing project guide covering goals,
  current preset features, installation, usage, architecture, explicit
  compatibility limits, roadmap, development checks, and uninstall behavior.
- Added official SillyTavern repository/prompt-documentation and TauriTavern
  repository/Agent-documentation references, plus a no-affiliation and
  third-party-content notice.
- Added the MIT license already declared by package metadata, with Copyright
  2026 Zhu Bohan.
- Kept internal architecture/review/acceptance documents separate from the
  product README.

Verification:

- `npm run check` rebuilt the client and passed 21/21 tests.
- `npm run pack:check` contained 17 release files including `LICENSE`, all three
  internal layers, and lifecycle scripts; it excluded docs, tests, runtime data,
  caches, and the copyrighted external fixture.

## 2026-08-14 — Stage 13: character-card format and use-case slice

Purpose: add SillyTavern character-card compatibility without reintroducing
prompt-runtime coupling or duplicating world-book policy.

Changes:

- Added pure V1/V2/V3 JSON normalization and bounded PNG `chara`/`ccv3` tEXt
  extraction, with V3 precedence and compatibility diagnostics.
- Preserved the complete source JSON, unknown fields, extensions, embedded
  character books, V3 assets, and the exact imported artifact bytes.
- Added an atomic character library, SHA-256 metadata, per-session selection,
  stable greeting indices, safe selection copy, and deletion cleanup.
- Added raw-byte import, detail/list, artifact/JSON export, deletion, and
  selection APIs with structured errors and loader-supplied session-policy hooks.
- Added a versioned loader resource snapshot and an inert embedded-world-book
  resource; neither interface compiles prompt text or activates entries.
- Aligned selection intent with the loader's `characterCardId`/`character`
  shape and added a `createCharacterAdapter()` whose `resolve()` returns
  `{ character, diagnostics }` with `id/name/updatedAt/data`.
- Added the character library UI and a minimal browser composition entry while
  leaving preset source and `packages/tavern-loader/**` unchanged.
- Recorded the implementation, API/loader/world-book contracts, scoped
  acceptance, limitations, and cross-branch merge points under
  `docs/character-card/`.

Verification:

- `npm run check` rebuilt the combined browser bundle and passed 38/38 tests:
  the original 21 preset checks plus 17 character format/use-case checks.
- All new fixtures are synthetic and generated inside tests; no local
  third-party character artwork or content was copied into the repository.
- Installed prompt injection, fork/subagent policy, and character-book matching
  remain explicit loader/world-book follow-up work rather than false positives
  in this slice's acceptance record.

# 2026-08-15 — Data lifecycle and public roadmap documentation

Purpose: make plugin data retention behavior and the public feature direction
reviewable before resource-library development.

- Documented the exact default plugin-local data tree, refresh recovery,
  uninstall backup, `--no-backup`, and external `storageDir` behavior.
- Added the public roadmap for standalone world books, name-and-description
  user resources, launcher status, Tavern Trace, session workflows, and
  stateful world-book behavior.
