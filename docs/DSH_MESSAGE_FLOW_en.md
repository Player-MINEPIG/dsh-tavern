# DSH and dsh-tavern (DT) message flow

[中文](DSH_MESSAGE_FLOW.md)

This page defines the current message contract for Tavern **2.4.3** on DSH
`0.1.7-rc.1`: native DSH flow, DT flow, DT interception points, and one complete model
step. V4 system prompts enter the effective surface through `system/message`, while
`request/header` retains config/tools. Trace schema 4 persists metadata and official
Session references only; [API v3](PROMPT_API_V3_en.md) verifies bodies on demand.

The Tavern Host adapter calls the session/workspace/directory-picker controllers explicitly.
History pins an inclusive `throughSeq` with `inspect()` and completes the same snapshot with
`page()`. In-process reads use `session.seq`, `snapshotEvents()`, and `ownEvents()`.
Coordinate and migration rules are in the [upgrade guide](DSH_0.1.7_MIGRATION_en.md).

`DT` here is short for `dsh-tavern`. SillyTavern (ST) is the resource format and part of the semantics DT compatibilizes. It is not the product identity of this plugin or its UI.

## 1. Native DSH flow

Without DT installed, an ordinary DSH `0.1.7-rc.1` agent step follows this sequence:

```text
User submit
  │
  ▼
Agent Inbox (next-turn / next-step)
  │  insert/edit/cancel and claim record agent/inbox/spliced
  ▼
systemPrompt.assemble(agent scope)
  ├─ collect and sort system sections, runtime contexts, tools, variables
  └─ run system-prompt/assemble; project the proposed runtime-context snapshot
  │
  ▼
agent/pre-step waterfall accepts, replaces, or rejects proposed messages
  │
  ▼
step/start → agent/request waterfall → prepareCall() validates config and binds the adapter
  │
  ▼
DSH admits the frozen assembly and accepted input
  ├─ system sections → official system/message
  └─ accepted user and runtime-context messages → user/message (once per step)
  │
  ▼
request/header records config + tools; request/context records adapter context
  │
  ▼
Session.deriveMessages() produces the frozen effective message array
  │
  ▼
PreparedLlmCall.stream(request) reaches llm/stream
  ├─ live agent/assistant-stream frames
  ├─ durable assistant/message or assistant/attempt settlement retains the stream
  └─ tool-call → tool-role tool/result → perhaps the next step
```

The current request has four authoritative input classes:

| Channel | Authoritative source | Final destination |
| --- | --- | --- |
| System and runtime context | official `system/message` / context `user/message` produced by `systemPrompt.assemble()` | LLM request `messages` |
| Conversation history | effective message surface from `Session.deriveMessages()` | LLM request `messages` |
| Tools | tools from system assembly | LLM request `tools` and `request/header.tools` |
| Model parameters | `agent/request` waterfall | provider/model/temperature call config and `request/header.config` |

Key facts:

- Inbox `claim`s current input before system assembly, but that input is not yet an ordinary
  Session `user/message`. Inserts, replacements, cancellation, and claim first persist public
  `agent/inbox/spliced` events. DT rebuilds a bounded queue from those events and obtains the
  claimed batch after the claim-delete event and before system assembly.
- DSH calls public `agent/pre-step` after system assembly. The hook sees claimed messages but
  cannot rewrite the frozen assembly.
- `Session.deriveMessages()` projects system, context, user, assistant, and tool content from
  the effective message surface. Turn/step boundaries and streaming chunks do not become
  duplicate model messages.
- `agent/request` owns call config only. It neither creates history nor replaces frozen system
  assembly.
- In V4, effective `system/message` is the system-body authority and the corresponding
  `user/message` snapshot is context-body authority. `request/header` records final config and
  tools; it does not store system bodies.
- `llm/stream` receives final runtime messages/tools/config. Observing that hook can verify the
  actual request shape but does not create a second durable history.

V4 uses producer-owned message sources: `system-prompt` for system messages and `runtime-context` for context snapshots. Tool results carry role `tool`, a top-level `toolCallId`, and direct content; they are not user messages wrapping a `tool-result` content block. Tavern keeps native roles and event ownership intact.

`prepareCall()` binds a prepared adapter call before model-visible messages are admitted. Retries rebuild through the public request boundary; they do not replay a middleware continuation or mutate an already prepared request. Live `agent/assistant-stream` frames settle into official `assistant/message` or `assistant/attempt` events, rather than separate durable `assistant/chunk` rows.

Code check locations:

- `@deepseek-ai/dsh-agent-loop/lib/index.js`: `preStep()`, `turn()`, `step()`, `buildRequest()`;
- `@deepseek-ai/dsh-system-prompt/lib/index.js`: `SystemPrompt.assemble()`;
- `@deepseek-ai/dsh-session/lib/index.js`: `Session.deriveMessages()`;
- `@deepseek-ai/dsh-llm/README.zh.md`: messages, call config, `request/header`, and `llm/stream`.

### 1.1 Why playthrough branching does not use message-surface replacement

A DSH Session keeps both an append-only event log and a model-visible message surface. Surface replacement does not delete original events. It appends a new message node that obscures a contiguous range on the current surface. The replacement node itself is still a current-surface node, so it can be replaced again later. The already-obscured original user, assistant, and tool events stay in the local Session log for transcript, audit, and recomputation.

That capability is still not a reversible ST-style history-reorg interface:

- A later replacement can only target nodes still visible on the current surface. There is no `unreplace` that makes old nodes visible in place again.
- One replacement is “contiguous range → one new message”. It cannot atomically restore several alternating user/assistant messages.
- `agent/request` only changes call config. There is also no public per-request history waterfall that can return an arbitrary `messages[]` without writing Session.
- Carrying a whole RP conversation in one user checkpoint would lose native role, tool-call/result, and per-message action boundaries. Copying the original into several new messages would create a second durable history and need extra atomicity and concurrency protocol.
- Native DSH compaction also uses the same surface replacement. If DT also used it as a branch tree, two different meanings would contend for one model-visible surface.

Therefore DT swipe, same-playthrough rollback, and new-playthrough branch use public DSH session branch/fork to create continuation sessions instead of rewriting the original session surface. Each branch has natively explainable DSH history, tool pairing, request headers, and independent compaction. Native **Chat**, other plugins, and Host after uninstall still work as ordinary DSH sessions. Tavern timeline stores only pointers to those authoritative messages, parent variants, and the active head. It composes a playthrough tree from several sessions and does not forge or copy history bodies.

Current DSH provides neither an arbitrary request-time `messages[]` history projection nor atomic multi-message surface replacement. DT system/context injection therefore is not history replacement, and strict ST role/depth projection is outside the current capability.

## 2. DT's own flow

DT separates resource management from runtime assembly. Frontend and API are the control plane and do not send messages to the model directly. The loader is the runtime data plane.

### 2.1 Control plane: import, edit, and session binding

```text
DT orb / resource sidebar
  │
  ▼
/pmp-dsh-tavern/api/v1/*
  │
  ├─ PresetStore
  ├─ CharacterStore
  ├─ WorldBookStore
  ├─ UserStore
  ├─ SessionSelectionStore
  │    └─ preset / character / world books / user explicitly bound to the current session
  └─ UserWorldBookBindingStore
       └─ zero or more standalone world books bound to each user
```

- Imported ST presets, character cards, and world books first pass their format adapters, then enter the plugin library after normalization. Unknown compatibility fields do not participate in DSH session history.
- Create, edit, delete, and bind change only DT resources or selection state. Unbound resources do not enter the prompt.
- Ordinary forks and delegated subagents both freeze the parent session's resource selection at that moment. Whether the delegated task is narrowed is decided by the parent agent's spawn prompt.
- UI red/green dots mean “whether the current session is bound to a resource”, not whether a world book hit this turn.

### 2.2 Accepted data plane: assemble bound resources into one runtime snapshot

```text
SessionSelectionStore
  │
  ├─ preset adapter ───────────────┐
  ├─ character adapter ────────────┤
  ├─ user adapter ─────────────────┼─ TavernProfileLoader.compile()
  └─ world-book adapter ───────────┘          │
       ├─ standalone world books               ├─ systemText
       ├─ card-embedded character_book         ├─ runtimeContexts
       └─ matcher scans history + this claimed input
                                                ├─ supported callConfig
                                                ├─ resources / diagnostics
                                                └─ audit + fingerprint
```

Assembly rules:

1. The loader resolves preset, character card, user profile, standalone world books, and the card's embedded book per session. Session-explicit world books win; world books bound to the current user are then appended and de-duplicated by ID.
2. The world-book matcher scans public `Session.deriveMessages()` history and this step's claimed input from `PendingInputProjection`, de-duplicates stably, and defaults to at most the latest 64 KiB. It runs ordinary primary keys, secondary keys, probability, groups, and budget. Native JavaScript regex is blocked by default to avoid ReDoS.
3. The unified assembler places character fields, user name/description, and hit lore at preset markers. `{{user}}` uses the current user name. Description is consumed once via `personaDescription`/`{{persona}}`. The `chatHistory` marker does not copy DSH history. Creator notes are not sent.
4. The result is an unmixable runtime snapshot: `systemText`, supported `callConfig`, resource summaries, diagnostics, world-book decisions, and an audit fingerprint.
5. New v1 audit and v3 assembly metadata share one schema 4 record. The llm/stream result persists only hashes/references; detail cold-reads official history and verifies section/context bodies. `source.text` is not stored. Old v1/schema 3 files remain read-only compatibility inputs during normal Host use; the explicit offline upgrade can update verified audit coordinates with backups.

## 3. What DT changes in the DSH flow

DT does not replace the agent loop and does not keep a second conversation history. It adds through public DSH extension points:

| DSH extension point | DT action | Effect on the final request |
| --- | --- | --- |
| `agent/created` | Initialize selection, reconstruct pending input, then initialize RP and its read-only sandbox in the awaited serial listener | Completes before the first request; initialization failures fail Agent registration |
| `systemPrompt.section` | Register the `pmp-dsh-tavern:profile` anchor (order 10) and `rp:policy` (order 45) | Give the waterfall this Tavern assembly and optional RP-lock text |
| `system-prompt/assemble` | Expand the logical profile anchor into ordered `pmp-dsh-tavern:part:*` sections and append import runtime contexts independently; advanced replace keeps only those parts and `rp:policy` | Determines the official system/context messages for this step, without changing ordinary history or tool-execution permissions |
| `agent/pre-step` | Commit a pending RP-boundary switch and pin the read-only sandbox again | Does not change messages. Changing chat-bar permissions cannot unlock RP before the next step |
| `tools.guard` | When RP is on, reject high-risk tools and `agent.cancel` | Does not enter execution. The alert dialog is recorded on the parent session (including when a child agent violates) |
| `agent/request` | Merge preset parameters, preflight them with public `llm.resolveCallConfig`, and start Trace | Unsupported preset effort is omitted for the adapter default; stored presets and messages remain unchanged |
| `llm/stream` | Verify the complete system message and establish official system/context event references | Copies no bodies; v3 detail can cold-read and verify official history |
| `session/event` | Align older Trace formats with request events; if RP is on and `sandbox/mode` is seen, pin read-only again | Adds only plugin audit metadata. Chat-bar permission changes cannot unlock RP |
| `agent/request-error` | Record explicit preset-parameter rejection and, when eligible, request bounded DSH retry | Omits only the rejected active preset override before any output; no retry after cancellation or for unrelated errors |
| Web server / client slots | Provide protected resource APIs, the `DT` orb, sidebar, and Tavern Trace view | Control plane and visualization. Do not enter the prompt directly |

Preset fallback changes only this request's overrides. Unsupported preset reasoning effort is omitted during public config preflight so the adapter supplies its default; no effort alias is invented. An explicit invalid/unsupported parameter rejection before any output may omit the active preset's `temperature`, `maxTokens`, `reasoningEffort`, or `stop`, once per field and at most four runtime retries. Cancellation, emitted output, and unrelated authentication, quota, or network errors do not trigger Tavern fallback. DSH owns retry execution; Trace retains requested/effective parameters and the reason for each omission. Stored preset documents remain unchanged.

The loader handles public `agent/inbox/spliced` through `session/event`, building a `PendingInputProjection` that does not persist bodies. That projection affects only world-book activation. It does not change final DSH messages.

In default append mode, native DSH system sections remain and the waterfall expands DT's logical profile into ordered `pmp-dsh-tavern:part:*` sections. When RP is on and `rp:policy` is non-empty, the order-45 lock text is inserted too. Advanced replace removes other model-visible system sections and keeps only those DT parts and `rp:policy`. Import runtime context remains an independent context contribution. Tools, other runtime contexts, variables, sandbox, approval, and execution-layer safety stay managed by DSH. RP rejects a further subset of tools on top of that and cannot be unlocked with the chat-bar permission chip.

DT explicitly does not:

- Delete, rewrite, or copy DSH durable history. Final `messages` still come from `Session.deriveMessages()`.
- Dress static preset blocks labeled user/assistant as real history messages.
- Forge greeting as assistant history. On the first round it is ordinary system text, with provenance recorded in Tavern Trace metadata.
- Override DSH Agent identity. A user profile only supplies a Tavern user name and description.
- Send creator notes.
- Bypass DSH tool permissions, sandbox, or approval. RP additionally blocks some high-risk tools. List: `RP_SECURE_MODE_en.md`.
- Write forged Trace, unknown events, or a second conversation record into Session.

## 4. Complete flow with DT installed

The control plane stores resources and Session selection. One model step reads that state only through loader/Host seams:

```text
[Before the request: DT control plane]
User imports/edits resources in the DT UI
  → /pmp-dsh-tavern/api/v1/*
  → plugin resource library
  → SessionSelectionStore saves the current Session binding

[One model step]
User submit
  │
  ▼
DSH Agent Inbox
  │ claim current input; the public delete splice lets DT retain that batch
  ▼
DSH systemPrompt.assemble(agent scope)
  │
  ├─ collect native DSH system sections / contexts / tools / variables
  │
  ├─ call DT's pmp-dsh-tavern:profile contribution
  │    ├─ read this Session's resource selection
  │    ├─ resolve preset / character / user / world books
  │    ├─ matcher scans deriveMessages() + this step's de-duplicated claimed batch
  │    ├─ assemble character fields, user description, and hit lore at markers
  │    └─ expand to ordered pmp-dsh-tavern:part:* sections; retain call-config/audit metadata
  │
  └─ system-prompt/assemble waterfall
       ├─ append: keep DSH sections and add DT sections/contexts
       └─ replace: model-visible system sections keep only DT parts and rp:policy; capabilities and execution-layer limits remain
  │
  ▼
DSH agent/pre-step accepts/replaces/rejects claimed input and proposed context
  │
  ▼
DSH step/start → agent/request
  ├─ DSH/other plugins produce base call config
  ├─ DT merges preset overrides and preflights adapter support
  └─ Trace starts the shared schema 4 record from assembly metadata
  │
  ▼
DSH prepareCall() validates config and binds the adapter
  │
  ▼
DSH commits system/message and, on the first attempt, accepted user/context messages
  │
  ▼
DSH records request/header and request/context, then derives frozen effective messages
  │
  ▼
PreparedLlmCall.stream reaches llm/stream with final messages / tools / config
  └─ Trace verifies official event references and captures actual effective parameters
  │
  ▼
assistant stream / tool calls
  ├─ live frames settle into durable assistant/message or assistant/attempt with the stream
  ├─ tool results stay managed by DSH
  └─ the next step/turn reassembles; DT does not cache a second chat history
```

The current model request simplifies to:

```text
request.messages = DSH effective message surface
  ├─ native + DT official system/message
  ├─ official runtime-context user/message snapshots
  └─ durable user / assistant / tool messages
request.tools    = DSH assembly tools
request.config   = DSH/adapter config + DT-mappable preset parameters
request/header  = durable audit event for config + tools
```

Append/replace changes only which system sections enter effective messages. Official DSH
surfaces and waterfalls still own messages, tools, and config. New Trace records store no
section/context/system-message/source body copies; they retain metadata, hashes, and official
logical-event references. Detail cold-inspects official history and verifies recoverable
section/context bodies on demand.

## 5. Current ActivationContext boundary

The current DSH order is:

```text
claim current input
  → assemble and freeze the system prompt
  → agent/pre-step only then publishes claimed messages
  → agent/request / prepareCall
  → commit system/message and accepted user/context messages
  → request/header / deriveMessages
```

Current DT scans a bounded `ActivationContext` during system assembly:

- Keyword already in history: this step can hit and inject.
- Keyword only in the just-submitted current input: the first assembly of this step can hit.
- Unbind a character card or standalone world book: the next assembly no longer reads it, but old assistant text already influenced by it remains history.

Tavern Trace scan cannot merely be delayed to `agent/pre-step`, `agent/request`, or `request/header`. Those hooks can see current input, but system is already frozen. A late scan would let Trace show “hit this turn” while the same-step official `system/message` actually lacked that lore — a false audit. DT therefore records the assembly that actually participated in the request and does not dress a later deduction up as this-turn activation.

The public order the implementation uses:

```text
agent/inbox/spliced (insert message)
  → loader projects the next-turn / next-step queue
  → claim produces a delete splice (outcome is not canceled)
  → loader holds this claimed batch
  → systemPrompt.assemble
  → ActivationContext = durable history + claimed batch
  → world-book matcher
  → this step's real Tavern sections / Trace metadata candidate
```

That path is implemented and keeps these constraints:

- `PendingInputProjection` exists only in the loader Host layer. format, world-book, character, user, and UI do not each subscribe to or copy Inbox state.
- Insert, replace, cancel, steer, next-step, and queued next-turn are handled exactly from the splice's `target/start/removedCount/inserted/outcome`.
- Current-input bodies are only bounded in-memory match input. They are not written to DT resources, selection, or Tavern Trace. DSH's own durable inbox event remains the source of authority.
- After assembly completes, cancel, exception, or agent/session end, the claimed batch is cleared. Messages that already entered history on the next step must not be spliced again.
- Trace records the participating assembly metadata at `agent/request`, then establishes body-verified official-history references at `llm/stream`. It does not rerun the matcher afterwards.
- It does not read a private Agent Inbox, append `user/message` early, add an empty-spin model request, or dress lore as an extra user message.

## 6. How to review a real request

From most trusted to least:

1. Official DSH `system/message` and context `user/message`: prompt bodies that actually entered this request's effective message surface.
2. Durable DSH `request/header`: final tools and effective call config.
3. Matching `Session.deriveMessages()`: the final effective message array.
4. Tavern Trace: explains the DT resources, world-book decisions, and official references for this turn/step, and verifies recoverable bodies on detail read.
5. Loader `/pmp-dsh-tavern/api/v1/active?sessionId=...`: current selection, resources, diagnostics, and a preview that does not include claimed current input.
6. DT sidebar: resource-edit and binding control plane, not a model-request log.

Tavern Trace sits in a public `conversation.view` slot sibling to Conversation / Trajectory. It is a minimized explanation layer over the actual loader snapshot. It replaces neither official messages nor `request/header`, and it does not enter model context.

## 7. Why clean sessions and UI settings do not enter the message flow

**New chat with current Tavern settings** and configuration templates are explicit control-plane transactions:

```text
Preview the current selection or template
  → DSH mode: uiWorkspace.connectWorkspace() returns a real blank session
    Mowan: reuse the shared playthrough controller for the previewed character, create or reuse the authoritative empty playthrough
  → loader writes the complete Tavern selection atomically
  → Mowan read-back-validates that the session character matches the playthrough character
  → DSH uiWorkspace.openSession() navigates
```

Templates store only resource IDs/options for preset, character/greeting switches, user, standalone world books, and the RP overlay. They do not read or copy durable messages, Tavern Trace, Inbox, claimed input, turn/step, or resource bodies. Mowan requires that projection to include a character card. DSH mode allows an ordinary session with no card. If any resource is already missing, preview and apply return diagnostics and block navigation, so a “half-applied” Tavern combination is not left behind.

Language, scale, and **Follow character into RP** are likewise control-plane state. They write only global `ui-settings.json` and act on the Tavern browser root. They do not enter profile assembly, the world-book matcher, `agent/request`, or `request/header`. Optional `rp:policy` text writes `rp-policy.json` and enters a system section only when RP is on.
