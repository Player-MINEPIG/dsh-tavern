# Prompt pipeline and compatibility map

[中文](PROMPT_PIPELINE.md)

This page explains how Tavern resources enter a model request in SillyTavern,
TauriTavern, and Tavern **2.4.0**, and which mappings are unsupported.
DSH turn/step, Inbox, Session, system-assembly, and request/header order are documented
in `DSH_MESSAGE_FLOW_en.md`.

## 1. How SillyTavern assembles one Chat Completion

A SillyTavern preset is not “paste some text at the front”. Its Chat Completion path is roughly:

1. `PromptManager` reads order and enablement from the current character's `prompt_order`. The global Chat Completion order usually uses `character_id: 100001`.
2. `preparePromptsForChatCompletion()` puts preset prompts and runtime-generated semantic blocks into one `PromptCollection`. The latter includes main, character description, personality, scenario, persona, World Info before/after, and similar.
3. `populateChatCompletion()` builds a `MessageCollection` at marker positions and adds ordinary ordered prompts. Absolute/depth injection goes to a specified depth in the conversation messages instead of all becoming system text.
4. Example dialogue and real chat history fill `dialogueExamples` and `chatHistory` markers, and history is trimmed by token budget. Control prompts are added last.
5. `chatCompletion.getChat()` finally produces a real message array with `system`, `user`, `assistant`, `tool` roles, then hands it to a concrete API.

Read-only source evidence (paths relative to the matching upstream checkout):

- `public/scripts/PromptManager.js`: `getPromptOrderForCharacter()` reads character order. Default marker definitions include `worldInfoBefore`, `worldInfoAfter`, `dialogueExamples`, and `chatHistory`.
- `public/scripts/openai.js`: `preparePromptsForChatCompletion()`, `populateChatCompletion()`, `populateChatHistory()`, `populateDialogueExamples()`, and final `getChat()` form the chain above.

Therefore ST preset markers are runtime slots, not text that is sent by itself. Prompt role, absolute position, depth, and token budget can all change the final message topology.

## 2. What TauriTavern changes on this path

TauriTavern's ordinary generation path keeps the upstream SillyTavern frontend and its prompt builder. The main change is host and transport: browser-style `fetch`/`jQuery.ajax` are intercepted and routed to Tauri/Rust, and host capabilities are exposed through `window.__TAURITAVERN__`. Ordinary chat therefore does not rewrite a different preset-ordering algorithm; it tries to let the upstream ST frontend keep producing the same request shape. Official notes: [Frontend Integration](https://tauritavern.github.io/en/architecture/frontend.html) and the [TauriTavern repository](https://github.com/Darkatse/TauriTavern).

TauriTavern's Agent path adds another snapshot boundary:

- `startRunFromLegacyGenerate()` first dry-runs one ST legacy generate;
- captures that turn's final Chat Completion payload and `WORLDINFO_SCAN_DONE` activation result;
- builds a `promptSnapshot` and starts the Agent run;
- the Agent profile then supplies agent system prompt, tool allow-list, Skills, workspace, and submit protocol.

That means the Agent still takes an already-assembled ST message snapshot as input, not merely some preset JSON. Current `preset.mode` only records snapshot or reference information and does not rewrite the snapshot again. See the official [Agent API](https://tauritavern.github.io/en/api/agent.html).

## 3. How dsh-tavern currently compatibilizes

dsh has no ST `PromptManager`, marker collection, or arbitrary history-depth insertion interface. The current implementation is an explicitly limited adapter:

1. On import, preset, character card, and World Info/Character Book are normalized separately, and unknown fields are kept.
2. The loader reads preset, character card, and one user resource from the current session selection. A card's embedded `character_book` automatically becomes a world-info source.
3. The loader projects this claimed batch from public `agent/inbox/spliced`, de-duplicates it with DSH durable user/assistant history by stable message id, and combines them under a bound. The world-info matcher therefore gets this turn's activated entries on the first assembly.
4. The loader composes static prompts, user name/description, character fields, and activated lore at preset markers into ordered `pmp-dsh-tavern:part:*` system sections.
5. DSH itself continues to project user input, history, and tool results from Session. The plugin does not copy `chatHistory`.
6. `temperature`, `maxTokens`, `reasoningEffort`, and `stop` are mapped through `agent/request`. Other ST samplers are stored for now and not claimed as delivered.

Code boundaries match this data flow: `tavern-format` only normalizes ST JSON; `preset` only manages persistence/API/UI; `tavern-loader` executes steps 3–5 and is the root plugin entry. Changing the DSH injection strategy later therefore does not require modifying or reinterpreting the ST parser. Full decisions: `ARCHITECTURE_en.md`.

Step 3 does not use an empty-spin step or a private Inbox. The loader rebuilds a bounded pending queue from the public `agent/inbox/spliced` Session event, holds this batch after the claim-delete splice and before system assembly, and forms `ActivationContext = durable history + claimed messages`. The pure world-book matcher still receives only explicit input and does not know about DSH events. Trace still records the real first-assembly result and does not recompute after the request.

Default system-section order: DSH harness identity (about `-100`) → Agent/deployment persona (about `0`) → dsh-tavern preset (`10`) → `rp:policy` when RP is on (`45`) → tool guidance (`100–199`). Default `rp:policy` only says high-risk operations are locked. It is not play identity. Identity and style still come from the preset / character card.

Advanced “preset only” mode uses `system-prompt/assemble` to replace system sections with the current preset and `rp:policy` (if any), while keeping the assembly's tools, contexts, and variables. It removes model-visible harness identity, persona, and tool text, so Code Mode or structured output may fail. Tool-execution policy, file sandbox, and approval are not turned off by deleting text. The RP lock is still enforced by `tools.guard`. Local DSH reference for this boundary: `@deepseek-ai/dsh-system-prompt/README.zh.md`.

## 4. Is the current mapping complete?

No. What exists is “ST preset static prompt blocks → DSH system section” plus a limited sampler map, not a line-by-line replica of ST message topology.

| ST concept | Current behavior | Completeness |
| --- | --- | --- |
| Ordinary enabled prompts and order | Bodies assemble in order as DSH system sections; official waterfall sections contain only `name`/`text`, while identifier, requested role, and provenance remain in Tavern Trace metadata | Partial; every actual contribution is still system, not a real `user`/`assistant` message role |
| Markers | Fill character fields, before/after lore, and example dialogue. `chatHistory` is owned by native DSH history | Partial; arbitrary real role/depth topology is not supported |
| This turn's user input | Sent by the native DSH session; the plugin does not copy it. Loader `ActivationContext` only lets it participate in activation before the first assembly | First-step activation is wired. It is not inserted into an ST `chatHistory` marker and does not write a fake durable message |
| Conversation history | Replayed from native DSH durable history; the plugin does not copy it | Wired into the request, but without ST token-budget/marker/depth semantics |
| Dialogue examples | Read from the card and emitted as ordinary approximate system text; provenance is recorded in Tavern Trace metadata | Partial; not real user/assistant example messages |
| Absolute/depth injection | Fields are kept; the assembler does not execute them | Not implemented |
| World Info before/after | Card-embedded book and per-session multi-select standalone books use the same matcher and are filled in | Basic before/after is wired; strict depth/outlet still degrades |
| Character description, personality, scenario, first message | The first three enter the profile. First message is greeting-reference only on the first-round generation | Partial; history is not forged, and later turns do not reinject |
| ST macros | Common variables, random, and dice; full ST runtime context is missing | Partial |

Especially: an ST `user`/`assistant` requested role is retained only in model-invisible Tavern Trace `sources[].role` metadata; the official waterfall section itself has no `source.role`. It is not equivalent to sending a real `user`/`assistant` message to the model.

## 5. Current placement of world info and character cards, and unsupported capabilities

The loader expands the logical profile into multiple named system sections and places marker content through one per-request assembly. Current mappings are:

| Resource | Current mapping |
| --- | --- |
| Preset static instruction | Uses named system sections with ST marker anchors in the same assembly |
| Character description/personality/scenario | Enters Tavern system text via preset markers or a stable fallback; does not override DSH Agent persona |
| User name and description | Name resolves `{{user}}`. Description enters `personaDescription`/`{{persona}}` once; missing placement is diagnosed with a stable fallback. Does not override DSH Agent persona |
| World-info entries | Scan durable history and this step's claimed input, and enter the profile at before/after anchors. Strict depth/outlet is unsupported |
| Example dialogue | Ordinary approximate system text; Tavern Trace metadata/diagnostics explain provenance and placement degradation. Real user/assistant example messages are unsupported |
| First message / alternate greeting | First-round generation as greeting-reference. After the first real reply it is no longer injected, and a seed/history message is never created |
| User input and history | Always authoritative from native DSH durable messages. World books scan read-only and are not resent |
| Agent system prompt | Coexists by default and precedes the preset. Advanced replace explicitly accepts the risk of losing tool prompts |

Arbitrary role-message/depth injection is unsupported. Related fields stay stored as-is and are labeled “not yet executed” in the UI. Do not claim full compatibility.

## 6. Why switching presets in the same session can still feel like the old preset

This is expected context leftover, not necessary evidence that “the old preset is still injected directly”. Before each send, the current system prompt is reassembled, so the next request should carry only the current selection. But assistant replies already influenced by the old preset, and later user turns, still sit in durable conversation history. The model can infer old identity, format, or task from that text, so cognitive residue remains.

The reliable clean switch is to choose the new preset and use **New chat with current settings**, or fork from a point where the old preset has not yet produced a reply. The plugin already provides explicit clean-session and configuration-template operations. DSH mode creates or obtains a real blank session through the public New Session seam. Mowan creates or reuses the configured character's authoritative empty playthrough. Both copy only the Tavern selection projection and apply it atomically before navigation. They do not delete, rewrite, hide, or copy old history.
