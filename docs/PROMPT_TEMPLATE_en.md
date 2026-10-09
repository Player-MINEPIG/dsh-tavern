# Prompt templates and managed sources

[中文](PROMPT_TEMPLATE.md)

Tavern Prompt Template is a separate, limited, read-only request assembly source. It is not Session Template and does not install or execute the SillyTavern extension. A resource's `content` remains its authored source. Expansion enters the assembler and DSH `request/assembly`; it never replaces the resource or native history. Templates run only when their source is explicitly selected in an assembly strategy.

## Upstream and support matrix

The reference is [zonde306/ST-Prompt-Template](https://github.com/zonde306/ST-Prompt-Template/tree/d6f520d149aba146305b0b781ddd691d449c28d2), whose [manifest](https://github.com/zonde306/ST-Prompt-Template/blob/d6f520d149aba146305b0b781ddd691d449c28d2/manifest.json) reports 1.17.9 and whose [license](https://github.com/zonde306/ST-Prompt-Template/blob/d6f520d149aba146305b0b781ddd691d449c28d2/LICENSE) is AGPL-3.0. This implementation neither copies nor links that extension's code. It uses an independently written tag compiler and the project's existing QuickJS dependency. EJS-style syntax support does not establish full extension compatibility.

| Capability | Current behavior |
| --- | --- |
| `<% code %>`, `<%- expression %>`, `<%= expression %>` | JS conditions, loops, local functions, promises/await; the last form escapes HTML |
| `<%# … %>`, `-%>`, `_%>`, `<%% … %>` | Comments, newline/whitespace trimming, literal tags |
| `print(...values)` | Bounded text output without resource mutation |
| `variables`, `getvar(path, {defaults, clone, scope})` | Frozen JSON snapshot; dot, numeric and quoted bracket paths; only cache scope; clone does not expose writable state |
| `getwi(book, title)` / `getwi(title)` | Matches selected standalone or embedded books by ID/name and entry UID/title; requires that book’s prompt-use authorization and returns only entries activated in this request, without recursive evaluation |
| `getpreset(name)` | Reads original content by identifier/name in the selected preset |
| `getchar(name?)` | Reads only the selected character's description; upstream's complete default definition format, custom templates and arbitrary character lookup are not implemented |
| `getWorldInfo`, `getPresetPrompt`, `getChara` | Aliases for the above helpers |
| `setvar`, `execute`, other mutation/command APIs | Rejected; no variable persistence, external effects or Host commands |
| Preload, post-generation/render lifecycle, `@INJECT`, libraries, recursive template data arguments | Unsupported and absent from executable event/strategy options |

Upstream [features](https://github.com/zonde306/ST-Prompt-Template/blob/d6f520d149aba146305b0b781ddd691d449c28d2/docs/features.md) and [API reference](https://github.com/zonde306/ST-Prompt-Template/blob/d6f520d149aba146305b0b781ddd691d449c28d2/docs/reference.md) also cover multiple variable scopes, generation/render injection and mutations. This adapter does not establish compatibility with those features. Reading EJS source does not execute it.

`inspectTemplateMetadata({name,content})` recognizes title tags and consecutive leading `@@` decorators. `[GENERATE:BEFORE]` and `[GENERATE:AFTER]` suggest `before_model_request` and require a caller-selected assembly position; they do not automatically reproduce ST injection ordering. `PRELOAD`, `RENDER`, `InitialVariables`, indexed/regex `GENERATE`, and `@INJECT` return unsupported diagnostics. All official decorators (including preload/render, generate, initial_variables, if, activate, private, iframe and preprocessing) are recognized but not executed. Unknown decorators also reject. Resources requesting these unimplemented semantics cannot be enabled; the `@@@` escape does not declare a decorator. Arbitrary JavaScript branches are never decompiled into outer rules. Inspection does not import or enable a resource.

## Resource configuration

On first start, plugin configuration `promptTemplates.resources` seeds resources. Thereafter, storageDir's `prompt-templates.json` is authoritative. Stop/restart the Host for manual file edits; startup arguments never overwrite an existing file. The editor updates only `content`; enablement, session binding and variable providers belong to resource configuration. Copies start disabled.

```json
{
  "promptTemplates": {
    "resources": [{
      "id": "prompt-template:scene",
      "name": "Scene prompt",
      "content": "Location: <%- getvar('scene.location', { defaults: 'unset' }) %>",
      "enabled": true,
      "sessionIds": ["example-session"],
      "variables": { "scene": { "location": "inn" } }
    }]
  }
}
```

Explicit `sessionIds` are required; `["*"]` selects all sessions. Preview without a session ID does not execute templates. `variableResourceId: "mvu:example"` replaces static variables through `tavernMvu.resolvePromptDependency` only when the template actually accesses `getvar` or `variables`. This acquires the resource’s prompt-use snapshot and lease. Missing capability, inaccessible state or policy denial rejects assembly. Unused variables do not trigger an MVU read. This is not a mapping of ST global/local/message scopes and never selects an ambiguous MVU resource. Historical reads use recorded results without evaluation. Raw editor reads do not grant prompt-use permission; there is no raw-read fallback.

Explicitly add a rule to the assembly strategy JSON:

```json
{"id":"scene-template","kind":"pmp-dsh-tavern/prompt-template","enabled":true,"role":"system","lifetime":"request","depth":null,"text":"","name":"Scene template"}
```

Place it at the desired position and apply the strategy. Built-in strategies do not implicitly add this source, and saved applied snapshots are not modified. The template source supports request lifetime only.

## Public manager contract

The Host service `tavernMemorySources` exposes `{protocolVersion:1, adapters:[...]}`. Resource adapters and the request-source catalog are distinct:

| Resource adapter | Stable resource ID | Assembly source | Strategy chain |
| --- | --- | --- | --- |
| `tavern.prompt-templates` | `prompt-template:<id>` | `pmp-dsh-tavern/prompt-template` | `prompt_template.expand` → `prompt_template.emit` |
| `tavern.world-books` | `world-book:<library ID>` | `worldbook` | `worldbook.activate` → `worldbook.emit` |

Both provide `list/read/validateConfig/setManagementMode/registerUsage/observe`, `authority: 'local'` and `strategyOwner: 'source'`. Templates additionally support `update/copy`. World-book content editing uses existing world-book APIs; the manager adapter does not advertise content writes. `read` returns `content/revision/managementMode/execution`. Template content is a string; world-book content is the resource document. Embedded books use `world-book:character:<character ID>:embedded-world-book`, expose `origin.kind: "embedded-character-book"` and the owning character ID, and share identity with native activation’s `character:<character ID>:embedded-world-book`.

The JSON `optionCatalog` contains `version/types/events/strategies/presets/modes`. Only retrieve at `before_model_request` and the complete fixed chains above are selectable; store is explicitly unsupported. Preset IDs are `builtin:prompt-template-retrieve` and `builtin:worldbook-retrieve`, without identity, whitelist or implicit permissions. Callers can compose scope/rule conditions freely. Additional execution capabilities require trusted plugin registration; configuration files do not inject Host JavaScript.

```json
{
  "id": "prompt-template:scene",
  "adapterId": "tavern.prompt-templates",
  "type": "prompt-template",
  "whitelist": [{"sessionId":"example-session"}],
  "blacklist": [],
  "retrieve": {
    "on": "before_model_request",
    "rule": {"all":[true,{"not":false}]},
    "strategy": [{"operation":"prompt_template.expand"},{"operation":"prompt_template.emit"}]
  }
}
```

Actual ownership follows the trusted Host registration: native without a manager, managed while registered, and source defaults after removal. `storedManagementMode` preserves older preferences; CAS setManagementMode does not claim current delegation. Content edits and policy overrides remain separate.

`registerUsage(handler,{providerId:'dsh-memory-manager'})` sends `{id,on,scope,event,managementMode}`. Managed execution requires `{enabled:true,configRevision,strategy,checkCurrent}`. Missing decisions, denial, errors, source changes or stale leases block the corresponding output. Sources recheck after their last await and synchronously after all sources resolve. The registry's optional `validateResolved(context)` hook must be synchronous and read-only. Managers must skip generic execution for `strategyOwner:'source'` to prevent duplicate output. These strategy names are declarations, not registered generic manager operations. Generic handlers without this marker do not claim delegation, but their explicit denials remain effective. `getManagementDefaults({id,scope?})` exposes the fixed source chain and a synchronous source-bound lease; configuration contains only type/retrieve.

For an active sessionless opening preview, the world-book source may add `previewScope: {characterId?,presetId?,userId?}` to its defaults snapshot. This Host-only proof binds the selected resource; `checkCurrent()` also checks draft revision, selection, resource revision and source lifetime. The Manager uses this scope only in source callbacks with `event.preview === true` and no sessionId. It creates no fake session or persisted wildcard grant; local/preset whitelists, blacklists, disabled sources and retrieve rules still apply. Ordinary library inspection provides no proof. Older Managers may still deny opening previews when they do not recognize this optional field and need updating together with Tavern.

An actual `llm/stream` request must match durable `request/assembly` content and include the source node before an `applied` observation is emitted. Preview emits no applied event; applied does not prove network delivery. Template nodes retain original text in `children` and expansion in `text`.

## World-book ownership

Native mode uses existing bindings, keywords, probabilities, budgets and positions. Managed mode still applies only to bound books: Tavern activates each once, then checks manager conditions and leases at the asynchronous source stage. The aggregate source name is never presented as a resource. Embedded books are individually listed, with actual ownership following the same registration lifecycle. Only the selected character’s book participates in a request; its entries still activate once through the native path. Existing character-world-book APIs retain content editing ownership.

Native and new assembly use the same asynchronous policy filter after one activation. Managed world books require request lifetime; retained native snapshots cannot bypass current revocation. Source defaults do not bind resources or add assembly rules. Existing recursion, vector and position limitations remain.

## Template dependency usage

Trusted Host code creates dependency requests from actual helper reads; templates cannot grant permissions. The target source sends `{id,on:"before_model_request",scope,event,managementMode}`. `event.usage` is `prompt-template-dependency` and `event.consumer` identifies the real `{adapterId,id}` of the template. Consumer identity is condition context only: it does not lend its whitelist or permission. The dependency must pass its own ownership, configuration, scope, rule and fixed strategy. Managed dependencies with disabled retrieval, denied by policy, or lacking permission from a registered manager reject; they never fall back to native/raw access. With no handlers, native dependencies retain source permission; every installed handler must explicitly permit native dependency use with a revocable lease rather than abstaining with undefined. This does not apply managed configuration or transfer ownership, and ordinary native assembly is unchanged.

Source `resolvePromptDependency` returns Host-only `{id,adapterId,content,revision,configRevision,checkCurrent}`. The VM never receives the lease. MVU follows its own read-only request strategy. World books reuse this request’s native activation and verify content revision, providing only already activated entries without repeating probability rolls. Accordingly, `getwi` cannot import an entry excluded by activation; this differs from upstream’s arbitrary entry imports.

The template collects leases only for used resources. It synchronously rechecks its own and every dependency’s versions, policy and selection after awaits, after rendering, and after all assembly sources resolve. Catching a lookup failure or forging a VM result cannot bypass external authorization. `TAVERN_MEMORY_DEPENDENCY_VERSION` diagnostics associate the consumer and dependency revision; world-book observations verify the final template node. Raw configuration editing is separate from the evaluation context.

## Isolation and verification

Templates run in isolated QuickJS WASM contexts without native modules, filesystem, network, timers or Agent handles. A synchronous lookup bridge only records a request or returns authorized JSON; it performs no I/O. A trusted source authorizes new dependencies outside the VM, then a fresh VM replays the read-only template. No raw card/preset document, world-book body or MVU editor snapshot is prefetched into the context. Limits: 128 Ki characters of source, 2 MiB input, 512 KiB output, 16 MiB VM memory, 256 KiB stack, a bounded forward tag scan, approximately 75 ms cumulative compilation and VM execution time, 1,000 pending-job steps per pass, 32 new lookups and 512 bridge calls. Recursive template evaluation remains unsupported; repeated dependency lookups and loops are bounded. Errors fail assembly without overwriting originals. Synchronous execution is interrupted at its budget; cancellation is checked at execution boundaries.

```sh
node --test test/prompt-template.test.mjs
DSH_TAVERN_ASSEMBLY_CORE_ROOT=/path/to/extended-runtime node --test test/request-assembly-host.test.mjs
npm test
npm run verify:2.0
```

Full Host acceptance must explicitly set an isolated documentsDirectory and use authored fixtures plus a synthetic provider. Check single native/managed emission, denial, original/history separation, source revisions, manager removal restoring source defaults and native continuity after Tavern unload. Real card scripts, providers, full ST lifecycles and the manager UI need separate authorization and evidence; these tests do not establish those scenarios. Keep run evidence under Git-ignored `.local/`.
