# Cross-platform installation and removal

[中文](INSTALLATION.md)

Status: current for the 2026-08-22 `2.0.0` release. The default root [README](../README.md) is Chinese. The English landing page is [README_en.md](../README_en.md) (no screenshots). This file is the detailed lifecycle, verification, and recovery contract.

The scripts use Node.js as their common entry point and normalize paths for
Windows, macOS, and Linux. macOS/Linux execute `dsh` directly. Windows safely
locates npm's `dsh.ps1` shim and invokes it through the system PowerShell with
an argument array, so paths are not reconstructed as shell command text. Run
the scripts from the `dsh-tavern` checkout with Node.js 20 or newer and `dsh`
on `PATH`.

Only the repository root is installed. `packages/tavern-format`,
`packages/preset`, and `packages/tavern-loader` are internal boundaries shipped
inside that one plugin; do not try to add them to dsh separately. The format
layer can be consumed as a JavaScript library through the root package export,
but by itself it intentionally has no agent-loading effect.

## Install

Install dependencies once, then install the plugin into the default `web`
profile:

```text
npm install --cache .npm-cache --legacy-peer-deps
npm run plugin:install
```

The installer builds `dist/client.js`, calls `dsh plugin ... add` without a
shell, and prints a restart reminder. Restart a currently running `dsh web`
process before review.

Stop the target `dsh web` process before updating an existing installation.
Repeated installation is supported: the script preserves the
installed `data/`, removes the stale local `file:` package, adds the current
worktree again, and restores the data. This is necessary because pnpm can report
`Already up to date` while leaving newly added source files absent from an
earlier local-directory snapshot. It can also hardlink source files: editing
one inode then replacing another may otherwise produce a package whose entry
file is new but one imported module is old. After every add, the installer
therefore replaces the package's declared `files` entries with independent
copies from the current worktree. It does not touch the installed `data/` or
pnpm-managed nested `node_modules`, and validates that the resolved package
target remains inside the selected profile before removing any stale package
directory. Pending recovery data is kept under
`<DSH_HOME>/backups/pmp-dsh-tavern/pending-refresh-<profile>/`; a successful refresh
removes it. If remove/add fails, the error prints the retained path and the next
installer run repairs an interrupted dependency registration and restores that
data automatically. Do not delete the pending directory while recovery is due.
When `--store-dir` is omitted, the updater reads the store already recorded in
the profile's `node_modules/.modules.yaml`; this prevents pnpm's
`ERR_PNPM_UNEXPECTED_STORE` on profiles created with a different store root.

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

Before calling `dsh plugin ... remove`, the uninstaller copies the installed
`data/` directory to:

```text
<DSH_HOME>/backups/pmp-dsh-tavern/<timestamp>/
```

This is important because dsh/pnpm removes the installed plugin directory,
which is also where this version stores the complete plugin-local `data/`
tree: presets, normalized character cards, PNG cover images under
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
node scripts/uninstall.mjs --no-backup
```

`--no-backup` permanently discards all plugin-local Tavern resources and
session bindings when dsh removes the package. It does not delete an external
ST file originally used for import. A `storageDir` explicitly configured
outside the installed package is not removed by this script.

All common options work for uninstall too: `--profile`, `--dsh-home`,
`--store-dir`, and `--dry-run`. Use `--help` for the complete command summary.
