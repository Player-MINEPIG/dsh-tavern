# Tavern public API surfaces

[中文](API_SURFACES.md) · [HTTP resource and history contracts](API_en.md) · [Frontend integration](FRONTEND_INTEGRATION_en.md)

Use the narrowest interface for the requested capability. HTTP v1 owns current resources/configuration, v2 owns RP meta-operations, and v3 owns historical assembly metadata and verified official references. Sources, assembly and historical records are distinct. Package entry points are program interfaces, not individually installable plugins.

## Stability and dependency

Tavern depends one way on an independently enabled assembler Host bundle. Memory Manager is optional; neither Tavern nor assembler requires its package/service. The assembler owns strategy storage, source registration and request placement; Tavern owns source bodies, parsing, authorizations, MVU commits and RP UI. `tavernRequestSources` aliases shared `dshPromptSources`. Legacy Tavern assembly-presets HTTP uses the same store/runtime as the independent assembler. Existing v1/v2/v3 roots, resource reads, selection, raw message reads, Trace official references, format exports and native DSH/uninstall behavior remain supported.

Tavern 3.0.0 interfaces follow this index and the linked contracts; use the matching Git tag for older behavior. Additional response fields are extensible. Current metadata owner is `dsh-prompt-assembler`; historical reads accept `pmp-dsh-tavern` too. A source unload removes future contribution, not durable history. V4 coordinate/version checks, template unknown-field rejection, scope authorization and CAS remain mandatory. Old clients must not replay a whole GET response as a mutation or treat current content as historical originals.

## Program entry points

| Public import | Purpose | Implementation |
| --- | --- | --- |
| `pmp-dsh-tavern` | Host plugin and compatibility loader primitives | [source](.././packages/tavern-loader/src/index.js) |
| `pmp-dsh-tavern/format` | ST format normalization and macros | [source](.././packages/tavern-format/src/index.js) |
| `pmp-dsh-tavern/loader` | DSH resource composition and secure Host/API entry | [source](.././packages/tavern-loader/src/index.js) |
| `pmp-dsh-tavern/world-book` | Pure world-book format, matching and projection | [source](.././packages/world-book/src/index.js) |
| `pmp-dsh-tavern/world-book-library` | Standalone world-book store and HTTP factory | [source](.././packages/world-book-library/src/index.js) |
| `pmp-dsh-tavern/preset` | Preset store, selection and HTTP factory | [source](.././packages/preset/src/index.js) |
| `pmp-dsh-tavern/character` | Character store, import/export and HTTP factory | [source](.././packages/character/src/index.js) |
| `pmp-dsh-tavern/user` | Persona store and HTTP factory | [source](.././packages/user/src/index.js) |
| `pmp-dsh-tavern/trace` | Bounded metadata, official references and audit | [source](.././packages/tavern-trace/src/index.js) |
| `pmp-dsh-tavern/session-template` | History-free session configuration templates | [source](.././packages/session-template/src/index.js) |
| `pmp-dsh-tavern/client` | DSH browser plugin entry | [source](.././dist/client.js) |
| `pmp-dsh-tavern/identity` | Plugin ID and versioned API prefixes | [source](.././packages/identity.js) |
| `pmp-dsh-tavern/package.json` | Package metadata | [source](.././package.json) |
| `pmp-dsh-tavern/request-assembler` | Compatibility assembly primitives | [source](.././packages/request-assembler/index.js) |
| `pmp-dsh-tavern/mvu` | MVU source, state and card bindings | [source](.././packages/mvu-adapter/src/index.js) |
| `pmp-dsh-tavern/prompt-template` | Read-only template syntax and bounded runtime | [source](.././packages/prompt-template/index.js) |
| `pmp-dsh-tavern/memory-sources` | Public world-book/template resource adapters | [source](.././packages/memory-sources/index.js) |
| `pmp-dsh-tavern/opening-worldbook` | Opening-world-book proposals and commits | [source](.././packages/opening-worldbook/index.js) |
| `pmp-dsh-tavern/opening-worldbook/manifest` | Fixed public opening snapshot identities | [source](.././packages/opening-worldbook/manifest.js) |
| `pmp-dsh-tavern/scope-catalog` | Indexed identity directory and scope leases | [source](.././packages/scope-catalog/index.js) |

Factory handlers are composable primitives. Mount them under the documented Host admission/security wrapper; importing a factory does not provide authentication, model grants or cross-resource transactions. Browser callers use the existing secure fetch transport. No source-private file access or `store.requestAssembler` access is a third-party contract.

## HTTP map

All Tavern paths below are relative to `/pmp-dsh-tavern/api`. Identifiers and JSON query values must be URL-encoded. Resource v1, play/session/workspace v2 and Trace v3 routes remain fully listed in [API](API_en.md); the following table covers the added source/runtime and draft routes.

| Method | Path | Input and result |
| --- | --- | --- |
| GET | `/request-token` | Embedded client header `X-Tavern-Client: embedded`; returns memory-only token for the existing desktop mutation transport |
| GET | `/v1/assembly-presets?sessionId=…` | Preset library, applied selection, capability and descriptors |
| POST | `/v1/assembly-presets` | Preset JSON or `{preset}`; saves library only |
| GET / PUT / DELETE | `/v1/assembly-presets/:id` | Read/save/remove; builtin and applied-preset restrictions apply |
| PUT | `/v1/assembly-presets/selection` | `{sessionId,id}`; saves independent applied snapshot, `id:null` disables; running session or missing advanced addon or protocol 1 returns 409 |
| POST | `/v1/assembly-presets/preview` | `{sessionId,preset}` or `{sessionId,presetId}`; read-only preview without unsent input |
| GET | `/v1/assembly-presets/actual?sessionId=…` | Latest durable `request/assembly`, or null; no re-evaluation |
| GET | `/v1/mvu/resources?scope=…` | `{authority:'local',sessionId}` JSON; returns records |
| GET | `/v1/mvu/resource?id=…&scope=…` | Returns record; only this trace read accepts messageId/endEventId |
| GET | `/v1/mvu/history?id=…&scope=…` | Current local session scope; version metadata including prior values |
| GET | `/v1/mvu/facts?id=…&scope=…` | Current local session scope; source execution facts |
| POST | `/v1/mvu/update` | `{id,scope,content,expectedRevision,operationId}`; source-authorized CAS; no implicit card grant |
| GET | `/v1/mvu/snapshot?scope=…` | Verified timeline/greeting/initial/draft scope; returns versioned variables and revision |
| POST | `/v1/mvu/card-binding` | `{scope,grantId,sourceIdentity,bindingId?}`; returns source-scoped execution binding |
| POST | `/v1/mvu/card-write` | `{capability,operation,value,expectedRevision,operationId,cause}`; patch/replace with schema/CAS/idempotency |
| POST | `/v1/mvu/card-binding/revoke` | `{capability}`; revoke both session/draft binding where applicable |
| GET / POST / PUT / DELETE | `/v1/rendering-cache/{graphs,sources,opening}` | Inert environment cache; graph generations, shared sources and fixed opening data; exact methods and import in [API](API_en.md#rendering-cache-storage) |
| POST / DELETE | `/v1/rendering-write-grants[/:grantId]` | Exact downloaded/enabled execution identity; create/revoke trusted renderer grant |
| POST | `/v1/sessions/:id/opening-worldbook/prepare` | Fixed source identity and opening ID; read-only proposal |
| POST | `/v1/sessions/:id/opening-worldbook/commit` | Reviewed proposal, revision, operationId and separate explicit write confirmation; session-local book receipt |
| POST | `/v2/drafts` | `{characterId,source?,selection?,assemblyPresetId?}`; stores opening draft and empty playthrough, no DSH session |
| GET / PUT | `/v2/drafts/:id` | Read; update `{expectedRevision,selection?,assemblyPresetId?,variables?,importContextRef?,resetVariables?}`; character identity cannot change |
| POST | `/v2/drafts/:id/materialize` | `{expectedRevision,operationId,text}`; prepares a unique real session/request; caller separately submits exactly that text/requestId through the public DSH message API |
| POST | `/v2/drafts/:id/cancel` | Cancel coordination; preserves accepted history |
| GET | `/v2/operation-logs` | Bounded diagnostic query; filters/JSONL in [operation contract](OPERATION_LOGS_en.md) |

See [MVU](MVU_en.md) for complete scope/binding/error definitions, [assembly](REQUEST_ASSEMBLY_en.md) for block placement, [opening world books](API_en.md#session-opening-world-books) for confirmed writes, and [draft lifecycle](ARCHITECTURE_en.md#sessionless-opening-lifecycle) for acceptance order. `materialize` does not send a model request itself. On conflict, reread authority and retry the same intent; never blindly repeat side effects. A successful HTTP response is not model/provider completion.

## Host capabilities

| Capability | Contract / owner |
| --- | --- |
| `dshPromptAssembler`, `dshPromptSources` | Required independent assembler; its public guide defines store/runtime/registry |
| `tavernRequestSources` | Protocol 1 compatibility alias, not a second registry |
| `tavernMvu` | [MVU](MVU_en.md): list/read/update/history/facts, scoped snapshots/bindings, prompt dependencies, source-owned command processors |
| `tavernMemorySources` | [Templates/source management](PROMPT_TEMPLATE_en.md): world-book/template adapters, metadata-only listBound and source default leases |
| `tavernScopeCatalog` | [API](API_en.md): searchScopes and resolveScopeContext; identity only, synchronous Host-only checkCurrent |
| `tavernOpeningWorldBooks` | prepare/commit; explicit separate world-book confirmation |
| `tavernRenderingAuthority` | Trusted renderer execution grants; no arbitrary guest Host calls |
| `pmpDshTavernChrome` | [Frontend contract](FRONTEND_INTEGRATION_en.md): native/play lifecycle; consumers own and dispose their slots |

Host-only leases and callbacks are not HTTP values and cannot be serialized as authority. Source visibility, list registration, editing a preset and rendering a card never grant prompt use or writes. Stock DSH rc.2 supports the standard public-interface backend. Advanced execution requires the mounted addon and protocol 1; check runtime.requireAvailable(preset), not the general available() flag.

Standard versus optional core capabilities, migration and evidence are defined in [assembly strategies](REQUEST_ASSEMBLY_en.md). Check capabilities() and requireAvailable(preset) for the selected backend.
