# Independent Prompt Assembler integration

[中文](ASSEMBLER_INTEGRATION.md) · [Assembly behavior](REQUEST_ASSEMBLY_en.md) · [Plugin repository](https://github.com/Player-MINEPIG/dsh-prompt-assembler)

Tavern 3.1.5 requires independently installed and enabled Standard Assembler 1.1.3. Its required peer range is `~1.1.3`. Assembler owns strategy storage, source registration, request hooks, the secure API and independent configuration entry. It has no package dependency on Tavern or Memory Manager. Tavern and other plugins consume the same public service without owning private copies.

The Assembler repository owns `adapters/tavern` and `adapters/memory-manager`, which consume providers' public read-only services. Sources retain ownership of their data, parsing and permissions. DSH durable history remains authoritative. Third parties can fork the repository or contribute adapter changes.

Advanced remains frozen at Assembler `1.1.0` / DSH `0.2.0-rc.2`, without a commitment to later adaptation. Current releases distribute Standard only and contain no newer core changes. Advanced semantics below explain legacy configurations and historical records.

## Installation and upgrade

Install and enable Assembler in the same DSH profile before Tavern. GUI **Plugins → Add plugin** accepts the two Release attachment URLs below. Stop the target Host before CLI operations:

```sh
dsh plugin --profile web add https://github.com/Player-MINEPIG/dsh-prompt-assembler/releases/download/v1.1.3/dsh-prompt-assembler-1.1.3.tgz
dsh plugin --profile web add https://github.com/Player-MINEPIG/dsh-tavern/releases/download/v3.1.5/pmp-dsh-tavern-3.1.5.tgz
```

Install both prebuilt packages separately. They do not require publishing or downloading npm Assembler 1.1.3. Tavern no longer carries Assembler or installs it when the peer is missing. The target DSH uses `autoInstallPeers: false`; package registration and bundle activation are different operations. Reload or restart when requested by the GUI, then check both components' startup.

When upgrading from 3.0.5 or a bundled candidate, default Assembler storage stays at `<DSH_HOME>/dsh-prompt-assembler/`. Retain Tavern data, strategies and session selections without rewriting history. Move an old custom `assemblerStorageDir` to independent Assembler's `storageDir` and remove the field from Tavern configuration. Version 3.1.5 rejects that obsolete field. Copy security settings previously forwarded to Assembler into its own `security`; retain Tavern `security` settings needed by Tavern. See the complete [upgrade procedure](INSTALLATION_en.md#upgrade-to-3-1-5).

## Shared services and lifecycle

The public `dshPromptAssembler` service exposes its actual running `version`, strategy store, source registry and assembly runtime. Tavern checks the service version and required capabilities before supplying resources through `attachTavern`. An SDK import does not establish that the service is running, or that the SDK and runtime came from the same package copy.

Tavern's DSH bundle uses the dependency-safe `packages/tavern-loader/src/host.js` (also exported as `pmp-dsh-tavern/host`) entry. Public SDK exports at the root and `./loader` remain available. Missing, disabled or incompatible independent Assembler never triggers a private Tavern instance. Tavern mounts its dependent runtime when the service is enabled. Disabling that service stops its consumers.

Removing Tavern unregisters only its sources, resource provider and UI. Independent Assembler strategies, entry, native DSH sources and other consumers remain available. Disable dependent plugins before removing Assembler. Tavern does not restore a formerly bundled copy. Default persistent storage and strategy files are retained; independent Assembler configuration owns custom storage paths.

Other plugins use the same public service and declare a compatible peer when importing the SDK. A source plugin can own its registration lifecycle as follows:

```js
export const inject = ['dshPromptAssembler']
export function apply(ctx) {
	const stop = ctx.dshPromptAssembler.registry.register(source)
	ctx.effect(() => stop)
}
```

Do not depend on another plugin's nested `node_modules` path or substitute SDK-class `instanceof` for service protocol checks. Different physical copies can have different module identities even when their versions match.

## Tavern's integration seam

Tavern consumes the shared Assembler store, registry and runtime. `attachTavern` supplies read-only resources, session leases, presets and final policy checks. Standard contributes official sections/context and accepted pre-step messages. Only the historical advanced addon owns protocol-1 request replacement. Standard Trace verifies durable system/context and complete native request references; legacy advanced Trace references one request/assembly per request. Tavern retains resource editing, restricted EJS and MVU commits.

Tavern no longer creates a local Assembler fallback. The legacy `tavernRequestSources` name still references the shared registry. Public resource APIs, assembly forwarding APIs and root SDK exports remain available. Missing source modules report diagnostics without recreating resources or rewriting native history.

The UI uses Assembler's `/dsh-prompt-assembler/api/v1/assembly-presets`, secure fetch and read-only actual-request endpoint. Legacy Tavern assembly-presets routes still forward to the same store/runtime. Current records use owner `dsh-prompt-assembler`; prior `pmp-dsh-tavern` records remain readable. Legacy migration only merges missing entries and preserves the original file. New applications bind by session ID and take precedence over old play/native scopes, including after reinstalling Tavern.

Assembler owns **Plugins → Installed plugins → dsh-prompt-assembler → Configure current session**. Tavern's embedded assembly panel retains the reusable frontend SDK and edits the same strategy library and session binding through public APIs. Tavern starts no additional standalone Assembler client. The last successful application determines future request snapshots. Editing a draft or saving a strategy leaves the applied snapshot unchanged. Both panels use the Assembler refresh event to synchronize applied state while preserving their own unsaved drafts.

## Modules and text parsers

The module menu lists only sources supplying current independent content. Dispersed content remains usable through the provider's `parseText(context, rule)` and `inputMode:'text'`. Both modes share placement, depth, role and snapshot behavior.

Tavern has one `tavern.text` entry, applying restricted EJS, content references and ST macros in order. Referenced bodies never execute EJS again. DSH `dsh.text` uses native variable interpolation. Third-party sources retain their own parser/renderer. Each module describes fields, origin, editing support and the editing location. Preview exposes resource identity and bodies.

## Optional Memory Manager

[dsh-memory-manager v1.0.0](https://github.com/Player-MINEPIG/dsh-memory-manager/releases/tag/v1.0.0) is an independent optional extension. Neither Tavern package nor Host service dependencies require it. While installed it provides resource inspection, usage rules and observed application facts. Removal revokes management leases so subsequent requests use source defaults, preserving DSH sessions, source content and the Manager configuration file. Reinstallation reapplies retained rules; those rules are not permanently copied into Tavern or assembler. The assembler owns `adapters/memory-manager`; removal withdraws that generic source while Tavern continues providing native MVU and world books.

Install the released v1.0.0 in the same profile while the Host is stopped, then restart DSH. Open **Memory Manager** in Settings or an existing conversation tab:

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-memory-manager#v1.0.0
```

That Manager release was validated only on DSH `0.2.0-rc.2`; support for the current target requires separate validation. Configure generic resource retrieval in Manager and select `memory-manager.resources` in an assembler strategy to provide those resources to the model; this path requires a Host supporting request-assembly protocol 1. Native DSH Skill calls and Tavern’s source-owned world-book, MVU and template contributions use their own paths. See the v1.0.0 [installation guide](https://github.com/Player-MINEPIG/dsh-memory-manager/blob/v1.0.0/docs/INSTALLATION_en.md), [usage guide](https://github.com/Player-MINEPIG/dsh-memory-manager/blob/v1.0.0/docs/USAGE_en.md) and [assembler integration](https://github.com/Player-MINEPIG/dsh-memory-manager/blob/v1.0.0/docs/ASSEMBLER_en.md).

## Source development and separate packaging

The production installation graph has independent Assembler and Tavern as two direct profile dependencies. Tavern declares compatibility through `peerDependencies`; it neither uses a GitHub URL as a regular subdependency nor declares `bundleDependencies`. The target pnpm restricts Git/URL subdependencies by default. Installing both directly does not require relaxing that policy.

Development and builds use the Assembler source archive pinned by the lockfile. `npm ci --legacy-peer-deps` installs the reviewed revision and integrity without requiring npm version 1.1.3. For independent Assembler development, check out its matching source and run its `npm ci` and `npm run check`. To test local changes together, use `npm install --no-save --package-lock=false --legacy-peer-deps /path/to/assembler` in a temporary checkout, without committing the temporary path.

```sh
npm run pack:release -- --assembler node_modules/dsh-prompt-assembler
```

The command rebuilds both clients and writes separate Assembler and Tavern tarballs. Tavern compiles the reviewed frontend SDK into its editor, but its package contains no second Assembler package or Host. Prepare development dependencies for both source directories before building. See [v1.1.0 installation and rollback](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/INSTALLATION_en.md) for the frozen advanced version. Standard backend behavior and legacy advanced diagnostics are described in [Assembler 1.1.3 backend rules](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.3/docs/BACKENDS_en.md).

[API surfaces](API_SURFACES_en.md) · [Tavern architecture](assets/architecture/tavern.en.html) · [Combined architecture](assets/architecture/ecosystem.en.html).
