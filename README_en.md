# pmp-dsh-tavern

[中文](README.md)

A SillyTavern compatibility plugin that keeps DeepSeek Harness (DSH) authoritative over sessions and execution, with frontend and backend APIs for composing Tavern capabilities with native DSH features.

> The current source is the unreleased `2.3.0` Trace candidate and targets DSH `0.1.5-rc.1`. [MIT License](LICENSE).
>
> Tavern Trace records identifiable prompt sections in the official format, stores bounded schema 4 metadata and official Session references, and verifies and restores bodies that remain available when detail is read. See [API/design](docs/PROMPT_API_V3_en.md) and [acceptance/manual checks](docs/TRACE_REVIEW_en.md).
>
> The default project README is the [Chinese version](README.md). This English file has no screenshots.

## Design

pmp-dsh-tavern does not replace DSH with another UI, and it does not copy conversation history. It adds a testable, auditable, uninstallable Tavern compatibility layer on top of public DSH extension points and atomic APIs:

- **Lingzhu / DSH native mode**: keep native DSH sessions, sidebar, and plugin ecosystem.
- **Mowan / RP mode**: regroup the RP sidebar by character card and playthrough, and provide greeting, display regex, swipe, branch, rollback, import, and export.
- **DSH remains authoritative**: durable history, tools, permissions, and the final model request stay owned by DSH.
- **Minimal change, maximum compatibility**: reuse public DSH seams first; do not replace the native frontend or depend on private DOM.
- **Original sessions stay readable after uninstall**: the plugin stores resources, selections, playthrough pointers, display metadata, and bounded Trace metadata/official-history references. It does not forge, overwrite, or copy DSH history bodies.

The dual-mode design is the compatibility mechanism. Outside Mowan, the user still sees ordinary DSH. The plugin mounts its RP surface only after entering RP mode.

## Security warning

Installing this plugin lets its code run in the DSH Host and the browser page. Install only from a trusted repository and commit. Review changes and back up plugin data before updating. The following controls reduce risk; **they are not OS-level isolation or account authentication**:

- **Agent and tool risk**: presets, character cards, world books, imported records, and user messages can contain prompt injection. A high-privilege Agent may still call approved terminal, file, network, browser, or other plugin capabilities when induced. Do not put secrets in the conversation. Keep DSH approval and sandboxing, and enable tools with least privilege.
- **RP secure-mode boundary**: RP mode adds read-only and high-risk tool limits on top of DSH permissions, and child agents inherit that overlay. It is not a VM, container, or system sandbox. It cannot constrain other local processes, and it cannot turn a malicious prompt into trusted content.
- **Backend and API risk**: v1/v2/v3 APIs target local loopback. Host, Origin, and Content-Type checks are not login authentication. A local malicious process can still reach them. Do not expose DSH Web or this plugin API to a LAN or the public internet. A reverse proxy must add its own TLS, authentication, and trusted Host configuration.
- **Frontend rendering risk**: model output is parsed as Markdown and sanitized with DOMPurify, but allowed remote images or styles can still make network requests and expose the visitor IP. Display regex uses JavaScript `RegExp`; catastrophic backtracking can freeze the page. Import and enable only templates and regex you trust.
- **Data and lifecycle risk**: swipe, branch, and playthroughs create real DSH sessions and can increase disk use. revision/CAS, path checks, and atomic writes do not replace backups and do not turn several API calls into a cross-file transaction.

If behavior looks suspicious, stop the Agent, switch back to DSH native mode, and inspect the original session and tool records. Full threat model, implemented boundaries, and vulnerability reporting: [Security policy](SECURITY_en.md). RP interception list: [RP secure mode](docs/RP_SECURE_MODE_en.md).

## Quick Start: first RP turn from a character card

### 0. Install

This page describes only the current `2.3.0` candidate. A direct GitHub install must pin its candidate branch:

Target DSH `0.1.5-rc.1` requires Node.js `^22.19.0 || >=24.0.0`, with `dsh` on `PATH` and an initialized profile (default `web`). Tavern standalone tests support Node 20; that does not establish Node 20 support for the target Host.

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-tavern#codex/trace-api-v3
```

For another version, switch to its tag and read the installation instructions in that tag. For source development, safe migration from legacy package-local data, or the project's backup-aware uninstall flow, follow the [source-candidate installation steps](docs/INSTALLATION_en.md#source-candidate) and check out the same candidate branch:

```sh
git clone --branch codex/trace-api-v3 https://github.com/Player-MINEPIG/dsh-tavern.git
cd dsh-tavern
npm install --cache .npm-cache
npm run plugin:install
```

Restart DSH Web after install. Tavern stores character cards, presets, world books, settings, and bindings under `<DSH_HOME>/pmp-dsh-tavern/` by default. Plain `dsh plugin remove` retains that directory but does not create a pre-removal snapshot; clone the repository and use its uninstaller when a snapshot is required. On the first upgrade from a version that still stores data inside the package, stop the target `dsh web` and use the project installer so pnpm cannot replace the old package before its data is preserved. The new Host copies that data to the external directory on first start and retains the old copy. Other profiles, a separate `DSH_HOME`, manual install, backup, and uninstall: [Installation](docs/INSTALLATION_en.md).

### 1. Import a character card

Left-click the `DT` orb, open **Character card**, and import a SillyTavern JSON or PNG card. Import creates a resource only. It does not forge a session or send a message.

### 2. Create a DSH workspace

Return to native DSH and create a workspace that will be used for RP. All playthrough sessions go into that one workspace so character chats do not scatter across ordinary work.

### 3. Enter the RP frontend and choose the workspace

Right-click the `DT` orb, or choose **Switch to custom frontend mode** in the menu. The first time you enter Mowan, the plugin requires an explicit choice from existing DSH workspaces. It does not enter RP content until write and read-back succeed.

### 4. Create a playthrough

In the RP sidebar, click `+` on the imported character card. The plugin creates or reuses that character's latest fully empty `Playthrough N`, and binds the root session to the card you actually clicked. Generated names follow the UI language; explicit renames remain unchanged.

### 5. Choose a greeting

An empty playthrough's opening dock shows the card greeting. Alternate greetings can be chosen with the left/right buttons. This is display and first-turn prompt reference only. It is never forged as an assistant reply that already happened.

### 6. Start chatting

Send the first user message from the native DSH composer. It appears immediately in the RP view. After that you can swipe, branch a new playthrough, roll back in the same playthrough, edit display text, and import/export.

Full operations and boundaries: [English usage guide](docs/USAGE_en.md).

## Feature map

| Area | Main capabilities | Details |
| --- | --- | --- |
| Resources | ST presets, V1/V2/V3 JSON/PNG cards, standalone/embedded world books, user profiles, bindings, export | [Usage](docs/USAGE_en.md) |
| RP frontend | Character/playthrough sidebar, greeting, body rendering, display regex, swipe, branch, rollback, display-layer edit | [Usage](docs/USAGE_en.md) |
| Playthrough data | Authoritative DSH sessions, tree timeline, workspace catalog, first-turn read-only import injection, static HTML and ST JSONL export | [API](docs/API_en.md) · [Architecture](docs/ARCHITECTURE_en.md) |
| Security | RP permission overlay, same-origin/loopback API, workspace path jail, CAS, DOMPurify, content-free operation log | [RP secure mode](docs/RP_SECURE_MODE_en.md) · [Security policy](SECURITY_en.md) |
| Debugging | Tavern Trace stores per-request section/provenance metadata and official-history references; details verify and read recoverable section bodies on demand, while source bodies are not stored | [Trace API/design](docs/PROMPT_API_V3_en.md) |
| Workspace diagnostics | DT → Diagnostics shows current RP workspace problems with recheck and copy actions; the sidebar summary is dismissible and affected playthroughs retain warning buttons | [Usage](docs/USAGE_en.md) |
| Third-party | v2 HTTP API, `pmpDshTavernChrome` mode service, DSH slots/store, standalone clients | [RP frontend integration](docs/FRONTEND_INTEGRATION_en.md) |

See the [feature gallery](docs/assets/market/README.md#gallery) for annotated examples of message actions, swipe-linked continuations, native Agent capabilities, session-bound assets, ST-compatible resources, display regex, and native/RP views.

## Important boundaries

- “Preset” means SillyTavern-style sampling and prompt ordering, not a DSH agent preset.
- Greeting does not enter the timeline and is not forged as DSH history. Imported records are injected only on the first real request as `untrusted` read-only context.
- Display regex affects Mowan rendering only. It does not rewrite the model request, DSH original messages, or the authoritative text used for export.
- Mowan hides reasoning, tool context, and child-agent notices. Switch back to native DSH **Chat** for full runtime detail.
- There is no dynamic frontend loader that replaces all of Mowan from one config file. Full replacement requires a separate DSH plugin, a standalone web client, or a fork.
- The target DSH outer **New session** control has no public click-intercept seam for Tavern. Mowan does not overlay it with private DOM. Create playthroughs with the `+` on a character card.
- This plugin targets local loopback DSH Web. Do not expose it to a LAN or the public internet.

## Documentation

- [Usage](docs/USAGE_en.md): all user features, steps, and compatibility boundaries
- [Installation](docs/INSTALLATION_en.md): install options, refresh recovery, backup, uninstall
- [HTTP API](docs/API_en.md): v1 resource contract and stable v2 RP surface
- [Trace v3 API and design](docs/PROMPT_API_V3_en.md): historical assembly indexes, official references, and on-demand body reads
- [RP frontend integration](docs/FRONTEND_INTEGRATION_en.md): mode lifecycle, delivery, action composition
- [Architecture](docs/ARCHITECTURE_en.md): minimal-change rule, module boundaries, public DSH seams
- [Loader contract](docs/LOADER_CONTRACT_en.md): session selection, profile composition, runtime limits
- [DSH message flow](docs/DSH_MESSAGE_FLOW_en.md): native DSH flow and plugin insertion points
- [Prompt pipeline](docs/PROMPT_PIPELINE_en.md): ST format, macros, character fields, world-book coverage
- [RP secure mode](docs/RP_SECURE_MODE_en.md): what RP blocks and what it does not
- [World-book design](docs/world-book/DESIGN_en.md): World Info format, matching, projection contract
- [Playthrough acceptance](docs/PLAY_REVIEW_en.md) and [Trace acceptance](docs/TRACE_REVIEW_en.md)
- [Changelog](docs/CHANGELOG.md)
- [Security policy](SECURITY_en.md)
- [Chinese documentation](README.md)

## Contributing

The project is [MIT License](LICENSE). Issues, pull requests, compatibility reports, and design discussion are welcome.

You do not need to fork the whole repo to build on this framework:

- Resource tools can use the public v1 API.
- RP views or DSH client plugins can use v2, the `pmpDshTavernChrome` lifecycle, and public DSH slots/store.
- Debugging and audit tools can read historical assemblies through v3. To observe or adjust the current assembly, use DSH's official `system-prompt/assemble`; use official `llm/stream` to observe the complete request.
- A standalone web client can consume HTTP v2 only.
- Fork when you need to change the loader, resource model, or bundled Mowan itself.

Give third-party UI its own slot ids, clean up only its own surfaces, and dispose fully when leaving `play` or uninstalling. The mode service owns lifecycle. It does not arbitrate one slot among several plugins.

## References

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- [NemoPresetExt](https://github.com/NemoVonNirgend/NemoPresetExt)

Copyright © 2026 Zhu Bohan.
