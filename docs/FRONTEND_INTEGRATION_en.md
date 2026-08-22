# Third-party RP frontend integration

[中文](FRONTEND_INTEGRATION_zh-CN.md)

Status: dsh-tavern 2.0 and DSH rc.8. HTTP fields follow [API_en.md](API_en.md). This page covers delivery, mode lifecycle, and product-action composition.

## 1. Understand the dual-mode compatibility boundary first

`native` (Lingzhu) does not replace native DSH session surfaces. `play` (Mowan) is what mounts Tavern's RP sidebar, view, and opening dock. That dual mode is itself the compatibility mechanism. A third-party plugin that binds its RP UI to the `play` lifecycle and fully disposes its own slots/UI when leaving that mode does not require the user to replace the native DSH plugin.

The mode service publishes only `native|play`. It does not arbitrate slots. Several plugins may still choose the same DSH slot. Each plugin must use its own id, clean up only its own entries, and follow that public slot's priority/order contract.

## 2. Three development and delivery paths

| Path | Fork this repo? | Fit | Install/upgrade boundary |
| --- | --- | --- | --- |
| Fork dsh-tavern | Yes | Deep changes to bundled Mowan, resource panels, or the loader | Maintain your own full plugin package and upstream merges |
| Separate DSH client plugin | No | New RP view, sidebar, or dock in the same WebUI | Installed separately from dsh-tavern; depends on the public mode service, DSH slots/store, and HTTP v2 |
| Standalone web client | No | You own the entire browser UI | Consume HTTP v2 only; no DSH Cordis service, slots, or `sessions.open` |

There is **no** support for replacing all of Mowan by importing one config file, and there is no frontend provider registry, dynamic bundle loader, or “install remote frontend code” API. A config file can describe data and options. It cannot safely express arbitrary React components, slot ownership, or lifecycle. For a custom WebUI, publish a separate DSH plugin or standalone client. Do not treat an unimplemented one-click replace as a current capability.

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
- `conversation.input.dock`: empty-playthrough greeting/import dock and one-shot default-view adapter;
- `ctx.sessions.list`: public snapshot/subscription for the current session;
- `ctx.sessions.open(sessionId)`: navigation after durable writes and focus checks.

Third-party plugins may use the same kinds of public seams, but must:

1. Use their own stable ids. Do not reuse `rp` or `pmp-dsh-tavern-*` ids.
2. Revoke every entry/effect they created in the `when('play', setup)` disposer.
3. Not unregister or replace native DSH `chat`. If they want their view by default, use the public view store/action and keep a manual path back.
4. Fail closed to the native DSH surface on classification failure, API unavailability, or uninstall.
5. Not take ownership through DOM queries, private bundle symbols, or mutating another plugin's registry.

`pmpDshTavernChrome` does not guarantee your slot wins. Slot contention, order, priority, and owner props stay under the DSH public slot contract.

## 5. HTTP v2 data plane

Root: `/pmp-dsh-tavern/api/v2`. It is for any RP frontend and provides:

- chrome authority and SSE;
- RP workspace bind, directories, and managed files;
- session create / branch / user-message / full messages;
- import-context reference;
- `GET /playthroughs/:id/focus`.

Important constraints:

- `timeline.json` stores session/event pointers and display metadata only. It does not copy QA bodies.
- Greeting is derived from the character card and session selection. It does not forge an assistant message.
- `/user-message` submits user text only. It does not accept a frontend-assembled full prompt.
- Managed catalog/timeline GET returns `revision`. PUT must send `expectedRevision`. After 409, read the new document and replay local intent.
- Focus is queried by a non-empty playthrough id. The old path entry is migration compatibility only.
- Imported records inject on the first turn through claim/lineage. They are not written as history.
- The history API reads until Host `hasMore: false`. Whether the model context fits is decided by DSH/provider.
- Do not put the workspace on a system disk.

Browser plugins should use same-origin relative URLs. A standalone web client must satisfy Host/Origin/peer and Content-Type protection itself. Do not expose a localhost-only API to a LAN or the public internet.

## 6. Compose product actions from atomic APIs

v2 does not add a dedicated endpoint per button. Recommended compositions:

| Product action | Composition |
| --- | --- |
| Edit display text | CAS-update `displayOverride`; DSH source stays unchanged |
| Switch an existing reply left/right | CAS-update `adoptedVariantId` → GET focus → `sessions.open` |
| Reply swipe | From the current output, walk to the nearest real user/steering → branch before the user → user-message original text → wait for the durable pair → CAS add/adopt variant and move tree head → focus; never resend context |
| Edit and regenerate | Same as swipe, but send the edited text as the new branch user-message; bundled Mowan has no button for this |
| Playthrough branch | branch at the adopted assistant end → verify the child session durable range → create directory/timeline copy → redirect the copy's last adopted pointer to the child session → catalog CAS → focus |
| Same-playthrough rollback | Reuse the same branch/inherited-range checks → timeline CAS only moves the active head → focus; no directory, timeline copy, or catalog row |
| Send a new turn | user-message → wait for messages to complete → CAS append a QA pointer |

branch, session, directory, timeline, and catalog are separate atomic operations, not one cross-resource transaction. Side effects run once. CAS conflicts replay only pure document intent. Recover mid-failure from the operation log, returned session id, file read-back, and stable error codes. Do not fake rollback by deleting or rewriting DSH history.

The v2 timeline does not provide a hide/suppress QA field. Use display regex to control RP body by content. Use `displayOverride` to rewrite final display text by hand. Both affect only the RP projection and do not change DSH authoritative history or the AI request. To return to an earlier node, use same-playthrough rollback or a new playthrough branch. Do not write undeclared fields onto the timeline. Third-party extension metadata belongs only in protocol-allowed `ext`.

## 7. v1 resource plane vs v2 RP plane

v2 is the stable protocol for third-party RP surfaces. v1 is this plugin's bundled-UI resource-management contract: presets, cards, world books, users, regex, selection, RP/Trace, and so on. A third-party DSH plugin may call v1 when the user has dsh-tavern installed. That is not a long-term v2 promise about resource-editor UI or fields.

If you only need rendering and playthrough operations, stay on v2 and the references already in timeline/catalog. If you must edit Tavern resources, declare a dependency on the matching v1 and dsh-tavern versions, and degrade when an API is missing.

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
8. The package contains no local paths, secrets, private fixtures, or user imports.

## 10. Contributing

The project is MIT. A third-party implementation does not need to copy bundled Mowan visuals or product flow. You can consume v2 only to build your own RP view, or optionally use v1 for resource tools. Issues and pull requests are welcome for missing atomic capabilities, compatibility boundaries, and DSH upgrade impact, as long as the result is independently verifiable and cleanly falls back after uninstall.

If a new capability cannot be composed from existing public APIs, do not bypass them with private DOM or implicit file conventions. Propose the protocol use case, failure semantics, and compatibility impact first, then decide whether to extend v1, v2, or add an adapter. The framework is not meant to lock one RP frontend. It is meant for different implementations to share authoritative DSH data and an auditable lifecycle.
