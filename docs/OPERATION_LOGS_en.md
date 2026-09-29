# Operation log contract

[简体中文](OPERATION_LOGS.md) · [API index](API_en.md)

## Stable surfaces and ownership

Tavern owns this contract. It describes operations and confirmed outcomes, without exposing DSH execution steps. Public DSH extension points are versioned too: the supported target remains DSH `0.1.7-rc.1`; this is not a promise of compatibility with future DSH versions.

| Layer | Contract / owner | Expected effect of a DSH upgrade |
| --- | --- | --- |
| Request boundary | Tavern route templates, operation names, correlation IDs, terminals, HTTP status | No logging change while route semantics hold; register a new monitored operation in its route declaration |
| Business checkpoints | Tavern-confirmed creation, binding, copying and writes | Internal reordering does not rename events; semantic changes require a contract change |
| Host adapter | `play-host.js` normalizes public DSH controller results | Adapt signatures and results here; logging does not separately inspect DSH objects or subscribe to events |
| Encoding and storage | Tavern eventVersion, schemaVersion, whitelist, rotation and queries | Independent of DSH event names, log formats and compression |
| Native execution and Prompt Trace | DSH authoritative history and existing Tavern Trace adapters | Maintain their own compatibility; operation logging does not duplicate it |

Flow: route declaration → shared operation boundary → business code / existing Host adapter checkpoints → content-free events → Cordis logger and bounded journal → query API / diagnostics panel. The journal imports no HTTP, loader or DSH module; HTTP validation is separate from storage.

An HTTP failure alone cannot establish whether earlier writes succeeded. A model failure after request acceptance also does not change the HTTP terminal. Use operationId to find the request and confirmed outcomes, then reread current state. Generation, assembly, provider and tool failures still use DSH diagnostics and Prompt Trace. Logs are evidence, not recovery commands.

## Event semantics version 1

`schemaVersion:1` describes the stored envelope; the additive optional `eventVersion:1` describes the following semantics. Both are independent of DSH Session format versions. Consumers identify semantics by `event`; `stage` remains for compatible display, not internal-step interpretation. Tolerate additional fields and unknown events, operations and error codes; display unknown versions generically.

| event | Meaning |
| --- | --- |
| `operation.started` | Entered a declared mutation; validation or writes have not been established |
| `operation.completed` | Handler returned successfully; API terminal includes actual HTTP status and normally result:completed. session.user-message uses result:accepted, meaning only Host input acceptance |
| `operation.failed` | Handler threw; confirmed earlier writes may remain. Includes code, HTTP status where applicable, duration and known target IDs |
| `session.created` | Obtained a new session ID by create or branch; workspace insertion, inbox cleanup, binding or copying may still fail |
| `session.selection.copied` | Selection copy call returned successfully |
| `session.import-context.bound` / `session.import-context.unbound` | Binding / unbinding call returned successfully |
| `session.import-lineage.copied` | Lineage copy call returned successfully; a source lineage need not exist |
| `workspace.bound` / `workspace.directory.created` / `workspace.file.written` | Respective call returned successfully; the entire frontend workflow need not be complete |
| `playthrough.timeline.updated` / `playthrough.catalog.updated` | File write returned successfully; another file or selection operation may still fail |
| `playthrough.catalog.restored` | Catalog compensation after relink failure returned successfully; this is not an atomic rollback across resources |
| `diagnostic.failed` | Previously caught auxiliary RP / Trace diagnostic failed; operation is rp.policy or trace.record. This does not mean a user request or DSH turn failed |

Each mutation has at most one terminal; process termination or storage faults can leave incomplete evidence. Completion does not guarantee browser receipt or asynchronous generation completion. Disconnecting does not automatically cancel business work; reread state before retrying. A missing terminal is not failure and does not authorize automatic replay.

`route` is a fixed template such as `/sessions/:id/branch`, never a query string or actual URL. Operation names remain workspace.bind, workspace.dir.create, workspace.file.write, session.create, session.branch, session.user-message, session.import-context.bind, session.import-context.unbind, playthrough.session.detach and playthrough.character.relink. Coverage does not include all v1/v3 APIs. Checkpoints update sessionId/playthroughId on subsequent records; after a branch creation checkpoint, sessionId refers to the child. Use operationId for the full chain: a sessionId filter can omit the start record.

Plugin lifecycle uses the same semantics: plugin.start emits started → completed (ready); normal plugin.stop emits completed (disposed). Abnormal exit does not fabricate a stop. RP / Trace only report failures caught at existing business sites; no additional DSH agent-lifecycle or model-execution log listener is installed.

Legacy records without eventVersion remain readable/exportable without being reinterpreted as version 1. Existing files and DSH history are not rewritten. Low-level createOperationContext retains start/stage/success/failure and the dsh-tavern.operation prefix. New production code uses the contract wrapper; custom legacy stages are not automatically upgraded. Changing an existing event or field meaning/type requires a new event version and compatibility policy. Additive optional fields or new events do not require an envelope version change.

## Upgrade and extension checks

1. Check Tavern route semantics and error mapping, then the target DSH public services. When only DSH signatures/results change, adapt the existing Host adapter; do not add DSH version checks to the journal, query layer or UI.
2. Register new monitored mutations in their route declaration; no handwritten start/success/failure is needed. Add whitelisted checkpoints only where partial completion affects diagnosis, never for validation, reads, function names, hook names or raw objects.
3. Run contract, partial-success, correlation, privacy, mixed legacy/current records and journal tests, followed by affected Host checks, npm test and npm run verify:2.0. Maintainers must still review business semantics; tests cannot guarantee future DSH behavior.
4. Update both versions of this contract for semantic changes. Pure DSH adaptation should leave storage, queries and the panel unchanged.

## Queries, storage and frontend

Existing v1 resources, v2 workspace primitives and v3 Trace cannot query operation lifecycles. One read-only primitive fills that gap: `GET /pmp-dsh-tavern/api/v2/operation-logs`. It inherits the Tavern API Host security boundary. There is no write, browser-upload, clear or repair endpoint; callers compose filtering and pagination.

- Query parameters: exact `operationId`, `sessionId`, `playthroughId`; `level=info|warn`; `limit=1..1000` (default 200); `before=<record id>` for older entries; `format=json|jsonl` (default JSON). Empty, duplicate or unknown parameters return 400 `LOG_QUERY_INVALID`.
- JSON returns `{ok:true,schemaVersion:1,records,nextCursor,storage,limits}`, newest writes first. Keep the same filters with `nextCursor`; an unavailable/rotated cursor returns 409 `LOG_CURSOR_EXPIRED`, requiring refresh. Pagination is not a snapshot across requests.
- `storage` includes `available`, `code`, this instance's `dropped` count and the query's corrupt `skippedRecords` count. `LOG_DISABLED`, `LOG_WRITER_BUSY`, `LOG_STORAGE_UNAVAILABLE`, `LOG_LOCK_RECOVERY_REQUIRED` and `LOG_CLOSED` mean degraded storage; HTTP 200 or empty `records` alone does not establish health. Readable old records may still be returned. A disk failure stops writes for this instance; fix the storage and restart the Host.
- `format=jsonl` downloads the same page, with a first `{type:"metadata",...}` line preserving status, limits and the next cursor, followed by one record per line. Responses use `no-store`. This is not a complete-history export; request additional pages as needed. It includes neither Trace nor the current problem report.
- The envelope contains schemaVersion:1, id, plugin-instance runId, UTC timestamp and level. Event fields are limited to eventVersion, event, route, operationId, operation, stage, result, errorCode, status, durationMs, method, sessionId and playthroughId. IDs use `<runId>:<sequence>`, independent of clock ordering. Persistence/export exclude path and reads reapply the whitelist; new contract producers omit path from Cordis output too. Identifiers and route are bounded to 128 characters; operation/event/stage/result/errorCode to 96; method to 32; control characters are replaced and a record is bounded to 4096 bytes. The legacy low-level utility still accepts path, but it never enters the journal.
- Instrumented v2 mutation responses include `X-Tavern-Operation-Id`; failed JSON additionally includes `operationId`. This correlates one request, not a cross-request transaction. Business `code` matches failure `errorCode` (`UNKNOWN_ERROR` without a stable code). Routing/security rejection or requests before an operation starts may lack this ID. `createLivePlayClient` preserves it as `error.operationId` and provides `getOperationLogs(filters)`. Older Hosts return 404; frontends should disable/hide log access while retaining current problem diagnostics.

By default the plugin stores at most four JSONL files in `operation-logs/` under Tavern storage, at most 1 MiB each, removing the oldest file at capacity. There is no daily archive or minimum retention period. Fixed file limits bound disk and query input; there is no unbounded write queue. New directories/files use 0700/0600 where supported. `operationLogs: { enabled: false }` disables this store and reading its history through queries, while retaining Cordis logging; it does not delete existing files. The directory is not used for migration, session replay or recovery decisions and may be deleted with the Host stopped.

Concurrent requests in one Host are serialized by synchronous bounded file writes. Only one journal writer may own a storage directory; a second instance can read old logs but reports `LOG_WRITER_BUSY`. Normal disposal releases ownership. After process death, startup checks the owner PID, reclaims a dead owner and discards an incomplete final line. An orphan startup guard, reused PID or unconfirmed owner death fails closed: stop all Hosts using the directory, confirm no writer remains, then remove `.guard`/`.owner` and restart. This is for local filesystems, not multi-machine shared writes. There is no fsync transaction guarantee; crashes, interrupted rotation or capacity eviction may lose records. Missing terminal records prove neither business success nor failure.

Coverage is limited to the operations and plugin lifecycle defined above, not all Cordis output. Logging failures do not change business results. Error messages, stacks, causes, bodies, body lengths and summaries never enter the journal.

The bundled diagnostics panel explicitly loads a recent page, filters by operationId, shows older pages and exports the displayed page. Browsers collect no console, network body, input or click history; there is no localStorage log or background polling. Current workspace problems describe current reads; the operation journal explains backend steps; Prompt Trace explains model assembly and official references. None replaces another. Logs cannot become authoritative DSH history, resource data or future MVU state. Exports exclude bodies but retain private identifiers and need review before sharing.
