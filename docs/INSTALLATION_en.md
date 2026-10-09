# Cross-platform installation and removal

[中文](INSTALLATION.md)

Tavern 3.0.0 requires both Tavern and the independent assembler to be enabled. See [integration](ASSEMBLER_INTEGRATION_en.md) for service loading and optional Memory Manager v1.0.0. Older full documentation remains at its Git tag.

Request layout CRUD, application, preview, recorded request references and the optional advanced core extension are documented in [Request assembly](REQUEST_ASSEMBLY_en.md).

Current Tavern source supports DSH **0.2.0-rc.2**, requiring Node `^22.19.0 || >=24.0.0`. Frontend and backend ship in one plugin embedded in DSH Web/Desktop. No additional standalone Web UI is provided. For earlier versions, use the corresponding tag's documentation.

Retain backups and follow the [coordinate migration guide](DSH_0.1.7_MIGRATION_en.md) for older external references. Already migrated V4 references need no further conversion; no rollback tool is provided. Put the target DSH on `PATH` and initialize the intended profile before installation.

## Install current source

Updating current source requires the additional assembler bundle. Existing Tavern resources, settings, native sessions, timelines and Trace are retained; loader startup merges missing legacy strategy entries into assembler storage without rewriting the old file. Historical coordinate upgrades remain separate. Continue using DSH `0.2.0-rc.2`. Math is enabled by default and needs no separate KaTeX, font or renderer installation. Display and offline HTML exports require a modern browser with MathML support; older browsers may show symbols without correct typesetting. See [usage](USAGE_en.md#markdown-html-and-template-styles) for syntax and HTML composition boundaries.

Stop the target Host and enable Tavern 3.0.0 with standard Assembler v1.1.0. Standard strategies use stock core; advanced strategies require the optional addon plus protocol 1. Plugin installation never patches core:

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-prompt-assembler#v1.1.0
dsh plugin --profile web add github:Player-MINEPIG/dsh-tavern#v3.0.0
```

Optional resource management is provided by [Memory Manager v1.0.0](https://github.com/Player-MINEPIG/dsh-memory-manager/releases/tag/v1.0.0). To use it, additionally install it in the same profile, then restart the Host; generic resource assembly requirements are covered in [integration](ASSEMBLER_INTEGRATION_en.md#optional-memory-manager):

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-memory-manager#v1.0.0
```

<a id="source-candidate"></a>
<a id="source-installation"></a>
### Install and validate from source

Use an isolated test profile/home initialized with the target DSH:

```sh
git clone --branch v3.0.0 https://github.com/Player-MINEPIG/dsh-tavern.git
cd dsh-tavern
npm ci --legacy-peer-deps
node scripts/install.mjs --dsh-home /absolute/path/to/test-home --profile web
```

Start DSH with that same `DSH_HOME`, then follow [developer verification](TESTING_en.md). A CLI upgrade alone does not update the plugin in a profile. Record the tested source revision. The scripts normalize macOS/Linux/Windows paths; Windows uses the npm PowerShell shim with an argument array. Install only the repository root, not its internal packages. Installation/startup peer admission requires no compatibility exemption.

### DSH provides the runtime peers

The current `package.json` declares `@deepseek-ai/dsh-util-crypto` at `0.2.0-rc.2` and `@deepseek-ai/cordis` at `4.0.4` as required `peerDependencies` supplied by the DSH runtime, so the plugin does not install a second copy. Source builds and tests use the `0.2.0-rc.2` crypto package pinned in `devDependencies`. Browser contracts are declared in `dsh.client.inject`, supplied by DSH, and not bundled into Tavern.

DSH profiles use `nodeLinker: hoisted` and `autoInstallPeers: false`; DSH's profile package resolver supplies official dependencies from its installation at startup. Consequently, `dsh plugin add` or `pnpm peers check` may report these peers as missing because the static check does not recognize runtime resolution. Do not rely on a `<DSH_HOME>/profiles/node_modules` link being present, or on a standalone Node process outside DSH as the sole check; verify the Host's resolved versions and plugin startup.

An `ERR_MODULE_NOT_FOUND` after restart is not an ignorable install warning: check that DSH on `PATH` is the target `0.2.0-rc.2`, its installation is complete, and module resolution reaches its packages. Do not mark required peers optional to hide warnings. DSH installation and startup checks use the plugin’s declared DSH peer versions. Passing admission does not establish compatibility with every Host behavior; also check the target version and runtime acceptance results.

### Data and source installation

On first start, Tavern automatically creates `<DSH_HOME>/pmp-dsh-tavern/` and
does not ask the user to choose an internal storage location. Plain
`dsh plugin remove` removes only the package from the profile and retains that
directory, but it does not invoke this project's backup logic or create a
pre-removal snapshot. Clone the repository and use `npm run plugin:uninstall`
below when a snapshot is required.

For source development, safe migration from legacy package-local `data/`, or
the backup-aware uninstall flow below, clone the repository and install its
dependencies once:

```text
npm install --cache .npm-cache
npm run plugin:install
```

The installer builds `dist/client.js`, calls `dsh plugin ... add` without a
shell, and prints a restart reminder. Restart a currently running `dsh web`
process before review.

Stop the target `dsh web` process before updating an existing installation.
Repeated installation does not touch the persistent directory because it sits
outside the package. To bridge installations that still use package-local
`data/`, the script stages that legacy directory under
`<DSH_HOME>/backups/pmp-dsh-tavern/pending-refresh-<profile>/` before remove/add
and restores it into the new package after add. On the next Host start, if the
external directory is empty, Tavern copies the legacy tree through a sibling
temporary directory, publishes it atomically at `<DSH_HOME>/pmp-dsh-tavern/`,
writes a migration marker, and retains the old copy. A populated external
directory is never overwritten and produces a warning. If remove/add fails,
the error prints the pending path; the next installer run repairs dependency
registration and resumes recovery. Do not delete that directory while recovery
is due.

The refresh still materializes the worktree's declared `files` entries as
independent copies to avoid stale pnpm directory snapshots and mixed hardlink
versions. It leaves pnpm-managed nested `node_modules` untouched and validates
that the install target stays inside the selected profile. When `--store-dir`
is omitted, it reuses the store recorded in `node_modules/.modules.yaml` to
avoid `ERR_PNPM_UNEXPECTED_STORE`.

Useful options:

```text
node scripts/install.mjs --profile web
node scripts/install.mjs --skip-build
node scripts/install.mjs --dsh-home /absolute/test/home
node scripts/install.mjs --store-dir /absolute/pnpm/store
node scripts/install.mjs --dry-run
```

Use the direct `node` form when passing options. This avoids npm-version and
PowerShell differences in forwarding arguments after `npm run`.

Windows paths may be passed normally, for example:

```text
node scripts/install.mjs --dsh-home .\test-envs\review
```

## Release verification

Before packaging or installing the current source, run the release verification command (its name remains `verify:2.0`):

```text
npm run verify:2.0
```

The command covers Trace v3 and the real AgentLoop, session-coordinate codecs,
history/cursor guards, managed documents and CAS, import claim/lineage, chrome and
slot ownership, localization, and installation boundaries. It then builds the
tracked browser bundle and performs `npm pack --dry-run`.

Set `DSH_TAVERN_COMPAT_ROOT` and `DSH_TAVERN_PROMPT_COMPAT_ROOT` to the target DSH
installation dependency root to enable real runtime checks; without them, those
checks explicitly skip. Run `npm run check` for the complete suite as well.
These commands do not replace [target Host and browser verification](TESTING_en.md).

## Uninstall

Use a separate workspace for ordinary conversations rather than DSH native **New Session** inside the RP workspace. DSH may reuse a same-workspace blank session that has not started a turn, even when it already has a Tavern character or title. Uninstalling Tavern does not clear session titles, per-session resource selections or workspace playthrough records, so reinstalling can restore old character bindings and grouping.

If you still repurpose a session in the RP workspace for ordinary chat, first unbind its character in the character panel and confirm detaching it from the old playthrough, unbind its preset, user persona and explicitly selected world books, turn RP off, and check the independent assembler's applied sources and custom text before uninstalling. Unbinding affects future requests without deleting resources or existing messages. Rename an old title manually through the native DSH session menu. Tavern's panels are unavailable after removal; reinstall first if you need them for cleanup.

```text
npm run plugin:uninstall
```

Before calling `dsh plugin ... remove`, the uninstaller copies the default
persistent directory to:

```text
<DSH_HOME>/backups/pmp-dsh-tavern/<timestamp>/
```

The default source is `<DSH_HOME>/pmp-dsh-tavern/`. It holds presets,
normalized character cards, PNG cover images under
`character-artifacts/` when a card was imported from PNG, standalone world books under
`world-books/`, three-field user resources under
`users/`, schema 4 Trace metadata/official-history references in
`tavern-trace-records.json`, and per-session resource selections. An upgraded
directory may also retain read-only legacy `tavern-traces.json` metadata and
legacy `tavern-assemblies.json` schema 3 body snapshots; the latter may contain
sensitive prompts. Copy the whole directory when backing up; copying only
`presets/` loses other resources, audit metadata and bindings. In particular,
the same tree holds `state.json`, `character-state.json`,
`user-world-book-bindings.json`, `resource-world-book-bindings.json`,
`session-templates.json`, `chrome.json`, `play-workspace.json`,
`import-context-bindings.json`, `ui-settings.json` (locale, outer UI scale,
character-follow RP), `conversation-settings.json` (Mowan RP text and
message-action scale), and optional `rp-policy.json`.

`play-workspace.json` is only a pointer. The selected DSH RP workspace owns the
actual `catalog.json`, per-playthrough `timeline.json`, display regex document,
and imported context files, while session bodies and branch history referenced
by the timeline remain in the corresponding `DSH_HOME` official session logs.
If playthroughs must be recoverable, back up Tavern's persistent directory, the
RP workspace, and the corresponding DSH data, including session logs and
inherited dependencies. An ST JSONL export preserves only the selected linear
chat and known swipes, not the complete Tavern branch topology.

Choose another backup directory or deliberately skip backup with:

```text
node scripts/uninstall.mjs --backup-dir /absolute/backup/path
node scripts/uninstall.mjs --storage-dir /absolute/custom/storage
node scripts/uninstall.mjs --no-backup
```

`--storage-dir` snapshots an explicitly configured custom storage directory.
`--no-backup` skips only this snapshot. Ordinary removal still retains the
default or custom persistent directory and does not delete an external ST file
used for import. If the user explicitly wants to purge data, delete the
persistent directory separately after confirming a backup; package removal
does not implicitly erase user content.

All common options work for uninstall too: `--profile`, `--dsh-home`,
`--store-dir`, `--storage-dir`, and `--dry-run`. Use `--help` for the complete
command summary.

For the standard and optional core packages, see [assembler integration](ASSEMBLER_INTEGRATION_en.md). Standard user context/pre-step persist in DSH history; they are not the advanced request-only transport.
