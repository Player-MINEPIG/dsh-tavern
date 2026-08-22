# Playthrough v2 implementation review

[中文](PLAY_REVIEW.md)

Review baseline: `codex/v2-lingzhu-mowan-frontend`. First review was `6ede09d` (2026-08-20). Risk-close and product-implementation notes were updated through `bb10a3b` (2026-08-21).
Original findings are kept as audit evidence. Each item's current status follows “accepted handling decision” and the implementation audit.

## Summary

The current implementation already respects several key boundaries: `packages/play` does not import private DSH modules; Host operations are centralized in `packages/tavern-loader/src/play-host.js`; message reads use Host history/`deriveMessages()`; user input goes through `session.prompt({ mode: "queue" })`; there is no bypass write of DSH messages or forged history; timeline stores only session/event range references; path APIs check root, relative path, and symlinks; the default-view adapter has also moved out of `conversation.view` and no longer registers a second `chat`.

## Later acceptance status

The following is product acceptance after the review baseline. The 2.0 release scope has completed human acceptance. Later changes still need the matching items rerun:

| Scope | Current status | Notes |
| --- | --- | --- |
| Playthrough lifecycle | Implemented, accepted | Character-card sidebar creates/reuses the latest empty playthrough, `N playthrough` naming, rename, real blank DSH session, empty timeline/catalog validation. Reuse also considers DSH messages and imported QA. |
| Empty-session greeting dock | Implemented, accepted | Greeting is shown in the native composer dock. Left/right buttons stay on both sides. A card with no greeting keeps an empty opening and footer. |
| Imported-record binding | Implemented, accepted | Binds to the current empty root session. Does not create a session or timeline. Supports bind, rebind, unbind; unbind restores greeting. The server repeats the empty-session lock check. |
| Last three QA turns | Implemented, accepted | Opening dock shows the last three imported QA turns. Display preview, not DSH history. |
| One-shot injection | Implemented, accepted | First assembly establishes a durable claim from public `claimEventSeqs`. Replay is allowed before the same terminal; after terminal a new claim no longer injects. Tavern branch/swipe copies body-free lineage. After interrupt, a new message on the original session does not reinject. |
| Action buttons and tree playthrough branching | Implemented, accepted | displayOverride, existing-variant switch, same-row left/right swipe, new-playthrough branch, same-playthrough rollback. Hide and its timeline field were removed before the 2.0 release. Whether a body is shown is decided only by display regex and displayOverride. Right-swipe on context output reruns the nearest real user turn and does not resend context. Timeline stores each swipe continuation with parent/head. The active branch-anchor session still belongs to the original playthrough. |
| Display-regex order | Implemented, accepted | Global, preset, and character card each support the same handle-drag, shrink-to-line, and drop-placeholder animation as preset prompts. Save writes the workspace document or native `regex_scripts` arrays. Cross-source drag is forbidden. Combined order is fixed global → preset → character. |
| Child-agent / context-injection display | Implemented, accepted | v2 messages keep model `role` and add `origin`. Mowan fully hides reasoning/context: no user bubble and no expand. Retry of context-triggered output walks forward to a real user turn; the controller refuses to resend context. Display regex only controls bodies. If every segment is cleared, one action group remains at the durable QA end. |

Table behavior completed user acceptance on DSH 0.1.0-rc.8. All P0 hardening is in `npm run verify:2.0` grouped regression. Windows junction, in-root reparse point, and pre-rename parent-directory replacement ran on a real machine and are no longer skipped for missing symlink permission. Real rc.8 Host chrome/workspace authoritative read-only smoke, write interaction, workspace-admission visuals, action buttons, display regex, playthrough lifecycle, and uninstall fallback are done. Two-tab and low-level races stay constrained by deterministic automated tests and later-version regression.
Workspace admission is implemented: Mowan blocks RP content when the v2 workspace is unbound, a candidate is stale, or read fails. It consumes only the public DSH workspace list. A candidate must be chosen explicitly, PUT is read-back-validated, and failure can retry or return to native. No browser workspace copy is saved.

Original findings stay below as evidence. Whether they are closed follows the decision table immediately after.

## Accepted handling decisions (2026-08-21; status as marked per row)

| Original risk | Accepted contract |
| --- | --- |
| History completeness (implemented, `10250a7`) | The 32-page cap is gone. Pagination continues until Host `hasMore: false`. Empty Host page, illegal oldest `seq`, or a repeating/non-advancing cursor → 502 `PLAY_HISTORY_CURSOR_STALLED`. The plugin does not summarize/slice. Model-context overflow is a DSH error. README distinguishes the two layers. |
| catalog/timeline concurrency | GET/PUT schema/path checks, in-process target lock, temp-write/replace recheck, and server SHA-256 revision/CAS are implemented. Managed PUT must send `expectedRevision`. Conflicts are uniformly 409 `PLAY_FILE_REVISION_CONFLICT` and do not change the file. Extremely narrow cross-process races stay under task 03's pure-Node boundary. Bundled live-client revision cache, create-only, and limited conflict replay were finished in task 05. Task 06 finished ordinary lifecycle-caller migration. |
| Half-complete resources | No cross-file transaction is added. Wired lifecycle mutation APIs record operationId, stage, result, error code, and duration through `ctx.logger`. Only whitelist identifiers are logged — not body, length, summary, or unknown fields. Clients recover from completed stages, read-back, and stable error codes. |
| import-context request semantics | Claim/terminal/lineage implemented. No claim means no inject or consume. Replay is allowed before the same terminal. `turn/end` stores only body-free terminal metadata. After terminal a new claim does not inject. Tavern branch/swipe copies body-free lineage. Third-party native forks are outside interception. |
| catalog schema | Implemented: validate before PUT write and after GET read. id/normalized path unique; id uses safe segments; path is a safe relative path ending in `/timeline.json`. Known `ext.pmpDshTavern` is validated; third-party ext is kept. |
| focus | Task 07 implemented: the stable entry resolves a path from a validated catalog and a safe playthrough id, and returns playthroughId/sessionId/nodeId/variantId. Empty playthroughs use rootSessionId. Old `/focus?path=` stays compatible; no path returns 400. Ordinary timeline PUT no longer updates deprecated/ignored activeTimelinePath. Task 08 finished bundled live-client migration: only a URL-encoded playthrough id is sent, and the four fields plus returned id are checked. |
| Path TOCTOU | Implemented in-process per-target guard. The path chain `lstat`s each segment and rejects symlink/junction. Directories are created layer by layer and rechecked with realpath. Temp files use exclusive `wx`. Parent directory is rechecked before write and rename. Pure Node does not claim a cross-process or kernel-level no-follow transaction. An external local process can still create an extremely narrow race. |
| Broader logging | This round supports only Cordis `ctx.logger`. Retention, destination, and rotation are managed by the DSH/Cordis Host. This plugin does not write its own persistent log file and does not promise Host logs as durable audit. Browser logger, a persistent bounded journal, and extra exporters go to backlog and do not block this round. |

## Original findings: API and lifecycle semantics

| Level | Location | Finding and impact | Suggestion |
| --- | --- | --- | --- |
| P1 data consistency (closed, tasks 04–06) | `workspace.js`, `live.js`, `mutations.js`, and lifecycle callers | The original implementation protected whole-document writes with only a single-client queue; cross-tab updates could be lost. Server revision/CAS and local-intent replay of built-in callers are now implemented. External side effects such as session/branch/message are not repeated during CAS replay. | Keep verifying two-tab conflicts in release regression. Third-party clients must send expectedRevision and handle 409. |
| P1 half-complete resources (accepted boundary, tasks 11–13) | `operation-log.js` and workspace/session/import mutation endpoints | session, directory, timeline, and catalog are still several atomic operations. Failure may leave orphans. The current choice is no cross-file mega-transaction, plus content-free `ctx.logger` stages, stable error codes, and client read-back recovery per endpoint. | Do not claim atomicity. Release acceptance checks failure logs and recovery paths. Browser logs, persistent journal, and exporter are deferred. |
| P1 history completeness (closed, `10250a7`) | `packages/play/src/sessions.js:62-79` | The original 32-page cap silently returned incomplete history while `hasMore: true`. That risk is closed by unbounded pagination and explicit cursor-stall failure. `GET /sessions/:id/messages` does not return a partial-history illusion. | Implemented: keep paging until `hasMore !== true`. Empty page, illegal oldest `seq`, or a repeating/non-advancing cursor → 502 `PLAY_HISTORY_CURSOR_STALLED`. The plugin does not summarize/slice. |
| P1 request semantics (closed, tasks 09–10) | `import-context-runtime.js`, loader hooks, and the branch host seam | Claim identity, terminal, and Tavern branch lineage are implemented. Retry replays before terminal. A new user claim after the same terminal no longer injects. State stores only body-free metadata. | Release regression covers the six cases: normal, request failure, cancel, new message after interrupt, same-turn retry, and swipe. |

## Original findings: security and schema

| Level | Location | Finding and impact | Suggestion |
| --- | --- | --- | --- |
| P2 security (closed, task 03) | `packages/play/src/workspace.js`, `packages/play/src/paths.js` | Practical path hardening is implemented: target lock, per-segment no-follow checks, layer-by-layer create, realpath recheck, exclusive temp write, and pre-rename parent recheck. | Pure Node does not claim a cross-process or kernel-level no-follow transaction. External-process extremely narrow races and revision/CAS stay separate. |
| P2 schema/compat (closed, task 02) | `packages/play/src/timeline.js`, `workspace.js` | catalog/timeline now validate uniformly on GET and PUT. Dangerous path, duplicate id/path, and bad known `pmpDshTavern` field values return explicit `PLAY_CATALOG_INVALID` / `PLAY_TIMELINE_INVALID`. Third-party ext is kept. Server revision/CAS finished inside the same target guard. TOCTOU path hardening is done. | Bundled live-client primitives and ordinary lifecycle-caller migration are both finished. |
| P2 focus semantics (closed, tasks 07/08) | `sessions.js`, `live.js`, and focus callers | Stable focus no longer depends on most-recent write or lastOpenedAt. activeTimelinePath is kept only as a compatibility field and is deprecated/ignored. Ordinary timeline PUT no longer updates it. The bundled live client calls the stable entry only with a URL-encoded playthrough id and validates playthroughId/sessionId/nodeId/variantId. | Old `/focus?path=` is migration compatibility only. A custom client may still pass an explicit path. |

## Boundaries that later implementation must not regress

- Do not write greeting, imported QA, or timeline nodes as DSH `user/message` / `assistant/message`. Current import projects through a limited, escaped, `untrusted`-labeled profile context. That direction is correct.
- Do not let the client touch private DSH session fields, bundle paths, or DOM. Keep going through v2 Host RPC, the public session projection, and the root path jail.
- Do not dress a local controller's serial queue as a cross-client transaction. Every managed catalog/timeline caller continues to cooperate with server revision/CAS.
- While fixing the items above, native view, native Chat, Host session history, and uninstall fallback must still work independently.

## Updated acceptance order

1. Automated evidence: run `npm run verify:2.0`. Full history, the six import claim/lineage cases, schema/CAS, corrupt files, focus-by-id, operation log, Windows junction/reparse/pre-rename parent replacement, and mode-service dispose are all covered by deterministic tests.
2. Real Host/browser: first run read-only Host smoke with `DSH_TAVERN_PLAY_LIVE=1` and `DSH_TAVERN_PLAY_LIVE_URL`. Then watch chrome SSE/focus/poll convergence and CAS conflicts in two tabs. In fresh data, verify workspace admission for no candidate / one candidate / many candidates / stale candidate / failure recovery. Do one representative UI regression for normal and interrupted replies.
3. Compatibility fallback: disable or uninstall Tavern, confirm native DSH and other plugins still work, then restore plugin data. Do not use this step to verify `--no-backup`, which deletes resources.
4. Release gate: `npm run verify:2.0` already includes build and pack dry-run. Recheck dependency audit, public-path/secret scan, official docs, and version before tagging 2.0.
