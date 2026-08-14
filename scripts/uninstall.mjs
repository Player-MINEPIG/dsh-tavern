#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  backupPresetData,
  dshInvocation,
  dshHomePath,
  dshPluginArgs,
  installedDataPath,
  parseOptions,
  PLUGIN_NAME,
  run,
} from './shared.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const help = `Uninstall dsh-tavern from a dsh profile.

Preset data is backed up before removal by default.

Usage:
  npm run plugin:uninstall
  node scripts/uninstall.mjs [options]

Options:
  --profile <name>       dsh profile (default: web)
  --dsh-home <path>      use a non-default DSH_HOME
  --store-dir <path>     forward a pnpm store directory to dsh
  --backup-dir <path>    choose the backup destination
  --no-backup            permanently remove plugin data without copying it
  --dry-run              print the removal command without changing anything
  -h, --help             show this help
`

try {
  const options = parseOptions(process.argv.slice(2), 'uninstall')
  if (options.help) {
    console.log(help)
    process.exit(0)
  }

  const environment = { ...process.env }
  const dshHome = dshHomePath(options, environment)
  if (options.dshHome !== undefined) environment.DSH_HOME = options.dshHome

  if (!options.noBackup && !options.dryRun) {
    const source = installedDataPath(dshHome, options.profile)
    const backup = await backupPresetData({
      source,
      dshHome,
      destination: options.backupDir,
    })
    if (backup === null) {
      console.log('[dsh-tavern] no installed preset data found to back up')
    } else {
      console.log(`[dsh-tavern] preset data backed up to ${backup}`)
    }
  } else if (options.noBackup) {
    console.log('[dsh-tavern] warning: preset data backup disabled')
  }

  const invocation = dshInvocation(process.platform, environment)
  console.log(`[dsh-tavern] uninstalling from dsh profile ${options.profile}`)
  run(invocation.command, [...invocation.prefix, ...dshPluginArgs('remove', options, PLUGIN_NAME)], {
    cwd: projectRoot,
    environment,
    dryRun: options.dryRun,
  })
  console.log('[dsh-tavern] uninstall complete; restart dsh web if it is already running')
} catch (error) {
  console.error(`[dsh-tavern] uninstall failed: ${error.message}`)
  process.exit(1)
}
