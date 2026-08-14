# Development changelog

This is the staged implementation log for the prompt-preset experiment. It is
kept separately from the product README so reviewers can follow intent,
decisions, verification, and known limits chronologically.

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
- The user's existing isolated profile, originally linked to
  `D:\.pnpm-store\v11`, refreshed successfully, retained two preset files and
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
