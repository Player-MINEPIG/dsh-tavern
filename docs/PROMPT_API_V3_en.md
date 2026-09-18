# Prompt assembly Trace and primitive API v3

Contract version: Tavern **2.3.0 candidate**, targeting DSH **0.1.5-rc.1**.
[中文](PROMPT_API_V3.md) · [API index and scope audit](API_en.md#api-scope) · [Acceptance](TRACE_REVIEW_en.md)

## Purpose and compatibility

v3 exposes per-request assembly records and provenance. Tavern Trace uses the same HTTP
surface. Third parties can also observe, alter, and contribute sections through official
DSH `system-prompt/assemble`, and inspect complete requests through `llm/stream`. There is
no composer registry, exclusive owner, remote callback, or current-resource aggregate.

`/sessions/:id/sources` is not part of the v3 contract and returns 404. Current
resources, bindings, and configuration remain in v1. Historical `sections[].sources`
describes section-level relationships at capture time. Released v1/v2 routes remain
compatible. API v3, Tavern 2.3.0, and DSH log format V3 are separate version numbers.

## Minimal read-only HTTP surface

Root: `/pmp-dsh-tavern/api/v3`. Existing TCP peer, Host, and Origin checks apply. All
responses use `Cache-Control: no-store`. URL-encode explicit session and record IDs.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/capabilities` | `{ok,apiVersion,contract,...}` with capabilities and retention limits |
| GET | `/sessions/:sessionId/assemblies` | `{ok,sessionId,records,storage}` index without section/context/system-message bodies |
| GET | `/sessions/:sessionId/assemblies/:recordId` | one historical detail resolved by a cold read |

Record IDs are opaque. Missing or evicted records return 404; this does not prove the turn
had no Tavern contribution. Invalid input returns 400, non-GET returns 405, and internal
failures return sanitized 500 `TRACE_READ_FAILED`. Detail calls use read-only Session
inspection. They do not activate an Agent or rerun assembly. Capabilities omit
`currentSources` and `maxSourceBytes`.

```js
const base = '/pmp-dsh-tavern/api/v3';
async function read(path) {
  const response = await fetch(base + path, { credentials: 'same-origin', cache: 'no-store' });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}
const sessionPath = `/sessions/${encodeURIComponent(sessionId)}`;
const { records } = await read(`${sessionPath}/assemblies`);
const latest = records.at(-1);
const detail = latest
  ? await read(`${sessionPath}/assemblies/${encodeURIComponent(latest.id)}`)
  : null;
```

Empty index response:

```json
{
  "ok": true,
  "sessionId": "example-session",
  "records": [],
  "storage": {
    "kind": "bounded-assembly-references",
    "maxRecords": 256,
    "maxRecordBytes": 2097152,
    "maxTotalBytes": 16777216
  }
}
```

An empty index means no retained record is available. A record may still be evicted between
the index and detail requests.

## Schema 4 records

New v1 audit and v3 assembly data share one schema 4 record in
`tavern-trace-records.json`. `captureId` / `legacyCaptureId` links one capture without
guessing from reusable turn/step/attempt or old v1 IDs. `sessionId/turn/step/attempt`
describes the request position. A turn can have multiple steps and a position can have
multiple observed requests. Attempt counts Tavern captures only; it is neither every network
retry nor the official `assistant/attempt` sequence. Request observation does not prove a
successful remote model response.

| Field | Meaning and boundary |
| --- | --- |
| `schemaVersion` | `4` for new records |
| `sections / contexts` | persisted name/index, character/UTF-16/UTF-8 counts, hash, provenance, source metadata, and official reference; no persisted `text` |
| `sources[]` | kind/resourceId/resourceRevision/field/identifier/role/relationship, hash and counts; `role` is the preset-requested role; `textStatus: "not-stored"`; no stored or recovered `source.text` |
| `selection / audit` | captured binding and v1-compatible resource/lore summary; later edits do not update it |
| `sessionRef` | Session identity, format version, creation time, and log cut used for cold-read validation |
| `systemMessageRefs` | official event references; no persisted `systemMessages` copy |
| `delivery` | provider/model, tool names, system hashes, log version/cut, and verification result |
| `delivery.assemblyVerified` | true only when the candidate assembly uniquely matched one complete system message |
| `delivery.historyVerified` | true only when `assemblyVerified` is true and an official-history reference was established for the matched system message |
| `delivery.systemMessageIndex` | verified system-message index, not an index into all chat messages |
| `failureRef` | Optional official failure-event reference with its own session identity/cut and event seq/type/hash; it does not widen the prompt cut |
| `failureStatus` | `reference-only` in the index; detail reads return `available` or `reference-unavailable` after verification |
| `failure` | Detail-only `{code,message}` after verification; each field is a string or null, never persisted |
| `failureReferenceError` | Why a failure reference is unavailable; independently verified prompt bodies remain readable |

New records use `bodyStorage: "official-session"` and `sourceTextStored: false`. Statuses
include `assembled`, `request-observed`, `request-unconfirmed`,
`request-failed-before-observation`, `assembly-or-preparation-failed`,
`superseded-unconfirmed`, and `unloaded-unconfirmed`. Failure bodies are not persisted.
New records in the index normally retain persisted `contentStatus: "reference-only"`. After a
schema 4 detail read, body recovery reports `available`, `partially-available`, or
`reference-unavailable`. Detail reads do not replace `assembly-unavailable` or
`omitted-size-limit`.

### Failure details

Failure reasons first reference `reason.failure` on the finish chunk of the current request's official `assistant/attempt`.
When assembly, preparation, or stream middleware errors have no such reason, the reference
uses official `turn/end.reason.error`. A detail request still performs one cold inspect,
validating prompt and failure references separately. Error bodies are read only for the
response, never copied into the Trace file or index. Missing, truncated, or altered history
produces an explicit unavailable state. Earlier records without references do not acquire
invented failure reasons.

`status: "request-observed"` may coexist with failureStatus: reaching the LLM boundary does
not establish success. A retry has its own record; a failed attempt is not attached to a
successful retry, nor a subsequent assembly failure to the preceding successful request.
Each record retains its most specific failure source, not a complete error cause chain or
the final outcome of the entire turn. Absence of failure does not prove success; cancellation
without an official error reason is not fabricated into an error.

The RP frontend and v2 `/messages` continue to project messages without failure placeholders.
Consumers that need failure details use v3. This does not change RP conversation display or
create assistant history.

## Official-history references and on-demand recovery

The recorder creates references only when they can be verified against the current public
model surface:

- log V3 system sections reference their `system/message` and a UTF-16 range;
- older formats reference `request/header.system` only on an exact full-text match;
- context sections reference the official system-prompt `user/message` snapshot and its named source section;
- every reference binds event seq/type, text hash, and a fixed log cut; message references also
  bind message ID and content hash, while section references bind a range or named source section.

These are logical coordinates in the official DSH event view, not byte offsets into a
compressed log file. One schema 4 detail request performs one cold inspect of the target
Session and then validates references in the returned official event view. Long Sessions can
still be costly to read; this contract promises neither random log access nor O(1) detail reads.

Detail inspection cold-reads official Session history and verifies Session ID, format,
creation time, log cut, event type, message identity, hashes, ranges, and target hashes.
Only then does it return `sections[].text` or `contexts[].text`. Temporary
`systemMessages` appears only when a captured, non-empty `systemMessageRefs` list resolves
completely. If any captured reference fails, `requestContentStatus` is
`reference-unavailable`. Records without system-message references do not promise that field.

Source inputs in new schema 4 records have no official historical body reference, so their
`source.text` is never returned. Source hash, counts, and `textStatus: "not-stored"` remain
available. Old schema 3 details may still expose source bodies already stored before upgrade.
Consumers may inspect **current** resources through v1, but must not present current bodies as
historical source text.

Missing history, an unavailable cut, identity/format/hash/range mismatch, or read failure is
reported through `reference-unavailable`, `partially-available`, and a specific
`referenceError`. There is no reassembly, current-resource reconstruction, or plugin-owned
full-text fallback. `assembly-unavailable` and `omitted-size-limit` remain explicit. DSH
durable history is the body authority; Trace is an evictable index and explanation layer.

## Assembly and provenance semantics

The loader expands preset markers, character overrides, macros, lore, and fallbacks in order,
then emits official `{name,text}` sections named
`pmp-dsh-tavern:part:<ordinal>:<kind>:<field>`. The ordinal is this assembly's position, not a
stable resource ID. Tavern adds no profile/preset name, ID, or `st-prompt` / character / user /
world-info identification wrapper to model-visible text. Identical tags authored in resource
content remain literal. Sections still join with two newlines.

Sources are captured during assembly rather than inferred from output. `sourceMapping:
section-contributors` promises section-level relationships, not character spans.
`{{original}}` may combine several sources; an override without original marks the replaced
preset source `placement-only`. A preset requested role stays in source metadata; every actual
contribution remains a system section.

Official assembly objects do not retain numeric registration order. `index` is the actual
array position. `offsetUtf16` includes two-newline separators and locates official content only
after assembly and reference verification. `characters` counts Unicode code points;
`utf16Units` and `utf8Bytes` are not token counts.

### World-book entry identity

New `kind: "worldbook"` sources carry these fields without a body copy:

| Field | Meaning |
| --- | --- |
| `resourceId` | World-book resource ID; embedded books use `character:<cardId>:embedded-world-book` |
| `entryId` | Normalized in-book UID as a string; null when absent, never inferred from a qualified ID |
| `qualifiedEntryId` | Complete Loader entry identity, normally `<resourceId>:<uid>`; null when absent |

For example, a v1 audit `entryId: "7"` corresponds to a new v3 source `entryId: "7"`, with
`qualifiedEntryId: "book-a:7"`. Join against the same record's `audit.worldBooks[].decisions[]`
using both resourceId and entryId; different books may reuse a UID. The v1 audit keeps its
existing count and string limits: UIDs over 120 UTF-16 units and resource IDs over 200 units
are clipped with an ellipsis. v3 sources retain complete identities. Missing, clipped, or
duplicate entries must not be treated as unique matches. `entryName` is a comment/name
display summary and may be empty; it is not an identity.

Earlier candidate sources lack `qualifiedEntryId`; their `entryId` may be a complete Loader
ID. Historical records remain unchanged. Detect the field's presence rather than relying
only on schemaVersion, and report unknown when identity cannot be established.
Loader fields such as `activeLoreEntries` continue to use complete IDs.

When expanding `{{char}}`, the Loader falls back from an empty or whitespace-only nickname
to the card name. A nonblank explicit macro context or nickname retains priority. The same
context is used to expand imported context text.

## Persistence, compatibility reads, and limits

`tavern-trace-records.json` is the canonical schema 4 store, atomically replaced through a
0600 temporary file. It stores metadata and official references only. New records contain no
section, context, system-message, or source-text copies.

Compatibility readers keep `tavern-traces.json` v1 metadata and `tavern-assemblies.json` schema 3
body snapshots read-only. They are neither migrated, rewritten, nor automatically reduced to
the new limits. The legacy v1 view retains its existing maximum of 128 records per Session;
actual retention for all new captures is controlled by the schema 4 store. Old v1 records
appear as `legacy-metadata-only`; old schema 3 details can still expose bodies that file already stored.
Compatibility reads do not make new records copy bodies and never provide a full-text fallback
for a new record.

All Sessions in one storage directory share the defaults: 256 records, 16 MiB total, and 2 MiB
per record. Per-record and total limits are configurable with hard ceilings of 4 MiB and 32 MiB;
record count is fixed. Oldest records are evicted first. Metadata/reference records that cannot
fit retain a minimal `omitted-size-limit` row rather than a deceptively partial detail. Corrupt
JSON fails visibly. Capture/write failures emit body-free diagnostics without blocking model
requests. Retention never deletes DSH history.

The schema 4 file has no prompt bodies, but reference metadata, resource IDs, model names, and
tool names may still be sensitive. The detail API can also return prompt bodies recovered from
DSH history. Protect the local data directory and API as DSH Session data.

## UI and third-party boundary

Tavern Trace first shows captured configuration/resource summaries, then lazily expands lore
decisions and loader assembly. Verified section/context bodies are displayed when recoverable.
Schema 4 sources show metadata, hashes, and counts without `source.text`; older schema 3 records may still include source bodies labeled as legacy snapshots. Explicit reasons are
shown when recovery fails. Current v1 resources can help diagnose current configuration, but
the UI does not label them as historical originals.

[HTTP reader](examples/trace-reader.mjs) imports no Tavern code.
[Official observer](examples/official-prompt-observer.mjs) needs no v3 request. Index/detail
reads never trigger assembly. Third parties may reorder or replace Tavern `:part:` sections in
the official waterfall. Import context and RP policy remain separate contributions. Sampling
still flows through `agent/request`; this API does not arbitrate third-party composition order.
