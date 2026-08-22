# dsh-tavern package architecture

[中文](ARCHITECTURE.md)

Status: 2026-08-22. Install identity is `pmp-dsh-tavern`. HTTP mounts at `/pmp-dsh-tavern/api`; resources use `/v1`; the play-surface contract uses `/v2`. RP session overlay and delegated child agents freezing the parent selection remain in force. This page is current architecture decisions and release-review gates, not a product README.

## Decisions

`dsh-tavern` stays one installable DSH plugin, split into one-way internal layers inside the same repo and release package. Preset, character card, user, standalone world book, and Tavern Trace are composed by one loader/client. Users are not asked to install several matching DSH plugins.

```text
SillyTavern JSON
       │
       ▼
packages/tavern-format
parse, validate, normalize, keep unknown fields, ST macros
       │
       ▼
packages/preset  packages/character  packages/user  packages/world-book-library
preset use case   character resource/UI  user resource/UI  standalone world-book resource/API/UI
          \              |              |              /
           \             |              |       packages/world-book
            \            |              |       pure world-book format, match, projection
             \           |              |             /
       │
       ▼
packages/play
chrome / play-workspace files / timeline validation / focus derivation (pure logic + HTTP)
       │
       ▼
packages/tavern-loader ◄── DSH session/event (PendingInputProjection)
DSH compile policy, session/request policy, Host hooks, v1+v2 HTTP
        │
        ├── packages/session-template (composed by the loader)
        │   clean-session configuration projection, atomic store/API (no history)
        │
        ├── packages/tavern-trace
        │   minimal audit model, bounded plugin store/API, conversation.view
        │
        ▼
DSH system prompt + agent request
```

Dependencies only go down: `tavern-loader → play/preset/character/user/world-book-library/world-book/tavern-trace → tavern-format`. The format layer and the `world-book` pure library must not import DSH, the filesystem, or UI. The preset, character, user, world-book-library, and `play` use-case layers must not register `systemPrompt`, `agent/request`, or other Host seams. Only the loader is the root `main` entry and may depend on the DSH runtime. `tavern-trace` accepts ordinary snapshot/session-event data from the loader, but it does not import DSH or append Session events. It owns only a minimal audit format, bounded plugin storage, a read-only API, and a browser view. The browser side is composed by `packages/client` from the use-case UIs. It is not the Host loader.

## Layer responsibilities

| Layer | Question it answers | Current contents | Explicitly not responsible for |
| --- | --- | --- | --- |
| `tavern-format` | “What does this ST file express?” | Preset recognition, order/enablement normalization, original-field retention, edit model, macro interpretation | Session selection, DSH system sections, model call parameters, HTTP, disk |
| `preset` | “How does the user manage presets?” | Atomic file store, import/create/edit/delete/select, API, sidebar source | Deciding how prompts enter the agent |
| `character` | “How does the user manage character resources?” | JSON/PNG import, create/edit, current-document JSON/PNG export, per-session binding, API, UI, loader/world-book resource snapshots | Prompt placement, assistant history, world-book activation |
| `user` | “How does the user manage their Tavern identity description?” | Strict three-field document, CRUD persistence, API, UI, loader adapter | Avatar, DSH Agent identity, prompt placement, Host seams |
| `world-book` | “Which lore entries should be activation candidates?” | ST/embedded-card format, normalization, pure match/rank/budget and loader projection | Session selection, DSH injection, character-card storage |
| `world-book-library` | “How does the user manage standalone world-book resources?” | Atomic JSON store, CRUD/export API, editor UI, documents for the loader | Session-selection ownership, matcher copies, Host seams, editing a card's embedded book |
| `session-template` | “How do we reuse Tavern configuration but create a clean DSH session?” | Bounded template projection / atomic store / API, missing-resource diagnostics, client transaction order | DSH history, Trace, Session construction, final prompt |
| `play` | “Where does play-surface meta-state live, and how do files stay inside the root?” | Global chrome, play-workspace path jail, timeline/catalog validation, `deriveFocus`, session HTTP; Host RPC is adapted by the loader | Rewriting DSH events, RP lock, bundled Mowan DOM, `archiveSession` |
| `tavern-loader` | “How do current resources affect this DSH request?” | Compile the selected preset, map supported call config, append/replace policy, Host/API mount, exclusive pending-input projection, RP session overlay | Reinterpreting raw ST fields, implementing concrete UI |
| `tavern-trace` | “Why did this loader run produce this combination?” | Turn/step alignment, resource summaries, world-book accept/reject reasons, header-summary references, bounded store/API/sibling view | Saving bodies, replacing request/header, appending session events or model messages |

Character cards already have an adapter/model in `tavern-format` and management/resource entry points in the `character` use-case layer. User resources are a separate `user` use-case layer with a strict `{id,name,description}` document. World-book format compatibility lives in the independent pure library `packages/world-book`. All resources are finally composed by the same `tavern-loader`. Neither the character nor the user module reads preset order or decides field insertion.

The unified loader collapses Host registration to two sections, `pmp-dsh-tavern:profile` and optional `rp:policy`, and introduces loader-owned `SessionSelectionStore`. Preset, character, user, and world-book documents stay in their modules, but “which session uses which resources” and the RP overlay are persisted by one policy. Ordinary forks and delegated subagents both copy the parent selection. RP is not a DSH agent preset.

Unified adapter, session inheritance, and marker contract: `LOADER_CONTRACT_en.md`. Native DSH and plugin-enhanced message flow: `DSH_MESSAGE_FLOW_en.md`. World-book format and projection: `world-book/DESIGN_en.md`.

Native DSH **New session** currently inherits the last focused session's preset and other Tavern selection/settings by default. That is Host baseline. Architecture and acceptance must not keep treating a native new session as a blank configuration.

Clean sessions and configuration templates are stored by `packages/session-template` as a pure selection projection. The loader injects the real resource libraries and `SessionSelectionStore`. In DSH mode, the browser composition root creates/navigates an ordinary blank session only through public `workspaces.connectWorkspace()` and `sessions.open()`. In Mowan, the same control plane first previews the configuration and obtains the character id, then reuses the shared playthrough controller and existing v2 atomic operations to create or reuse that character's playthrough, and finally writes the complete selection atomically through v1 apply. There is no dedicated “configure playthrough” backend verb. Neither path forks or forges history. Full transaction boundary: `LOADER_CONTRACT_en.md`.

## Loader-owned ActivationContext

rc.6 `agent/inbox/spliced` is a public, durable Session event. Insert, replace, cancel, and claim first append that event and synchronously notify `session/event`; only then does the live Inbox change. At this boundary the loader maintains the only `PendingInputProjection`, combining durable history with this step's claimed batch (after de-duplication) into a temporary `ActivationContext` for the world-book matcher to consume read-only.

This projection belongs to the Host adapter and does not sink into pure modules:

- `world-book` still receives only explicit messages/text/options. It cannot read a session or listen to events.
- `character`, `user`, and `world-book-library` do not copy pending state or change their storage models.
- `tavern-trace` receives only a compiled snapshot and body-free source metadata. It does not persist input.
- `packages/client` does not participate in capture, so a browser refresh or extra window cannot decide runtime semantics.
- The loader must handle cancel/replace/steer, multiple targets, exception cleanup, and next-step de-duplication.

This change only moves “current input participates in activation” earlier, to the first system assembly. It does not change ownership of DSH durable history, real role-message order, tool permissions, `agent/request`, or `request/header`.

## Control-plane extensions

- User–standalone-world-book relations are held in a separate atomic file owned by unified loader policy. `UserModel` is still only `id/name/description`. `world-book-library` documents do not store user ids in reverse. The user UI can edit relations, but session-explicit sources win, user sources follow with stable de-duplication, and only the loader's shared adapter runs the matcher.
- UI scale, language, and Follow character into RP are implemented by one settings entry in `packages/client`, a shared locale contract, and per-language semantic catalogs. Business components reference semantic keys only. Dynamic resource values interpolate through an explicit raw boundary. Runtime no longer scans or replaces Chinese source strings. The loader root API persists only a bounded global display document (including `rpFollowCharacter`). Resource JSON, profile compile, and session selection do not read display language/scale. Optional `rp:policy` text is another bounded file, `rp-policy.json`.
- Conversation display preferences are not mixed into that outer UI document. The loader saves `textScale/actionScale` through independent `conversation-settings.json` and v1 `/conversation-settings`. The client notifies only Mowan chat and the empty-playthrough opening dock. Body scale enters RP text through a local CSS custom property. Button scale enters only the durable QA action row, so it does not cascade into native DSH, the composer, Tavern panels, prompts, or exports.
- Both of these must reuse the existing single-plugin API, security boundary, refresh events, and atomic persistence. They must not be implemented by adding a second installable plugin.

## Native-first frontend adaptation

The frontend long-term rule is “minimal change, maximum compatibility”: first look for an equivalent in the current DSH version's package README, root export types, and public slots/services. Build only when DSH has no public interface for that Tavern meaning. Reuse is not “we can import it from DSH source”. It must be in public docs or root exports, injected or declared by the plugin manifest, must not read `/src/*` or bundle-internal symbols, and Host data plus the native UI must still work independently after this plugin is uninstalled.

### DSH mechanisms already reused

| Tavern capability | Public DSH mechanism reused | Custom part and boundary |
| --- | --- | --- |
| DT orb entry | Additive `shell.overlay` slot, Cordis effect lifecycle | Orb, menu contents, and global chrome state are product UI. Do not create an uncontrolled root on `document.body` |
| Mowan sidebar | `sidebar.workspaces` slot; owner-injected `useSessions` / `useWorkspaces`; `ctx.sessions.open()` | Reproject as character/playthrough only. Do not rewrite, archive, or hide Host session data |
| DSH outer New session | Owned by the rc.8 sidebar shell; no public slot/service | Tavern does not take it over with hashed classes, DOM capture, or source replacement. Mowan keeps the native button and documents it as not recommended. Ordinary-area `+` only guides back to native |
| Ordinary-session hint | Independent full-row `conversation.input.dock` slot, inherited `--dsh-composer-card-max-width` | Shows only Tavern's RP-workspace classification. The hint is centered to Host composer width. It does not take over the native composer, copy fixed pixels, or read hashed classes |
| Mowan conversation page | `conversation.view` slot; standard `useSession` nodes / partial / running | Cross-session playthrough aggregation is a Tavern projection. Do not forge DSH messages or read private runtime |
| Mowan default view | Native `chat` store handle from `slots.entries("conversation.view")`, session-scoped `conversation.input.dock` and its `actions.setView()` | Before a new playthrough has a chosen view, reuse the same store from a dock entry with no visible content, then unregister immediately after switching to `rp`. Do not register a second `chat` on the view ring. Keep manually selectable native **Chat** |
| Live send and streaming | DSH `useSession` live nodes and partial | `/v2/messages` only reconciles durable message range. It does not re-wrap DSH's browser live API |
| Conversation scroll | Conversation `[data-conversation-scroll]` scrollport, sticky composer geometry, injected `chatScroll.save(null)` | Choose only when to call native “scroll to bottom”. Do not compute a fixed composer height or keep a second scroll container |
| Clean new session / templates | DSH mode reuses `workspaces.connectWorkspace()`; Mowan reuses playthrough v2 `sessions.create` composition; both navigate with `sessions.open()` | Tavern only copies selection atomically onto the target session. Mowan additionally treats the configured character as playthrough ownership and read-back-validates. It does not construct messages or fork history |
| Playthrough session operations | Host `sessions.create/rename/fork/prompt/history`, `workspace.insertSessionBefore`; Host-side `Session.deriveMessages()` | v2 composes these atomic operations into playthrough transactions usable by third-party frontends, while DSH sessions remain authoritative history |
| RP secure mode | Official `sandbox/mode` Session event, `tools.guard`, Session/agent lifecycle hooks | Tavern stores only whether RP is on and the follow source. It does not invent a second sandbox state |
| Prompt and audit | `systemPrompt.section`, `agent/request`, `request/header`, `Session.deriveMessages()` | The loader only compiles selected ST resources. Trace records only bounded source metadata |
| Tavern Trace | Additive `conversation.view` | Trace is an explanation layer over the loader snapshot. It does not replace native Chat / Trajectory |
| Visual adaptation | DSH `--dsw-*` theme / semantic tokens | Character-card, playthrough, and resource-editor layout stay owned by Tavern |

### Further reuse candidates, not yet migrated

These are upgrade candidates. They do not authorize changes in the current round:

- User and assistant bodies are not migrated directly onto `MessageText` / `MarkdownText`. Uncovered messages run the browser display pipeline from DSH-authoritative content: “macro replace → ST display regex (global → preset → character, each source keeps array order) → Marked 18.0.10 → DOMPurify”. Custom/XML wrapper tags therefore do not block Markdown inside them, and nested tags plus ST's loose quoted-fence semantics stay. The rules page allows drag only within one source. After save, global rules write the workspace document; resource rules write back to native `regex_scripts`. DSH `MarkdownText` omits raw HTML and cannot be the ST-HTML-compatible renderer. Later Marked upgrades, sanitizer changes, or reuse of lower DSH capabilities must separately compare ST output and malicious-HTML cases, prove they do not change Tavern display semantics or bypass the sanitizer, then accept independently.
- Mowan does not render reasoning or runtime context and provides no expand control. Public `DisclosureRow` / Think icon are therefore no longer migration targets for that view. Users who need runtime detail return to native DSH **Chat**. Action buttons may still adopt public icons and `Tooltip` gradually. Bundle-internal unpublished `ReasoningRow` and `MessageIconActions` are not dependable interfaces.
- DSH model-message `role` and UI origin are different dimensions. Public ConversationNode already represents runtime injection as `kind: "context"`, but the durable history projection may still give it `role: "user"`. v2 therefore adds additive `origin.kind` without changing `role`, and keeps optional source metadata such as `producer` / `form` / `summary`. An RP frontend must project bubbles, hide/present context, and compute action capability from `origin`. It must not guess from text, position, or “is this the last output segment”.
- Timeline expresses a branch tree with `parentVariantId` and an active `head`. Display, focus, and new-QA reconcile work only along the head's ancestor path. The head session may be a continuation just branched with no new QA yet, so sidebar classification must treat the head session as a playthrough member. Old flat timelines stay readable; the next reconcile enters the tree.
- Built-in action rows belong to the durable QA, not to one visible assistant body. Real user/steering output retries itself. Context-triggered parent output walks forward to the nearest real user turn and reruns the whole turn. The controller never resends `origin=context` as a user prompt. New-playthrough branch and same-playthrough rollback reuse the same DSH branch / inherited-range checks. The only difference is creating a catalog copy versus moving the original timeline head. Hide and its timeline field never entered the v2 contract. Display regex only decides whether each body segment renders. One QA, no matter how many assistant segments it has or whether all were cleared, keeps one action group at the QA end. Timeline references and provenance always remain.
- DSH message-surface replacement can repeatedly obscure the current node. Original append-only events stay readable, but the current public meaning is only “a contiguous range → one message”. There is no `unreplace`, atomic multi-message restore, or per-request history projection. It fits native compaction/checkpoint. It does not fit an RP branch tree. DT therefore stores each continuation in a public branch session so DSH history, role/tool pairing, native Chat, and uninstall fallback stay valid. Timeline only composes those session pointers into the active playthrough path. Full trade-off: `DSH_MESSAGE_FLOW_en.md` §1.1.
- `displayOverride` is edited by an in-conversation multiline editor. Save and Cancel/Esc stay on the current reply. They do not use `window.prompt`. The override is defined as final display text: later macros and display regex are skipped; Marked/DOMPurify still run. An empty string is a valid override and keeps Restore. Restore sets `null` and reruns the current display pipeline from the DSH original. Save still writes display metadata through the existing node controller and timeline CAS. It does not change the DSH original or model context.
- **Approved backlog:** playthrough import/export and resource-selection anchor menus should adopt public `Menu` (portal, scroll/resize reposition, compact mode) to reduce narrow-sidebar clipping and self-maintained positioning CSS. Edit/delete confirmations should gradually adopt public `Modal` / `Button` / `Input`. Copy should use `writeClipboard`. Migration still lands and accepts per feature.
- The duplicate import/export `+` once registered on `conversation.input.left` is gone. Playthrough IO stays only in the sidebar `PlayIoMenu` and does not occupy or rewrite native composer left actions.
- Early message-scroll work used local anchors, occlusion amounts, and composer-height compensation. It was reverted to the DSH scrollport `scrollTop = scrollHeight` meaning. Later, confirm Host scroll ownership first. Do not simulate a sticky composer with fixed pixels.

When introducing primitives, `@deepseek-ai/dsh-client-ui-primitives` must be an explicit, same-version-family client dependency/inject. Do not borrow transitive dependencies from the DSH install directory. Migration must accept item by item. Do not replace every control at once for visual unity.

### Custom Tavern layers that must stay

DSH currently has no native data model for character cards, playthroughs, greeting, cross-session adopted variants, ST display regex, or Tavern selection. Therefore `catalog.json` / `timeline.json`, the character→playthrough sidebar projection, cross-session reply switching, greeting-as-display-only, regex resource management, and the v2 playthrough protocol stay owned by Tavern. They point at DSH-authoritative messages by event range and do not copy bodies. Subdirectories inside the RP workspace must also pass Tavern's path jail. DSH native/browse directory flow is a UI seam for choosing or registering a Workspace. It does not provide a unified Host capability for “let a third-party v2 frontend safely create arbitrary playthrough subdirectories inside an already-bound root”.

Playthrough names and DSH session names are intentionally separate. Inside each character card, Tavern shows `N playthrough` from an assigned monotonic number stored in catalog extension data. User rename edits only that projection. The original DSH session stays named by Host as “character name + time”, so authoritative data stays recognizable after leaving Mowan or uninstalling. Old catalogs without a number get a computed fill from that card's existing order, but old rows are not rewritten for compatibility.

Create only inspects that card's highest-numbered playthrough. Reuse is forbidden when the timeline already has QA, imported context already has QA, DSH-authoritative messages already have user/assistant, or an unfinished turn exists. Greeting alone is not durable history. Only when all four are empty is the original root session opened, with no directory, session, or catalog write. A read failure must not be guessed as empty, so the lifecycle does not keep growing or overwriting when authoritative state is uncertain.

Character-selection changes add a membership guard first. v1 only reports “detach required” plus structured conflicts and does not write selection without confirm. After confirm, v2 detach is computed on the server from `parentVariantId` (flat timelines use the previous adopted variant) for the target and descendants, and commits with each timeline/catalog revision as CAS. It does not delete DSH sessions or rehang sibling branches. After root detach, catalog keeps the empty playthrough; the next same-character create attaches a new blank root session. This explicit lifecycle verb keeps third-party frontends from each inventing a tree-prune algorithm.

Imported records remain immutable `import-context.json`. They neither forge a DSH message nor copy into the timeline. An empty session manages the loader's authoritative binding through `/sessions/:id/import-context` GET/PUT/DELETE. Rebind writes a new file then replaces the pending reference. Unbind only clears the reference and keeps the workspace file for recovery/audit. After DSH conversation, an open turn, or a consumed binding, the backend locks mutation. Public export composes “imported greeting/QA → later timeline pointers resolved to DSH originals”. Static HTML outputs the currently visible greeting and RP render. SillyTavern JSONL outputs greeting, the current active path, and each QA's `swipes` / `swipe_id`. Greeting `{{user}}` / `{{char}}` are frozen to current display names at export. Import files stay immutable and keep participating in hash checks. The loader expands Tavern macros in greeting and QA with the current user/character profile snapshot only at prompt-projection time, then XML-escapes so leftover ST placeholders are not misread as DSH prompt variables. ST JSONL cannot express the full playthrough tree. When this plugin re-imports an ST record it binds only the selected linear history represented by each line's `mes`. The unpublished portable bundle that could not fully round-trip was removed from the 2.0 public surface. The frontend must also sync catalog/timeline display references and read-back-validate. Current v2 has no unified transaction across import binding, files, and catalog/timeline, so validation can only expose a half-complete state. It cannot claim an atomic commit.
The current playthrough lifecycle is a frontend composition of these atomic capabilities: the character-card sidebar creates or reuses the latest empty root session, writes the character/playthrough directory, empty timeline, and catalog metadata, then rereads and validates. Renaming `N playthrough` edits catalog only. Empty-session greeting and imported-record preview hang on session-scoped `conversation.input.dock` and do not register a second conversation view. Imported records bind to the existing empty root session's import-context file. The opening footer provides bind, rebind, unbind, and last-three-QA preview. Real messages, an open turn, or consume lock the Host API.

Accepted implementation boundaries: greeting, imported QA, and timeline never forge a DSH durable message. The first real assembly must read public `claimEventSeqs` from the same profile snapshot, persist pending → `claimed` only after success, and inject escaped, `untrusted` read-only context through the loader. A view/assembly without a claim does not inject or consume. A claimed identity may replay. Full history pagination is implemented by `10250a7`: read until Host `hasMore: false`; empty page, illegal oldest `seq`, or a repeating/non-advancing cursor → 502 `PLAY_HISTORY_CURSOR_STALLED`; no summarize/slice. In the 2026-08-21 accepted release hardening, catalog/timeline GET validates after read inside the same target guard and returns exact UTF-8-byte SHA-256 `revision`; PUT compares explicit `expectedRevision`, validates, temp-writes, and renames inside the same guard. Missing field / bad format / conflict are 400 `PLAY_FILE_REVISION_REQUIRED`, 400 `PLAY_FILE_REVISION_INVALID`, 409 `PLAY_FILE_REVISION_CONFLICT`. Conflicts do not change the file. id/path uniqueness, safe relative paths, and known `pmpDshTavern` fields are checked; third-party ext is kept. The bundled live client implements managed revision read-back/cache, `null` create-only, and limited conflict replay. Task 06 migrated built-in lifecycle callers onto those primitives. CAS replay reruns only pure local mutators. Old get/put custom clients keep one compatibility fallback and no concurrent-replay guarantee. Import claim, terminal metadata, and Tavern branch retry/swipe lineage are implemented. Provider retry before the same terminal may replay; after terminal a new claim does not inject. Third-party native forks are outside plugin interception. Stable focus is derived by playthrough id (task 07). Task 08 migrated the bundled live client and built-in sidebar/node/swipe callers to the stable by-id entry. The old explicit-path client route is compatibility only. Per-segment path and practical TOCTOU hardening inside the target lock are implemented. This flow is still not a cross-file playthrough-create transaction. Workspace bind, directory create, catalog/timeline/ordinary-file writes, and session create/branch/user-message/import-context PUT/DELETE already write backend `ctx.logger` with one `operationId` inside the same request. Clients recover from completed stages, read-back, and stable error codes. user-message records only the Host-accepted stage, not body, length, or summary. GET, focus, and chrome reads produce no operation log. Logs do not claim a shared operationId across APIs or a cross-file transaction. Browser logs and a persistent bounded journal are deferred. Until implementation and acceptance are complete, do not tell third parties these items are solved. Public evidence and contract: `PLAY_REVIEW_en.md` and `API_en.md`.

Plugin-owned resource changes continue to use a bounded Tavern refresh event. Session / Workspace / live Chat changes must subscribe to DSH stores. That custom event must not replace Host state management.

### DSH upgrade review

On every DSH version upgrade, first do a read-only diff audit: plugin-manifest inject, public package root exports, slot owner props, store fields, Host RPC, and README contracts. Then run native/play dual-mode and uninstall-fallback acceptance. If a public seam disappears, fail the matching enhancement closed and keep the native surface first, then discuss a protocol change. Do not temporarily switch to DOM queries, internal bundle symbols, or private runtime. Design notes for new frontend features must explicitly write “reused native mechanism / reason for custom work / official upgrade observation point”.

rc.8 default view is still held by the DSH chat store. A `conversation.view` owner does not automatically inject another entry's store into a plugin view. The default RP adapter must therefore explicitly reuse the same store handle from the native `chat` entry in the public slot snapshot. It must not invent a second store. DSH reuses instances by store handle × session scope, so the adapter hangs on session-scoped `conversation.input.dock` that produces no view button, returns `null`, handles only the not-yet-chosen `view` state, and unregisters after running. Do not obtain actions from a same-named `conversation.view` entry. If the public handle is missing or the component cannot get the store, fail closed and clear the temporary occupancy. Upgrade regression: after the first message of a new playthrough, default into RP; native **Chat** remains manually selectable; from the first frame the top bar has only one `chat`; switching back to native or uninstalling does not change the original DSH component.

## Why this is not two DSH plugins

The format parser has independent value, but its right shape is a pure library, not a separately installable DSH plugin:

- It can be reused by browser import preview, server import, migration CLI, snapshot tests, and future character-card/world-book tools.
- Format compatibility can be verified in a test environment with no DSH, session, or filesystem.
- “ST file parse error” can be diagnosed separately from “DSH load-policy error”.

In theory `tavern-format` could grow its own package manifest and publish as an npm library. That is unnecessary now. It has no Host entry, bundle patch, or standalone user feature, and cannot send content to an agent by itself. Wrapping it as a second DSH plugin would:

- Show “installed successfully” with no conversation effect — a half-install.
- Force extra version negotiation between loader and parser.
- Let both plugins contend for API, storage, or UI lifecycle.
- Double install, uninstall, backup, and troubleshooting cost.

Therefore the release and install unit stays the root package `pmp-dsh-tavern` (product name remains dsh-tavern). Internal package boundaries exist for reuse and test isolation. Browser and Host share `PLUGIN_ID`, `API_ROOT`, `API_V1`, `API_V2` from `packages/identity.js`. The HTTP mount prefix is `/pmp-dsh-tavern/api`. Existing resources use `/v1`; play meta APIs use `/v2`. The old root `/dsh-tavern/api` is retired. `packages/play` does not import DSH. The loader attaches v2 session/workspace to public Host RPC through `ctx.get('apiProxy')` when present, and mounts on existing `secureTavernApi`. `package.json` exports `./format`, `./preset`, `./character`, `./user`, `./world-book`, `./world-book-library`, `./trace`, `./loader` are programmatic interfaces, not separately installable plugins.

## Current release gates

Early preset, character-card, world-book, user, and Phase 3 worktrees already finished layered development and are wired into the current loader. The commit process stays in `docs/CHANGELOG.md` and is no longer a pending merge checklist. Before a formal merge to `main`:

1. Run format-compatibility acceptance: ST parse, unknown-field retention, and normalization stay stable.
2. Run load acceptance: per-session selection, system profile, call config, current-input activation, API, and Trace do not regress.
3. Run `npm run check` and `npm run pack:check` so the generated bundle is stable. The npm package should include the public docs and image assets listed in `package.json#files`, but must not include tests, runtime data, private development plans, or external fixtures.
4. Install the root plugin in an isolated `DSH_HOME` and start real DSH. At least complete launcher, resource binding, a new session, and one request/header/Trace alignment check.
5. Scan tracking files and the npm package inventory for local absolute paths, API keys, private fixtures, or third-party imports.
6. Sync README, usage, security risks, acceptance records, and changelog with the implementation before merge, tag, and push.

## Two long-term acceptance tracks

Format-compatibility acceptance cares about: input recognition, diagnostics, prompt order, enablement, unknown-field retention, stable normalization, and external copyrighted fixtures staying read-only and out of the repo.

Runtime-load acceptance cares about: current selection, session isolation, append/replace, resource composition order, call config, final request/header, API audit, and the install entry. Changing load strategy later must not break format-parse tests with it.

Current architecture tests check critical dependency direction. They do not replace code review, but they stop the most obvious DSH Host logic from flowing back into the format layer.

### Tavern chrome revision and event boundary

Global blue/red frontend state is held by `packages/play`'s own `ChromeStore`. `chrome.json` stores `mode` and an opaque `revision`. `GET/PUT /v2/chrome` keep the old `ok/mode` fields and attach `revision`. A change is published only after a successful atomic write and an actual mode change. `GET /v2/chrome/events` is Tavern-owned SSE under the same API prefix: the first connection sends the current snapshot, then `chrome/change`, exposing only `mode/revision`, and releasing the subscription on close. It does not change the DSH Host store, transport, or view. External file edits and other-process writes are outside the event contract. Clients must use GET/focus refresh as a degraded check.

### Browser mode service and consumer boundary

The client composition root creates a transport-independent mode core and registers it on the stable plugin fiber with `ctx.provide('pmpDshTavernChrome', face)`. SSE/focus/polling commit server snapshots only through an internal adapter. TavernShell, the orb controller, and `playSlots.setMode()` are ordinary consumers of that service. They no longer each maintain GET, focus, or BroadcastChannel state machines.

The service's `when(mode, setup)` expresses only mode lifecycle. It does not grant surface ownership. Several plugins may subscribe at once and register their own public DSH slots. Contention for the same slot stays under that public slot contract. On provider unload, transport stops and effects are cleaned first; then Cordis revokes the service and drives required-consumer unload. Native mode still does not modify the native DSH surface.
