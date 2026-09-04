# Cross-platform installation and removal

[中文](INSTALLATION.md)

Status: current for the 2026-09-05 `2.1.0-rc.1` candidate code, targeting the full DSH version `0.1.2-rc.1`. The default root [README](../README.md) is Chinese. The English landing page is [README_en.md](../README_en.md) (no screenshots). This file is the detailed lifecycle, verification, and recovery contract.

The scripts use Node.js as their common entry point and normalize paths for
Windows, macOS, and Linux. macOS/Linux execute `dsh` directly. Windows safely
locates npm's `dsh.ps1` shim and invokes it through the system PowerShell with
an argument array, so paths are not reconstructed as shell command text. Run
the scripts from the `dsh-tavern` checkout with Node.js 20 or newer and DSH
`0.1.2-rc.1` on `PATH`.

Only the repository root is installed. `packages/tavern-format`,
`packages/preset`, and `packages/tavern-loader` are internal boundaries shipped
inside that one plugin; do not try to add them to dsh separately. The format
layer can be consumed as a JavaScript library through the root package export,
but by itself it intentionally has no agent-loading effect.

## Install

Ordinary users can install the plugin directly from GitHub into the default
`web` profile:

```text
dsh plugin --profile web add github:Player-MINEPIG/dsh-tavern
```

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

## Verify a 2.0 release

Before packaging or installing a 2.0 release, run:

```text
npm run verify:2.0
```

The command runs five named regression groups for complete history and cursor
guards; managed-document validation/CAS/focus/path hardening; import
claim/lineage and privacy-safe lifecycle logs; chrome transport/slot ownership
and workspace admission; and localization/installer boundaries. It then builds
the tracked browser bundle and performs `npm pack --dry-run`.

This command does not replace real-browser review. Use the private release
acceptance checklist for multi-tab notification, first-run workspace choice,
and disable/uninstall fallback against the target DSH rc build.

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
`users/`, bounded Trace metadata in `tavern-traces.json`, and per-session
resource selections. Copy the whole directory when backing up; copying only
`presets/` loses other resources, audit metadata and bindings. In particular,
the same tree holds `state.json`, `character-state.json`,
`user-world-book-bindings.json`, `resource-world-book-bindings.json`,
`session-templates.json`, `chrome.json`, `play-workspace.json`,
`import-context-bindings.json`, `ui-settings.json` (locale, outer UI scale,
character-follow RP), `conversation-settings.json` (Mowan RP text and
message-action scale), and optional `rp-policy.json`.

`play-workspace.json` is only a pointer. The selected DSH RP workspace owns the
actual `catalog.json`, per-playthrough `timeline.json`, display regex document,
and imported context files. Back up that workspace as well if playthroughs must
be recoverable; an ST JSONL export preserves only the selected linear chat and
known swipes, not the complete Tavern branch topology.

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
