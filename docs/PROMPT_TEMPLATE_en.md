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
| `getwi(book, title)` / `getwi(title)` | Reads selected standalone world-book snapshots by ID/name and entry UID/title; returns original text without recursive template execution |
| `getpreset(name)` | Reads original content by identifier/name in the selected preset |
| `getchar(name?)` | Reads only the selected character's description; upstream's complete default definition format, custom templates and arbitrary character lookup are not implemented |
| `getWorldInfo`, `getPresetPrompt`, `getChara` | Aliases for the above helpers |
| `setvar`, `execute`, other mutation/command APIs | Rejected; no variable persistence, external effects or Host commands |
| Preload, post-generation/render lifecycle, `@INJECT`, libraries, recursive template data arguments | Unsupported and absent from executable event/strategy options |

Upstream [features](https://github.com/zonde306/ST-Prompt-Template/blob/d6f520d149aba146305b0b781ddd691d449c28d2/docs/features.md) and [API reference](https://github.com/zonde306/ST-Prompt-Template/blob/d6f520d149aba146305b0b781ddd691d449c28d2/docs/reference.md) also cover multiple variable scopes, generation/render injection and mutations. This adapter does not establish compatibility with those features. Reading EJS source does not execute it.

`inspectTemplateMetadata({name,content})` recognizes explicit title tags only. `[GENERATE:BEFORE]` and `[GENERATE:AFTER]` suggest `before_model_request` and require a caller-selected assembly position; they do not automatically reproduce ST injection ordering. PRELOAD/RENDER tags return unsupported diagnostics and resources with those titles cannot be enabled. Arbitrary JavaScript branches are never decompiled into outer rules. Inspection does not import or enable a resource.

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

Explicit `sessionIds` are required; `["*"]` selects all sessions. Preview without a session ID does not execute templates. `variableResourceId: "mvu:example"` replaces static variables with the current session's read-only `tavernMvu.read` snapshot. Missing or inaccessible state rejects assembly. This is not a mapping of ST global/local/message scopes and never selects an ambiguous MVU resource. Historical reads use recorded results without evaluation.

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

Both provide `list/read/validateConfig/setManagementMode/registerUsage/observe`, `authority: 'local'` and `strategyOwner: 'source'`. Templates additionally support `update/copy`. World-book content editing uses existing world-book APIs; the manager adapter does not advertise content writes. `read` returns `content/revision/managementMode/execution`. Template content is a string; world-book content is the original resource document.

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

Configuration does not transfer ownership. `setManagementMode({id,mode:'managed'|'native',scope,expectedRevision,operationId,signal})` uses source revision CAS; template `update` also requires revision and operationId. Conflicts do not write. Ownership is atomically persisted; manager unload/restart does not restore native mode. Resource content, outer on/rule and strategy output remain separate.

`registerUsage(handler)` sends `{id,on,scope,event,managementMode}`. Managed execution requires `{enabled:true,configRevision,strategy,checkCurrent}`. Missing decisions, denial, errors, source changes or stale leases block the corresponding output. Sources recheck after their last await and synchronously after all sources resolve. The registry's optional `validateResolved(context)` hook must be synchronous and read-only. Managers must skip generic execution for `strategyOwner:'source'` to prevent duplicate output. These strategy names are declarations, not registered generic manager operations.

An actual `llm/stream` request must match durable `request/assembly` content and include the source node before an `applied` observation is emitted. Preview emits no applied event; applied does not prove network delivery. Template nodes retain original text in `children` and expansion in `text`.

## World-book ownership

Native mode uses existing bindings, keywords, probabilities, budgets and positions. Managed mode still applies only to bound books: Tavern activates each once, then checks manager conditions and leases at the asynchronous source stage. The aggregate source name is never presented as a resource. Character-embedded books remain native, are not listed by this adapter and cannot transfer ownership here; their full management is not implemented.

An old core/loader cannot execute managed policy, so it suppresses managed standalone books with a diagnostic instead of restoring native behavior. Managed books require request lifetime. If an actual request retains a native snapshot, assembly is rejected until the lifetime changes to request, preventing retained content from bypassing revocation. Ownership changes do not bind resources or select assembly strategies. Existing recursion/vector/unsupported-position limitations remain unchanged.

## Isolation and verification

Every template runs in a fresh QuickJS WASM context with detached, frozen JSON and no Host callbacks, native modules, filesystem, network, timers or Agent handles. Limits: 128 Ki characters of source, 2 MiB input, 512 KiB output, 16 MiB VM memory, 256 KiB stack, approximately 75 ms execution budget and 1,000 pending-job steps. Errors fail assembly without overwriting originals. Synchronous execution is interrupted at its budget; cancellation is checked at execution boundaries.

```sh
node --test test/prompt-template.test.mjs
DSH_TAVERN_ASSEMBLY_CORE_ROOT=/path/to/extended-runtime node --test test/request-assembly-host.test.mjs
npm test
npm run verify:2.0
```

Full Host acceptance must explicitly set an isolated documentsDirectory and use authored fixtures plus a synthetic provider. Check single native/managed emission, denial, original/history separation, source revisions, manager unload denial and native continuity after Tavern unload. Real card scripts, providers, full ST lifecycles and the manager UI need separate authorization and evidence; these tests do not establish those scenarios. Keep run evidence under Git-ignored `.local/`.
