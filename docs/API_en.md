# HTTP API

[中文](API.md)

Status: 2026-08-22. Root: `/pmp-dsh-tavern/api`. Auth is still local TCP peer, Host, Origin, and Content-Type (see the loader security middleware). Success responses include `ok: true`; failures include `ok: false` and `error`.

Two contracts:

- **v2**: the stable surface for any RP frontend.
- **v1**: the bundled-UI contract for this plugin's orb, sidebar, and Trace. Outsiders may read and call it, but RP surfaces should use v2. v1 fields change with this plugin's UI needs.

Do not add `/swipe`, `/regenerate`, `/export`, or `POST /focus`.

## v2 stable surface

Prefix: `/pmp-dsh-tavern/api/v2`.

| Method | Path | Role | Status |
| --- | --- | --- | --- |
| GET | `/chrome` | Returns `{ mode: "native" \| "play", revision }`. `revision` is the server-authoritative opaque version string | Implemented |
| GET | `/chrome/events` | Tavern-owned SSE. Sends the current snapshot on connect and `chrome/change` when mode actually changes | Implemented |
| PUT | `/chrome` | Writes global chrome. Does not change the RP lock or the current DSH session. Success includes the new `revision` (same mode produces no change) | Implemented |
| POST | `/chrome` | Not provided | 405 |
| GET | `/workspace` | Root path, whether a root is selected, contract version, warnings | Implemented |
| PUT | `/workspace` | Bind **one** existing play-workspace root. First selection may carry `SWIPE_DISK` / possible `SYSTEM_DISK` warnings. Does not mkdir the root | Implemented |
| POST | `/workspace/dirs` | `{ path }` relative path. `PlayWorkspaceStore` creates it inside the already-bound root jail. Compatible with native/browse Host; does not depend on the global `directory-picker` or `apiProxy.host.createDirectory`. Unbound root → 409. Rejects absolute paths, `..`, symlink escape, and file conflicts. Does not register a new DSH workspace | Implemented |
| GET | `/workspace/files?path=` | Read a UTF-8 file under the root. `catalog.json` / `timeline.json` run the matching schema/path checks after read. Third-party `ext` is kept as-is. Managed documents add a SHA-256 `revision` of the exact UTF-8 bytes (64 lowercase hex) | Implemented |
| PUT | `/workspace/files?path=` | Ordinary files still use `{ content }`. `catalog.json` / `timeline.json` must send `expectedRevision`: `null` creates a missing target only; a 64-hex lowercase SHA-256 replaces only when the current byte hash matches. Validation, CAS, temp write, and rename share one target guard | Implemented |
| GET | `/workspace/files?list=` | List one prefix level | Implemented |
| POST | `/sessions` | Open a play session. With a character card, title = character name + time. Without a card, DSH `session.create` default title is used; no 409. Tavern bindings are copied only when the body has `selectionFromSessionId`. Inserts into the play workspace. **Does not write timeline** | Implemented |
| POST | `/sessions/:id/branch` | `{ atEventId }` = log seq. After fork, copy the public selection. If the source import claim already ended at an earlier terminal, copy body-free pending lineage. Does not write timeline or send on behalf of the user. Copy failure is explicit 502 `PLAY_BRANCH_COPY_FAILED`. Open turn → 409 | Implemented |
| POST | `/sessions/:id/user-message` | `{ text }` as the next user body, `session.prompt` `queue` | Implemented |
| GET | `/sessions/:id/messages` | `deriveMessages()` + `seq` + `incompleteTurn` + per-message `origin`. Reads until `hasMore: false`; no plugin page cap. Empty Host cursor page, illegal seq, or a cursor that does not advance → 502 `PLAY_HISTORY_CURSOR_STALLED` | Implemented |
| GET | `/sessions/:id/import-context` | Returns `{ binding }`. Unbound is `null`. A binding includes path/hash/state/count summaries and, when claimed, body-free claim identity/event-seq summaries. Record bodies are not returned | Implemented |
| PUT | `/sessions/:id/import-context` | `{ reference: { path, expectedHash? } }`. Bind or rebind an already-written workspace import-context on an empty session | Implemented |
| DELETE | `/sessions/:id/import-context` | Unbind an empty session. Idempotent `{ binding: null }` | Implemented |
| GET | `/playthroughs/:id/focus` | 2.0 stable contract: resolve the playthrough via catalog and return `{ playthroughId, sessionId, nodeId, variantId }`. Empty playthroughs use `rootSessionId` | Implemented; bundled live client migrated |
| POST | `/playthroughs/:id/relink-character` | `{ characterId }`. Rebind only that playthrough and its root/swipe/branch descendant sessions to an existing card. An explicit user choice is not limited by automatic classification | Implemented |
| POST | `/playthroughs/:id/detach-session` | `{ sessionId }`. Remove the target session's timeline variant and descendants from that playthrough. Sibling branches, the DSH session/history, and the empty catalog playthrough remain. The server validates the tree and commits with managed-file revision/CAS | Implemented |
| GET | `/focus?path=` | Migration-era low-level compatibility: derive `{ sessionId }` from an explicit timeline path. The 2.0 bundled frontend no longer depends on it | Implemented, migration compatibility |
| GET | `/focus` (no path) | 2.0 provides no default target. “Most recently written timeline” is no longer user focus | Default removed; 400 `PLAY_FOCUS_PATH_REQUIRED` |
| POST | `/focus`, `/playthroughs/:id/focus` | Not provided | 405 |

Path exists but method is wrong → `405 PLAY_METHOD_NOT_ALLOWED` (for example `POST /chrome`, `POST /focus`, `GET /sessions`). On the stable focus path, a missing playthrough id is 404 `PLAY_PLAYTHROUGH_NOT_FOUND`; a missing catalog is 409 `PLAY_CATALOG_UNAVAILABLE`; a corrupt catalog stays 400 `PLAY_CATALOG_INVALID`; a missing or corrupt timeline is uniformly 409 `PLAY_FOCUS_UNAVAILABLE`. The stable entry does not accept a client path, does not read DSH history, and does not write files. Old `/focus?path=` remains migration compatibility only.

### Message origin and display semantics

Each message from `GET /sessions/:id/messages` keeps two independent classifications:

- `role` is the model-facing message role, currently mainly `user`, `assistant`, `system`. DSH runtime context injection may still be `role: "user"` on the model side.
- `origin.kind` is frontend origin/display semantics: `user`, `context`, `steering`, `assistant`, `system`. Third-party frontends must use it to distinguish real user input from context injection and must not draw a user bubble from `role` alone. Whether to hide or present context separately is a frontend choice.
- `origin.kind: "context"` may include `producer`, `form`, `summary`. Those are bounded optional display metadata. The body stays in `text` / `content` and is not copied into `origin`.
- New fields are additive for older clients. Existing meanings of `role`, `seq`, `text`, `content`, and `incompleteTurn` do not change. When an older server has no `origin`, the client can only fall back conservatively on `role` and cannot reliably detect context injection.

Bundled Mowan does not render reasoning or `origin.kind: "context"` and provides no expand control. Use native DSH **Chat** for runtime detail. Reply swipe is a client composition of branch / user-message / timeline CAS. There is no `/swipe` verb. When the user acts on parent output triggered by `context`, the controller walks forward on the active branch to the nearest real `user` / `steering` and reruns the whole turn from in front of it. It never resends a context report as human input. Missing a real user message fails explicitly. Durable QA provides copy, left/right swipe, new-playthrough branch, same-playthrough rollback, and display-layer edit. Hide is gone. Display regex decides per-segment assistant-body visibility, but actions belong to the QA: multi-segment output still has one action group; if every body is cleared, that group plus non-visual provenance and timeline pointers remain.

Import-context mutation is locked by session-authoritative state. If a DSH user/assistant message, an open turn, or a claimed binding exists, `PUT` / `DELETE` return `409 PLAY_IMPORT_CONTEXT_LOCKED`. Hiding the button is not a substitute. `PUT` rereads the workspace file, runs JSON/schema/hash checks, then sets the binding to `pending`. `GET` may read the summary in any state. Bodies are still read through `/workspace/files?path=` with an explicit path. The first real assembly must carry non-negative `claimEventSeqs` from the public `agent/inbox/spliced` projection before the loader persists the binding as `claimed` and replays the same escaped, `untrusted`, read-only context for that claim identity. A view/assembly without a claim does not inject or consume pending. Only a claimed `turn/end` becomes `consumed`, storing body-free terminal metadata (safe integer end event seq, turn, `reason.kind`). It is not written as DSH history. A DSH provider request retry before the same turn/end reuses the claim. `agent/request-error` does not consume or reset it. Tavern swipe uses the public branch endpoint and, when the fork point is earlier than the source terminal, copies selection and body-free import lineage. The child session needs a new public claim; the old claim is not reused. After interrupt, a new user claim on the original session no longer injects.

Current `GET` and `PUT` of `timeline.json` / `catalog.json` run the same schema/path checks. PUT compares `expectedRevision` then validates inside the same target guard. GET validates after read inside the guard and returns a SHA-256 `revision` of the exact UTF-8 bytes. Missing field → 400 `PLAY_FILE_REVISION_REQUIRED`. Bad format → 400 `PLAY_FILE_REVISION_INVALID`. Target exists/missing/hash mismatch → 409 `PLAY_FILE_REVISION_CONFLICT`. Conflicts do not change the file. Schema failure still returns explicit `PLAY_TIMELINE_INVALID` or `PLAY_CATALOG_INVALID` and never rewrites DSH events. Catalog ids use client-same-origin safe-segment rules, id/path uniqueness, safe POSIX relative paths that must end with `/timeline.json`. Known `ext.pmpDshTavern` fields are validated; unknown third-party fields are kept.

Timeline allows real `qa` nodes only. Greeting is derived from the character card and session selection and does not enter the timeline. Product fields on a QA node are `id`, `kind`, `displayOverride`, optional `parentVariantId`, `adoptedVariantId`, `variants`, and optional `ext`. Undeclared top-level fields are rejected as `PLAY_TIMELINE_INVALID`. Third-party metadata belongs in `ext`. v2 has no hide/suppress-QA field. Tree fields are additive: a node may have `parentVariantId: string | null` pointing at an earlier QA variant; a timeline may have `head: { sessionId, nodeId, variantId }`. `nodeId/variantId` must point at the same QA, but `head.sessionId` may be a continuation session just created by DSH branch that has not produced the next QA yet. The active display path walks ancestors from `head.variantId` via `parentVariantId`. Flat documents without tree fields still read in original node order; the next completed-QA reconcile writes an explicit head/parent. In a tree document, variant ids must be globally unique; a parent may only point at an earlier node and must not cycle. Focus is not a second stored state. Stable focus is derived from timeline head; an empty timeline falls back to catalog `rootSessionId`.

The bundled live client sends only a URL-encoded playthrough id and rejects a mismatched returned id or missing/illegal fields. Stable focus keeps `activeTimelinePath` only as deprecated/ignored old-binding data. Ordinary timeline PUT no longer updates it. Path mutation `lstat`s each segment inside the in-process target lock, rejects symlink/junction, creates layer by layer, and rechecks with realpath. Temp files use exclusive `wx`. Parent directory is rechecked before write and rename. Server CAS is implemented. The bundled live client implements managed revision cache, `null` create-only, 409 cache invalidation, and limited conflict replay (default 3 retries, configurable 1–5). Built-in playthrough lifecycle callers (rename, create catalog append, node metadata/adopt, swipe/rollback timeline head, turn reconcile) use `updateCatalog` / `updateTimeline`. Each mutator recomputes local intent from a fresh document. External session/branch/user-message/directory/timeline create-only side effects are not repeated during CAS replay. An old custom client that only has get/put gets one compatibility fallback and no concurrent-replay guarantee.

### Playthrough lifecycle composition

v2 does not turn character card, playthrough, and greeting into one irreplaceable backend mega-API. A third-party frontend can compose the same flow from public session/workspace/timeline/catalog blocks. Current bundled frontend order:

1. Read the character directory and check whether that character's last playthrough is still empty. Reuse it if empty; otherwise `POST /sessions` creates a real blank DSH session.
2. For an existing source session, copy Tavern selection with v2 `selectionFromSessionId`. Without a source session, bind the card through v1.
3. Create the character/playthrough directory inside the bound workspace root, write an empty `timeline.json`, write catalog, then reread and validate. The display name is `N playthrough` and can be confirmed after a catalog edit.

Character unbind/rebind is the exception: `POST /v1/character-selection` checks whether the session belongs to a playthrough whose character does not match, before writing selection. On conflict it returns 409 `CHARACTER_PLAYTHROUGH_DETACH_REQUIRED`. `error.details.conflicts[]` includes `playthroughId`, `playthroughTitle`, `sessionId`, `expectedCharacterId`, `requestedCharacterId`, and `descendantSessionCount`. Selection is not written. After user confirm, the frontend should call `POST /v2/playthroughs/:id/detach-session` per conflict, then retry the original v1 request. Detach is computed by the server from the timeline tree. Clients must not guess or rewrite descendant relations.

Detach deletes every variant of the target session and every descendant variant that has them as parent. Surviving nodes are not rehung. Sibling swipes and other branches on the same node remain. If root is removed, catalog clears `rootSessionId` and the old import-context reference but keeps the playthrough row, name, and number. The next new playthrough for that character creates a new DSH root session for the empty playthrough and reattaches it with catalog CAS. It does not create a new directory or number. No DSH session is deleted, archived, or renamed.

This “playthrough transaction” is a frontend composition of public atomic operations, not a server cross-file transaction. A single client's controller serializes same-character creates. Built-in callers use limited server-CAS replay against cross-tab writes, but the session/directory/timeline/catalog combination is still not a transaction. Mid-create failure does not add a cross-file transaction: workspace bind, directory create, ordinary-file and catalog/timeline writes, playthrough detach, and session create/branch/user-message plus import-context PUT/DELETE each write `ctx.logger` with one `operationId` inside that mutation request. Clients recover from completed stages, read-back, and stable error codes. Different API requests do not share an operationId. chrome, GET, and browser frontend operations stay quiet. Do not advertise the composed flow as an atomic commit.

### Imported-record context

An empty playthrough's opening dock binds an imported record to the current root session. It does not create another session or write greeting or timeline nodes. Bind, rebind, and unbind use `PUT` / `DELETE /sessions/:id/import-context`. The client shows the actions in the same footer and, after bind, previews the last three QA turns. While `pending`, the first real request injects the full content. The loader expands Tavern macros in greeting and QA with user/character names from the same profile snapshot, then escapes them and marks them `untrusted` read-only context so ST placeholders do not enter DSH prompt-variable parsing. It does not write the content into DSH durable history. The implemented base semantics: the first assembly must establish a durable claim from the original user turn/event's public `claimEventSeqs`. The same claim identity may reassemble. Unclaimed pending is not consumed by a view or an unrelated turn/end. retry/swipe lineage and cancel/interrupt terminals are implemented: terminal stores only event seq, turn, `reason.kind`, and similar body-free metadata. The same request may reassemble before terminal; after terminal a new claim no longer injects. Tavern swipe copies selection/lineage only through the public branch seam and does not claim to intercept every third-party native fork.

The body is `{ reference: { path, expectedHash? } }`. The file must sit inside the bound workspace root, with `schemaVersion: 1` and a `qa` array. The import parser does not apply a 256 KiB or QA-count artificial context cap, and it does not summarize or slice. Whether the model context overflows is left to DSH/provider. Generic `/workspace/files` still has a 1 MiB file-layer read/write limit. Ordinary SillyTavern JSON/JSONL can be parsed by the client and written as that context file. 2.0 no longer publishes a portable bundle format. ST JSONL expresses only the current active linear history and cannot store the full playthrough tree. Greeting remains a display projection and does not forge assistant history.

### 2.0 release hardening (implemented and covered by grouped automated regression)

- ✅ History implemented (`10250a7`): the 32-page artificial cap is gone; pagination continues until `hasMore: false`. Empty Host page, illegal oldest `seq`, or a repeating/non-advancing cursor → 502 `PLAY_HISTORY_CURSOR_STALLED`. The plugin does not summarize or slice.
- Import-context claim/terminal/lineage implemented: public `claimEventSeqs` drive pending → claimed. The same identity may replay before terminal. `turn/end` stores body-free metadata (event seq, turn, `reason.kind`) and becomes consumed. After terminal a new claim does not inject. Tavern swipe copies selection and body-free pending lineage through public branch; the old claim is not reused. Third-party native forks are outside plugin interception.
- ✅ catalog/timeline GET returns exact UTF-8-byte SHA-256 `revision`. PUT uses explicit `expectedRevision`. Missing/bad format are 400; target-state or hash mismatch is 409; conflicts do not change the file. Server contract, bundled live-client revision cache/limited replay, and CAS migration of built-in lifecycle callers are implemented.
- ✅ catalog/timeline run the same schema/path checks after GET read and before PUT write. Unknown third-party `ext` is kept. revision/CAS share the same target guard. Path lock, per-segment no-follow checks, exclusive `wx` temp write, and pre-rename recheck are implemented.
- Paths reject symlink/junction (link types Node exposes) per segment, create non-recursively layer by layer, recheck with realpath, use exclusive `wx` temps, and recheck the parent before write/rename. Pure Node still cannot resist an extremely narrow race from an external process. No native addon is introduced.
- This round wired backend `ctx.logger` operation log: `PUT /workspace` (bind), `POST /workspace/dirs`, `PUT /workspace/files?path=` (ordinary files and catalog/timeline), `POST /playthroughs/:id/detach-session`, `POST /playthroughs/:id/relink-character`, plus session create/branch/user-message and import-context PUT/DELETE. Each mutation records the same `operationId` through start, request.validated, Host/prepare/bind/copy or timeline/catalog stages, and success or failure. Resource/chat bodies are not logged. user-message records only the Host prompt-accepted stage, not body, length, or summary. GET/list, session/messages/focus/import-context, chrome, browser logs, a persistent journal, and extra exporters are deferred.

The hardening above is implemented and included in `npm run verify:2.0`. That command checks history, schema/CAS/focus/path jail, claim/lineage, content-free operation log, chrome service/slot, workspace admission, localization, and package boundaries. With `DSH_TAVERN_PLAY_LIVE=1` and `DSH_TAVERN_PLAY_LIVE_URL` it also reads chrome/workspace authority from a running DSH Host. Real writes, browser two-tab notification, and final rc.8 interaction remain on the release acceptance list. Risks and decisions: [`PLAY_REVIEW_en.md`](PLAY_REVIEW_en.md).

`chrome` is the whole frontend's blue/red orb. It lives in plugin data `chrome.json` and defaults to `native`. Illegal `mode` → 400. GET does not require JSON Content-Type.
`GET /chrome/events` is Tavern-owned SSE, not a DSH Host API. On connect it immediately sends `event: chrome/change` with the current snapshot. A successful `PUT /chrome` broadcasts the same event once after mode actually changes. Event data is only `{ mode, revision }`. SSE uses `text/event-stream`, disables cache, and clears subscribers on close. Non-GET → 405. Older clients that only read `mode` stay compatible. Clients that cannot use SSE should fall back to GET/focus refresh or short polling. Direct edits of `chrome.json`, other-process writes, and DSH private transport are outside this event contract.

The client entry always shows `DT`. Left-click immediately expands or collapses the menu. Rapid repeated clicks repeat that default. Double-click has no special effect. Right-click switches frontend display mode. Menu buttons say **Switch to custom frontend mode** / **Switch to DSH native mode**. Current state may show **Current: Mowan** / **Current: DSH native**. The tooltip is always **Switch frontend display mode**. The menu stays mounted; content fades in after the 220ms expand.

The `PUT /workspace` directory must already exist (`workspace.create` also does not mkdir). `POST /workspace/dirs` is created by `PlayWorkspaceStore` inside the bound root for character/playthrough subdirectories. It does not depend on the global `directory-picker` or `apiProxy.host.createDirectory`, so native/browse Hosts both work. The path jail rejects `..`, absolute paths, symlinks that point outside the root, and file conflicts. files/dirs return 409 when no root is selected. Do not use `archiveSession` to tuck sessions away. The `user-message` body is not a full prompt. Session meta APIs go through Host `apiProxy`: `session.create` / `session.fork({ atSeq })` / `session.prompt({ mode: "queue" })` / `session.history`. `PUT /workspace` calls `workspace.create`. Fork of an open turn maps to HTTP 409.

## v1 bundled UI contract

Prefix: `/pmp-dsh-tavern/api/v1`. The old root `/dsh-tavern/api` is retired.

| When you want to | Paths |
| --- | --- |
| Manage presets, export ST JSON, native regex, standalone world-book relations, inspect current assembly, import/select | `/presets`, `/presets/:id/export`, `/presets/:id/regex-scripts`, `/presets/:id/world-books`, `/active`, `/import`, `/select` |
| Manage character cards, sidebar order, missing-card relink, native regex, standalone world-book relations, bind, export json/png, embedded book | `/characters`, `/characters/order`, `/characters/relink`, `/characters/:id/regex-scripts`, `/characters/:id/world-books`, `/characters/:id/world-book`, `/character-selection` |
| Manage standalone world books and bindings | `/world-books`, `/world-book-selection` |
| Manage users and user–world-book relations | `/users`, `/user-selection` |
| UI language/scale and Follow character into RP | `/ui-settings` |
| Mowan conversation body and action-button scale | `/conversation-settings` |
| RP switch/alerts and rp:policy text | `/rp-mode`, `/rp-alert`, `/rp-policy` |
| Inspect Trace | `/traces` |
| Configuration templates and open a clean session from the current binding | `/session-templates`, `/session-configurations/preview`, `/apply` |

### Character-card sidebar order

The character list has three explicit sort modes: `updated` by `updatedAt` descending (then name, ID), `name` A→Z (Chinese uses `zh-CN` collation), `custom` by user drag order. Drag writes library state only. It does not change the card source or `updatedAt`. Switching modes does not clear a saved custom order.

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| PUT | `/characters/order` | `{ mode, characterIds? }` | `{ ok: true, characters: [...], sorting: { mode } }` |

`mode` must be `updated`, `name`, or `custom`. `custom` without `characterIds` switches back and restores the saved custom order. If none is saved, the current resource order is initialized and cards added while away are appended. Send `characterIds` only for a real reorder. It must contain every stored character-card ID exactly once, at most 4096 items. Unknown, duplicate, or missing IDs return 400 and leave state unchanged. Other modes reject `characterIds`. Successful mode and custom order are stored separately in `character-state.json` as `characterSortMode` and `characterOrder`. In custom mode, newly created or imported cards append. Deleting a card also removes its order entry. `GET /characters` also returns `sorting: { mode }`.

### Missing character cards and relink

Deleting a card still deletes the resource body and cover and still clears stale session selections. The library also keeps a bounded tombstone (original ID, display name, source-file SHA-256 when available) so playthroughs that still reference the card can appear under the human-readable **Missing character cards** area. New playthroughs also snapshot `characterId`, `characterName`, and `characterSha256` when available in `ext.pmpDshTavern`. Card bodies are not copied into the timeline.

After re-import, unique SHA-256 is matched against the tombstone first. Without a hash match, normalized same-name matching is used only when both the missing name and the live name are unique. A unique match relinks automatically. Several same-name candidates are not guessed; the sidebar chooses the target.

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| POST | `/characters/relink` | `{ previousCharacterId, characterId }` | `{ ok: true, relinkedPlaythroughCount, relinkedSessionCount }` |

v1 `/characters/relink` is the missing-resource recovery surface. It uses catalog revision as CAS, moves every playthrough that referenced the old ID onto the target card, and updates root/swipe/branch descendant sessions in one batch of session-selection writes. v2 `/playthroughs/:id/relink-character` is the playthrough-lifecycle surface: it migrates only that playthrough and all of its descendant sessions. The bundled frontend evaluates the target with “unique SHA-256, then both-sides unique same name”. A mismatch shows a warning, but the user can still confirm. The backend does not veto an explicit choice with heuristics.

Both relink paths refuse to overwrite a third card binding that is unrelated to the playthroughs being migrated. If the session batch write fails, catalog is rolled back with the just-written revision. v1 recovery clears the tombstone only after success. When no workspace is bound, automatic recovery is deferred and the tombstone is not silently dropped. Key start, success, and deferral reasons go to `ctx.logger`.

### Conversation display settings

`/conversation-settings` is a v1 bundled-UI contract, separate from `/ui-settings`. It persists only Mowan RP conversation display preferences. It does not enter profile, prompts, timeline, DSH history, or export bodies.

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| GET | `/conversation-settings` | none | `{ ok: true, settings: { schemaVersion: 1, textScale, actionScale } }` |
| PUT | `/conversation-settings` | `{ textScale, actionScale }` | same as GET |
| DELETE | `/conversation-settings` | none | restore both fields to `1` |

Both scales are finite numbers from `0.75`–`1.5` in steps of `0.05`. PUT is a full replace and rejects unknown fields. `textScale` applies to Mowan user/assistant bodies and greeting (including the empty-playthrough opening dock). `actionScale` applies only to the copy, swipe, branch, rollback, and edit row at the end of a durable QA.

### Preset export

`GET /presets/:id/export` returns an `application/json` attachment. The server starts from the saved ST original, keeps unknown top-level fields, prompt fields, other `prompt_order`s, and extensions, then overlays name, sampling, prompt content/order/enablement, and the current Chat Completion order from Tavern's normalized state. Export therefore reflects current edits and is not a raw download of import-time `source.raw`.

The body is Chat Completion preset JSON that can be sent back to `POST /import` or imported into SillyTavern. Tavern-only `systemPromptMode` has no ST field and is not written. Native regex carried by the resource stays on its original ST path. This GET does not change selection, session, resources, or the operation log.

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| GET | `/presets/:id/export` | none | ST JSON attachment; `Content-Disposition: attachment` |

### Native ST regex carried by a resource

Presets and character cards share the same sub-resource contract:

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| GET | `/presets/:id/regex-scripts` | none | `{ ok: true, regexScripts: [...] }` |
| PUT | `/presets/:id/regex-scripts` | `{ regexScripts: [...] }` | `{ ok: true, regexScripts: [...] }` |
| GET | `/characters/:id/regex-scripts` | none | `{ ok: true, regexScripts: [...] }` |
| PUT | `/characters/:id/regex-scripts` | `{ regexScripts: [...] }` | `{ ok: true, regexScripts: [...] }` |

`PUT` is a full ordered-array replace, not a field merge. Array order is execution order inside that resource. Elements must be objects. The server does not rewrite native ST fields and does not drop unknown per-rule extensions. The adapter prefers the resource's existing `regex_scripts` path. If there is no array yet, presets write `extensions.regex_scripts`, V2/V3 cards write `data.extensions.regex_scripts`, and V1 cards write `extensions.regex_scripts`. Other resource fields stay unchanged. Writes still go through the matching store's atomic save and total-document size limit.

This v1 sub-resource edits only the preset or card original. It does not compose global regex, compute the session's final effective set, or change history, timeline, or the AI request. The Mowan display pipeline reads the saved resource data only as a render projection. Failures reuse the parent resource API's existing format and status codes.

Mowan regex-page create/import/edit/delete for **preset-bound / character-bound** uses these native sub-resources. Rules are not saved into the workspace global `ui/regex.json` with only a resource scope. Local scoped rules already saved that way enter a pending-migration state the next time the matching resource is the current binding. After the user clicks save, rules are written to the resource original and removed from the global document. Migration de-duplicates by rule id against existing native rules and does not rewrite the resource merely because the panel was opened.

### Preset/character standalone world-book relations

A preset or character card may bind zero or more existing standalone world books:

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| GET | `/presets/:id/world-books` | none | `{ ok: true, binding: { presetId, worldBookIds } }` |
| PUT | `/presets/:id/world-books` | `{ worldBookIds: [...] }` | same as GET |
| GET | `/characters/:id/world-books` | none | `{ ok: true, binding: { characterCardId, worldBookIds } }` |
| PUT | `/characters/:id/world-books` | `{ worldBookIds: [...] }` | same as GET |

`PUT` fully replaces that resource's ordered relation. Duplicate IDs are de-duplicated stably. Missing resources or world books reject the write. Each preset or card may bind at most 100 books. Relations are atomically stored in loader-owned `resource-world-book-bindings.json`. No Tavern-private field is written into the ST preset or card original. Therefore:

- Preset export and card JSON/PNG export do not carry these Tavern-local relations. After uninstall, the original resources still work with native ST semantics.
- `DELETE /presets/:id` or `DELETE /characters/:id` clears relations owned by that resource. Deleting a standalone world book clears the matching ID from session, user, preset, and character relations.
- The plural character path `/world-books` means standalone-resource relations. The singular `/world-book` still edits the card's own `character_book`. Both may exist at once.

The loader's standalone-book composition order is fixed: session explicit, user relation, preset relation, character relation. The same ID runs once, but audit/resource summary keeps every `bindingSources`. The card's embedded `character_book` then enters the same matcher. `GET /active` `worldBookSelection` publishes `explicitIds`, `userBoundIds`, `presetBoundIds`, `characterBoundIds`, `effectiveIds`, `duplicateIds`, and `order`.

The world-book panel lists these sources directly. When the current card has no `character_book`, the frontend may first create a `{ name, entries: [] }` draft and save it with existing `PATCH /characters/:id/world-book`. That creates an exportable embedded book. It is not the same as binding a standalone book.

### Tavern playthrough-branch composition

The bundled RP view does not overlay native DSH fork. It calls public `POST /sessions/:id/branch` at the adopted assistant's `endEventId`, verifies with `/messages` that the child session inherited that durable user/assistant range, then creates a new playthrough directory and a timeline copy through that QA. The copy only redirects the target adopted variant's `sessionId` to the child session, then catalog CAS appends the new playthrough and focus-by-id validates. The new playthrough keeps DSH-authoritative context. Re-entering from the sidebar opens the continuation branch session. Source timeline, source variant, and original DSH messages are unchanged.

This is still a client composition of existing atomic APIs, not a mega-transaction across session, directory, timeline, and catalog. If branch succeeds and a later file write fails, an unarchived DSH child session or workspace orphan file may remain. Each step is recorded by the existing `ctx.logger` operation. The client does not fake rollback by deleting original history.

**Continue from here in this playthrough** reuses the same DSH branch and inherited durable-range checks, but creates no directory, timeline copy, or catalog row. The client only moves `head` to `{ continuationSessionId, targetNodeId, targetVariantId }` with timeline CAS. Later nodes stay in the tree but are not on the active path. After the next real message completes, a new QA is appended with the target variant as parent. It does not delete or rewrite DSH history and does not forge user or assistant messages.

### Backend operation-log utility

`packages/play/src/operation-log.js` exports `createOperationContext` and `operationLogConstants` for workspace/catalog/timeline, session/import, and playthrough mutations. Currently wired write operations:

- `PUT /workspace` (bind), `POST /workspace/dirs`, `PUT /workspace/files?path=`;
- `POST /sessions`, `POST /sessions/:id/branch`, `POST /sessions/:id/user-message`;
- `PUT /sessions/:id/import-context` and `DELETE /sessions/:id/import-context`;
- `POST /playthroughs/:id/detach-session` and `POST /playthroughs/:id/relink-character`.

Read-only GET does not produce operation logs. It accepts only a Cordis `ctx.logger` (or its callable logger service) and writes one line prefixed `dsh-tavern.operation `. The rest of the line is stable JSON. An operation stores its name and start time when the context is created, and may record `start`, several `stage`s, and one `success` or one `failure`. Success and failure terminals include `result` and non-negative `durationMs`. Failure records only a stable `error.code` (`UNKNOWN_ERROR` if missing) and optional HTTP status, at `warn`.

The payload whitelist is only `operationId`, `operation`, `stage`, `result`, `errorCode`, `status`, `durationMs`, `method`, `sessionId`, `playthroughId`, `path`. Identifiers and paths are normalized for type, length, and control characters. Prompt, QA, character card, preset, regex, resource bodies, request body, message text, and unknown fields are never emitted, including as body summaries. Missing logger, missing method, or a logger throw fail-soft. A stage or terminal call after terminal is invalid and does not rewrite the terminal.

This section documents the utility and the workspace/session/import/playthrough endpoint wiring above. It does not claim that every silent lifecycle failure is now logged. The default Cordis logger is still managed by itself. The plugin writes no persistent log file, browser log, or exporter.

## Browser chrome mode service

The Tavern client registers the stable service name `pmpDshTavernChrome` through rc.8 public Cordis `ctx.provide`. This is a Tavern v2 contract, not a DSH Host API. It provides only the `native|play` lifecycle. It does not own or arbitrate any slot, view, or third-party plugin UI.

Public face:

- `getMode()`, `getSnapshot()`: synchronously return a frozen `{ mode, revision }`. On an older server, revision may be `null`.
- `subscribe(listener)`: notify the current snapshot immediately and return an idempotent disposer.
- `refresh()`: read back and commit the authoritative snapshot via `GET /v2/chrome`.
- `setMode(mode)`, `switchMode()`: serialize writes; update local state only after `PUT /v2/chrome` succeeds.
- `when(mode, setup)`: setup on enter; dispose on leave, unregister, or service unload. A late async setup is cleaned up immediately.

A required-dependency plugin may declare `inject: ['pmpDshTavernChrome']` and read `ctx.pmpDshTavernChrome`. An optional consumer should use `ctx.get('pmpDshTavernChrome')` and keep its native/fallback behavior when missing. Third parties must not `provide` the same name again, and must not depend on Tavern-internal React state, `playSlots`, EventSource, or timers.

Internal transport uses `GET /v2/chrome/events`. When EventSource is missing, the connection fails, or it drops, it falls back to the initial GET, window-focus read-back, and 1-second polling. Polling stops after SSE recovers. BroadcastChannel is not in the contract. Service unload stops transport and clears every `when` effect. Several third-party plugins register independently and each cleans only its own slots/UI.

Full notes on third-party DSH plugins, standalone web clients, surface ownership, atomic action composition, and uninstall fallback: [FRONTEND_INTEGRATION_en.md](FRONTEND_INTEGRATION_en.md). There is no one-click config-file Mowan replacement, frontend provider registry, or dynamic bundle loader.
