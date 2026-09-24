# Cross-platform installation and removal

The current DSH target is `0.1.7-rc.1`. When moving existing playthroughs from the earlier DSH coordinate format, follow the [upgrade guide](DSH_0.1.7_MIGRATION_en.md) first. This DSH version requires Node `^22.19.0 || >=24.0.0`, regardless of Tavern's standalone Node 20 declaration.

[中文](INSTALLATION.md)

This guide covers Tavern `2.4.2`; only DSH `0.1.7-rc.1` is supported. Upgrade old external history references with the migration guide and retain pre-upgrade backups; no rollback tool is provided. The default root [README](../README.md) is Chinese. The English landing page is [README_en.md](../README_en.md) (no screenshots). This file is the current lifecycle, verification, and recovery contract. For another version, switch to its tag and read the installation instructions in that tag.

The scripts use Node.js as their common entry point and normalize paths for
Windows, macOS, and Linux. macOS/Linux execute `dsh` directly. Windows safely
locates npm's `dsh.ps1` shim and invokes it through the system PowerShell with
an argument array, so paths are not reconstructed as shell command text. Run
the scripts from the `dsh-tavern` checkout with Node.js 20 or newer and target DSH
`0.1.7-rc.1` on `PATH`; starting its Host requires the Node range above.

Only the repository root is installed. `packages/tavern-format`,
`packages/preset`, and `packages/tavern-loader` are internal boundaries shipped
inside that one plugin; do not try to add them to dsh separately. The format
layer can be consumed as a JavaScript library through the root package export,
but by itself it intentionally has no agent-loading effect.

## Install 2.4.2

DSH rc.1 checks declared DSH peer versions at installation and startup. Tavern 2.4.2 matches rc.1 without a version exemption. If compatibility is refused, check the Host and plugin versions rather than using an exemption in place of an upgrade.

Install `2.4.2` from GitHub into the default `web` profile using its version tag:

```text
dsh plugin --profile web add github:Player-MINEPIG/dsh-tavern#v2.4.2
```

<a id="source-candidate"></a>
<a id="source-installation"></a>
### Install and validate from source

Use a separate test profile/home. Stop its Host before installing. Check out the
`v2.4.2` tag, then install from source:

```sh
git clone --branch v2.4.2 https://github.com/Player-MINEPIG/dsh-tavern.git
cd dsh-tavern
npm ci --legacy-peer-deps
node scripts/install.mjs --dsh-home /absolute/path/to/test-home --profile web
```

See the [patch release documentation checklist](TESTING_en.md#patch-release-documents).

Start DSH `0.1.7-rc.1` with that same `DSH_HOME`, then follow the
[developer verification guide](TESTING_en.md). A CLI upgrade alone does not update
the plugin installed in a profile. Record `git rev-parse HEAD` for the tested build.

### DSH provides the runtime peers

The current `package.json` declares `@deepseek-ai/dsh-util-crypto` at `0.1.7-rc.1` and `@deepseek-ai/cordis` at `4.0.4` as required `peerDependencies` supplied by the DSH runtime, so the plugin does not install a second copy. Source builds and tests use the `0.1.7-rc.1` crypto package pinned in `devDependencies`. Browser contracts are declared in `dsh.client.inject`, supplied by DSH, and not bundled into Tavern.

DSH profiles use `nodeLinker: hoisted` and `autoInstallPeers: false`; DSH's profile package resolver supplies official dependencies from its installation at startup. Consequently, `dsh plugin add` or `pnpm peers check` may report these peers as missing because the static check does not recognize runtime resolution. Do not rely on a `<DSH_HOME>/profiles/node_modules` link being present, or on a standalone Node process outside DSH as the sole check; verify the Host's resolved versions and plugin startup.

An `ERR_MODULE_NOT_FOUND` after restart is not an ignorable install warning: check that DSH on `PATH` is the target `0.1.7-rc.1`, its installation is complete, and module resolution reaches its packages. Do not mark required peers optional to hide warnings. Exact peer declarations constrain those packages; they are not a startup gate checking the entire DSH version.

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
