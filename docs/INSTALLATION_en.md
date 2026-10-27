# Cross-platform installation and removal

[中文](INSTALLATION.md)

Tavern 3.1.5 requires independently installed and enabled Assembler 1.1.3. The two components ship separately. Tavern neither carries a private Assembler package nor downloads or starts one. Its required peer range is `~1.1.3`. See [integration](ASSEMBLER_INTEGRATION_en.md) for service ownership and optional Memory Manager.

[Request assembly](REQUEST_ASSEMBLY_en.md) covers layout CRUD, application, preview, recorded request references and legacy advanced configuration reads. Current targets are DSH **0.2.1-rc.2 / 0.2.1-rc.3**, requiring Node `^22.19.0 || >=24.0.0`. Tavern embeds its frontend in DSH Web and Desktop, without an additional standalone Web UI.

Host and DSH crypto peer ranges are `>=0.2.1-rc.2 <0.2.2-0`. Later versions in that range are admitted by policy, not a claim of individual runtime acceptance. Older full documentation remains at its Git tag.

## Install both independent components

Initialize the target DSH profile first. In GUI **Plugins → Add plugin**, paste these attachment URLs in order, installing and enabling each component:

1. Assembler 1.1.3.

   ```text
   https://github.com/Player-MINEPIG/dsh-prompt-assembler/releases/download/v1.1.3/dsh-prompt-assembler-1.1.3.tgz
   ```

2. Tavern 3.1.5.

   ```text
   https://github.com/Player-MINEPIG/dsh-tavern/releases/download/v3.1.5/pmp-dsh-tavern-3.1.5.tgz
   ```

Reload or restart the Host when the GUI requests it. If independent Assembler is already installed, check its version and enabled state. Registering a package in the profile does not establish that its bundle is enabled.

Before CLI installation or updates, stop the target Host. Put the target DSH on `PATH` and run both commands for the same profile:

```sh
dsh plugin --profile web add https://github.com/Player-MINEPIG/dsh-prompt-assembler/releases/download/v1.1.3/dsh-prompt-assembler-1.1.3.tgz
dsh plugin --profile web add https://github.com/Player-MINEPIG/dsh-tavern/releases/download/v3.1.5/pmp-dsh-tavern-3.1.5.tgz
```

These are prebuilt Release attachments. They do not require downloading Assembler 1.1.3 from npm. DSH runtime dependencies and Tavern's other regular dependencies retain their own installation mechanisms.

Market's "installed, effective after restart" means the package is registered, not that its plugins started. After restart, confirm that independent Assembler and Tavern both run, then open the assembly configuration and DT panel. If Assembler is missing or incompatible, install and enable a supported independent version, then reload or restart as directed by the Host. A version exemption cannot supply a missing dependency.

Current releases support Standard strategies on stock core only. Advanced remains frozen at Assembler 1.1.0 / DSH 0.2.0-rc.2, without a commitment to later adaptation. Plugin installation never patches DSH core.

<a id="upgrade-to-3-1-5"></a>
## Upgrade from a bundled Assembler version to 3.1.5

1. Stop the target Host. Back up Tavern storage, Assembler storage, the RP workspace and corresponding DSH data.
2. Install independent Assembler 1.1.3 in the same profile and select its bundle as enabled.
3. Keep the default Assembler storage at `<DSH_HOME>/dsh-prompt-assembler/`. Do not delete that directory or replace it with an empty copy.
4. If old Tavern configuration contains `assemblerStorageDir`, move that value to independent Assembler's `storageDir`, then remove the old Tavern field. Tavern 3.1.5 rejects the obsolete field rather than silently opening another strategy store. Keep Tavern's own `storageDir` unchanged.
5. Old Tavern `security` settings were also forwarded to Assembler. Copy the settings still needed for the assembly API into independent Assembler's `security`. Retain Tavern `security` settings that protect Tavern's own API.
6. Remove the old Tavern package while retaining its data directories. In GUI use **Uninstall pmp-dsh-tavern**; in CLI run `dsh plugin --profile web remove pmp-dsh-tavern`. Do not clear Tavern, Assembler or DSH data.
7. Reinstall Tavern using the 3.1.5 attachment URL above, confirm both bundles are enabled, and start the Host. Check character cards, strategies, session selections and Trace, then follow [runtime verification](TESTING_en.md).

pnpm can retain files from the formerly bundled Assembler during an overwrite, causing SDK resolution to find 1.1.2. This upgrade from a bundled version requires removing and reinstalling the Tavern package; an overwrite alone does not reliably clear that copy.

Default configuration without old custom fields needs no manual storage-path change. Tavern still merges missing entries from its legacy strategy storage into independent Assembler and preserves the original files. Installation and this upgrade do not rewrite DSH session history. Earlier external coordinates follow the [migration guide](DSH_0.1.7_MIGRATION_en.md). Existing V4 references need no new conversion; no rollback tool is provided.

Math is enabled by default and needs no additional KaTeX, font or renderer installation. Display and offline HTML export require a modern browser with MathML support. Older browsers may show symbols without correct typesetting. See [usage](USAGE_en.md#markdown-html-and-template-styles).

### Installation channels and address formats

DSH CLI, Web and desktop plugin management share a `pnpm add` installation path. The GUI Add plugin form accepts an npm package name, GitHub repository address, absolute local directory, or `.tgz` / `.tar.gz` package address. It installs and enables the bundle through `pluginManager.installBundle`. See the [GUI call](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.3/packages/client/ui-plugin-manager/src/client/manager-store.ts), [address parser](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.3/packages/boot/plugin-manager/src/install-spec.ts) and [shared installer](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.3/packages/boot/plugin-manager/src/index.ts).

- A repository address can include `#tag` or `#commit`. It installs the package at that Git revision without looking for GitHub Release attachments.
- `releases/download/tag/package.tgz` is a prebuilt attachment URL accepted for installation.
- `releases/tag/tag` is a Release webpage, not an installation address.
- GitHub's generated source `.tar.gz` can be recognized as an archive, but is not a prebuilt package. The current GUI does not accept source `.zip` archives.

Custom Market entries select `name@version` or a Git URL pinned to a commit. They do not automatically choose Release assets. See the [Market implementation](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.3/packages/util/plugin-market-index/src/index.ts).

Tavern declares shared Assembler through `peerDependencies`. DSH profiles use `nodeLinker: hoisted` and `autoInstallPeers: false`, so that peer declaration does not install Assembler. Install Assembler as a direct profile dependency instead of putting a GitHub address in Tavern's regular subdependencies. Neither source nor prebuilt Tavern declares `bundleDependencies` or contains a second Assembler package. Other Assembler consumers should also use public services and declare their compatible range.

### DSH provides the official runtime peers

Required peers `@deepseek-ai/dsh-util-crypto` and `@deepseek-ai/cordis` come from DSH instead of installing another copy. Their ranges are `>=0.2.1-rc.2 <0.2.2-0` and `4.0.5`, respectively. Browser contracts are declared through `dsh.client.inject` and supplied by DSH.

Static `pnpm peers check` does not recognize DSH runtime resolution and can report these official peers missing. Assembler is a separate third-party component that the user must install. Do not treat its absence as the same ignorable warning. Verify actual Host resolution and startup. A directory at profile top level or package lookup by ordinary Node alone is insufficient evidence.

If restart still produces `ERR_MODULE_NOT_FOUND`, check the target DSH version, installation completeness and actual module paths. Do not mark a required peer optional to hide a warning. DSH checks `engines.dsh` first and falls back to DSH peers when it is absent. Version admission does not establish runtime acceptance.

<a id="source-candidate"></a>
<a id="source-installation"></a>
### Install and package source

Use an isolated test profile initialized by the target DSH. Install and enable independent Assembler there first. Tavern's development lockfile pins a reviewed GitHub source archive and integrity. It does not require Assembler 1.1.3 to be published to npm.

```sh
git clone --branch v3.1.5 https://github.com/Player-MINEPIG/dsh-tavern.git
cd dsh-tavern
npm ci --legacy-peer-deps
node scripts/install.mjs --dsh-home /absolute/path/to/test-home --profile web
```

Start DSH with that same `DSH_HOME`, follow [developer verification](TESTING_en.md), and record the tested source revision. Updating the CLI does not update a profile's plugin. The scripts normalize macOS, Linux and Windows paths; Windows uses the npm PowerShell shim with an argument array. Install the repository root, not its internal packages. No compatibility exemption is needed.

Produce both independent prebuilt packages:

```sh
npm run pack:release -- --assembler node_modules/dsh-prompt-assembler
```

The command rebuilds both clients and writes separate Tavern and Assembler tarballs. Tavern compiles the reusable frontend SDK for its editor, but starts no additional Assembler Host or standalone client. The Tavern package must not contain `node_modules/dsh-prompt-assembler`. Validate final tarballs or actual Release attachments, rather than relying on dependencies available in the source checkout.

### Data and the source installer

Tavern creates `<DSH_HOME>/pmp-dsh-tavern/` on first start. Plain `dsh plugin remove` retains that directory without a pre-removal snapshot. For snapshots, check out the repository as above and use the uninstaller below.

The project installer updates Tavern only. It builds `dist/client.js`, calls `dsh plugin ... add` with an argument array, and requests a restart. Independently install and enable Assembler in the target profile before running it. Install development dependencies with `npm ci --legacy-peer-deps`.

Refresh materializes the worktree's declared `files` as independent copies to avoid stale pnpm snapshots or mixed hardlink versions. It leaves pnpm-managed nested `node_modules` untouched and verifies that replacements stay inside the selected profile. Without `--store-dir`, it reuses the store recorded in `.modules.yaml`.

When upgrading a version with package-local `data/`, stop the Host first. Before remove/add, the installer stages the old directory at `<DSH_HOME>/backups/pmp-dsh-tavern/pending-refresh-<profile>/` and restores it after success. On first start, if external storage is empty, the new Host copies the data to a sibling temporary directory and atomically publishes it, retaining the old copy. Existing external storage is never overwritten. If recovery fails, follow the installer's diagnostic and retain the pending directory until recovery finishes.

Useful options:

```text
node scripts/install.mjs --profile web
node scripts/install.mjs --skip-build
node scripts/install.mjs --dsh-home /absolute/test/home
node scripts/install.mjs --store-dir /absolute/pnpm/store
node scripts/install.mjs --dry-run
```

Use the direct `node` form to avoid npm and PowerShell argument-forwarding differences. Windows paths work in their native form, for example `node scripts/install.mjs --dsh-home .\test-envs\review`.

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

Removing Tavern retains independent Assembler and its data for other consumers. Disable dependent plugins before removing Assembler. Tavern never replaces it with a private instance.

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

For Standard and the historical advanced boundary, see [assembler integration](ASSEMBLER_INTEGRATION_en.md). Standard user context/pre-step persist in DSH history; they are not the advanced request-only transport.
