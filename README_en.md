# pmp-dsh-tavern

[中文](README.md)

An open-source DeepSeek Harness (DSH) plugin for Tavern resource compatibility, RP workflow, and a third-party frontend protocol.

> This documentation matches `2.0.0`. The project is released under the [MIT License](LICENSE).
>
> The default project README is the [Chinese version](README.md). This English file has no screenshots.

## Design

pmp-dsh-tavern does not replace DSH with another UI, and it does not copy conversation history. It adds a testable, auditable, uninstallable Tavern compatibility layer on top of public DSH extension points and atomic APIs:

- **Lingzhu / DSH native mode**: keep native DSH sessions, sidebar, and plugin ecosystem.
- **Mowan / RP mode**: regroup the RP sidebar by character card and playthrough, and provide greeting, display regex, swipe, branch, rollback, import, and export.
- **DSH remains authoritative**: durable history, tools, permissions, and the final model request stay owned by DSH.
- **Minimal change, maximum compatibility**: reuse public DSH seams first; do not replace the native frontend or depend on private DOM.
- **Original sessions stay readable after uninstall**: the plugin stores resources, selections, playthrough pointers, and display metadata only. It does not forge or overwrite DSH history.

The dual-mode design is the compatibility mechanism. Outside Mowan, the user still sees ordinary DSH. The plugin mounts its RP surface only after entering RP mode.

## Security warning

Installing this plugin lets its code run in the DSH Host and the browser page. Install only from a trusted repository and commit. Review changes and back up plugin data before updating. The following controls reduce risk; **they are not OS-level isolation or account authentication**:

- **Agent and tool risk**: presets, character cards, world books, imported records, and user messages can contain prompt injection. A high-privilege Agent may still call approved terminal, file, network, browser, or other plugin capabilities when induced. Do not put secrets in the conversation. Keep DSH approval and sandboxing, and enable tools with least privilege.
- **RP secure-mode boundary**: RP mode adds read-only and high-risk tool limits on top of DSH permissions, and child agents inherit that overlay. It is not a VM, container, or system sandbox. It cannot constrain other local processes, and it cannot turn a malicious prompt into trusted content.
- **Backend and API risk**: v1/v2 APIs target local loopback. Host, Origin, and Content-Type checks are not login authentication. A local malicious process can still reach them. Do not expose DSH Web or this plugin API to a LAN or the public internet. A reverse proxy must add its own TLS, authentication, and trusted Host configuration.
- **Frontend rendering risk**: model output is parsed as Markdown and sanitized with DOMPurify, but allowed remote images or styles can still make network requests and expose the visitor IP. Display regex uses JavaScript `RegExp`; catastrophic backtracking can freeze the page. Import and enable only templates and regex you trust.
- **Data and lifecycle risk**: swipe, branch, and playthroughs create real DSH sessions and can increase disk use. revision/CAS, path checks, and atomic writes do not replace backups and do not turn several API calls into a cross-file transaction.

If behavior looks suspicious, stop the Agent, switch back to DSH native mode, and inspect the original session and tool records. Full threat model, implemented boundaries, and vulnerability reporting: [Security policy](SECURITY_en.md). RP interception list: [RP secure mode](docs/RP_SECURE_MODE_en.md).

## Quick Start: first RP turn from a character card

### 0. Install

Requirements: Node.js 20 or newer, `dsh` on `PATH`, and an initialized DSH profile (default `web`).

```sh
git clone https://github.com/Player-MINEPIG/dsh-tavern.git
cd dsh-tavern
npm install --cache .npm-cache --legacy-peer-deps
npm run plugin:install
```

Restart DSH Web after install. Stop the target `dsh web` before updating an existing install; the installer keeps plugin data across refresh. Other profiles, a separate `DSH_HOME`, manual install, backup, and uninstall: [Installation](docs/INSTALLATION_en.md).

### 1. Import a character card

Left-click the `DT` orb, open **Character card**, and import a SillyTavern JSON or PNG card. Import creates a resource only. It does not forge a session or send a message.

### 2. Create a DSH workspace

Return to native DSH and create a workspace that will be used for RP. All playthrough sessions go into that one workspace so character chats do not scatter across ordinary work.

### 3. Enter the RP frontend and choose the workspace

Right-click the `DT` orb, or choose **Switch to custom frontend mode** in the menu. The first time you enter Mowan, the plugin requires an explicit choice from existing DSH workspaces. It does not enter RP content until write and read-back succeed.

### 4. Create a playthrough

In the RP sidebar, click `+` on the imported character card. The plugin creates or reuses that character's latest fully empty `N playthrough`, and binds the root session to the card you actually clicked.

### 5. Choose a greeting

An empty playthrough's opening dock shows the card greeting. Alternate greetings can be chosen with the left/right buttons. This is display and first-turn prompt reference only. It is never forged as an assistant reply that already happened.

### 6. Start chatting

Send the first user message from the native DSH composer. It appears immediately in the RP view. After that you can swipe, branch a new playthrough, roll back in the same playthrough, edit display text, and import/export.

Full operations and boundaries: [English usage guide](docs/USAGE_en.md).

## v2.0 feature map

| Area | Main capabilities | Details |
| --- | --- | --- |
| Resources | ST presets, V1/V2/V3 JSON/PNG cards, standalone/embedded world books, user profiles, bindings, export | [Usage](docs/USAGE_en.md) |
| RP frontend | Character/playthrough sidebar, greeting, body rendering, display regex, swipe, branch, rollback, display-layer edit | [Usage](docs/USAGE_en.md) |
| Playthrough data | Authoritative DSH sessions, tree timeline, workspace catalog, first-turn read-only import injection, static HTML and ST JSONL export | [API](docs/API_en.md) · [Architecture](docs/ARCHITECTURE_en.md) |
| Security | RP permission overlay, same-origin/loopback API, workspace path jail, CAS, DOMPurify, content-free operation log | [RP secure mode](docs/RP_SECURE_MODE_en.md) · [Security policy](SECURITY_en.md) |
| Debugging | Tavern Trace shows this turn's resources, world-book hits, and request/header alignment; it does not store full bodies | [DSH message flow](docs/DSH_MESSAGE_FLOW_en.md) |
| Third-party | v2 HTTP API, `pmpDshTavernChrome` mode service, DSH slots/store, standalone clients | [RP frontend integration](docs/FRONTEND_INTEGRATION_en.md) |

## Important boundaries

- “Preset” means SillyTavern-style sampling and prompt ordering, not a DSH agent preset.
- Greeting does not enter the timeline and is not forged as DSH history. Imported records are injected only on the first real request as `untrusted` read-only context.
- Display regex affects Mowan rendering only. It does not rewrite the model request, DSH original messages, or the authoritative text used for export.
- Mowan hides reasoning, tool context, and child-agent notices. Switch back to native DSH **Chat** for full runtime detail.
- There is no dynamic frontend loader that replaces all of Mowan from one config file. Full replacement requires a separate DSH plugin, a standalone web client, or a fork.
- DSH rc.8 outer **New session** has no public click-intercept seam. Mowan does not overlay it with private DOM. Create playthroughs with the `+` on a character card.
- This plugin targets local loopback DSH Web. Do not expose it to a LAN or the public internet.

## Documentation

- [Usage](docs/USAGE_en.md): all user features, steps, and compatibility boundaries
- [Installation](docs/INSTALLATION_en.md): install options, refresh recovery, backup, uninstall
- [HTTP API](docs/API_en.md): v1 resource contract and stable v2 RP surface
- [RP frontend integration](docs/FRONTEND_INTEGRATION_en.md): mode lifecycle, delivery, action composition
- [Architecture](docs/ARCHITECTURE_en.md): minimal-change rule, module boundaries, public DSH seams
- [Loader contract](docs/LOADER_CONTRACT_en.md): session selection, profile composition, runtime limits
- [DSH message flow](docs/DSH_MESSAGE_FLOW_en.md): native DSH flow and plugin insertion points
- [Prompt pipeline](docs/PROMPT_PIPELINE_en.md): ST format, macros, character fields, world-book coverage
- [RP secure mode](docs/RP_SECURE_MODE_en.md): what RP blocks and what it does not
- [World-book design](docs/world-book/DESIGN_en.md): World Info format, matching, projection contract
- [Changelog](docs/CHANGELOG.md)
- [Security policy](SECURITY_en.md)
- [Chinese documentation](README.md)

## Contributing

The project is [MIT License](LICENSE). Issues, pull requests, compatibility reports, and design discussion are welcome.

You do not need to fork the whole repo to build on this framework:

- Resource tools can use the public v1 API.
- RP views or DSH client plugins can use v2, the `pmpDshTavernChrome` lifecycle, and public DSH slots/store.
- A standalone web client can consume HTTP v2 only.
- Fork when you need to change the loader, resource model, or bundled Mowan itself.

Give third-party UI its own slot ids, clean up only its own surfaces, and dispose fully when leaving `play` or uninstalling. The mode service owns lifecycle. It does not arbitrate one slot among several plugins.

## References

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- [NemoPresetExt](https://github.com/NemoVonNirgend/NemoPresetExt)

Copyright © 2026 Zhu Bohan.
