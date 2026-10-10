# Independent Prompt Assembler integration

[中文](ASSEMBLER_INTEGRATION.md) · [Assembly behavior](REQUEST_ASSEMBLY_en.md) · [Plugin repository](https://github.com/Player-MINEPIG/dsh-prompt-assembler)

Tavern depends on `dsh-prompt-assembler` at exact npm version `1.1.0` (the lockfile verifies package integrity; source corresponds to GitHub `v1.1.0`). The assembler owns strategy storage, source registration, the request hook, secure API and Settings entry, without package dependencies on Tavern or Memory Manager. Its repository owns the Tavern/Manager adapters, which consume public read-only services. Third parties can fork it or submit adapter PRs. Sources retain data, parsing and permission ownership; DSH durable history remains authoritative.

## Optional Memory Manager

[dsh-memory-manager v1.0.0](https://github.com/Player-MINEPIG/dsh-memory-manager/releases/tag/v1.0.0) is an independent optional extension. Neither Tavern package nor Host service dependencies require it. While installed it provides resource inspection, usage rules and observed application facts. Removal revokes management leases so subsequent requests use source defaults, preserving DSH sessions, source content and the Manager configuration file. Reinstallation reapplies retained rules; those rules are not permanently copied into Tavern or assembler. The assembler owns `adapters/memory-manager`; removal withdraws that generic source while Tavern continues providing native MVU and world books.

Install the released v1.0.0 in the same profile while the Host is stopped, then restart DSH. Open **Memory Manager** in Settings or an existing conversation tab:

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-memory-manager#v1.0.0
```

It targets DSH `0.2.0-rc.2`. Configure generic resource retrieval in Manager and select `memory-manager.resources` in an assembler strategy to provide those resources to the model; this path requires a Host supporting request-assembly protocol 1. Native DSH Skill calls and Tavern’s source-owned world-book, MVU and template contributions use their own paths. See the v1.0.0 [installation guide](https://github.com/Player-MINEPIG/dsh-memory-manager/blob/v1.0.0/docs/INSTALLATION_en.md), [usage guide](https://github.com/Player-MINEPIG/dsh-memory-manager/blob/v1.0.0/docs/USAGE_en.md) and [assembler integration](https://github.com/Player-MINEPIG/dsh-memory-manager/blob/v1.0.0/docs/ASSEMBLER_en.md).

## Installation and development

Tavern 3.0.2 automatically installs and loads standard `dsh-prompt-assembler` v1.1.0 and automatically loads its Host and browser entries. The optional `dsh-prompt-assembler-core` is not a production dependency. Users only need to install Tavern:

```sh
dsh plugin --profile web add pmp-dsh-tavern@3.0.2
```

The fixed GitHub tag and the Tavern `.tgz` attached to the Release are alternatives. Source installation still downloads dependencies; prebuilt Tavern packages already include standard Assembler and need no second package:

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-tavern#v3.0.2
```

### Coexistence with standalone Assembler

To use Assembler independently of Tavern, install it in the same profile:

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-prompt-assembler#v1.1.0
```

The composition entry prefers an independently enabled Assembler. Either installation order runs one Host instance and one set of browser entries. Installing standalone later releases the bundled instance before handing over. Disabling or removing standalone restores the bundled instance while Tavern remains enabled. Removing Tavern leaves an independent instance running; disabling or removing both releases all assembly hooks, routes and UI entries.

Default instances share `<DSH_HOME>/dsh-prompt-assembler/`; switching, updating or restarting does not delete strategies or session selections. If standalone uses a custom storage directory, configure Tavern's `assemblerStorageDir` to the same path to share existing settings. npm dependencies alone do not automatically activate DSH bundles: Tavern's composition entry handles loading, while its business loader retains the `dshPromptAssembler` service dependency.

Clone the assembler separately for source development and run `npm ci` and `npm run check` there. Tavern's `npm ci` uses the npm package pinned by its lockfile. To test local changes together, use `npm install --no-save --package-lock=false /path/to/assembler` in a temporary checkout, without committing the temporary path.

Standard strategies execute on stock rc.2 through public sections/context/pre-step. Advanced strategies require the separately packaged core addon and a prepared protocol-1 core. Legacy strategies without a backend remain advanced and fail explicitly when capabilities are absent. Plugin installation never modifies core. See the assembler [backend rules](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/BACKENDS_en.md).

## Tavern's integration seam

Tavern shares the assembler store, registry and runtime, supplying read-only resources, session leases, both preset backends and final policy checks through `attachTavern`. Standard contributes official sections/context and accepted pre-step messages; only the optional addon owns protocol-1 request replacement. Standard Trace verifies durable system/context and complete native request references; advanced Trace references one request/assembly per request. Tavern retains resources, restricted EJS, MVU commits and Trace presentation. Legacy `tavernRequestSources` and package exports continue forwarding.

The UI uses the assembler's `/dsh-prompt-assembler/api/v1/assembly-presets`, secure fetch and read-only actual-request endpoint. Legacy Tavern assembly-presets routes still forward to the same store/runtime, and Trace continues resolving recorded requests from DSH. Current records use owner `dsh-prompt-assembler`; prior `pmp-dsh-tavern` records remain readable. Legacy migration only merges missing entries and preserves the original file. New applications bind by session ID and take precedence over old play/native scope, including after reinstalling Tavern.

The standalone Settings → Prompt assembly entry and embedded Tavern panel share the strategy library and session binding, with no plugin priority. The last successful application determines the snapshot for future requests. Editing a draft or saving a strategy leaves the applied snapshot unchanged. Both panels use the assembler refresh event to synchronize applied status while preserving their own unsaved drafts.

Removing Tavern unregisters its sources and read provider. The assembler entry, strategies and native DSH text remain usable. Missing source modules report diagnostics without rebuilding absent resources or rewriting native history. The Manager adapter consumes public services; native assembly does not require Manager installation.

## Modules and text parsers

The module menu lists only sources supplying current independent content. Dispersed content remains usable through the provider's `parseText(context, rule)` and `inputMode:'text'`; both modes share placement, depth, role and snapshot behavior.

Tavern has one `tavern.text` entry: restricted EJS, content references, then ST macros. Referenced bodies never execute EJS again. DSH `dsh.text` uses native variable interpolation; third-party sources retain their own parser/renderer. Each module describes fields, origin, editing support and the editing location. Preview exposes resource identity and actual bodies.

## GitHub dependency representation

The dependency graph is Tavern → standard assembler; the optional addon peers with that same assembler, while Manager remains optional. No submodule is needed. The source manifest pins npm version `1.1.0`, and the lockfile verifies package integrity. GitHub/Market installations download this dependency through the package manager. The source manifest declares no `bundleDependencies`, because GitHub archives have no `node_modules`. Only prebuilt packaging declares this dependency bundled and includes the selected Assembler package inside the Tavern tgz; the additional Assembler tgz is for optional standalone use. Installing only Tavern loads the Host service through its composition entry. Public-directory submissions, tags, releases and npm publishing remain separate actions.

[API surfaces](API_SURFACES_en.md) · [Tavern architecture](assets/architecture/tavern.en.html) · [Combined architecture](assets/architecture/ecosystem.en.html).

Pack standard assembler and Tavern with `npm run pack:with-assembler`; add `-- --with-core` only to generate the optional addon too. Without that flag, the receipt contains Tavern with bundled Assembler and the optional standalone Assembler package; installing both is not required. Neither standard tarball contains core-preparation tooling. The core addon installs separately after preparation; see its [README](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/core-extension/README_en.md).

The packaging command rebuilds both clients first and embeds the assembler source being packaged (including a directory selected with `--assembler`) into Tavern. This keeps the embedded panel and backend strategy formats aligned. Install build dependencies in both source directories before running it.
