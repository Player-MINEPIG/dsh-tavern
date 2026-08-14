# Development changelog

This is the staged implementation log for the prompt-preset experiment. It is
kept separately from the product README so reviewers can follow intent,
decisions, verification, and known limits chronologically.

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
