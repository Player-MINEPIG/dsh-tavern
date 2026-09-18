# HTTP API

[中文](API.md) · [v3 detailed contract](PROMPT_API_V3_en.md) · [Frontend integration](FRONTEND_INTEGRATION_en.md)

Contract version: Tavern **2.3.0 candidate**, targeting DSH `0.1.5-rc.1`.
Root: `/pmp-dsh-tavern/api`. API versions and DSH log format V3 are independent.

All endpoint catalogs use **Method / Path / Behavior / Status**, following the v2
format. Paths are relative to the stated version prefix. URL-encode identifiers;
query parameters and request bodies remain endpoint-specific. Existing local TCP
peer, Host, Origin and media-type checks apply. Successful JSON responses carry
`ok:true`; failures carry `ok:false` and `error`. v1 error shapes and method rejection
codes vary by resource; common documentation formatting does not change wire contracts.

The [DSH V3 coordinate migration contract](DSH_0.1.5_MIGRATION_en.md) governs
message coordinates, branch inputs, and unmigrated timeline references.

<a id="api-scope"></a>
## Version responsibilities and overlap audit

The following defines the current responsibilities of v1, v2, and v3. v3 does not
provide a current-resource aggregator.

| Capability | Existing v1 coverage | Existing v3 coverage | Scope conclusion |
| --- | --- | --- | --- |
| Complete current resource fields | `/presets/:id`, `/characters/:id`, `/users/:id`, `/world-books/:id` | No current-resource aggregate | Resource reads belong to v1 |
| Current bindings and greeting options | Selection endpoints, resource world-books links, configuration preview; `/active` includes a current summary | Past bindings inside historical records only | Current configuration belongs to v1; consumers derive effective greetings and deduplicated links |
| Current counts, aggregate revision and sampling suggestions | Resource fields can be counted; `/active.callConfig` maps sampling, but there is no identical aggregate snapshot revision | No current counts or aggregate revision; historical section/source metadata retains counts and hashes | Consumers compose these values; v1 is not field-for-field response equivalent |
| Historical bindings, resource summaries and lore decisions | Legacy `/traces?sessionId=` compatibility reads; new v1 audit and v3 share one schema 4 record | Selection/audit in assembly details and legacy adaptation | Intentional historical audit overlap; old route retained, new captures write one canonical record |
| Historical named sections, source metadata, order and actual system-message verification | None; `/active` reruns assembly using current state | Assembly index and detail; detail verifies and resolves bodies from official history | Independent v3 responsibility; `source.text` is not stored and current configuration cannot stand in for history |

Implemented boundary: **v1 owns current resources/configuration, v2 owns play
Session/workspace primitives, and v3 owns per-request assembly metadata,
official-history references, and provenance.** `/sessions/:id/sources` is not part
of the v3 contract: GET returns 404 with no alias or v1 redirect. Historical
`sections[].sources` retain past input relationships as metadata, hashes, and counts;
new records do not store `source.text`.

Historical overlap does not imply identical IDs or wire fields. New v1 audit and v3 assembly
metadata use the same audit in one canonical schema 4 record. Legacy schema 3 detail may predate
the final state of older v1 metadata; those files remain read-only compatibility inputs.

v1 `/active` runs loader assembly and lore matching. It does not create a new
historical Trace record and is not a cheap configuration-only GET. For current
configuration, use `POST /session-configurations/preview` with
`source: {mode:"current",sessionId}`, then read resources and linked books by ID.
Preview includes saved template-scoped RP fields; read runtime RP/pending state separately
from `/rp-mode`. This path runs no prompt assembly, but multiple HTTP reads are not
an atomic cross-resource snapshot.

DSH history and v2 `/sessions/:id/messages` provide authoritative message reads.
They do not guarantee original pre-assembly fields, disabled content or Tavern
field provenance, and cannot reconstruct complete resources or historical source bodies.
The v3 detail route verifies official references before returning section/context bodies;
source text remains unavailable. Official `system-prompt/assemble` offers runtime
observation, adjustment, and contribution independently of HTTP v3.
Failures are not extra assistant messages; v2 does not add failure placeholders. v3 can read
`failure {code,message}` through verified official failure-event references, with explicit
unavailability on missing or invalid history. See [failure details](PROMPT_API_V3_en.md#failure-details).

Audit evidence: [Trace API handler](../packages/tavern-loader/src/prompt-trace-api.js),
[configuration preview](../packages/session-template/src/service.js),
[v1 preset/active routes](../packages/preset/src/server.js),
[historical recorder](../packages/tavern-trace/src/assembly-recorder.js),
[Trace client](../packages/tavern-trace/src/client.js).

## v2 stable surface

Prefix: `/pmp-dsh-tavern/api/v2`.

| Method | Path | Behavior | Status |
| --- | --- | --- | --- |
| GET | `/chrome` | Returns `{ mode: "native" \| "play", revision }`. `revision` is the server-authoritative opaque version string | Implemented |
| GET | `/chrome/events` | Tavern-owned SSE. Sends the current snapshot on connect and `chrome/change` when mode actually changes | Implemented |
| PUT | `/chrome` | Writes global chrome. Does not change the RP lock or the current DSH session. Success includes the new `revision` (same mode produces no change) | Implemented |
| POST | `/chrome` | Not provided | 405 |
| GET | `/workspace` | Root path, whether a root is selected, contract version, warnings | Implemented |
| PUT | `/workspace` | Bind **one** existing play-workspace root. First selection may carry `SWIPE_DISK` / possible `SYSTEM_DISK` warnings. Does not mkdir the root | Implemented |
| POST | `/workspace/dirs` | `{ path }` relative path. `PlayWorkspaceStore` creates it inside the already-bound root jail. Compatible with native/browse Host; does not invoke the global directory picker or register a new DSH workspace. Unbound root → 409. Rejects absolute paths, `..`, symlink escape, and file conflicts | Implemented |
| GET | `/workspace/files?path=` | Read a UTF-8 file under the root. `catalog.json` / `timeline.json` run the matching schema/path checks after read. Third-party `ext` is kept as-is. Managed documents add a SHA-256 `revision` of the exact UTF-8 bytes (64 lowercase hex) | Implemented |
| PUT | `/workspace/files?path=` | Ordinary files still use `{ content }`. `catalog.json` / `timeline.json` must send `expectedRevision`: `null` creates a missing target only; a 64-hex lowercase SHA-256 replaces only when the current byte hash matches. Validation, CAS, temp write, and rename share one target guard | Implemented |
| GET | `/workspace/files?list=` | List one prefix level | Implemented |
| POST | `/sessions` | Open a play session. With a character card, title = character name + time. Without a card, DSH `session.create` default title is used; no 409. Tavern bindings are copied only when the body has `selectionFromSessionId`. Inserts into the play workspace. **Does not write timeline** | Implemented |
| POST | `/sessions/:id/branch` | `{ atEventId, sessionFormatVersion? }`: log seq and its format version; migration checks below. After fork, copy the public selection. If the source import claim already ended at an earlier terminal, copy body-free pending lineage. Does not write timeline or send on behalf of the user. Copy failure is explicit 502 `PLAY_BRANCH_COPY_FAILED`. Open turn → 409 | Implemented |
| POST | `/sessions/:id/user-message` | `{ text }` as the next user body, `session.prompt` `queue` | Implemented |
| GET | `/sessions/:id/messages` | `deriveMessages()` + `seq` + `incompleteTurn` + per-message `origin`; optional top-level `sessionFormatVersion` / `migratedFromV2`. Reads until `hasMore: false`; no plugin page cap. Empty Host cursor page, illegal seq, or a cursor that does not advance → 502 `PLAY_HISTORY_CURSOR_STALLED` | Implemented |
| GET | `/sessions/:id/coordinates` | Read current logical Session format and migration marker without message bodies. [Fields and examples](#session-coordinates) | Implemented |
| GET | `/sessions/:id/import-context` | Returns `{ binding }`. Unbound is `null`. A binding includes path/hash/state/count summaries and, when claimed, body-free claim identity/event-seq summaries. Record bodies are not returned | Implemented |
| PUT | `/sessions/:id/import-context` | `{ reference: { path, expectedHash? } }`. Bind or rebind an already-written workspace import-context on an empty session | Implemented |
| DELETE | `/sessions/:id/import-context` | Unbind an empty session. Idempotent `{ binding: null }` | Implemented |
| GET | `/playthroughs/:id/focus` | Resolve the playthrough via catalog and return `{ playthroughId, sessionId, nodeId, variantId }`. Empty playthroughs use `rootSessionId` | Implemented |
| POST | `/playthroughs/:id/relink-character` | `{ characterId }`. Rebind only that playthrough and its root/swipe/branch descendant sessions to an existing card. An explicit user choice is not limited by automatic classification | Implemented |
| POST | `/playthroughs/:id/detach-session` | `{ sessionId }`. Remove the target session's timeline variant and descendants from that playthrough. Sibling branches, the DSH session/history, and the empty catalog playthrough remain. The server validates the tree and commits with managed-file revision/CAS | Implemented |
| GET | `/focus?path=` | Low-level compatibility route: derive `{ sessionId }` from an explicit timeline path. The bundled frontend uses the playthrough-id route | Compatibility surface |
| GET | `/focus` (no path) | No default target; “most recently written timeline” is not user focus | 400 `PLAY_FOCUS_PATH_REQUIRED` |
| POST | `/focus`, `/playthroughs/:id/focus` | Not provided | 405 |

Path exists but method is wrong → `405 PLAY_METHOD_NOT_ALLOWED` (for example `POST /chrome`, `POST /focus`, `GET /sessions`). On the stable focus path, a missing playthrough id is 404 `PLAY_PLAYTHROUGH_NOT_FOUND`; a missing catalog is 409 `PLAY_CATALOG_UNAVAILABLE`; a corrupt catalog stays 400 `PLAY_CATALOG_INVALID`; a missing or corrupt timeline is uniformly 409 `PLAY_FOCUS_UNAVAILABLE`. The stable entry does not accept a client path, does not read DSH history, and does not write files. Old `/focus?path=` remains migration compatibility only.

<a id="session-coordinates"></a>
### Query and use Session coordinate versions

The public read-only `GET /sessions/:id/coordinates` endpoint reports **the format governing the specified Session's current event sequence numbers**. It takes no body or query parameters; URL-encode the DSH Session ID. It returns no message bodies, log paths, storage schema, or old-to-new sequence map, and does not migrate Tavern data. External frontends can query it before reusing saved event references.

#### Request and fields

Call from a same-origin page that already has access to DSH Web. Existing Host access controls apply; there is no separate Tavern API key:

```js
async function queryCoordinates(sessionId) {
  const response = await fetch(
    `/pmp-dsh-tavern/api/v2/sessions/${encodeURIComponent(sessionId)}/coordinates`,
    { credentials: 'same-origin', headers: { Accept: 'application/json' } },
  )
  const data = await response.json()
  if (!response.ok || data.ok !== true) {
    throw Object.assign(new Error(data.error ?? `HTTP ${response.status}`), {
      status: response.status, code: data.code,
    })
  }
  return data
}
```

Example success (HTTP 200):

```json
{
  "ok": true,
  "sessionFormatVersion": 3,
  "migratedFromV2": true
}
```

| Field | Type | Meaning and limits |
| --- | --- | --- |
| `ok` | boolean | `true` on success. |
| `sessionFormatVersion` | integer or null | The Session format version **defined by upstream DSH**, read from public `session.inspect()` metadata at `meta.version`. This is not the DSH software version, Tavern version, or HTTP `/v2` version. `0` is valid: do not use a truthiness check. `null` means the Host did not provide a usable version, not zero or compatible. |
| `migratedFromV2` | boolean | A **Tavern inference**: `true` when current events contain a synthetic V2→V3 system-message ID matching the upstream naming rule. V0/V1 restored through that edge can also return `true`. `false` only means no marker was detected; it does not prove the Session was never migrated or authoritatively report migration completion. |

The value describes the **logical Session format currently read by the Host**; it does not guarantee the original disk file has already been rewritten. Clients must use the returned value rather than infer it from software versions, and must not treat `>= 3` as a future-format compatibility promise. Tavern defines the API field names; DSH defines the format semantics and conversion rules.

If messages are already needed, use the top-level `sessionFormatVersion` and `migratedFromV2` from `GET /sessions/:id/messages` instead of making another request. Those message fields are optional, and older plugins may lack the standalone endpoint; missing/null means unknown. The endpoint avoids returning message bodies but still inspects the Session, so its cost is not guaranteed to be independent of history length.

#### Save, compare, and branch

1. When creating a QA range from messages, save the version from **that same response** in `variant.ext.pmpDshTavern.sessionFormatVersion`. For example: `startEventId: 9`, `endEventId: 16`, version `3`. Never query a version after an upgrade and use it to relabel old integers with unknown provenance.
2. Before reusing a saved range, query its variant's `sessionId` and compare versions for **equality**. A mismatch, unknown version, or unversioned reference with a migration marker requires verification/recovery before reuse. Absence of a marker does not establish that an old unversioned range is valid.
3. Send the saved range's version when branching. This conservative external-client example accepts only explicitly versioned, matching references; legacy unversioned data needs provenance verification first.

```js
async function branchSavedVariant(variant) {
  const savedVersion = variant.ext?.pmpDshTavern?.sessionFormatVersion
  const current = await queryCoordinates(variant.sessionId)
  if (!Number.isSafeInteger(savedVersion) || savedVersion < 0
    || savedVersion !== current.sessionFormatVersion) {
    throw new Error('Verify or migrate the saved event range before branching')
  }
  const response = await fetch(
    `/pmp-dsh-tavern/api/v2/sessions/${encodeURIComponent(variant.sessionId)}/branch`,
    {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        atEventId: variant.endEventId,
        sessionFormatVersion: savedVersion,
      }),
    },
  )
  const data = await response.json()
  if (!response.ok || data.ok !== true) {
    throw Object.assign(new Error(data.error ?? `HTTP ${response.status}`), {
      status: response.status, code: data.code,
    })
  }
  return data // HTTP 201: { ok: true, sessionId: child Session ID }
}
```

Equality only passes the format check; it does not prove an arbitrary event exists or identifies the intended reply. A query is not a lock or CAS token. The server rechecks before fork and still checks whether DSH permits the branch. Do not cache versions indefinitely, especially across Host upgrades or reconnects.

#### Errors and recovery

The query accepts no old coordinates, so a detected migration marker still returns 200. Old references are rejected when reading/writing a timeline, branching, or using import context.

| Request/status | `code` | Client action |
| --- | --- | --- |
| Query, 400 | `PLAY_SESSION_INVALID` | Correct the Session ID. |
| Query, 404 | `PLAY_SESSION_NOT_FOUND` | Refresh the Session selection; this does not mean unknown format. |
| Query, 405 | `PLAY_METHOD_NOT_ALLOWED` | Use GET. |
| Branch, 400 | `PLAY_COORDINATES_INVALID` | Supply a nonnegative safe integer version, not `null`. |
| Timeline/branch, 409 | `PLAY_COORDINATES_MIGRATION_REQUIRED` | Stop reusing old references and follow migration guidance. Do not merely change the version marker and retry. |

Example v2 error: `code` is **top-level** and `error` is a string:

```json
{
  "ok": false,
  "error": "Session event references need migration. Back up the playthrough and run scripts/migrate-session-coordinates.mjs with the retained source and V3 logs.",
  "code": "PLAY_COORDINATES_MIGRATION_REQUIRED"
}
```

Preserve references and backups. Follow the [offline migration guide](DSH_0.1.5_MIGRATION_en.md) to validate source/target logs, preview and apply the mapping, then reread the timeline and messages. The current tool is verified only for V0/V1/V2→V3. Unknown future formats need new adaptation and tests; this query does not supply conversion rules automatically.

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
3. Create the character/playthrough directory inside the bound workspace root, write an empty `timeline.json`, write catalog, then reread and validate. The generated display name is `Playthrough N` in English and `{number}周目` in Chinese; an explicit rename is stored and displayed verbatim.

Character unbind/rebind is the exception: `POST /v1/character-selection` checks whether the session belongs to a playthrough whose character does not match, before writing selection. On conflict it returns 409 `CHARACTER_PLAYTHROUGH_DETACH_REQUIRED`. `error.details.conflicts[]` includes `playthroughId`, `playthroughTitle`, `sessionId`, `expectedCharacterId`, `requestedCharacterId`, and `descendantSessionCount`. Selection is not written. After user confirm, the frontend should call `POST /v2/playthroughs/:id/detach-session` per conflict, then retry the original v1 request. Detach is computed by the server from the timeline tree. Clients must not guess or rewrite descendant relations.

Detach deletes every variant of the target session and every descendant variant that has them as parent. Surviving nodes are not rehung. Sibling swipes and other branches on the same node remain. If root is removed, catalog clears `rootSessionId` and the old import-context reference but keeps the playthrough row, name, and number. The next new playthrough for that character creates a new DSH root session for the empty playthrough and reattaches it with catalog CAS. It does not create a new directory or number. No DSH session is deleted, archived, or renamed.

This “playthrough transaction” is a frontend composition of public atomic operations, not a server cross-file transaction. A single client's controller serializes same-character creates. Built-in callers use limited server-CAS replay against cross-tab writes, but the session/directory/timeline/catalog combination is still not a transaction. A mid-create failure is not wrapped in a cross-file transaction: workspace bind, directory create, ordinary-file and catalog/timeline writes, playthrough detach, and session create/branch/user-message plus import-context PUT/DELETE each write `ctx.logger` with one `operationId` inside that mutation request. Clients recover from completed stages, read-back, and stable error codes. Different API requests do not share an operationId. chrome, GET, and browser frontend operations stay quiet. Do not advertise the composed flow as an atomic commit.

### Imported-record context

An empty playthrough's opening dock binds an imported record to the current root session. It does not create another session or write greeting or timeline nodes. Bind, rebind, and unbind use `PUT` / `DELETE /sessions/:id/import-context`. The client shows the actions in the same footer and, after bind, previews the last three QA turns. While `pending`, the first real request injects the full content. The loader expands Tavern macros in greeting and QA with user/character names from the same profile snapshot, then escapes them and marks them `untrusted` read-only context so ST placeholders do not enter DSH prompt-variable parsing. It does not forge user/assistant QA or copy imported content into the Tavern timeline; the system prompt used by a real request is still persisted in official DSH history. The first assembly must establish a durable claim from the original user turn/event's public `claimEventSeqs`. The same claim identity may reassemble. Unclaimed pending is not consumed by a view or an unrelated turn/end. retry/swipe lineage and cancel/interrupt terminals are implemented: terminal stores only event seq, turn, `reason.kind`, and similar body-free metadata. The same request may reassemble before terminal; after terminal a new claim no longer injects. Tavern swipe copies selection/lineage only through the public branch seam and does not claim to intercept every third-party native fork.

The body is `{ reference: { path, expectedHash? } }`. The file must sit inside the bound workspace root, with `schemaVersion: 1` and a `qa` array. The import parser does not apply a 256 KiB or QA-count artificial context cap, and it does not summarize or slice. Whether the model context overflows is left to DSH/provider. Generic `/workspace/files` still has a 1 MiB file-layer read/write limit. Ordinary SillyTavern JSON/JSONL can be parsed by the client and written as that context file. The public import/export surface defines no portable bundle. ST JSONL expresses only the current active linear history and cannot store the full playthrough tree. Greeting remains a display projection and does not forge assistant history.

### v2 persistence, concurrency, and audit guarantees

- History paginates until `hasMore: false`. An empty Host page, illegal oldest `seq`, or a repeating/non-advancing cursor returns 502 `PLAY_HISTORY_CURSOR_STALLED`. The plugin does not summarize or slice.
- Public `claimEventSeqs` drive import-context pending → claimed. The same identity may replay before terminal. `turn/end` stores body-free metadata (event seq, turn, `reason.kind`) and becomes consumed. After terminal a new claim does not inject. Tavern swipe copies selection and body-free pending lineage through public branch; the old claim is not reused. Third-party native forks are outside plugin interception.
- catalog/timeline GET returns exact UTF-8-byte SHA-256 `revision`; PUT uses explicit `expectedRevision`. Missing/bad format are 400; target-state or hash mismatch is 409; conflicts do not change the file. The bundled live client caches revisions and limits CAS replay to pure document intent.
- catalog/timeline run the same schema/path checks after GET read and before PUT write. Unknown third-party `ext` is kept. revision/CAS share the same target guard. Path locking performs per-segment no-follow checks, uses exclusive `wx` temporary files, and rechecks the parent before rename.
- Paths reject symlink/junction types exposed by Node, create directories non-recursively, and recheck with realpath. Pure Node cannot resist an extremely narrow race from an external process; the contract adds no native addon.
- Backend `ctx.logger` operation logging covers `PUT /workspace`, `POST /workspace/dirs`, `PUT /workspace/files?path=`, playthrough detach/relink, session create/branch/user-message, and import-context PUT/DELETE. Each mutation request uses one `operationId` for stages and terminal status. Resource/chat bodies are never logged. user-message records only the Host prompt-accepted stage, not body, length, or summary. Read-only GET/list, session/messages/focus/import-context, and chrome stay quiet; browser logs, a persistent journal, and extra exporters are outside the contract.

`npm run verify:2.0` checks history, schema/CAS/focus/path jail, claim/lineage,
content-free operation logging, chrome service/slot, workspace admission, localization, and
package boundaries. With `DSH_TAVERN_PLAY_LIVE=1` and `DSH_TAVERN_PLAY_LIVE_URL`, it also
reads chrome/workspace authority from a running DSH Host. This read-only smoke does not replace
real-write or browser two-tab notification checks.

`chrome` is the whole frontend's blue/red orb. It lives in plugin data `chrome.json` and defaults to `native`. Illegal `mode` → 400. GET does not require JSON Content-Type.
`GET /chrome/events` is Tavern-owned SSE, not a DSH Host API. On connect it immediately sends `event: chrome/change` with the current snapshot. A successful `PUT /chrome` broadcasts the same event once after mode actually changes. Event data is only `{ mode, revision }`. SSE uses `text/event-stream`, disables cache, and clears subscribers on close. Non-GET → 405. Older clients that only read `mode` stay compatible. Clients that cannot use SSE should fall back to GET/focus refresh or short polling. Direct edits of `chrome.json`, other-process writes, and DSH private transport are outside this event contract.

The client entry always shows `DT`. Left-click immediately expands or collapses the menu. Rapid repeated clicks repeat that default. Double-click has no special effect. Right-click switches frontend display mode. Menu buttons say **Switch to custom frontend mode** / **Switch to DSH native mode**. Current state may show **Current: Mowan** / **Current: DSH native**. The tooltip is always **Switch frontend display mode**. The menu stays mounted; content fades in after the 220ms expand.

The `PUT /workspace` directory must already exist (`workspaceController.create` also does not mkdir). `POST /workspace/dirs` is created by `PlayWorkspaceStore` inside the bound root for character/playthrough subdirectories. It does not invoke the global directory picker, so native/browse Hosts both work. The path jail rejects `..`, absolute paths, symlinks that point outside the root, and file conflicts. files/dirs return 409 when no root is selected. Do not use archive to tuck sessions away. The `user-message` body is not a full prompt. The loader's Play Host adapter explicitly calls `sessionController.create()`, `rename()`, `fork()`, `prompt()`, `inspect()`, and `page()`. One history read pins its first inclusive `throughSeq` across every page. `PUT /workspace` calls `workspaceController.create()`. Fork of an open turn maps to HTTP 409.

## v1 bundled UI contract

Prefix: `/pmp-dsh-tavern/api/v1`. `/dsh-tavern/api` is not part of the current contract.

| Method | Path | Behavior | Status |
| --- | --- | --- | --- |
| GET | `/presets?sessionId=` | Preset catalog and current selectedId | Implemented |
| POST | `/presets` | Create a preset; returns preset | Implemented |
| GET | `/presets/:id` | Complete current preset; returns preset | Implemented |
| PUT | `/presets/:id` | Update preset; returns preset | Implemented |
| DELETE | `/presets/:id` | Delete preset and clean up bindings | Implemented |
| POST | `/import` | Import an ST preset; content is a JSON string, name is optional | Implemented |
| POST | `/select` | { id, sessionId? }; select/clear preset, omitted sessionId targets global selection | Implemented |
| GET | `/active?sessionId=` | Current assembly preview summary: sessionSelection, worldBookSelection, resources, callConfig, audit; runs assembly, not a historical record | Implemented |
| GET | `/presets/:id/export` | Export current edited state as an ST JSON attachment | Implemented |
| GET | `/presets/:id/regex-scripts` | Read preset native regex array | Implemented |
| PUT | `/presets/:id/regex-scripts` | Replace the complete preset native regex array | Implemented |
| GET | `/presets/:id/world-books` | Read preset ordered linked standalone world-book IDs | Implemented |
| PUT | `/presets/:id/world-books` | Replace the complete preset ordered linked standalone world-book IDs | Implemented |
| GET | `/characters/:id/regex-scripts` | Read character native regex array | Implemented |
| PUT | `/characters/:id/regex-scripts` | Replace the complete character native regex array | Implemented |
| GET | `/characters/:id/world-books` | Read character ordered linked standalone world-book IDs | Implemented |
| PUT | `/characters/:id/world-books` | Replace the complete character ordered linked standalone world-book IDs | Implemented |
| GET | `/characters` | Character catalog, sorting and missing-card summaries | Implemented |
| POST | `/characters` | Create a character card | Implemented |
| POST | `/characters/import` | Import a JSON/PNG character card | Implemented |
| GET | `/characters/:id` | Complete current character card; returns character | Implemented |
| PATCH | `/characters/:id` | Update character fields | Implemented |
| DELETE | `/characters/:id` | Delete card and clear bindings, retaining a missing-card summary | Implemented |
| GET | `/characters/:id/json` | Export a character JSON attachment | Implemented |
| GET | `/characters/:id/png` | Export a character PNG attachment | Implemented |
| PATCH | `/characters/:id/world-book` | { characterBook }; update embedded lore, not standalone book bindings | Implemented |
| PUT | `/characters/order` | { mode, characterIds? }; configure ordering | Implemented |
| POST | `/characters/relink` | { previousCharacterId, characterId }; recover missing-card references | Implemented |
| GET | `/character-selection?sessionId=` | Current character binding/options (including greeting index) and card summary | Implemented |
| POST | `/character-selection` | { sessionId, characterCardId, character? }; bind or unbind | Implemented |
| GET | `/world-books` | Standalone world book catalog | Implemented |
| POST | `/world-books` | Create standalone world book | Implemented |
| GET | `/world-books/:id` | Complete current standalone world book; returns worldBook | Implemented |
| PATCH | `/world-books/:id` | Update standalone world book | Implemented |
| DELETE | `/world-books/:id` | Delete standalone world book and clean up related bindings | Implemented |
| GET | `/users` | User catalog | Implemented |
| POST | `/users` | Create user | Implemented |
| GET | `/users/:id` | Complete current user; returns user | Implemented |
| PATCH | `/users/:id` | Update user | Implemented |
| DELETE | `/users/:id` | Delete user and clean up related bindings | Implemented |
| POST | `/world-books/import` | Import world-book JSON | Implemented |
| GET | `/world-books/:id/json` | Export a world-book JSON attachment | Implemented |
| GET | `/world-book-selection?sessionId=` | Explicit Session world-book bindings and resource summaries | Implemented |
| POST | `/world-book-selection` | Set explicit Session worldBookIds | Implemented |
| GET | `/user-selection?sessionId=` | Current user binding and user document | Implemented |
| POST | `/user-selection` | Set or clear the Session user binding | Implemented |
| GET | `/users/:id/world-books` | Read standalone world-book IDs linked to a user | Implemented |
| PUT | `/users/:id/world-books` | Replace the complete user worldBookIds | Implemented |
| GET | `/ui-settings` | Read language, scale and character-follow RP | Implemented |
| PUT | `/ui-settings` | Save language, scale and character-follow RP | Implemented |
| DELETE | `/ui-settings` | Reset language, scale and character-follow RP | Implemented |
| GET | `/conversation-settings` | Read Mowan text/action scale | Implemented |
| PUT | `/conversation-settings` | Save Mowan text/action scale | Implemented |
| DELETE | `/conversation-settings` | Reset Mowan text/action scale | Implemented |
| GET | `/rp-policy` | Read RP policy text | Implemented |
| PUT | `/rp-policy` | Save RP policy text | Implemented |
| DELETE | `/rp-policy` | Reset RP policy text | Implemented |
| GET | `/rp-mode?sessionId=` | Read RP, pending and followCharacter | Implemented |
| PUT | `/rp-mode` | { sessionId, active }; request an RP change | Implemented |
| GET | `/rp-alert?sessionId=` | Read an unconsumed RP risk alert | Implemented |
| DELETE | `/rp-alert?sessionId=&id=` | Consume the alert; id is optional | Implemented |
| GET | `/traces?sessionId=` | Legacy historical metadata audit; returns records/storage/authority without complete prompt bodies | Implemented; retained for compatibility |
| GET | `/session-templates` | Template catalog, selection, content summaries and missing-resource diagnostics | Implemented |
| POST | `/session-templates` | { name, sourceSessionId }; create a template from current configuration | Implemented |
| GET | `/session-templates/:id` | Template detail and resource diagnostics | Implemented |
| PATCH | `/session-templates/:id` | Update template | Implemented |
| DELETE | `/session-templates/:id` | Delete template | Implemented |
| POST | `/session-templates/select` | { id }; select or clear a template | Implemented |
| POST | `/session-configurations/preview` | { source }; read-only current/template configuration preview; does not run prompt assembly | Implemented |
| POST | `/session-configurations/apply` | { targetSessionId, source }; validate and apply bindings | Implemented |

Resource/subresource details follow below. Except where explicitly specified, do not assume unsupported methods return v2-style 405 errors.

### Historical world-book audit

`GET /traces?sessionId=` retains `records[].worldBooks[]` as a public compatibility surface.
Each book has `resource`, `budget`, and `decisions[]`. Decisions include entry identity/name,
included/rejected status, reason, primary/secondary keys and matches, group, probability,
tokenCost, and requested/applied position fields. `decisions[].entryId` is the stringified
in-book UID; resourceId identifies the book, and entryName is its entry comment/name, which
may be empty. The summary retains at most 16 books and 128 decisions in total. Entry IDs over
120 UTF-16 units and resource IDs over 200 units are clipped with an ellipsis; this is not a
complete resource inventory. See [world-book entry identity](PROMPT_API_V3_en.md#world-book-entry-identity)
for new v3 source IDs and earlier candidate compatibility.

### Current configuration and resource reads

To inspect bindings without running assembly, preview the current configuration,
then fetch the required resource detail. The caller supplies an explicit sessionId.
v1 errors may be strings or structured objects.

```js
const base = '/pmp-dsh-tavern/api/v1';
async function readJson(path, options = {}) {
  const response = await fetch(base + path, { credentials: 'same-origin', ...options });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    const message = typeof data.error === 'string' ? data.error : data.error?.message;
    throw new Error(message ?? `HTTP ${response.status}`);
  }
  return data;
}
const preview = await readJson('/session-configurations/preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ source: { mode: 'current', sessionId } }),
});
const characterId = preview.selection.characterCardId;
const character = characterId === null ? null
  : (await readJson(`/characters/${encodeURIComponent(characterId)}`)).character;
```

`preview` returns `{ok,selection,contents,diagnostics,available}`. `contents` contains
resource references and summaries, not complete documents. `available:false` reports
invalid/missing resources; a missing resource detail can still fail independently.
This preview neither creates a Session nor applies bindings. Read preset/character/
user linked world-books through their corresponding subresources; embedded lore is
part of the character document. These reads do not promise a cross-request snapshot.

### Character-card sidebar order

The character list has three explicit sort modes: `updated` by `updatedAt` descending (then name, ID), `name` A→Z (Chinese uses `zh-CN` collation), `custom` by user drag order. Drag writes library state only. It does not change the card source or `updatedAt`. Switching modes does not clear a saved custom order.

| Method | Path | Behavior | Status |
| --- | --- | --- | --- |
| PUT | `/characters/order` | Request: `{ mode, characterIds? }`; response: `{ ok: true, characters: [...], sorting: { mode } }` | Implemented |

`mode` must be `updated`, `name`, or `custom`. `custom` without `characterIds` switches back and restores the saved custom order. If none is saved, the current resource order is initialized and cards added while away are appended. Send `characterIds` only for a real reorder. It must contain every stored character-card ID exactly once, at most 4096 items. Unknown, duplicate, or missing IDs return 400 and leave state unchanged. Other modes reject `characterIds`. Successful mode and custom order are stored separately in `character-state.json` as `characterSortMode` and `characterOrder`. In custom mode, newly created or imported cards append. Deleting a card also removes its order entry. `GET /characters` also returns `sorting: { mode }`.

### Missing character cards and relink

Deleting a card still deletes the resource body and cover and still clears stale session selections. The library also keeps a bounded tombstone (original ID, display name, source-file SHA-256 when available) so playthroughs that still reference the card can appear under the human-readable **Missing character cards** area. New playthroughs also snapshot `characterId`, `characterName`, and `characterSha256` when available in `ext.pmpDshTavern`. Card bodies are not copied into the timeline.

After re-import, unique SHA-256 is matched against the tombstone first. Without a hash match, normalized same-name matching is used only when both the missing name and the live name are unique. A unique match relinks automatically. Several same-name candidates are not guessed; the sidebar chooses the target.

| Method | Path | Behavior | Status |
| --- | --- | --- | --- |
| POST | `/characters/relink` | Request: `{ previousCharacterId, characterId }`; response: `{ ok: true, relinkedPlaythroughCount, relinkedSessionCount }` | Implemented |

v1 `/characters/relink` is the missing-resource recovery surface. It uses catalog revision as CAS, moves every playthrough that referenced the old ID onto the target card, and updates root/swipe/branch descendant sessions in one batch of session-selection writes. v2 `/playthroughs/:id/relink-character` is the playthrough-lifecycle surface: it migrates only that playthrough and all of its descendant sessions. The bundled frontend evaluates the target with “unique SHA-256, then both-sides unique same name”. A mismatch shows a warning, but the user can still confirm. The backend does not veto an explicit choice with heuristics.

Both relink paths refuse to overwrite a third card binding that is unrelated to the playthroughs being migrated. If the session batch write fails, catalog is rolled back with the just-written revision. v1 recovery clears the tombstone only after success. When no workspace is bound, automatic recovery is deferred and the tombstone is not silently dropped. Key start, success, and deferral reasons go to `ctx.logger`.

### Conversation display settings

`/conversation-settings` is a v1 bundled-UI contract, separate from `/ui-settings`. It persists only Mowan RP conversation display preferences. It does not enter profile, prompts, timeline, DSH history, or export bodies.

| Method | Path | Behavior | Status |
| --- | --- | --- | --- |
| GET | `/conversation-settings` | Request: none; response: `{ ok: true, settings: { schemaVersion: 1, textScale, actionScale } }` | Implemented |
| PUT | `/conversation-settings` | Request: `{ textScale, actionScale }`; response: same as GET | Implemented |
| DELETE | `/conversation-settings` | Request: none; response: restore both fields to `1` | Implemented |

Both scales are finite numbers from `0.75`–`1.5` in steps of `0.05`. PUT is a full replace and rejects unknown fields. `textScale` applies to Mowan user/assistant bodies and greeting (including the empty-playthrough opening dock). `actionScale` applies only to the copy, swipe, branch, rollback, and edit row at the end of a durable QA.

### Preset export

`GET /presets/:id/export` returns an `application/json` attachment. The server starts from the saved ST original, keeps unknown top-level fields, prompt fields, other `prompt_order`s, and extensions, then overlays name, sampling, prompt content/order/enablement, and the current Chat Completion order from Tavern's normalized state. Export therefore reflects current edits and is not a raw download of import-time `source.raw`.

The body is Chat Completion preset JSON that can be sent back to `POST /import` or imported into SillyTavern. Tavern-only `systemPromptMode` has no ST field and is not written. Native regex carried by the resource stays on its original ST path. This GET does not change selection, session, resources, or the operation log.

| Method | Path | Behavior | Status |
| --- | --- | --- | --- |
| GET | `/presets/:id/export` | Request: none; response: ST JSON attachment; `Content-Disposition: attachment` | Implemented |

### Native ST regex carried by a resource

Presets and character cards share the same sub-resource contract:

| Method | Path | Behavior | Status |
| --- | --- | --- | --- |
| GET | `/presets/:id/regex-scripts` | Request: none; response: `{ ok: true, regexScripts: [...] }` | Implemented |
| PUT | `/presets/:id/regex-scripts` | Request: `{ regexScripts: [...] }`; response: `{ ok: true, regexScripts: [...] }` | Implemented |
| GET | `/characters/:id/regex-scripts` | Request: none; response: `{ ok: true, regexScripts: [...] }` | Implemented |
| PUT | `/characters/:id/regex-scripts` | Request: `{ regexScripts: [...] }`; response: `{ ok: true, regexScripts: [...] }` | Implemented |

`PUT` is a full ordered-array replace, not a field merge. Array order is execution order inside that resource. Elements must be objects. The server does not rewrite native ST fields and does not drop unknown per-rule extensions. The adapter prefers the resource's existing `regex_scripts` path. If there is no array yet, presets write `extensions.regex_scripts`, V2/V3 cards write `data.extensions.regex_scripts`, and V1 cards write `extensions.regex_scripts`. Other resource fields stay unchanged. Writes still go through the matching store's atomic save and total-document size limit.

This v1 sub-resource edits only the preset or card original. It does not compose global regex, compute the session's final effective set, or change history, timeline, or the AI request. The Mowan display pipeline reads the saved resource data only as a render projection. Failures reuse the parent resource API's existing format and status codes.

Mowan regex-page create/import/edit/delete for **preset-bound / character-bound** uses these native sub-resources. Rules are not saved into the workspace global `ui/regex.json` with only a resource scope. Local scoped rules already saved that way enter a pending-migration state the next time the matching resource is the current binding. After the user clicks save, rules are written to the resource original and removed from the global document. Migration de-duplicates by rule id against existing native rules and does not rewrite the resource merely because the panel was opened.

### Preset/character standalone world-book relations

A preset or character card may bind zero or more existing standalone world books:

| Method | Path | Behavior | Status |
| --- | --- | --- | --- |
| GET | `/presets/:id/world-books` | Request: none; response: `{ ok: true, binding: { presetId, worldBookIds } }` | Implemented |
| PUT | `/presets/:id/world-books` | Request: `{ worldBookIds: [...] }`; response: same as GET | Implemented |
| GET | `/characters/:id/world-books` | Request: none; response: `{ ok: true, binding: { characterCardId, worldBookIds } }` | Implemented |
| PUT | `/characters/:id/world-books` | Request: `{ worldBookIds: [...] }`; response: same as GET | Implemented |

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

## v3 prompt assembly audit

Prefix: `/pmp-dsh-tavern/api/v3`. Read-only candidate contract.

| Method | Path | Behavior | Status |
| --- | --- | --- | --- |
| GET | `/capabilities` | Contract capabilities, source mapping and capacity limits | Implemented in candidate |
| GET | `/sessions/:id/assemblies` | Historical index without section/context/system-message bodies | Implemented in candidate |
| GET | `/sessions/:id/assemblies/:recordId` | Cold-read official history; verified section/context bodies; schema 4 returns source metadata/hash/counts while legacy schema 3 detail may retain stored `source.text` | Implemented in candidate |

Fields, examples, errors and persistence: [v3 detailed contract](PROMPT_API_V3_en.md).
`/sessions/:id/sources` is not part of the v3 contract and returns 404. Read current configuration and complete resources through v1.

## Browser chrome mode service

The Tavern client registers the stable service name `pmpDshTavernChrome` through DSH `0.1.5-rc.1` public Cordis `ctx.provide`. This is a Tavern v2 contract, not a DSH Host API. It provides only the `native|play` lifecycle. It does not own or arbitrate any slot, view, or third-party plugin UI.

Public face:

- `getMode()`, `getSnapshot()`: synchronously return a frozen `{ mode, revision }`. On an older server, revision may be `null`.
- `subscribe(listener)`: notify the current snapshot immediately and return an idempotent disposer.
- `refresh()`: read back and commit the authoritative snapshot via `GET /v2/chrome`.
- `setMode(mode)`, `switchMode()`: serialize writes; update local state only after `PUT /v2/chrome` succeeds.
- `when(mode, setup)`: setup on enter; dispose on leave, unregister, or service unload. A late async setup is cleaned up immediately.

A required-dependency plugin may declare `inject: ['pmpDshTavernChrome']` and read `ctx.pmpDshTavernChrome`. An optional consumer should use `ctx.get('pmpDshTavernChrome')` and keep its native/fallback behavior when missing. Third parties must not `provide` the same name again, and must not depend on Tavern-internal React state, `playSlots`, EventSource, or timers.

Internal transport uses `GET /v2/chrome/events`. When EventSource is missing, the connection fails, or it drops, it falls back to the initial GET, window-focus read-back, and 1-second polling. Polling stops after SSE recovers. BroadcastChannel is not in the contract. Service unload stops transport and clears every `when` effect. Several third-party plugins register independently and each cleans only its own slots/UI.

Full notes on third-party DSH plugins, standalone web clients, surface ownership, atomic action composition, and uninstall fallback: [FRONTEND_INTEGRATION_en.md](FRONTEND_INTEGRATION_en.md). There is no one-click config-file Mowan replacement, frontend provider registry, or dynamic bundle loader.
