# Cross-platform installation and removal

The scripts use Node.js as their common entry point and normalize paths for
Windows, macOS, and Linux. macOS/Linux execute `dsh` directly. Windows safely
locates npm's `dsh.ps1` shim and invokes it through the system PowerShell with
an argument array, so paths are not reconstructed as shell command text. Run
the scripts from the `dsh-tavern` checkout with Node.js 20 or newer and `dsh`
on `PATH`.

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
node scripts/install.mjs --dsh-home D:\DSH-Test
```

## Uninstall

```text
npm run plugin:uninstall
```

Before calling `dsh plugin ... remove`, the uninstaller copies the installed
`data/` directory to:

```text
<DSH_HOME>/backups/dsh-tavern/<timestamp>/
```

This is important because dsh/pnpm removes the installed plugin directory,
which is also where this version stores created and imported presets.

Choose another backup directory or deliberately skip backup with:

```text
node scripts/uninstall.mjs --backup-dir /absolute/backup/path
node scripts/uninstall.mjs --no-backup
```

`--no-backup` permanently discards plugin-local presets when dsh removes the
package. It does not delete an external ST JSON originally used for import.

All common options work for uninstall too: `--profile`, `--dsh-home`,
`--store-dir`, and `--dry-run`. Use `--help` for the complete command summary.
