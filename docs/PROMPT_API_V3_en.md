# Prompt assembly Trace and primitive API v3

Status: Tavern 2.3.0 candidate, not released. Target: DSH **0.1.5-rc.1**.
[中文](PROMPT_API_V3.md) · [Acceptance](TRACE_REVIEW_en.md)

## Purpose and compatibility

v3 provides current source snapshots and historical assembly records. Consumers own
composition. Tavern Trace uses these same HTTP primitives. Third parties may also
observe, adjust, and contribute sections through official DSH
`system-prompt/assemble`, and observe requests through `llm/stream`, without importing
Tavern. There is no composer registry, exclusive owner, required callback, or remote
callback mechanism.

This contract replaces the unpublished composition-oriented v3 candidate:
`prompt-sources` becomes `sources`; `prompt-mode`, `registerComposer`, and
`pmpDshTavernPrompt` are not included. Released v1/v2 routes remain available.
v1 `/traces` retains its bounded metadata-only audit, including world-book decisions.
API v3, Tavern 2.3.0, and DSH log format V3 are independent version numbers.

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
that time and may be trimmed. Current `documents.*.source.raw` preserves imported
raw fields; current normalized edits take precedence. Lore also exposes `entryId`.
Unknown external sections, or sections whose bodies were changed, receive
`provenance: unknown` rather than inheriting old Tavern attribution.

Official assembly objects do not retain numeric registration order. `index` is the
actual array position. `offsetUtf16` includes the two-newline separators within the
candidate system text; it locates actual request content only when
`delivery.assemblyVerified` is true. `characters` counts Unicode code points;
`utf16Units` and `utf8Bytes` are also available. None is a token count.

## Read-only HTTP primitives

Root: `/pmp-dsh-tavern/api/v3`. Existing TCP peer, Host, and Origin checks apply.
Responses use `Cache-Control: no-store`; URL-encode explicit session and record IDs.

| GET path | Response |
|---|---|
| `/capabilities` | `{ok,apiVersion,contract,currentSources,historicalAssemblies,officialSections,sourceMapping,maxSourceBytes,storage,...}` |
| `/sessions/:sessionId/sources` | `{ok,sources}`: current bindings and documents |
| `/sessions/:sessionId/assemblies` | `{ok,sessionId,records,storage}`: bounded index without bodies |
| `/sessions/:sessionId/assemblies/:recordId` | `{ok,record}`: historical snapshot |

Record IDs are opaque. A missing/evicted record returns 404, not proof that a round
contained no Tavern prompt. Old v1 records are exposed as `legacy-metadata-only`;
missing historical bodies are never manufactured by rerunning assembly. Invalid
input returns 400, non-GET 405, missing selected resources 409, and oversized sources
413. Internal errors return a sanitized 500 `TRACE_READ_FAILED`. Historical reads
do not require or activate an Agent. Current-source reads verify Session existence
through public Host coordinates.

### Current sources

- `selection`: bindings, character options, greeting index.
- `worldBookSelection`: binding origins and deduplicated effective order.
- `documents`: current preset, character, user and world books, preserving imported
  raw data and unknown extensions.
- `greeting`: requested/effective index, text, and `first-turn-reference` semantics.
- `fieldLengths`: JSON Pointers rooted at documents, with all three counts.
- `suggestedCallConfig`: mappable sampling suggestions; reading does not apply them.
- `revision`: current snapshot hash, not a historical assembly or request identity.

The entire response snapshot, including metadata, is limited to 16 MiB. Oversize
snapshots are rejected rather than truncated. Reading runs no assembly, matching,
random macros, or greeting consumption.

### Historical records

`sessionId/turn/step/attempt` identify a request position; one turn may include many
steps and retries. `recordedAt` is capture time. Attempts are numbered from retained
records; use the opaque ID for durable identity after eviction.

- `sections/contexts`: rendered content captured at Tavern's waterfall return point,
  with sources, counts and hashes.
- `selection`: bindings at assembly time; `audit`: the compatible v1 resource/lore
  decision summary.
- `systemMessages`: system text observed at `llm/stream`, excluding ordinary chat
  history and tool bodies.
- `delivery`: provider/model, tool names, system hashes, and available Session log
  version/cut sequence references.
- `delivery.assemblyVerified`: the complete candidate system text uniquely matches
  one complete system message in the actual request. False means consistency is
  unproven, including complete overrides, later changes or duplicate text.
- `delivery.systemMessageIndex`: index within system messages, not all chat messages.

Statuses: `assembled`, `request-observed`, `request-unconfirmed`,
`request-failed-before-observation`, `assembly-or-preparation-failed`,
`superseded-unconfirmed`, and `unloaded-unconfirmed`. Observing a request **does not
prove a successful remote model response**. Exceptions are not persisted.
`contentStatus` distinguishes `available`, `assembly-unavailable`,
`omitted-size-limit`, and legacy metadata. Restart does not prove an unconfirmed
request succeeded. Context snapshots do not claim actual user-message delivery
based on system verification. DSH durable history remains authoritative.

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
