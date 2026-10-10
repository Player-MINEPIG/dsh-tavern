# DSH and dsh-tavern (DT) message flow

[中文](DSH_MESSAGE_FLOW.md)

Tavern **3.0.2** integrates independent Assembler **v1.1.0**. Tavern resolves resources and owns source permissions; Assembler owns strategies, rendering and placement; DSH owns sessions and provider calls. Standard strategies use public sections/context/pre-step. Only the separately installed core addon enables protocol-1 request projection. The no-strategy loader renderer is a retained compatibility path, not the default RP strategy. See [integration](ASSEMBLER_INTEGRATION_en.md) and [Host/resource contract](LOADER_CONTRACT_en.md).

This page defines the current message contract for Tavern 3.0.2 on DSH
`0.2.0-rc.2`: native DSH flow, DT flow, DT interception points, and one complete model
step. V4 system prompts enter the effective surface through `system/message`, while
`request/header` retains config/tools. Trace schema 4 persists metadata and official
Session references only; [API v3](PROMPT_API_V3_en.md) verifies bodies on demand.

The Tavern Host adapter calls the session/workspace/directory-picker controllers explicitly.
History pins an inclusive `throughSeq` with `inspect()` and completes the same snapshot with
`page()`. In-process reads use `session.seq`, `snapshotEvents()`, and `ownEvents()`.
Coordinate and migration rules are in the [upgrade guide](DSH_0.1.7_MIGRATION_en.md).

`DT` here is short for `dsh-tavern`. SillyTavern (ST) is the resource format and part of the semantics DT compatibilizes. It is not the product identity of this plugin or its UI.

## 1. Native DSH flow

On stock rc.2, without Tavern or assembler strategies, an ordinary DSH `0.2.0-rc.2` agent step follows this sequence:

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
- `agent/request` only changes call config. Stock rc.2 also has no public per-request history waterfall that can return an arbitrary `messages[]` without writing Session.
- Carrying a whole RP conversation in one user checkpoint would lose native role, tool-call/result, and per-message action boundaries. Copying the original into several new messages would create a second durable history and need extra atomicity and concurrency protocol.
- Native DSH compaction also uses the same surface replacement. If DT also used it as a branch tree, two different meanings would contend for one model-visible surface.

Therefore DT swipe, same-playthrough rollback, and new-playthrough branch use public DSH session branch/fork to create continuation sessions instead of rewriting the original session surface. Each branch has natively explainable DSH history, tool pairing, request headers, and independent compaction. Native **Chat**, other plugins, and Host after uninstall still work as ordinary DSH sessions. Tavern timeline stores only pointers to those authoritative messages, parent variants, and the active head. It composes a playthrough tree from several sessions and does not forge or copy history bodies.

Stock rc.2 has no arbitrary request-time `messages[]` projection or atomic multi-message surface replacement. Standard strategies therefore retain native delivery boundaries. The optional core addon enables advanced request-only placement, without making it a reversible durable-history branching API; playthrough branching still uses public session forks.

## 2. DT's own flow

### 2.1 Control plane: import, edit, and session binding

Tavern UI and `/pmp-dsh-tavern/api/v1/*` manage resources and session selections. Imported ST presets, cards and world books pass their format adapters before entering resource stores. Editing a resource is distinct from binding it to a session. Effective world books combine session/opening, user, preset and character relations with stable ID de-duplication, then the card's embedded book.

Assembler's Settings entry and Tavern's embedded panel share one strategy store and session application snapshot. Editing/saving a strategy does not apply it; successful explicit application determines subsequent assembly. Independent DSH sessions have no implicit RP strategy; new Tavern openings default to standard Preset slots first. Existing explicit choices, including opt-outs, remain unchanged.

### 2.2 Data plane: resource resolution followed by assembly

```text
Session selections + public history/claimed-input projection
  → TavernProfileLoader.compile()
       preset / character / user / active lore / resource audit
       source-owned MVU and template reads through permission leases
  → shared Assembler registry + applied strategy snapshot
       source resolution and source-specific rendering
       ordered placement algorithms / delivery / retention
  → native official contributions OR advanced request projection
  → frozen DSH request + recorded evidence
```

An applied strategy makes the loader return resource models without pre-rendering another profile. Assembler resolves registered sources such as preset, character, persona, world books, templates, MVU and native DSH text. Sources determine their parsing and access rules; selecting a module is not permission to execute arbitrary scripts or read another session.

Standard Preset roles first preserves supported authored roles within native delivery regions. Preset slots first adapts preset-controlled content around native history/input boundaries and identifies adjustments in preview. System contributions use official sections; user contributions use context or accepted pre-step delivery and **enter durable history**. Removing a source stops future contributions; previous user bodies remain historical. Native history, input and tool transactions retain their protected order.

Advanced strategies require both the core addon and a protocol-1 Host. They project a frozen request with the supported role/depth/retention rules and record official `request/assembly`; request-only bodies are not fabricated durable chat messages. A missing backend fails explicitly. Exact behavior and limits are in [request assembly](REQUEST_ASSEMBLY_en.md) and [Assembler backend rules](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/BACKENDS_en.md).

With no applied strategy, the compatibility renderer expands the Tavern profile into system parts. Its role/depth approximations apply only to that path; they do not describe current standard or advanced strategies.

## 3. What Tavern and Assembler change in the DSH flow

| Public boundary | Owner and action | Request effect |
| --- | --- | --- |
| `agent/created` | Tavern initializes resource selections, pending input and RP; Assembler inherits parent strategy selection | Initialization completes before requests; failures propagate |
| `agent/inbox/spliced` / `agent/inbox/claimed` | Tavern projects activation input from public splice events; Assembler captures claimed input for native delivery | Current input can affect this step's world-book match before system assembly |
| `systemPrompt.section` | Tavern provides its resource snapshot anchor, imported context and optional `rp:policy` | Applied strategies do not pre-render a duplicate Tavern profile |
| `system-prompt/assemble` | Assembler consumes the complete official assembly and applies the native strategy; Tavern retains no-strategy compatibility expansion | Standard produces legal sections/context and plans pre-step delivery |
| `agent/pre-step` | Assembler applies accepted native input contributions; Tavern admits opening drafts and enforces RP | Native user contributions enter DSH history; frozen system assembly is not rescanned |
| `agent/assemble-request` | Optional core addon executes protocol 1; Tavern performs source-permission validation | Advanced projection only; the standard bundle does not register this executor |
| `agent/request` / `agent/request-error` | Tavern admits preset parameters, starts Trace and requests bounded native retries when eligible | Call config changes; no history rewrite |
| `llm/stream` / `session/event` | Tavern verifies actual-request evidence, records references, observes updates and RP enforcement | Trace explains recorded requests; MVU commits only from accepted durable events |
| `tools.guard` | Tavern adds RP restrictions over DSH permission/sandbox checks | Refuses high-risk execution; changing prompt layout does not remove execution controls |
| Web API / public client slots | Tavern and Assembler expose their respective resources, strategy controls and inspection | UI/preview does not make a provider call |

Preset fallback omits only a rejected active preset override (`temperature`, `maxTokens`, `reasoningEffort` or `stop`), before output and when not canceled. Each field is tried at most once, with at most four native retries. Unsupported effort preflight uses the adapter default rather than guessing an alias. Authentication, quota and unrelated network errors do not trigger this fallback. The original preset is unchanged; Trace records requested/effective values and omissions.

Imported external records remain untrusted read-only first-request context. Greeting is an opening reference, never a fabricated assistant reply. Creator notes are not sent. Source-specific rendering, RP restrictions, restricted MVU and template semantics remain owned by their sources; layout does not override those permissions.

## 4. Complete flow with Tavern and Assembler installed

```text
User submit → DSH Inbox claim
  → public claim/splice observations
  → DSH systemPrompt.assemble
       native sections / contexts / tools / variables
       Tavern resolves selected resources + world-book activation
       Assembler resolves/render sources under the applied snapshot
       native backend returns sections/context and pre-step plan
       no-strategy path instead renders compatibility profile
  → agent/pre-step
       opening admission + RP enforcement
       accepted native strategy user contributions
  → agent/request: call config + preset admission + Trace candidate
  → DSH call preparation and official system/user/context/header events
  → DSH builds the effective native request
       native: sends its frozen messages
       core: optional protocol-1 executor projects and records request/assembly
  → llm/stream: actual messages/tools/config verified for Trace
  → assistant/tool events remain DSH-owned
  → accepted durable assistant events may commit MVU updates
  → next step resolves a new resource/strategy snapshot
```

The standard path retains DSH message delivery and context-snapshot reuse, so logical preview placement is not a historical request log. The advanced event freezes its actual projected message array. Neither path copies durable history into Tavern's resource stores or Trace. Trace stores metadata, hashes and official references; details cold-read and verify the referenced bodies. See [Trace contract](PROMPT_API_V3_en.md).

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

1. In Tavern Trace select the exact historical request: standard reads the complete recorded native-request references; advanced reads its referenced `request/assembly`. Preserve system/user/assistant/tool order.
2. Check its official `request/header` for tools/effective call config and the verified system/context events for individual contributions. Reading `deriveMessages()` on today's live session alone does not recover a past request.
3. Use Trace metadata to explain source/strategy/world-book decisions. MVU inspection opens only on demand; state updates have their own durable source records.
4. `active?sessionId=...`, logical preview and assembler's latest-only actual endpoint describe their respective current/latest states. They must never fill missing historical bodies.
5. Resource/strategy panels are control surfaces, not evidence of what was sent.

Trace uses the public `conversation.view` slot alongside native Chat/Trajectory. It neither replaces official evidence nor enters model context.

## 7. Why clean sessions and UI settings do not enter the message flow

Configuration templates copy bounded resource-selection intent, not messages, Trace, Inbox or resource bodies. The clean-session controls use public controllers and apply complete selections only after validation; details and mutation boundaries are in the [Host/resource contract](LOADER_CONTRACT_en.md).

The character-sidebar new-playthrough path first persists an independent opening draft, resource/strategy snapshots and initial MVU. It creates no DSH session and makes no provider call. First send prepares a real session and associates it only after admission. A draft preview contains neither native history nor unsent input. Existing rooted playthroughs retain their original sessions.

Language, scale and RP-follow preference are UI/control state. They do not become prompt text. Optional `rp:policy` contributes only while RP is active; source-owned initial MVU can be read by an authorized module/card but is not a fabricated assistant message.

## 8. MVU in the request/update cycle

MVU owns initialization, schema, state instances and scoped reads/writes. World-book variable macros, restricted prompt templates or the MVU source can read a bound snapshot under source permission and revision leases. Unused modules and preview do not implicitly initialize or commit state. Final assembly checks reject revoked reads.

After an accepted durable assistant reply, supported variable commands pass source policy, schema and atomic CAS before committing. Fork/swipe instances use their own checkpoints; historical card reads do not redirect to the latest focused session. Trace can inspect these source facts, but is not the state store. Full contracts and supported Helper shapes are in [MVU](MVU_en.md) and [prompt templates](PROMPT_TEMPLATE_en.md).
