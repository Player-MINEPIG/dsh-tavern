# Prompt assembly Trace and primitive API v3

Status: Tavern 2.3.0 candidate, not released; updated 2026-09-18. Target: DSH **0.1.5-rc.1**.
[中文](PROMPT_API_V3.md) · [API index and scope audit](API_en.md#api-scope) · [Acceptance](TRACE_REVIEW_en.md)

## Purpose and compatibility

**Scope audit:** The overlapping current-resource `/sessions/:id/sources` endpoint
has been removed; GET returns 404. Historical `sections[].sources` provenance remains.
Tavern Trace uses only assembly index/detail. Read current configuration and complete
resources through v1; see the [field-level overlap audit](API_en.md#api-scope).

v3 provides per-request assembly records and provenance, live and historical. Consumers own
composition. Tavern Trace uses these same HTTP primitives. Third parties may also
observe, adjust, and contribute sections through official DSH
`system-prompt/assemble`, and observe requests through `llm/stream`, without importing
Tavern. There is no composer registry, exclusive owner, required callback, or remote
callback mechanism.

This contract replaces the unpublished composition-oriented v3 candidate:
Neither `prompt-sources` nor the current-resource `sources` aggregate is provided; `prompt-mode`, `registerComposer`, and
`pmpDshTavernPrompt` are not included. Released v1/v2 routes remain available.
v1 `/traces` retains its bounded metadata-only audit, including world-book decisions.
API v3, Tavern 2.3.0, and DSH log format V3 are independent version numbers.

## Read-only HTTP primitives

Root: `/pmp-dsh-tavern/api/v3`. Existing TCP peer, Host, and Origin checks apply.
Responses use `Cache-Control: no-store`; URL-encode explicit session and record IDs.

| Method | Path | Behavior | Status |
| --- | --- | --- | --- |
| GET | `/capabilities` | `{ok,apiVersion,contract,...}`; capabilities and capacity limits | Implemented in candidate |
| GET | `/sessions/:sessionId/assemblies` | `{ok,sessionId,records,storage}`; historical index without section bodies | Implemented in candidate |
| GET | `/sessions/:sessionId/assemblies/:recordId` | `{ok,record}`; one historical snapshot | Implemented in candidate |

Record IDs are opaque. A missing/evicted record returns 404, not proof that a round
contained no Tavern prompt. Old v1 records are exposed as `legacy-metadata-only`;
missing historical bodies are never manufactured by rerunning assembly. Invalid
input returns 400 and non-GET 405. Internal errors return a sanitized 500
`TRACE_READ_FAILED`. Historical reads do not require or activate an Agent. Capabilities
no longer include `currentSources` or `maxSourceBytes`; `storage` describes assembly
record limits only.

### Request and response example

In an authenticated same-origin Host page, read the index and fetch one opaque ID.
This runs no assembly and does not require an active Agent.

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
const record = latest
  ? (await read(`${sessionPath}/assemblies/${encodeURIComponent(latest.id)}`)).record
  : null;
```

Empty index (HTTP 200):

```json
{
  "ok": true,
  "sessionId": "example-session",
  "records": [],
  "storage": {
    "kind": "bounded-assembly-snapshots",
    "maxRecords": 256,
    "maxRecordBytes": 2097152,
    "maxTotalBytes": 16777216
  }
}
```

An empty index means no retained records are available; it does not prove the
Session never ran. A record can be evicted between index and detail calls (404).

### Historical records

`sessionId/turn/step/attempt` identify a request position; one turn may include many
steps and retries. `recordedAt` is capture time. Attempts are numbered from retained
records; use the opaque ID for durable identity after eviction.

| Field | Type | Meaning and boundary |
| --- | --- | --- |
| `sections / contexts` | array | Rendered sections at waterfall return: name/index/text, characters/utf16Units/utf8Bytes, hash/provenance/sources; may be absent when bodies are unavailable |
| `selection` | object | Bindings at capture, unaffected by current edits; may be absent on incomplete/legacy records |
| `audit` | object | Compatible captured v1 resource/lore summary; overlaps legacy audit |
| `systemMessages` | string[] | System messages observed at the LLM boundary; absent before observation |
| `delivery` | object | Observed provider/model, tool names, hashes and available log version/cut; absent before observation |
| `delivery.assemblyVerified` | boolean | True only when candidate system text uniquely matches one complete system message; otherwise consistency is unproven |
| `delivery.systemMessageIndex` | integer / null | System-message index only when verified; not an index into all chat messages |

Statuses: `assembled`, `request-observed`, `request-unconfirmed`,
`request-failed-before-observation`, `assembly-or-preparation-failed`,
`superseded-unconfirmed`, and `unloaded-unconfirmed`. Observing a request **does not
prove a successful remote model response**. Exceptions are not persisted.
`contentStatus` distinguishes `available`, `assembly-unavailable`,
`omitted-size-limit`, and legacy metadata. Restart does not prove an unconfirmed
request succeeded. Context snapshots do not claim actual user-message delivery
based on system verification. DSH durable history remains authoritative.

## Assembly and provenance

The loader expands preset markers, character overrides, macros, lore and fallback
fields in their existing order. Existing blocks become official `{name,text}`
sections named `pmp-dsh-tavern:part:<ordinal>:<kind>:<field>`. The ordinal identifies
this output position, not a stable resource across rounds. Preset, character, and
lore sections can interleave. Tavern expands its contribution before `next()` so
downstream official listeners see those sections. Existing XML-like wrappers and
`\n\n` separators remain; ordinary model text is unchanged. The remaining
`pmp-dsh-tavern:profile` contribution holds import context. RP policy, tools, and
DSH history retain their existing owners.

ST `main`/`jailbreak` are preset entry identifiers. `{{original}}` may combine several
sources inside one section; splitting must not add whitespace. Source relationships
are captured during assembly, not reconstructed from prose. `sourceMapping:
section-contributors` promises section-level input relationships, **not exact source
character spans**. A preset overridden without `original` is `placement-only`;
`input` means an input participated, possibly transformed or removed by macros.

Sources expose `kind/resourceId/resourceRevision/field/text/relationship` and
counts. `field` is a logical assembler field or preset entry path, not always a JSON
Pointer into the imported document. Source `text` is the normalized input used at
that time and may be trimmed. Use v1 resource detail for complete current documents; `source.raw`, when present,
preserves imported fields. Current normalized edits take precedence. Lore also exposes `entryId`.
Unknown external sections, or sections whose bodies were changed, receive
`provenance: unknown` rather than inheriting old Tavern attribution.

Official assembly objects do not retain numeric registration order. `index` is the
actual array position. `offsetUtf16` includes the two-newline separators within the
candidate system text; it locates actual request content only when
`delivery.assemblyVerified` is true. `characters` counts Unicode code points;
`utf16Units` and `utf8Bytes` are also available. None is a token count.

## Persistence and privacy

`tavern-assemblies.json` is a separate bounded store; existing `tavern-traces.json`
is unchanged. Historical inspection can work without an active Agent or current
resource files because snapshots retain sections, source inputs, and observed
system text. These may contain sensitive prompts and need the same local protection
as DSH Session data. Writes are atomic with mode 0600. No credential configuration,
full ordinary chat history, tool arguments, or tool results are stored, and no Trace
records are injected into model history.

Defaults: 256 records, 2 MiB per record, 16 MiB total. Configure
`traceAssemblies.maxRecordBytes` and `maxTotalBytes`; hard ceilings are 4 MiB / 32 MiB.
Oldest retained records are evicted first. Oversized individual records keep explicit
`omitted-size-limit` metadata. Corrupt JSON fails visibly during loading. Runtime
capture/write failures log body-free diagnostics without blocking model requests.
One Host writes the store; retention never deletes DSH history.

## Examples and composition

[HTTP reader](examples/trace-reader.mjs) imports no Tavern code.
[Official observer](examples/official-prompt-observer.mjs) needs no v3 requests.
Tavern's built-in assembly remains active. Consumers may explicitly replace/reorder
`:part:` sections in the official waterfall. Import context and RP policy are separate
contributions. Sampling is applied through `agent/request`; changing sections alone
does not disable Tavern's sampling suggestions. Third parties own their ordering
and coordination policies.

While a panel is open and its Session is running, poll the index every 1.5 seconds;
load detail on demand, abort closed panels, and discard stale responses after a
Session switch. Reading never triggers assembly.
