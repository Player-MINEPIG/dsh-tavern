# MVU state source

[中文](MVU.md) · [HTTP API](API_en.md) · [Request assembly](REQUEST_ASSEMBLY_en.md)

MVU variables describe character state; they are a separate type from long-term memory. `tavernMvu` (protocol 1) owns content, history, revisions, CAS and idempotency. An optional manager uses this public service. Tavern neither depends on the manager nor copies authoritative state into its database.

## Discovery, configuration and identity

Imported cards with `[initvar]` or recognized schema declarations are discovered when the manager reads resources or the Host prepares a selected character session. Stable resource IDs derive from the stored character ID. Discoveries default to **managed**, without an enabled usage policy. Only selecting that card grants a session access; discovery never grants wildcard access or executes card scripts. Selection, deselection and reselection persist activation event boundaries so old character replies never replay into the new source. Changing selection does not reinitialize content. Source parsing errors remain visible as `sourceError` and prevent execution.

Explicit Host resources remain supported:

```js
{ mvu: { resources: [{
  id: 'mvu:campaign', sessionIds: ['session-a', 'session-b'],
  initial: { stat_data: { hp: 100 } }, managementMode: 'native'
}] } }
```

`sessionIds:['*']` explicitly allows all sessions in this source service. `initial` may be YAML. A configured `characterId` without `initial` reads the imported card's InitVar entries and declarative schema without fetching scripts. Initialization objects merge in entry order; distinct schema declarations require explicit resolution. Parse failures never overwrite durable content. Source edits and selection changes are not reset commands; a discovered resource retains its original initialization/schema.

The same ID has one current content and CAS revision across authorized sessions. Scope controls access and historical selection, not implicit copies. `copy` creates an independent new ID and retains source/access information. Copies of discoveries remain managed; ordinary explicit resources copy as native. Multiple resources matching a bubble produce `MVU_AMBIGUOUS`; the snapshot endpoint does not guess.

## Host service

Use `ctx.get('tavernMvu')` or optional `ctx.inject(['tavernMvu'], ...)`. Package export `pmp-dsh-tavern/mvu` exposes the service, installation, discovery, parsers and pure update functions.

| Method | Contract |
| --- | --- |
| `list({scope,signal})` | Read authorized resources; global local management uses `{authority:'local'}` (also accepts an empty object) |
| `read({id,scope,signal})` | Null if missing; record includes `id,name,type,authority,scope,content,revision,currentRevision,historical,versionKey,managementMode`, plus optional source/error details |
| `update({id,content,expectedRevision,operationId,scope,signal})` | Current-content CAS edit; identical operation/request is idempotent, conflicting reuse rejected; source schema cannot be removed/replaced, candidate transforms once |
| `copy({id,newId,scope,signal})` | Explicit new entity; existing IDs rejected |
| `history({id,scope,signal})` | Source versions and success/failure evidence for that session |
| `setManagementMode({id,mode,expectedRevision,operationId,scope,signal})` | Persist native/managed mode, with CAS and idempotency |
| `registerUsage(handler)` | Trusted decision hook, returns disposer; request is `{on,id,scope,event,variables,managementMode}` |
| `observe(listener)` | Commit/request facts, returns disposer; listeners do not participate in writes |
| `validateConfig(config)` | Validate `type:'mvu-state'`, triggers and supported strategy chains |
| `discover({definition,sessionId?})` | Trusted Host discovery; stable card identity, managed default and explicit session grant |

Only local authority is accepted. Session reads require a source access grant. Historical reads use messageId or endEventId; combined coordinates must agree. Historical `revision` identifies that snapshot; `currentRevision` is the current entity's CAS revision. Editing historical scope is rejected: explicitly read current scope before editing.

Managed execution without a manager decision fails closed. Handler returns undefined for no configuration, or `{enabled,configRevision?,strategy?,reason?}`. Registration generations bind pending decisions: removal/re-registration cancels them without consuming the durable message. Supported chains:

- Store: `assistant_message_committed`, `parse_mvu_update → validate_update → apply_update`.
- Retrieve: `before_model_request`, `read_content → render_state_and_update_instructions → provide_to_model`.

Strategies are arrays of names or `{operation}` entries. Unsupported parameters fail explicitly. The manager owns whitelist/blacklist/rule evaluation. Store event includes native coordinates, `text` and `containsMvuUpdate`; retrieve includes optional preview/turn/step.

Facts are `{id,eventId,phase,sessionId?,turn?,turnKind?,requestId?,revision?,detail?}`. Phases are started/triggered/applied/skipped/failed/completed. A `state-committed` applied fact requires an actual persistent state change. `dsh-request-observed` requires recorded request assembly to match the actual DSH llm/stream request; it does not claim successful network delivery. Preview/resolution alone is not applied. Global edits omit sessionId rather than inventing one.

## Durable history and requests

Only the last non-interrupted, non-tool-call assistant message of a completed turn is applied. Identity includes session, log version, creation time when available, message ID/sequence, turn/step and end event. Nested forks use the trusted inherited boundary and never replay inherited updates. Recovery checks source references against durable history; missing/changed sources block reads/injection until reconciled.

Commands execute on private candidates. Ordinary schema or missing-path rejection records diagnostics and continues; interpreter budgets, invalid syntax and persistence errors are fatal and do not commit earlier candidates. Accepted candidates persist once atomically. Failures may retain unchanged content with a diagnostic receipt. Duplicate messages do not apply twice.

Request source `tavern.mvu/state` must be explicitly selected in an assembly preset with `role:'system', lifetime:'request'`. It emits stat_data and update instructions with resource/config/strategy version diagnostics. Native DSH messages remain authoritative; unloading does not rewrite them.

## Read-only bubble binding

`GET /pmp-dsh-tavern/api/v1/mvu/snapshot?scope=<JSON>` uses existing Tavern authentication. Host binds `{playthroughId,sessionId,nodeId,variantId,endEventId,sessionFormatVersion?}` against durable timeline and native message evidence. Browser input cannot select arbitrary messageId. Snapshot revision stays historical; currentRevision is the current entity CAS revision.

`createMvuCardBinding({client,scope,signal?,pollMs?})` asynchronously returns `{getSnapshot(),subscribe(listener),dispose()}`. Snapshot is `{version:1,status,scope,revision,variables,resourceId?}`. Variables are the whole object including stat_data/schema. Scope is immutable; polling is bounded, abort cancels initial reads, and disposed bindings reject reads. Rendering owns script callbacks and lifecycle. Ordinary greeting/import/streaming bubbles cannot impersonate durable coordinates. The current empty-session greeting may use only the separate initial mode below.

## Authorized card writes

Code review and variable-write permission are separate. Complete execution-bundle identity is `{version:1,sha256,scope}`. After a trusted settings page reviews that bundle and grants write access, optional `tavernRenderingAuthority.resolve({grantId,sourceIdentity})` returns `{valid:true,write:true,scope}`. Synchronous `isCurrent` must also verify TTL/revocation at the final commit boundary; the Host checks the same service instance remains installed. Missing capabilities deny writes.

`POST /pmp-dsh-tavern/api/v1/mvu/card-binding` accepts `{scope,grantId,sourceIdentity}` and creates a short-lived opaque capability only for the active timeline head/current resource. `POST .../card-write` accepts `{capability,operation:'patch'|'replace',value,expectedRevision,operationId,cause}`. `POST .../card-binding/revoke` revokes it. A write cannot choose another scope. Historical/running messages, expired grants, changed source identity and stale revisions are rejected.

Host primitives are createCardBinding/cardWrite/revokeCardBinding. Client binding accepts `writeGrant:{grantId,sourceIdentity}` and exposes async write; getSnapshot exposes only a writable boolean. Grants/capabilities never enter card code. Host derives CAS from currentRevision and generates operationId. Abort, unload or review changes cancel pending candidates.

Both native and managed card writes require an explicit usage-policy approval; a write grant alone is insufficient. Every deciding usage handler must also return a private trusted Host synchronous `checkCurrent:()=>boolean` lease capturing configuration/reload generations and provider lifetime. After the final await and immediately before persistence, all leases must return exactly true. Missing, asynchronous or stale leases deny the transaction. Functions are never persisted or exposed to scripts. Reload must invalidate leases when it starts; reporting configRevision alone is insufficient.

The separate store event `card_variable_update` uses `validate_card_update → apply_card_update`. Writes default to denied; manager enabled is policy approval only, never a substitute for the source grant. Event includes operation/operationId/expectedRevision/sourceIdentity/cause. Causes are user-interaction, interval and script. Valid-binding permission/policy rejection emits skipped; only actual commit emits applied with configRevision. Invalid capabilities/parameters without a valid resource association return a coded HTTP error rather than fabricating a resource usage event.

The trusted renderer dispatcher derives cause from native isTrusted events/timer tasks; the VM supplies only op/value. The server trusts that authenticated Host UI evidence and cannot independently prove a human clicked in the browser. Code approval does not authorize impersonating a click.

Observed API shapes are `getMvuData(options)` returning whole variables, `updateVariablesWith(JSONPatchArray)` and `await replaceMvuData(variables,options)`. Callback updater signatures remain unverified. VARIABLE_UPDATE_ENDED only promises a no-argument callback after a commit in this binding, followed by a fresh read; it does not claim full upstream payload/event compatibility. Cross-message/latest/chat/character fallbacks cannot silently resolve to the current authorized scope.

## Current empty-session greeting binding

The same snapshot/card-binding/card-write APIs accept the separate scope `{mode:'initial',playthroughId,sessionId,characterId,sessionFormatVersion?}`. It cannot contain nodeId/variantId/endEventId. A session-only management API is not a card capability. Host verifies root-session membership, character selection, empty timeline and one accessible active character resource. The same resource ID remains one current entity shared across authorized sessions; greeting configuration does not implicitly copy it.

Initial binding requires a controlled live DSH session. If unloaded, Host restores only the specified session through public `sessionController.resolveAgent(sessionId)`; inability to restore denies access. Empty conversation history permits DSH startup `sandbox/mode` metadata only; other events and parent/inherited history are rejected. A synchronous lease captures the session instance/header, event generation, membership and that session's selection generation. Starting the first turn or switching the character away and back invalidates old capabilities. Unrelated session selection changes do not invalidate them. Renderer must abort/dispose bindings when leaving or switching sessions/characters, then create a fresh binding on return; old bubbles must never follow current focus.

Initial writes retain the independent grant, policy lease, CAS, idempotency and schema checks. Ledger entries use `source.initial:true` for opening configuration rather than inventing assistant messages. The first completed reply inherits the committed current state. Initial mode reads current content and stops reading/writing after the first turn; source management APIs retain the persisted initial records.

## Schema confirmation for explicit built-in adapters

A trusted rendering adapter may read available snapshot `variables.mvu_schema:{mvuSchema:1,interpreterVersion:1,source}` and compare source exactly with the entire original declaration script selected for substitution. A match means the backend interpreter already handles that declaration. The entire declaration is not executed again in the VM, including initialization and transforms. Missing descriptors, unknown versions and changed sources are rejected. An empty registerMvuSchema function cannot stand in for successful registration. This contract does not provide runtime Zod-object registration or schema hot migration.

The rendering adapter independently verifies remote-module identities/hashes, its default-off substitution setting and visible diagnostics. A descriptor's interpreter version is not an upstream bundle byte identity or evidence that the original bundle ran.

## Compatibility and verification

Core reference: [MagVarUpdate 183d8ade](https://github.com/MagicalAstrogy/MagVarUpdate/tree/183d8ade3b9a3369e824a55cb13b4ddf91aada50), MIT. Small upstream literal fixtures retain their license. mvu_zod is a semantic reference only; no Helper PolyForm Noncommercial implementation or auxiliary execution code is copied. Acorn interprets a bounded declarative AST, without eval, Function, imports or remote fetching.

| Capability | Implementation and boundary |
| --- | --- |
| Initialization | Bounded YAML/JSON5; reject tags/aliases; merge entries in order |
| Commands | set/add/insert/assign/remove/unset/delete; JSONPatch replace/delta/insert/add/remove/move; safe dot/bracket/JSON pointer paths |
| Native metadata | extensible/recursiveExtensible/required, object/array templates, arrayMeta/extension marker; remove by value/index; strict/compatible VWD assignment |
| Schema | object/array/record/enum/literal/union; number/string/boolean/any/unknown; coerce; default/prefault/optional/nullable; min/max/int; strict/passthrough; transform |
| Pure expressions | Arithmetic/comparison/conditions, object spread, constants/locals, input-field assignment, clamp and finite Math functions; static syntax and execution budgets |
| Isolation | Private capability brands; persist bounded source + interpreterVersion, rebuild isolated environments; reject array length writes, object numeric/key coercion and prototype paths |
| Not equivalent yet | Complete mathjs matrices/units; Date construction/arithmetic; upstream path repair and all tolerant parsing; legacy display_data/delta_data text; Helper write signatures beyond those above and mutable event hooks; MVU auxiliary model generation |

Listed schema support is not arbitrary Zod JavaScript support. Method combinations need verification; object-valued coercion is rejected. Current display_data is a result copy and delta_data is an internal change record, not the full legacy UI format. Default instructions request literal JSONPatch; complex generation strategies need their own public contract.

Tests `test/mvu-*.test.mjs` cover neutral structural card fixtures, fixed upstream literals, CAS, forks/history, recovery, adversarial budgets, manager removal and binding cancellation. Set `DSH_TAVERN_PROMPT_COMPAT_ROOT` to a DSH runtime with request assembly support and run `node --test test/mvu-host.test.mjs` for real Host checks with temporary storage and a synthetic provider. Full cards, renderer dependencies and final manager integration require separate verification; interpreter fixtures cannot substitute for them.
