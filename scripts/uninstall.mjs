#!/usr/bin/env node

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  backupTavernData,
  dshInvocation,
  dshHomePath,
  dshPluginArgs,
  installedDataPath,
  parseOptions,
  persistentDataPath,
  PLUGIN_NAME,
  run,
} from './shared.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const help = `Uninstall dsh-tavern from a dsh profile.

Persistent Tavern data is backed up before removal by default and remains in
place after the package is removed.

Usage:
  npm run plugin:uninstall
  node scripts/uninstall.mjs [options]

Options:
  --profile <name>       dsh profile (default: web)
  --dsh-home <path>      use a non-default DSH_HOME
  --store-dir <path>     forward a pnpm store directory to dsh
  --storage-dir <path>   back up an explicitly configured Tavern storageDir
  --backup-dir <path>    choose the backup destination
  --no-backup            skip the backup snapshot; persistent data is retained
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
    const persistent = options.storageDir ?? persistentDataPath(dshHome)
    const legacy = installedDataPath(dshHome, options.profile)
    const source = options.storageDir === undefined && !existsSync(persistent)
      ? legacy
      : persistent
    const backup = await backupTavernData({
      source,
      dshHome,
      destination: options.backupDir,
      unsafeRoot: source === legacy ? path.dirname(legacy) : source,
    })
    if (backup === null) {
      console.log('[dsh-tavern] no installed Tavern data found to back up')
    } else {
      console.log(`[dsh-tavern] Tavern data backed up to ${backup}`)
    }
  } else if (options.noBackup) {
    console.log('[dsh-tavern] warning: Tavern backup snapshot disabled; persistent data will remain in place')
  }

  const invocation = dshInvocation(process.platform, environment)
  console.log(`[dsh-tavern] uninstalling from dsh profile ${options.profile}`)
  run(invocation.command, [...invocation.prefix, ...dshPluginArgs('remove', options, PLUGIN_NAME)], {
    cwd: projectRoot,
    environment,
    dryRun: options.dryRun,
  })
  const retained = options.storageDir ?? persistentDataPath(dshHome)
  console.log(`[dsh-tavern] persistent Tavern data retained at ${retained}`)
  console.log('[dsh-tavern] uninstall complete; restart dsh web if it is already running')
} catch (error) {
  console.error(`[dsh-tavern] uninstall failed: ${error.message}`)
  process.exit(1)
}
