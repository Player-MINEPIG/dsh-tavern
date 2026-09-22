# Third-party RP frontend integration

[中文](FRONTEND_INTEGRATION_zh-CN.md)

The current client integration targets DSH `0.1.7-alpha.1`.
HTTP fields follow [API_en.md](API_en.md). This page covers delivery, mode lifecycle,
product-action composition, and v1/v2/v3 responsibilities.

## 1. Understand the dual-mode compatibility boundary first

`native` (Lingzhu) does not replace native DSH session surfaces. `play` (Mowan) is what mounts Tavern's RP sidebar, view, and opening dock. That dual mode is itself the compatibility mechanism. A third-party plugin that binds its RP UI to the `play` lifecycle and fully disposes its own slots/UI when leaving that mode does not require the user to replace the native DSH plugin.

The mode service publishes only `native|play`. It does not arbitrate slots. Several plugins may still choose the same DSH slot. Each plugin must use its own id, clean up only its own entries, and follow that public slot's priority/order contract.

## 2. Three development and delivery paths

| Path | Fork this repo? | Fit | Install/upgrade boundary |
| --- | --- | --- | --- |
| Fork dsh-tavern | Yes | Deep changes to bundled Mowan, resource panels, or the loader | Maintain your own full plugin package and upstream merges |
| Separate DSH client plugin | No | New RP view, sidebar, or dock in the same WebUI | Installed separately from dsh-tavern; depends on the public mode service, DSH slots/store, and HTTP v2 |
| Standalone web client | No | You own the entire browser UI | Consume Tavern HTTP contracts; no injected DSH Cordis service, slots, or `uiWorkspace.openSession` |

There is **no** support for replacing all of Mowan by importing one config file, and there is no frontend provider registry, dynamic bundle loader, or “install remote frontend code” API. A config file can describe data and options. It cannot safely express arbitrary React components, slot ownership, or lifecycle. For a custom WebUI, publish a separate DSH plugin or standalone client. Do not treat an unimplemented one-click replace as a current capability.

### Independent frontend feasibility

Source inspection supports a separate RP frontend without changing Tavern's Host HTTP contracts. An embedded DSH plugin can reuse the mode service, public slots, and the official Session/Chat/Conversation subscriptions while composing Tavern v2 operations. A standalone client can create sessions, submit user text, read durable messages, branch, query focus, and update managed timeline/catalog files through v2. Resource editors and configuration preview/application additionally require the matching v1 contract; historical prompt inspection uses v3.

The reusable [standalone boundary test](../test/standalone-client-boundary.test.mjs) bundles the preset, character, user, world-book, and template client modules plus the HTTP client/configuration workflows with React using esbuild. It checks every input/output import, excludes DSH entry/bootstrap modules, `@deepseek-ai` packages, unresolved externals and `window.__ModuleLoader__`, then initializes the bundle without DSH/browser globals and exercises injected mock HTTP calls. This establishes source-level module reuse, not DOM rendering or live Host acceptance.

These panels are not a separately published standalone component SDK: package `./client` exports the DSH loader bundle, and the test deliberately imports repository source modules. A consumer must supply a React/browser host, resource styles and theme variables (the template panel also uses shared Tavern shell CSS), same-origin HTTP access, and session/context props. The resource panels use their existing relative v1 requests; `createLivePlayClient` separately accepts `fetchImpl` and API roots. Character actions need history/detach callbacks; template creation needs configuration and navigation callbacks. Resolving the current session and its blank state, owning navigation, and managing live session subscriptions remain the consuming frontend's responsibilities.

This establishes the available integration pieces, not a complete replacement for the DSH WebUI. The [v2 route implementation](../packages/play/src/server.js) provides chrome-mode SSE, but no token-message stream, stop-generation, approval, or interactive-question route. A standalone client that needs these controls must separately integrate and validate the target DSH public transport; `uiWorkspace` and the injected React hooks do not exist in an ordinary HTTP client. The upstream session-controller package publishes client and Remote entry points, but their existence alone does not establish a standalone connection, authentication, reconnect, or interaction implementation. Durable message polling is sufficient only for a client whose requirements accept that presentation model.

Tavern does not provide a standalone frontend implementation. A complete replacement needs its own interaction design, transport/lifetime implementation, and browser acceptance. Native DSH remains the available complete session UI.

## 3. Browser mode service

The stable service name is `pmpDshTavernChrome`. This is a Tavern v2 client contract, not a DSH Host API.

Public face:

- `getMode()`: synchronously returns `native` or `play`;
- `getSnapshot()`: synchronously returns a frozen `{ mode, revision }`;
- `subscribe(listener)`: notifies the current snapshot immediately and returns an idempotent disposer;
- `refresh()`: reads back server authority;
- `setMode(mode)` / `switchMode()`: commit local state only after the server PUT succeeds;
- `when(mode, setup)`: call setup on enter; dispose on leave, unregister, or service unload.

A plugin that hard-depends on dsh-tavern can declare `inject: ['pmpDshTavernChrome']` and read `ctx.pmpDshTavernChrome`. A plugin that should still work without Tavern should use `ctx.get('pmpDshTavernChrome')` and keep its native or unenhanced behavior when missing.

Mode lifecycle sketch (fill slot names and props from the target DSH public package contract):

```js
export function apply(ctx) {
  const chrome = ctx.get('pmpDshTavernChrome')
  if (chrome == null) return

  return chrome.when('play', () => {
    const disposeOwnUi = registerYourPublicDshSlots(ctx)
    return () => disposeOwnUi()
  })
}
```

Do not `provide` the same service name again. Do not depend on dsh-tavern internal React state, `playSlots`, EventSource, pollers, or BroadcastChannel. Transport is an implementation detail. Third parties depend only on the face.

## 4. Surface rules in a DSH plugin

Bundled Mowan uses these public DSH seams:

- `sidebar.workspaces`: character-card / playthrough projection;
- `conversation.view`: independent `rp` view; do not unregister native `chat`;
- `conversation.input.dock`: session-scoped empty-playthrough greeting/import dock and default-view adapter;
- `ctx.sessions.list`: catalog snapshots and local `retainedBy` counts; the main conversation is the row with `retainedBy.mainView > 0`; there is no `current` field;
- `ctx.uiWorkspace.openSession(sessionId)`: navigation after durable writes and focus checks; inject the `uiWorkspace` service as well as its package dependency. `ctx.sessions.open` no longer exists.

Third-party plugins may use the same kinds of public seams, but must:

1. Use their own stable ids. Do not reuse `rp` or `pmp-dsh-tavern-*` ids.
2. Revoke every entry/effect they created in the `when('play', setup)` disposer.
3. Not unregister or replace native DSH `chat`. If they want their view by default, use the public view store/action and keep a manual path back.
4. Fail closed to the native DSH surface on classification failure, API unavailability, or uninstall.
5. Not take ownership through DOM queries, private bundle symbols, or mutating another plugin's registry.

`pmpDshTavernChrome` does not guarantee your slot wins. Slot contention, order, priority, and owner props stay under the DSH public slot contract.

### Multiple retained conversations

The session catalog is not a selected-session store. DSH can retain a main conversation and other consumers simultaneously; catalog membership does not retain a client session. Match the native workspace browser's `retainedBy.mainView` projection only for root-scoped launcher/sidebar selection. No matching row means no main conversation, even when other sessions remain retained.

`conversation.view`, `conversation.session`, and `conversation.input.dock` have session scope. Their `inject(sessionId, ...)` callback and standard `sessionId`/`useSession` props address the rendered session, which may differ from the main conversation. Keep asynchronous classification, playthrough preference, loading/error state, cached messages, and default-view completion keyed by that identity. Reject late results after release, replacement, mode exit, or disposal. Only explicit swipe navigation may use the initiating session's cached frame as a transition source.

The Conversation view roster remains global. Registering an RP tab does not establish that every rendered session is an RP session. Resolve its binding per session and keep native Chat available for confirmed non-RP sessions; pending or failed classification must not permanently overwrite an existing view preference. The Conversation store handle from `conversation.session` resolves independently per session. Set a default only while its view is unset; preserve explicit Chat, Trace, or other choices. Unregistering Tavern's entries leaves native entries and durable history intact.

A plugin that needs a session outside an existing rendered scope can use the public `sessions.retain(target, { source, signal })` reference or `sessions.using(...)` lifetime. A reference owns its exact client generation; await `ready` before using the binding and release it on completion/disposal. `sessions.binding(id)` is only a lookup of an already retained generation, not navigation or lifetime acquisition. Do not keep a main-view reference alive merely to perform navigation.

Source checks for this contract use DSH `0.1.7-alpha.1`: `@deepseek-ai/dsh-api-session-controller/client` (`ISessions`, `SessionReference`, `SessionListState`), `@deepseek-ai/dsh-client-ui-workspace/client` (`openSession` and native workspace-tree selection), and `@deepseek-ai/dsh-client-ui-slots` / `@deepseek-ai/dsh-client-ui-conversation/client` (session scope, positional inject parameters, and Conversation store). Tavern's implementation is in [session selection](../packages/client/src/session-selection.js), [slot occupancy](../packages/client/src/play/occupancy.js), and [default view](../packages/client/src/play/view-default.js).

The RP error notice subscribes to `useSession`'s `promptError/lastAgentError/openError` and the latest turn boundary in `useChat`'s `timeline`. The latter uses the same `turn/end` error fact as native `turn-error` nodes while recognizing newer turns without assistant messages. Do not leave a permanent notice based on any historical error. Hide old terminal failures during submission/generation without masking current Session errors. Localize the generic copy through Tavern i18n and leave diagnostics in native Chat.

**DT → Diagnostics** separately presents current RP workspace problems. It shares resource/file reads with the built-in sidebar and checks for existing, unarchived playthrough Sessions in the current workspace only after both official Session and Workspace mirrors reach `ready`. A readable empty timeline does not prove root-Session availability; a loading mirror does not prove loss. The summary is dismissible while per-playthrough warning buttons remain, and resolved issues disappear. The client composition root owns the controller across native/play switches; bounded `sessionStorage` entries retain only dismissal identities, not issue bodies or resource copies.

This panel composes existing interfaces and official state in the client; it adds no v3 API or shared logging service. Third parties can use the same public sources to present their own diagnostics without relying on Tavern's internal controller. Copied reports contain workspace paths, object identifiers and error details. Backend-write `ctx.logger` / `operationId` records and native turn errors retain their separate roles.

## 5. HTTP v2 data plane

Embedded clients on DSH `0.1.7-alpha.1` read lifecycle from `useSession`, `legacy.nodes/partial` from `useChat`, and interaction state from `useConversation`. Derive opening phase with the package-root `conversationPhase(session, conversation)` export. Default-view selection uses the Conversation store on `conversation.session`, not the native Chat store. Standalone HTTP clients do not use these browser hooks. Tavern UI settings events refresh presentation only; they cannot replace the Host live-message source.

Root: `/pmp-dsh-tavern/api/v2`. It is for any RP frontend and provides:

- chrome authority and SSE;
- RP workspace bind, directories, and managed files;
- session create / branch / user-message / full messages;
- `GET /sessions/:id/coordinates` to query a Session coordinate version without returning bodies;
- import-context reference;
- `GET /playthroughs/:id/focus`.

Upstream DSH defines the Session format version. The coordinate endpoint reports the current logical format and a Tavern-inferred migration marker, not a storage schema or automatic migration. Save the message response version with each new range; compare before reuse and send the saved version when branching. See [coordinate API usage](API_en.md#session-coordinates) for requests, fields, branch examples, and recovery. If messages are already requested, use their top-level format fields.

Important constraints:

- `timeline.json` stores session/event pointers and display metadata only. It does not copy QA bodies.
- Greeting is derived from the character card and session selection. It does not forge an assistant message.
- `/user-message` submits user text only. It does not accept a frontend-assembled full prompt.
- Managed catalog/timeline GET returns `revision`. PUT must send `expectedRevision`. After `409 PLAY_FILE_REVISION_CONFLICT`, read the new document and replay local intent. `PLAY_COORDINATES_MIGRATION_REQUIRED` needs migration instead of repeated retries or merely changing a version marker.
- Focus is queried by a non-empty playthrough id. The old path entry is migration compatibility only.
- Imported records inject on the first turn through claim/lineage. They do not forge user/assistant QA or enter the Tavern timeline; the system prompt used by a real request is still persisted in official DSH history.
- The history API reads until Host `hasMore: false`. Whether the model context fits is decided by DSH/provider.
- Do not put the workspace on a system disk.

Browser plugins should use same-origin relative URLs. A standalone web client must satisfy Host/Origin/peer and Content-Type protection itself. Do not expose a localhost-only API to a LAN or the public internet.

## 6. Compose product actions from atomic APIs

v2 does not add a dedicated endpoint per button. Recommended compositions:

| Product action | Composition |
| --- | --- |
| Edit display text | CAS-update `displayOverride`; DSH source stays unchanged |
| Switch an existing reply left/right | CAS-update `adoptedVariantId` → GET focus → `uiWorkspace.openSession` (embedded) or the client’s own navigation (standalone) |
| Reply swipe | From the current output, walk to the nearest real user/steering → branch before the user → user-message original text → wait for the durable pair → CAS add/adopt variant and move tree head → focus; never resend context |
| Edit and regenerate | Same as swipe, but send the edited text as the new branch user-message; bundled Mowan has no button for this |
| Playthrough branch | branch at the adopted assistant end → verify the child session durable range → create directory/timeline copy → redirect the copy's last adopted pointer to the child session → catalog CAS → focus |
| Same-playthrough rollback | Reuse the same branch/inherited-range checks → timeline CAS only moves the active head → focus; no directory, timeline copy, or catalog row |
| Send a new turn | user-message → wait for messages to complete → CAS append a QA pointer |

branch, session, directory, timeline, and catalog are separate atomic operations, not one cross-resource transaction. Side effects run once. CAS conflicts replay only pure document intent. Recover mid-failure from the operation log, returned session id, file read-back, and stable error codes. Do not fake rollback by deleting or rewriting DSH history.

The v2 timeline does not provide a hide/suppress QA field. Use display regex to control RP body by content. Use `displayOverride` to rewrite final display text by hand. Both affect only the RP projection and do not change DSH authoritative history or the AI request. To return to an earlier node, use same-playthrough rollback or a new playthrough branch. Do not write undeclared fields onto the timeline. Third-party extension metadata belongs only in protocol-allowed `ext`.

## 7. v1 resources, v2 RP and v3 Trace

v2 is the stable protocol for third-party RP surfaces. v1 is this plugin's bundled-UI resource-management contract: presets, cards, world books, users, regex, selection, RP/Trace, and so on. A third-party DSH plugin may call v1 when the user has dsh-tavern installed. That is not a long-term v2 promise about resource-editor UI or fields.

If you only need rendering and playthrough operations, stay on v2 and the references already in timeline/catalog. If you must edit Tavern resources, declare a dependency on the matching v1 and dsh-tavern versions, and degrade when an API is missing.

Current resources and configuration are v1 responsibilities; historical prompt
assembly and provenance are v3 responsibilities. v3 defines no `/sources`
aggregator and GET returns 404; use v1 for current configuration.
Historical `sections[].sources` must not be confused with that endpoint. Use official
DSH `system-prompt/assemble` for runtime observation/adjustment/contribution, or v3
for historical records. See [scope audit and route catalogs](API_en.md#api-scope)
and [v3 fields/examples](PROMPT_API_V3_en.md). v1 `/active` runs current assembly;
configuration-only consumers can use preview plus resource reads instead.

## 8. Uninstall, conflicts, and upgrades

- Uninstalling a third-party UI plugin should revoke all of its slots/effects. Bundled Mowan and DSH native remain.
- Uninstalling dsh-tavern removes the mode service. Optional consumers must degrade. DSH durable history remains visible in native Chat.
- Multiple RP UIs installed together: avoid the same id. If they compete for the same high-priority surface, document the winner in each project's docs. Do not unregister each other.
- DSH upgrade: first check manifest inject, public package root exports, slot owner props, store fields, and Host RPC. Then verify native/play, rapid switching, and uninstall fallback.
- If a public seam disappears: turn the corresponding enhancement off, keep native UI, then discuss an adapter. Do not temporarily switch to a private API.

## 9. Pre-release self-test

1. In `native`, no third-party RP slot/UI remains and native Chat works.
2. Switching to `play` mounts immediately. Rapid switching does not double-register or leak effects.
3. Refresh, another tab, and HTTP mode changes all converge. Read-back still works without SSE.
4. Missing plugin, API failure, or classification failure returns to the native surface and does not show guessed data.
5. Timeline writes use revision/CAS. Conflicts do not silently overwrite another tab.
6. Display regex and `displayOverride` never change the AI request or DSH source.
7. Uninstalling the third-party plugin restores bundled Mowan. Uninstalling dsh-tavern still lets DSH native view sessions.
8. With two retained conversations, switching the main selection does not change the other session’s binding, cached frame, or explicit view choice; pending reads and release/disposal cannot resurrect a surface.
9. The package contains no local paths, secrets, private fixtures, or user imports.

## 10. Contributing

The project is MIT. A third-party implementation does not need to copy bundled Mowan visuals or product flow. You can consume v2 only to build your own RP view, or optionally use v1 for resource tools. Issues and pull requests are welcome for missing atomic capabilities, compatibility boundaries, and DSH upgrade impact, as long as the result is independently verifiable and cleanly falls back after uninstall.

If a new capability cannot be composed from existing public APIs, do not bypass them with private DOM or implicit file conventions. Propose the protocol use case, failure semantics, and compatibility impact first, then decide whether to extend v1, v2, or add an adapter. The framework is not meant to lock one RP frontend. It is meant for different implementations to share authoritative DSH data and an auditable lifecycle.
