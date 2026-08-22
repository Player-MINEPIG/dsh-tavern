# Unified Tavern loader contract

[中文](LOADER_CONTRACT.md)

Status: 2026-08-18. Includes the RP session overlay (`selection.rp` + `rp:policy`) and delegated subagents freezing the parent selection. This is the runtime contract between resources and the loader, not a README.

## Goals and ownership

The loader is the only layer allowed to decide how current resources enter a DSH request. Format modules only interpret files. Use-case modules only manage resources. They must not register `systemPrompt`, mutate the Agent, copy conversation history, or write the model request themselves.

```text
PresetModel ─────────────┐
CharacterCardModel ──────┼─> TavernProfileLoader ─> one Tavern profile section
UserModel ────────────────┤             │
WorldBookModel + matches ┘             │
                                       ├─> agent/request call config
SessionSelectionStore ─────────────────┘
```

The current root plugin registers two system sections: `pmp-dsh-tavern:profile` (order 10) and optional `rp:policy` (order 45, content only when RP is on and the text is non-empty). Preset `replace` mode keeps both sections. It will not leave only the preset and silently drop character, world-book, or RP-lock text.

## Session policy

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
- Selections are user intent that must not be dropped silently, so a full capacity rejects new entries instead of copying Trace's LRU. `deleteSession(id)` is a reclaim seam prepared for a future authoritative DSH session-delete event. The current Host does not expose that event.

### Running-agent mutation boundary and known gaps

The current runtime protection is “explicit session-binding write protection”, not a global transaction lock over every resource change. Preset, character-card, user, and standalone world-book selection APIs query the matching agent before writing `SessionSelectionStore`. State `running` returns HTTP 409 with `PRESET_AGENT_RUNNING`, `CHARACTER_AGENT_RUNNING`, `USER_AGENT_RUNNING`, or `WORLD_BOOK_AGENT_RUNNING`. That stops a user from switching those four selections on that session through the normal bind buttons while a turn is executing.

These indirect mutation entries are not yet under the same protection. Review and later implementation must not describe current behavior as “a running Tavern configuration is fully immutable”:

- session-template/configuration apply can overwrite a target session with a complete selection. The normal UI targets a newly created blank session, but the API itself does not yet reject an already-running existing target.
- Deleting a referenced preset, character card, user, or standalone world book calls `clearResource()` and clears one or more session selections without checking each affected agent.
- Editing the body of a currently bound resource does not change the resource ID, but it does change what a later compile reads.
- Editing a user, preset, or character card's standalone world-book relations may change the effective world-book set of one or more sessions. Today only the relation and resource caps are validated. Those sessions are not checked for running.

A completed system assembly is a frozen snapshot. Resource changes do not write back into durable history and must not be dressed up as already having entered an old request. Concurrent edits around assembly still have a timing boundary. A strict mode needs a loader-owned unified mutation guard: resolve every affected session from a direct session id or reverse resource reference, atomically confirm none is running, then commit. For body-only edits, the product must also choose “reject while running” or “save succeeds but only the next turn is guaranteed”. Current targeted tests cover the reject paths of preset, character-card, and user selection hooks. World books are wired but still need a direct running-state regression. Templates and the indirect paths above need their own tests.

### Clean-session/template policy

**New chat with current settings** and configuration templates copy only the selection projection above. They do not call an ordinary fork and do not read or write Session events. DSH mode obtains a real blank session id through public `workspaces.connectWorkspace(workspaceId)`. Mowan first obtains the configured character from the same preview, then calls the shared playthrough-create controller: existing v2 session/directory/timeline/catalog atomic APIs create or reuse that character's authoritative empty playthrough; v1 apply then commits the complete configuration with one `SessionSelectionStore.set(targetId, completeSelection)` and rechecks that the root session's character binding matches the playthrough character. Both modes call public `sessions.open(targetId)` only after success. A configuration with no character card can create only an ordinary DSH session, not a playthrough.

Templates are not rewritten silently when a resource is deleted. Dangling ids for preset, character/greeting, user, or standalone world book are returned as structured diagnostics from preview/apply and block create. A DSH create failure happens before the selection write. An atomic write failure does not publish in-memory state and does not navigate. Templates must not contain durable history, Trace, Inbox, turn/step, runtime state, or resource bodies. RP state is copied with the selection projection.

## Profile safety budget

`TavernProfileLoader` applies a default 512 KiB UTF-8 cap to the single `pmp-dsh-tavern:profile` section it generates. `limits.maxProfileBytes` may tighten or loosen it, but the implementation hard cap is 2 MiB. The world-book parser/store share a streaming structure guard before normalize: at most 10,000 entries per resource, depth 32, 100,000 nodes, 1 MiB per string, 1,024 characters per object key. The adapter additionally applies a 10,000-entry hard cap to standalone plus embedded books for this request. A resource that cannot fit is skipped and diagnosed. The combined budget is first-come by a deterministic composition order: session-explicit standalone books, user-bound standalone books, preset-bound standalone books, character-bound standalone books (stable ID de-duplication), then the card's embedded book. Each resource is reserved as a whole; if it cannot fit completely it is not scanned. So when earlier standalone books fill 10,000 entries, the embedded book is skipped with `WORLD_BOOK_RUNTIME_TOTAL_LIMIT`. That is an intentional safety/determinism policy, not a random omission. After those guards, the compiler considers at most the top-ranked 4,096 lore candidates and, before generating wrappers, limits raw lore bodies to twice the profile budget. A world book's own `tokenBudget` and `ignoreBudget` only decide ST-compatible candidates. They cannot change any Host hard cap.

When a character card edits an embedded `character_book`, the shared structure guard and parser run first. Raw JSON/PNG import currently only confirms at the character-format layer that `character_book` is an object, then losslessly keeps unknown fields, and does not run the same depth/node/entry guard before disk. The 32 MiB import cap limits total input. The first time the loader consumes it, `parseCharacterBook()` still fails closed and reports `EMBEDDED_WORLD_BOOK_INVALID`, so the match-amplification path is blocked. This remains an import-time defense-in-depth gap: an ultimately unrunnable embedded book can enter the library first. Later work should add import-time structure diagnostics or a reject policy for a normalized runtime copy without breaking unknown-field retention on the current document.

If all content exceeds the cap, the compiler keeps the highest-ranked lore-entry prefix that still fits in the original candidate order and reports `TAVERN_PROFILE_LORE_LIMITED`. If it is still over after removing all lore, it throws `TAVERN_PROFILE_TOO_LARGE`. Preset, character fields, or user description are not truncated in the middle.

### Resource-to-world-book relationships

User resources stay strictly `{ id, name, description }`. “User-bound world books” are an independent relation in unified loader policy's `user-world-book-bindings.json`. World-book ids are not written into the description body, and the `user` adapter does not run the matcher itself.

Preset and character standalone world-book relations live in `resource-world-book-bindings.json`, partitioned by owner kind `preset` / `character`. IDs are not added to the ST preset or character-card original. A card's embedded `character_book` stays in the card and exports with it. External relations are a parallel, not exclusive, source.

On each compile the loader reads the current session's explicit `worldBookIds`, current user relation, current preset relation, and current character relation, de-duplicates by ID, and hands each standalone book to the shared adapter once. The card's embedded book then enters the same adapter. Audit keeps the original `sessionSelection` and `worldBookSelection` explicit/user/preset/character/effective/duplicate IDs. Each world-book resource summary's `bindingSources` keeps every hit source. The active view's `selection.worldBookIds` is the actually effective set, so the launcher can show the real combination.

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
- Adapters do not assemble the DSH system prompt. Final placement, override, de-duplication, and degradation diagnostics are decided by `compileTavernProfile()`.
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

`conversationText` is a compatibility field derived from `activationContext.text`, not a second state. Adapters consume that value only and do not subscribe to DSH events. Pending queue, claim/cancel decisions, one-shot consume on first assembly, turn-end cleanup, and de-duplication are exclusive to the loader. Default scan is the latest 128 messages / 64 KiB characters; hard caps are 1,024 messages and 1 MiB. Queue retention has its own message/character hard caps. Trace stores only body-free metadata, not `messages` or `text`.

## Composition semantics

### Preset-only compatibility

With no character, user, or activated lore, the loader calls the already-accepted `compilePresetForDsh()` directly. Output shape, sampler mapping, and macro behavior stay the same so unification itself does not regress presets.

### Marker ownership

After a character is selected or lore is activated, the unified compiler consumes these ST markers:

| Marker / prompt | Loader source | Behavior |
| --- | --- | --- |
| `main` | character `systemPrompt` | May override the preset; supports `{{original}}`. `forbid_overrides` keeps the preset |
| `worldInfoBefore` | active before lore | Emitted at that marker; stable fallback if the marker is missing |
| `charDescription` | character description | Emitted once; fallback if the marker is missing |
| `charPersonality` | character personality | Emitted once; fallback if the marker is missing |
| `scenario` | character scenario | Emitted once; fallback if the marker is missing |
| `personaDescription` | user description | Emitted once. `{{persona}}` may be an explicit placement. Missing marker/macro is diagnosed with a stable fallback |
| `worldInfoAfter` | active after lore | Emitted at that marker; fallback if the marker is missing |
| `dialogueExamples` | character message example | Emitted as source-labeled approximate system content |
| `chatHistory` | DSH Session | Marker is consumed but not emitted. DSH durable history is always the only authority |
| `jailbreak` | character PHI | May override the preset; supports `{{original}}`. Position approximation is reported explicitly |

Each character field, user description, and lore position is consumed at most once. `{{user}}` uses the name of the user bound to the current session. The user description may also use existing name/character macros. A user resource does not change the DSH Agent persona or identity section. Creator notes never enter the profile. Turning off the character system/PHI switch truly suppresses the field. It is not moved to fallback and sent by accident.

### Honest degradation

- Greeting becomes `<st-character-field name="greeting-reference">` only on the first-round generation. After the first real assistant reply it is no longer injected, and it is never forged as assistant history.
- PHI lives in the Tavern system profile and is not claimed to sit strictly after all history.
- Depth-prompt format duties for role/depth stay in the character module. The loader's first phase can only put them in an explicitly labeled system fallback.
- `user`/`assistant` preset prompt roles remain reviewable labels, not real history-message roles.
- System assembly scans durable history plus this step's claimed batch, so the current input of a single-step session can hit on the first request. The implementation does not use a too-late `agent/pre-step` and does not read a private Inbox.
- Trace must describe the actually frozen assembly. It must not rerun the matcher on current input after `agent/pre-step` or `request/header` and label that result as having entered this turn's system. Because there is no same-step reassembly seam, the claimed batch must enter the matcher via the `agent/inbox/spliced` projection before the first assembly.

## Audit boundary

`TavernProfileLoader.compile()` returns:

- `systemText`: the Tavern profile that actually enters `request/header.system`;
- `callConfig`: supported fields actually proposed through `agent/request`;
- `resources`: summaries of preset, character, user, and world book resolved this run;
- `diagnostics`: missing resources and placement degradation;
- `audit`: session selection, resources, activated lore IDs, and SHA-256 fingerprint.

DSH's own `request/header` remains the final authority for what the model actually received. Loader audit is for UI/API to explain why this input was produced. It cannot replace the DSH header and does not add a private session event.

## Integration checklist

Before merging a character-card branch:

1. store/API/UI maintain only character documents and selection intent;
2. migrate or bridge session selection onto `SessionSelectionStore.characterCardId/character`;
3. provide the model through `registerCharacterAdapter()`;
4. delete that branch's own Host system section/profile compiler;
5. verify with marker, replace, dual-session, fork, subagent, and request-header tests.

Before merging a world-book branch:

1. keep parser/matcher as pure logic;
2. return activated entries and diagnostics through `registerWorldBookAdapter()`;
3. card-embedded `characterBook` and standalone WorldBookModel enter the same matcher; do not reimplement;
4. do not register a system context/section yourself;
5. give deterministic tests for scan window, regex, recursion, and budget.

Before merging a user-resource branch:

1. store documents are strictly `id/name/description`; reject avatar and unknown fields;
2. `SessionSelectionStore.userId` is the only session-binding owner;
3. hand off through `registerUserAdapter()` to the unified loader; do not register a Host seam;
4. marker, macros, fallback, and description de-duplication are executed only by `compileTavernProfile()`;
5. verify dual session, live switch, restart, unbind, delete cleanup, and a single final profile output.

## Current acceptance

- Preset-only output and model parameters do not regress.
- Two sessions may choose different presets, or explicitly choose “no preset”.
- Ordinary forks and delegated subagents both inherit a snapshot of the parent selection (including RP state) and then stay unlinked.
- Marker fill, character override, `{{original}}`, lore before/after, and chatHistory-not-copied all have unit tests.
- `replace` removes only host system sections and keeps tools, contexts, variables, and the complete Tavern profile.
- The API active view exposes selection/resources/diagnostics/audit and does not expose the full `compiledPrompt`.
- Character-card APIs use unified session policy. Old `character-state.json` bindings migrate one way and are then cleared so unbind + restart cannot resurrect them.
- V1/V2/V3 JSON and PNG cards can enter the profile through the adapter. Creator notes are not sent.
- A card's embedded `character_book` uses the shared world-book parser/matcher. Hits enter the same profile.
- Standalone world books are provided by the `world-book-library` use-case layer as a document store, CRUD/export API, and management UI. Per-session zero/one/many bindings still write loader-owned `SessionSelectionStore.worldBookIds`.
- Selected standalone books and the card's embedded `characterBook` are run by the same world-book adapter through the same parser, matcher, rank, probability, and budget contract, then merged into the profile.
- Deleting a standalone book clears dangling ids from every session through `clearResource("world-book", id)`. It does not read, modify, or unbind a character card or its embedded book.
- User CRUD/API/UI, per-session single binding, `{{user}}`/`{{persona}}`, the `personaDescription` marker, and diagnostic fallback are wired.
- The user panel can save zero or more standalone world books per user. The loader composes with stable order “session explicit first, user relation next”, de-duplicating. The active view/launcher/Trace publish the actually effective set.
- User relations are independently atomically persisted, with caps on user count, books per user, state bytes, and safe reads. Deleting a user or world book clears the matching relation without deleting other users or session-explicit selections.
- The world-book panel can save zero or more standalone world books for the current preset and character. Relations do not pollute ST originals. The loader composes with stable de-duplication in order “session, user, preset, character, character embedded”.
- A bound card with no `character_book` can create an empty embedded book in the world-book panel and save it through the existing card embedded-book API. Standalone relations and the embedded book each keep their export semantics.
- No local third-party preset, character-card, or world-book fixture has been copied.
