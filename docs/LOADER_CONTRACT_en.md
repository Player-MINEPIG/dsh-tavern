# Tavern Host and resource contract

[中文](LOADER_CONTRACT.md)

The Tavern bundle entry loads bundled standard Assembler or reuses an independently enabled instance before mounting the service-dependent business loader. Installation order, disabling and removal follow the [integration contract](ASSEMBLER_INTEGRATION_en.md#coexistence-with-standalone-assembler).

This contract covers Tavern **3.0.1**, Assembler **v1.1.0** and DSH **0.2.0-rc.2**. The retained filename reflects the `tavern-loader` module, which still owns resource resolution and Host integration. It no longer describes a single loader owning final request assembly. See [Assembler integration](ASSEMBLER_INTEGRATION_en.md), [request assembly](REQUEST_ASSEMBLY_en.md) and [message flow](DSH_MESSAGE_FLOW_en.md) for strategy and backend behavior.

## Goals and ownership

| Owner | Current responsibility |
| --- | --- |
| Tavern / `TavernProfileLoader` | Session resource selections, normalized preset/card/user/world-book models, activation and resource audit; source-owned MVU, templates and permission checks |
| Independent Assembler | Strategy store and applied snapshots, source/placement-strategy registries, source rendering, module placement, standard delivery and preview |
| Optional core addon | Registers the protocol-1 executor on a prepared Host; advanced request projection and official `request/assembly` evidence |
| DSH | Durable sessions and effective message surface, system/context events, tool execution, call preparation and provider serialization |

```text
Resource stores + SessionSelectionStore + ActivationContext
  → TavernProfileLoader: resolved models / audit / permission leases
  → attachTavern + registered Tavern sources
  → Assembler strategy snapshot
       ├─ native: official sections/context + accepted pre-step messages
       └─ core: optional protocol-1 executor → request/assembly
  → DSH prepared call → provider
```

The loader supplies read-only resources to the shared store/registry/runtime through `attachTavern`; Tavern's compatibility exports forward to the independent package. Format and resource modules do not independently register prompt sections, modify Agent state or copy session history. Source services retain their data and parsing/permission ownership.

For an applied strategy, `TavernProfileLoader.compile()` resolves resources and returns `assemblyInput` rather than pre-rendering a second Tavern profile. Assembler owns module rendering and placement. The loader still provides imported context, optional `rp:policy` and final world-book/MVU permission checks. Without an applied strategy, the retained compatibility path expands the order-10 `pmp-dsh-tavern:profile` anchor into `pmp-dsh-tavern:part:*` sections; `rp:policy` remains order 45. This compatibility renderer is described separately below.

## Session policy

The supported runtime is DSH 0.2.0-rc.2 only. The awaited serial `agent/created` listener freezes or restores selection, reconstructs pending input from public own events, then initializes RP and its read-only sandbox before the Agent is exposed for requests. Initialization failure propagates to registration; it is not downgraded to a warning. Forks, resumes, and delegated agents use the same initialization boundary.

The durable file is `session-selections.json` under the plugin data directory:

```json
{
  "schemaVersion": 2,
  "sessions": {
    "<session-id>": {
      "selection": {
        "presetId": "... or null",
        "characterCardId": "... or null",
        "userId": "... or null",
        "worldBookIds": [],
        "character": {},
        "rp": {
          "active": false,
          "source": null,
          "followSuppressed": false,
          "sandboxBefore": null
        }
      },
      "updatedAt": "2026-08-15T00:00:00.000Z"
    }
  }
}
```

- Old `PresetStore.state.selectedId` remains the compatibility default for a session that is not yet bound.
- The UI splits resource browsing from session binding. Changing the dropdown, importing, or creating only changes the current edit target. Only the explicit bind/unbind buttons write session selection. After UI/API carry `sessionId`, preset selection edits that session only and does not pollute other parallel sessions.
- Presets share the same runtime boundary as character cards/users: changing a binding is rejected while the agent is running. Switching a preset on a session that already has history prompts that only later requests are affected.
- A fresh ordinary session freezes the then-current default selection the first time an Agent uses it.
- An ordinary fork copies the parent selection from `Session.header.parentSession`. After that, parent and child do not stay linked.
- A subagent with `delegationDepth > 0` likewise freezes the parent selection (the same projection as **New chat with current settings**, including `rp`). After that, parent and child do not stay linked. Whether the delegated task is narrowed is decided by the parent agent's spawn prompt, not encoded in `rp:policy` or an empty selection.
- RP is a session overlay on selection, not a DSH agent preset. `selection.rp` records whether it is locked. Optional `rp:policy` text lives in `rp-policy.json`. The default only says high-risk operations are locked.
- When a resource is deleted, loader policy provides `clearResource(kind, id)` to clear every dangling selection.
- Session id is only a JSON key, but it still goes through length/charset checks to avoid prototype keys and abnormal input.
- Schema v1 is migrated in place to v2 on read. Character options keep only the three loader-known greeting/system/PHI fields. Resource ids and per-session world-book counts are bounded.
- Default cap is 2,048 sessions (implementation hard cap 4,096) and 4 MiB of durable state. Old files over 8 MiB never enter `JSON.parse`. Writes validate on a copy and land atomically. Failure does not pollute in-memory state.
- Selections are user intent that must not be dropped silently, so a full capacity rejects new entries instead of copying Trace's LRU. `deleteSession(id)` is an explicit reclaim seam; the current Host has no authoritative session-delete event that can trigger it automatically.

### Running-agent mutation boundary

The current runtime protection is “explicit session-binding write protection”, not a global transaction lock over every resource change. Preset, character-card, user, and standalone world-book selection APIs query the matching agent before writing `SessionSelectionStore`. State `running` returns HTTP 409 with `PRESET_AGENT_RUNNING`, `CHARACTER_AGENT_RUNNING`, `USER_AGENT_RUNNING`, or `WORLD_BOOK_AGENT_RUNNING`. That stops a user from switching those four selections on that session through the normal bind buttons while a turn is executing.

These indirect mutation entries are outside the same protection, so the current contract does not guarantee that “a running Tavern configuration is fully immutable”:

- session-template/configuration apply can overwrite a target session with a complete selection. The normal UI targets a newly created blank session, but the API itself does not yet reject an already-running existing target.
- Deleting a referenced preset, character card, user, or standalone world book calls `clearResource()` and clears one or more session selections without checking each affected agent.
- Editing the body of a currently bound resource does not change the resource ID, but it does change what a later assembly reads.
- Editing a user, preset, or character card's standalone world-book relations may change the effective world-book set of one or more sessions. Today only the relation and resource caps are validated. Those sessions are not checked for running.

A completed system assembly is a frozen snapshot. Resource changes do not write back into durable history and cannot be described as having entered an earlier request. Concurrent edits around assembly retain a timing boundary: body edits and indirect relation changes only guarantee that a later assembly reads the state visible at that time. The current running-state rejection guarantee applies only to the four explicit selection writes above.

### Clean-session/template policy

**New chat with current settings** and configuration templates copy only the selection projection above. They do not call an ordinary fork and do not read or write Session events. DSH mode obtains a real blank session id through public `uiWorkspace.connectWorkspace(workspaceId)`. Mowan first obtains the configured character from the same preview, then calls the shared playthrough-create controller: existing v2 session/directory/timeline/catalog atomic APIs create or reuse that character's authoritative empty playthrough; v1 apply then commits the complete configuration with one `SessionSelectionStore.set(targetId, completeSelection)` and rechecks that the root session's character binding matches the playthrough character. Both modes call public `uiWorkspace.openSession(targetId)` only after success. A configuration with no character card can create only an ordinary DSH session, not a playthrough.

Templates are not rewritten silently when a resource is deleted. Dangling ids for preset, character/greeting, user, or standalone world book are returned as structured diagnostics from preview/apply and block create. A DSH create failure happens before the selection write. An atomic write failure does not publish in-memory state and does not navigate. Templates must not contain durable history, Trace, Inbox, turn/step, runtime state, or resource bodies. RP state is copied with the selection projection.

The character-sidebar new-playthrough path instead creates an independent opening draft with no DSH session until its first accepted send. Draft resource/strategy snapshots and initial MVU are separate from session selections; preview has no native history or unsent input and makes no model call. Existing rooted playthroughs retain their sessions. See [opening drafts](USAGE_en.md).

## Profile safety budget

The resource parser/matcher guards below apply to both paths. Profile-text truncation and `TAVERN_PROFILE_*` diagnostics belong to the compatibility renderer; applied strategies enforce the Assembler budgets in the request-assembly contract.

Request assembly uses `limits.maxProfileBytes` below for logical additional content. Complete system snapshots use a separate fixed 2 MiB physical ceiling. Additional serialized bytes are charged for every projected carrier; loosening the profile limit cannot raise this ceiling, and unchanged native history is not additional overhead. Runtime and preview enforce both limits and reject excess. See the [request assembly contract](REQUEST_ASSEMBLY_en.md#system-contributions-and-complete-dsh-snapshots).

`TavernProfileLoader` applies a default 512 KiB UTF-8 cap to the combined Tavern profile text it generates. `limits.maxProfileBytes` may tighten or loosen it, but the implementation hard cap is 2 MiB. The world-book parser/store share a streaming structure guard before normalize: at most 10,000 entries per resource, depth 32, 100,000 nodes, 1 MiB per string, 1,024 characters per object key. The adapter additionally applies a 10,000-entry hard cap to standalone plus embedded books for this request. A resource that cannot fit is skipped and diagnosed. The combined budget is first-come by a deterministic composition order: session-explicit standalone books, user-bound standalone books, preset-bound standalone books, character-bound standalone books (stable ID de-duplication), then the card's embedded book. Each resource is reserved as a whole; if it cannot fit completely it is not scanned. So when earlier standalone books fill 10,000 entries, the embedded book is skipped with `WORLD_BOOK_RUNTIME_TOTAL_LIMIT`. That is an intentional safety/determinism policy, not a random omission. After those guards, the assembler considers at most the top-ranked 4,096 lore candidates and limits raw lore bodies to twice the profile budget before composing section text. A world book's own `tokenBudget` and `ignoreBudget` only decide ST-compatible candidates. They cannot change any Host hard cap.

When a character card edits an embedded `character_book`, the shared structure guard and parser run first. Raw JSON/PNG import only confirms at the character-format layer that `character_book` is an object, then losslessly keeps unknown fields, and does not run the same depth/node/entry guard before disk. The 32 MiB import cap limits total input. When the loader first consumes it, `parseCharacterBook()` fails closed with `EMBEDDED_WORLD_BOOK_INVALID`; an unrunnable embedded book can enter the library, but it cannot enter the match-amplification path.

If all content exceeds the cap, the assembler keeps the highest-ranked lore-entry prefix that still fits in the original candidate order and reports `TAVERN_PROFILE_LORE_LIMITED`. If it is still over after removing all lore, it throws `TAVERN_PROFILE_TOO_LARGE`. Preset, character fields, or user description are not truncated in the middle.

### Resource-to-world-book relationships

User resources stay strictly `{ id, name, description }`. “User-bound world books” are an independent relation in unified loader policy's `user-world-book-bindings.json`. World-book ids are not written into the description body, and the `user` adapter does not run the matcher itself.

Preset and character standalone world-book relations live in `resource-world-book-bindings.json`, partitioned by owner kind `preset` / `character`. IDs are not added to the ST preset or character-card original. A card's embedded `character_book` stays in the card and exports with it. External relations are a parallel, not exclusive, source.

On each assembly the loader reads the current session's explicit `worldBookIds`, current user relation, current preset relation, and current character relation, de-duplicates by ID, and hands each standalone book to the shared adapter once. The card's embedded book then enters the same adapter. Audit keeps the original `sessionSelection` and `worldBookSelection` explicit/user/preset/character/effective/duplicate IDs. Each world-book resource summary's `bindingSources` keeps every hit source. The active view's `selection.worldBookIds` is the actually effective set, so the launcher can show the real combination.

Unbinding or switching any one resource removes only that source and does not rewrite the others. Deleting a user, preset, or character card clears owner relations and the matching session selections. Deleting a standalone world book clears every relation and session-explicit reference, but does not modify any card's embedded book. The relation store bounds owner count, books per owner, state bytes, and safe reads, and atomically replaces after validating a copy.

## Adapter boundary

`TavernProfileLoader` exposes one singleton adapter slot each for character, user, and world book:

```js
loader.registerCharacterAdapter({
  resolve({ selection, sessionId, agent, conversationText, context }) {
    return { character, diagnostics }
  },
})

loader.registerUserAdapter({
  resolve({ selection, sessionId, agent, conversationText, context }) {
    return { user, diagnostics }
  },
})

loader.registerWorldBookAdapter({
  resolve({ selection, sessionId, agent, conversationText, character, context }) {
    return { loreEntries, resources, diagnostics }
  },
})
```

Constraints:

- Adapters return already-normalized models. They do not return raw ST files as runtime instructions.
- Adapters may read `conversationText` for matching. They do not write the session.
- Adapters do not assemble the DSH system prompt. Applied strategies delegate rendering and placement to Assembler; only the no-strategy compatibility path calls `compileTavernProfile()`.
- Only one adapter per kind. A duplicate registration fails immediately so load order cannot decide behavior.
- A disposer revokes only its own instance and supports HMR.

The character adapter's minimum return model matches the character branch `CharacterCardModel`. The loader currently consumes `id/name/updatedAt/data`. The user adapter returns only `{ id, name, description }`. The world-book adapter at least normalizes activated items to `{ id|uid, content, position: "before"|"after" }`.

### Activation input contract

The loader Host layer's only `PendingInputProjection` rebuilds the queue and this claimed batch from public `agent/inbox/spliced`, then gives adapters a structured, read-only `activationContext`:

```js
{
  messages,             // bounded { id, role, text, source } de-duplicated by stable id
  text,                 // matcher-compatible input under message/character caps
  metadata,             // counts, truncation, claim event seq; no body / body hash
}
```

`conversationText` is a compatibility field derived from `activationContext.text`, not a second state. Adapters consume that value only and do not subscribe to DSH events. Pending queue, claim/cancel decisions, one-shot consume on first assembly, turn-end cleanup, and de-duplication are exclusive to the loader. Default scan is the latest 128 messages / 64 KiB characters; hard caps are 1,024 messages and 1 MiB. Queue retention has its own message/character hard caps. Trace does not persist ActivationContext messages/text. Schema 4 also stores no assembly or source-body copy; it records verifiable official-history references and metadata only.

## Composition semantics

Applied strategies use Assembler v1.1.0 sources and placement algorithms. Standard preserves or adapts roles within native delivery boundaries; advanced supports its explicit request-only projection contract. Consult [request assembly](REQUEST_ASSEMBLY_en.md) and [backend rules](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/BACKENDS_en.md). The subsections below describe **only the retained no-strategy compatibility renderer**, not the default RP assembly strategy.

### Preset-only compatibility

With no character, user, or activated lore, the loader calls `compilePresetForDsh()` directly. It emits enabled non-marker prompt bodies in their original order and preserves sampler mapping and macro behavior. Tavern adds no preset names, IDs, or XML-style identification wrappers to model-visible text; identical tags authored in resource bodies remain literal. A selected resource with no body produces no placeholder header. Official waterfall sections contain only `name` and `text`; prompt identifiers, requested roles, and resource provenance are kept in Tavern Trace metadata.

### Marker ownership

In the compatibility renderer, a selected character or activated lore enables these ST markers:

| Marker / prompt | Loader source | Behavior |
| --- | --- | --- |
| `main` | character `systemPrompt` | May override the preset; supports `{{original}}`. `forbid_overrides` keeps the preset |
| `worldInfoBefore` | active before lore | Emitted at that marker; stable fallback if the marker is missing |
| `charDescription` | character description | Emitted once; fallback if the marker is missing |
| `charPersonality` | character personality | Emitted once; fallback if the marker is missing |
| `scenario` | character scenario | Emitted once; fallback if the marker is missing |
| `personaDescription` | user description | Emitted once. `{{persona}}` may be an explicit placement. Missing marker/macro is diagnosed with a stable fallback |
| `worldInfoAfter` | active after lore | Emitted at that marker; fallback if the marker is missing |
| `dialogueExamples` | character message example | Emitted as ordinary approximate system text; provenance is recorded only in Tavern Trace metadata |
| `chatHistory` | DSH Session | Marker is consumed but not emitted. DSH durable history is always the only authority |
| `jailbreak` | character PHI | May override the preset; supports `{{original}}`. Position approximation is reported explicitly |

Each character field, user description, and lore position is consumed at most once. `{{user}}` uses the name of the user bound to the current session. The user description may also use existing name/character macros. A user resource does not change the DSH Agent persona or identity section. Creator notes never enter the profile. Turning off the character system/PHI switch truly suppresses the field. It is not moved to fallback and sent by accident.

### Honest degradation

- Greeting contributes plain system text only on the first-round generation. After the first real assistant reply it is no longer injected, and it is never forged as assistant history.
- PHI lives in the Tavern system profile and is not claimed to sit strictly after all history.
- The character module preserves depth-prompt role/depth fields. The current loader can only place the body in an ordinary system fallback and reports that real depth/role semantics were not executed.
- `user`/`assistant` preset prompt roles remain reviewable in Tavern Trace `sources[].role` metadata. Official waterfall sections themselves contain only `name` and `text`; every actual contribution is still a system section, not a real history-message role.
- System assembly scans durable history plus this step's claimed batch, so the current input of a single-step session can hit on the first request. The implementation does not use a too-late `agent/pre-step` and does not read a private Inbox.
- Trace must describe the actually frozen assembly. It must not rerun the matcher on current input after `agent/pre-step` or `request/header` and label that result as having entered this turn's system. Because there is no same-step reassembly seam, the claimed batch must enter the matcher via the `agent/inbox/spliced` projection before the first assembly.

## Preset parameter admission and fallback

Preset sampling remains stored as authored. At `agent/request`, the Host merges supported preset overrides and uses public `llm.resolveCallConfig` for preflight. Unsupported preset reasoning effort is omitted so the adapter can supply its default; no alternative effort name is guessed.

After an explicit invalid/unsupported parameter rejection, `agent/request-error` may request a native DSH retry only before any output and while not aborted. It omits only an active preset override among `temperature`, `maxTokens`, `reasoningEffort`, and `stop`, each at most once, with at most four runtime retries. Other plugins' parameters and unrelated authentication, quota, or network errors are not fallback candidates. The prepared request is not mutated and its middleware continuation is not replayed. Trace records requested/effective parameter maps and each omission; effective values come from the actual `llm/stream` boundary after DSH defaults.

## Audit boundary

`TavernProfileLoader.compile()` returns resolved `assemblyInput`, macro context, resource summaries, diagnostics and resource-selection audit. With an applied strategy or `resolveOnly` preview, `systemText` and profile sections are empty: this is resource resolution, not a missing final request. Without a strategy, they contain the compatibility profile. `callConfig` proposes supported preset sampling fields; admission/fallback can change the effective overrides.

Assembler records the chosen strategy and source/placement metadata. Tavern Trace combines that metadata with resource decisions and verified official-history references; it does not persist another source-body or message-history copy. Standard actual requests are reconstructed from the recorded native request references; advanced requests reference DSH's `request/assembly`. The latest-only actual endpoint and current preview cannot reconstruct an older request.

In V4, `system/message` and runtime-context `user/message` own standard prompt bodies; `request/header` owns final tools/config. Advanced `request/assembly` freezes the sent array without replacing durable history. Coordinate compatibility and explicit offline upgrades are covered by [migration](DSH_0.1.7_MIGRATION_en.md); supported current Host remains rc.2.

## Adapter integration invariants

1. Resource modules own normalized documents and selection intent; register each resource adapter once and return read-only models.
2. Tavern assembler adapters register through the shared Assembler source registry. Rendering and placement follow the applied strategy; never add a second Host assembler for the same resource.
3. World-book standalone/embedded content shares one parser/matcher and activation projection. Source permissions and leases are checked again before use.
4. MVU owns initialization, schemas, state instances, durable-event commits and scoped card permissions. Source resolution and preview do not commit variable updates. See [MVU](MVU_en.md).
5. Uninstall disposers revoke only their registrations/provider/leases, preserving resources and DSH sessions. Legacy exports and service aliases forward to the shared implementation.

## Verification

Use the affected resource, loader, native/advanced assembly, MVU and Trace tests plus isolated Host checks in [developer verification](TESTING_en.md). Marker/system fallback tests establish compatibility-renderer behavior; they do not establish standard role delivery or advanced request projection. Inspect recorded request evidence for those backends.
