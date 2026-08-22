# DSH and dsh-tavern (DT) message flow

[中文](DSH_MESSAGE_FLOW.md)

Status: the message-flow baseline was checked on 2026-08-18 against the public README and installed source of local `@deepseek-ai/dsh 0.1.0-rc.6`. The 2.0 release candidate ran automated regression and install verification against DSH rc.8 on 2026-08-22, but later sections are not presented as a new full upstream source audit. This page describes the native DSH flow, DT's own flow, how DT inserts into DSH, and one complete model step after DT is installed. It is not a README.

`DT` here is short for `dsh-tavern`. SillyTavern (ST) is the resource format and part of the semantics DT compatibilizes. It is not the product identity of this plugin or its UI.

## 1. Native DSH flow

Without DT installed, an ordinary agent step runs in this order:

```text
User submit
  │
  ▼
Agent Inbox (next-turn / next-step)
  │  Insert/edit/cancel all record agent/inbox/spliced
  │  Claiming the pending messages records another delete splice
  ▼
systemPrompt.assemble(agent scope)
  ├─ Collect and sort native system sections
  ├─ Collect runtime contexts
  ├─ Collect tools and variables
  └─ Run the system-prompt/assemble waterfall
  │
  ▼
Render the assembly as system and runtime-context messages
  │
  ▼
agent/pre-step waterfall
  └─ Accept, replace, or reject this step's claimed messages
  │
  ▼
Session appends the accepted user/message
  │
  ▼
Session.deriveMessages() produces this step's history messages
  │
  ▼
agent/request waterfall produces the LLM call config
  │
  ▼
Record request/header (final config + system + tools)
  │
  ▼
llm.stream({ system, messages, tools, ...config })
  │
  ├─ assistant/chunk durable events
  ├─ assistant/message enters Session history
  └─ tool-call → tool result → maybe the next step of the same turn
```

DSH's four data channels are independent:

| Channel | Authoritative source | Final destination |
| --- | --- | --- |
| System prompt | `systemPrompt.assemble()` | LLM request `system` |
| Conversation history | `Session.deriveMessages()` | LLM request `messages` |
| Tools | tools from system assembly | LLM request `tools` |
| Model parameters | `agent/request` waterfall | provider/model/temperature and other call config |

Key facts:

- Inbox `claim`s current input first, but when system assembly runs, that input has not yet been appended as a Session `user/message` and is not in the public assembly context.
- Every Inbox insert, replace, cancel, and claim first persists a public `agent/inbox/spliced` Session event. `Session.append()` synchronously notifies `session/event` observers, then Inbox mutates the live queue. DT rebuilds a bounded pending queue from that event and obtains the claimed messages after the claim-delete event and before system assembly starts.
- DSH calls public `agent/pre-step` only after system assembly. The hook can see claimed messages, but the assembly it receives is already frozen.
- `Session.deriveMessages()` projects user, assistant, and tool results from the durable message surface. Turn/step boundaries and streaming chunks do not become duplicate model messages.
- `agent/request` owns only call config. It does not generate history and cannot replace a frozen system assembly.
- `request/header` stores the actually effective config, system, and tools. It is the authoritative record of that step's model request header.

Local check locations:

- `@deepseek-ai/dsh-agent-loop/lib/index.js`: `preStep()`, `turn()`, `step()`, `buildRequest()`;
- `@deepseek-ai/dsh-system-prompt/lib/index.js`: `SystemPrompt.assemble()`;
- `@deepseek-ai/dsh-session/lib/index.js`: `Session.deriveMessages()`;
- `@deepseek-ai/dsh-llm/README.zh.md`: messages, call config, and `request/header` contract.

### 1.1 Why playthrough branching does not use message-surface replacement

A DSH Session keeps both an append-only event log and a model-visible message surface. Surface replacement does not delete original events. It appends a new message node that obscures a contiguous range on the current surface. The replacement node itself is still a current-surface node, so it can be replaced again later. The already-obscured original user, assistant, and tool events stay in the local Session log for transcript, audit, and recomputation.

That capability is still not a reversible ST-style history-reorg interface:

- A later replacement can only target nodes still visible on the current surface. There is no `unreplace` that makes old nodes visible in place again.
- One replacement is “contiguous range → one new message”. It cannot atomically restore several alternating user/assistant messages.
- `agent/request` only changes call config. There is also no public per-request history waterfall that can return an arbitrary `messages[]` without writing Session.
- Carrying a whole RP conversation in one user checkpoint would lose native role, tool-call/result, and per-message action boundaries. Copying the original into several new messages would create a second durable history and need extra atomicity and concurrency protocol.
- Native DSH compaction also uses the same surface replacement. If DT also used it as a branch tree, two different meanings would contend for one model-visible surface.

Therefore DT swipe, same-playthrough rollback, and new-playthrough branch use public DSH session branch/fork to create continuation sessions instead of rewriting the original session surface. Each branch has natively explainable DSH history, tool pairing, request headers, and independent compaction. Native **Chat**, other plugins, and Host after uninstall still work as ordinary DSH sessions. Tavern timeline stores only pointers to those authoritative messages, parent variants, and the active head. It composes a playthrough tree from several sessions and does not forge or copy history bodies.

If DSH later provides a public request-time history projection (frozen native history in, this-request-only `messages[]` out) or atomic multi-message surface replacement, RP mode can add an optional strict ST projection strategy without changing the original Session. Until then, DT system/context injection must not be advertised as history replacement.

## 2. DT's own flow

Inside DT, resource management and runtime compile are separate first. Frontend and API are the control plane and do not send messages to the model directly. The loader is the runtime data plane.

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

### 2.2 Accepted data plane: compile bound resources into one runtime snapshot

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

Compile rules:

1. The loader resolves preset, character card, user profile, standalone world books, and the card's embedded book per session. Session-explicit world books win; world books bound to the current user are then appended and de-duplicated by ID.
2. The world-book matcher scans public `Session.deriveMessages()` history and this step's claimed input from `PendingInputProjection`, de-duplicates stably, and defaults to at most the latest 64 KiB. It runs ordinary primary keys, secondary keys, probability, groups, and budget. Native JavaScript regex is blocked by default to avoid ReDoS.
3. The unified compiler places character fields, user name/description, and hit lore at preset markers. `{{user}}` uses the current user name. Description is consumed once via `personaDescription`/`{{persona}}`. The `chatHistory` marker does not copy DSH history. Creator notes are not sent.
4. The result is an unmixable runtime snapshot: `systemText`, supported `callConfig`, resource summaries, diagnostics, world-book decisions, and an audit fingerprint.
5. Tavern Trace persists only minimized metadata from that snapshot and its association with the final `request/header`. It does not store full system text, message bodies, resource bodies, or tool schemas.

## 3. What DT changes in the DSH flow

DT does not replace the agent loop and does not keep a second conversation history. It adds through public DSH extension points:

| DSH extension point | DT action | Effect on the final request |
| --- | --- | --- |
| `agent/session-start` | Establish or restore the agent's session resource selection; pin the read-only sandbox when RP is on | Decides which DT resources this session may load, and whether the RP lock is on |
| `systemPrompt.section` | Register `pmp-dsh-tavern:profile` (order 10) and `rp:policy` (order 45) | Contribute the compiled Tavern profile and optional RP-lock text to system assembly |
| `system-prompt/assemble` | Append DT runtime contexts; advanced replace may keep only the DT profile and `rp:policy` | Changes final `system`/context, not history or tool-execution permissions |
| `agent/pre-step` | Commit a pending RP-boundary switch and pin the read-only sandbox again | Does not change messages. Changing chat-bar permissions cannot unlock RP before the next step |
| `tools.guard` | When RP is on, reject high-risk tools and `agent.cancel` | Does not enter execution. The alert dialog is recorded on the parent session (including when a child agent violates) |
| `agent/request` | Merge call-config fields the DSH preset explicitly supports; hand the just-finished assembly snapshot to Trace | May change temperature/maxTokens/reasoningEffort/stop and similar. Does not change messages |
| `session/event` | Align Trace with `request/header`; if RP is on and `sandbox/mode` is seen, pin read-only again | Adds only plugin audit metadata. Chat-bar permission changes cannot unlock RP |
| `agent/request-error` | Mark the matching Trace attempt as failed | Does not change model input |
| Web server / client slots | Provide protected resource APIs, the `DT` orb, sidebar, and Tavern Trace view | Control plane and visualization. Do not enter the prompt directly |

Besides request/header alignment, the existing `session/event` observer is also used exclusively by the loader for public `agent/inbox/spliced`, building a `PendingInputProjection` that does not persist bodies. That projection affects only world-book activation. It does not change final DSH messages.

In default append mode, native DSH system sections still exist and the DT profile joins assembly as a new section. When RP is on and `rp:policy` is non-empty, the order-45 lock text is inserted too. Advanced replace removes other sections from model-visible system text and keeps only the DT profile and `rp:policy`. Tools, runtime contexts, variables, sandbox, approval, and execution-layer safety stay managed by DSH and are not turned off. RP then rejects a further subset of tools on top of that and cannot be unlocked with the chat-bar permission chip.

DT explicitly does not:

- Delete, rewrite, or copy DSH durable history. Final `messages` still come from `Session.deriveMessages()`.
- Dress static preset blocks labeled user/assistant as real history messages.
- Forge greeting as assistant history. Today it is only source-labeled reference content.
- Override DSH Agent identity. A user profile only supplies a Tavern user name and description.
- Send creator notes.
- Bypass DSH tool permissions, sandbox, or approval. RP additionally blocks some high-risk tools. List: `RP_SECURE_MODE_en.md`.
- Write forged Trace, unknown events, or a second conversation record into Session.

## 4. Complete flow after the accepted DT is installed

The following merges already-saved control-plane resource selection with one real model step:

```text
[Before the request: DT control plane]
User imports/edits resources in the DT UI
  → /pmp-dsh-tavern/api/v1/*
  → plugin resource library
  → SessionSelectionStore saves the current session binding

[One model step]
User submit
  │
  ▼
DSH Agent Inbox
  │ claim current input; the public delete splice lets DT hold that batch
  ▼
DSH systemPrompt.assemble(agent scope)
  │
  ├─ Collect native DSH system sections / contexts / tools / variables
  │
  ├─ Call DT's pmp-dsh-tavern:profile section
  │    ├─ Read this session's resource selection
  │    ├─ Resolve preset / character / user / world books
  │    ├─ Matcher scans deriveMessages() + this step's de-duplicated claimed batch
  │    ├─ Compose markers, character fields, user description, and hit lore
  │    └─ Cache this systemText / callConfig / audit snapshot
  │
  └─ system-prompt/assemble waterfall
       ├─ append: keep DSH sections and add DT profile/contexts
       └─ replace: keep only the DT profile section; capability and execution-layer limits remain
  │
  ▼
DSH renders and freezes this step's system assembly
  │
  ▼
DSH agent/pre-step
  └─ Now publicly claims current input; accept/replace/reject messages
  │
  ▼
DSH Session appends the accepted user/message
  │
  ▼
DSH Session.deriveMessages() produces the final history messages
  │
  ▼
DSH agent/request
  ├─ DSH/other plugins produce the base call config
  └─ DT merges supported preset parameters and lets Trace capture the assembly that actually ran
  │
  ▼
DSH prepareCall() validates and freezes model config
  │
  ▼
DSH records request/header (final config + system + tools)
  └─ DT aligns Trace to header seq and summary through session/event
  │
  ▼
The LLM receives:
  ├─ system = DSH sections +/or DT profile
  ├─ messages = DSH durable history + this step's accepted input
  ├─ tools = tools from DSH system assembly
  └─ config = DSH base config + DT-supported preset parameters
  │
  ▼
assistant stream / tool calls
  ├─ chunks and the complete assistant message are persisted by DSH
  ├─ tool results stay managed by DSH
  └─ the next step/turn reruns the assembly above; DT does not cache a second chat history
```

The final model request simplifies to:

```text
request.system   = native DSH system sections (append mode) + DT-compiled Tavern profile
request.messages = DSH Session.deriveMessages()
request.tools    = DSH assembly tools
request.config   = DSH/adapter config + DT-mappable preset parameters
```

In replace mode only the first line differs: `request.system = DT-compiled Tavern profile`. The other three authoritative channels stay the same.

## 5. Current ActivationContext boundary

The current DSH order is:

```text
claim current input
  → assemble and freeze the system prompt
  → agent/pre-step only then publishes claimed messages
  → append user/message
  → agent/request / request/header
```

Current DT scans a bounded `ActivationContext` during system assembly:

- Keyword already in history: this step can hit and inject.
- Keyword only in the just-submitted current input: the first assembly of this step can hit.
- Unbind a character card or standalone world book: the next assembly no longer reads it, but old assistant text already influenced by it remains history.

Tavern Trace scan cannot merely be delayed to `agent/pre-step`, `agent/request`, or `request/header`. Those hooks can see current input, but system is already frozen. A late scan would let Trace show “hit this turn” while actual `request/header.system` lacked that lore — a false audit. DT therefore records the assembly that actually participated in the request and does not dress a later deduction up as this-turn activation.

The public order the implementation uses:

```text
agent/inbox/spliced (insert message)
  → loader projects the next-turn / next-step queue
  → claim produces a delete splice (outcome is not canceled)
  → loader holds this claimed batch
  → systemPrompt.assemble
  → ActivationContext = durable history + claimed batch
  → world-book matcher
  → this step's real Tavern profile / Trace snapshot
```

That path is implemented and keeps these constraints:

- `PendingInputProjection` exists only in the loader Host layer. format, world-book, character, user, and UI do not each subscribe to or copy Inbox state.
- Insert, replace, cancel, steer, next-step, and queued next-turn are handled exactly from the splice's `target/start/removedCount/inserted/outcome`.
- Current-input bodies are only bounded in-memory match input. They are not written to DT resources, selection, or Tavern Trace. DSH's own durable inbox event remains the source of authority.
- After assembly completes, cancel, exception, or agent/session end, the claimed batch is cleared. Messages that already entered history on the next step must not be spliced again.
- Trace still records at `agent/request` the exact assembly snapshot that participated in this request. It does not rerun the matcher afterwards.
- It does not read a private Agent Inbox, append `user/message` early, add an empty-spin model request, or dress lore as an extra user message.

## 6. How to review a real request

From most trusted to least:

1. DSH durable `request/header`: final system, tools, and effective call config.
2. Matching `Session.deriveMessages()`: the final history message array.
3. Tavern Trace: explains which DT resources and world-book decisions this turn/step used, and whether they align with header seq/summary.
4. Loader `/pmp-dsh-tavern/api/v1/active?sessionId=...`: current selection, resources, diagnostics, and a preview that does not include claimed current input.
5. DT sidebar: resource-edit and binding control plane, not a model-request log.

Tavern Trace sits in a public `conversation.view` slot sibling to Conversation / Trajectory. It is a minimized explanation layer over the actual loader snapshot. It does not replace `request/header` and does not enter model context.

## 7. Why clean sessions and UI settings do not enter the message flow

**New chat with current Tavern settings** and configuration templates are explicit control-plane transactions:

```text
Preview the current selection or template
  → DSH mode: workspaces.connectWorkspace() returns a real blank session
    Mowan: reuse the shared playthrough controller for the previewed character, create or reuse the authoritative empty playthrough
  → loader writes the complete Tavern selection atomically
  → Mowan read-back-validates that the session character matches the playthrough character
  → DSH sessions.open() navigates
```

Templates store only resource IDs/options for preset, character/greeting switches, user, standalone world books, and the RP overlay. They do not read or copy durable messages, Tavern Trace, Inbox, claimed input, turn/step, or resource bodies. Mowan requires that projection to include a character card. DSH mode allows an ordinary session with no card. If any resource is already missing, preview and apply return diagnostics and block navigation, so a “half-applied” Tavern combination is not left behind.

Language, scale, and **Follow character into RP** are likewise control-plane state. They write only global `ui-settings.json` and act on the Tavern browser root. They do not enter profile compile, the world-book matcher, `agent/request`, or `request/header`. Optional `rp:policy` text writes `rp-policy.json` and enters a system section only when RP is on.
