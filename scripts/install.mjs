#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PLUGIN_NAME,
  dshHomePath,
  dshInvocation,
  dshPluginArgs,
  installedDataPath,
  localPackageSpec,
  parseOptions,
  profileStoreDir,
  run,
} from './shared.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const help = `Install dsh-tavern into a dsh profile.

Usage:
  npm run plugin:install
  node scripts/install.mjs [options]

Options:
  --profile <name>     dsh profile (default: web)
  --dsh-home <path>    use a non-default DSH_HOME
  --store-dir <path>   forward a pnpm store directory to dsh
  --skip-build         install the existing dist/client.js
  --dry-run            print commands without changing anything
  -h, --help           show this help

An existing installation is refreshed with remove/add. Its plugin-local data
is copied to a temporary recovery directory and restored after a successful add.
`

async function installFresh(invocation, options, spec, projectRoot, environment) {
  run(invocation.command, [...invocation.prefix, ...dshPluginArgs('add', options, spec)], {
    cwd: projectRoot,
    environment,
    dryRun: options.dryRun,
  })
}

async function refreshExisting(invocation, options, spec, projectRoot, environment) {
  const dshHome = dshHomePath(options, environment)
  const dataPath = installedDataPath(dshHome, options.profile)
  const pluginRoot = path.dirname(dataPath)
  if (!existsSync(pluginRoot)) {
    await installFresh(invocation, options, spec, projectRoot, environment)
    return
  }

  console.log('[dsh-tavern] existing installation found; refreshing package files')
  let recoveryRoot
  let recoveryData
  if (!options.dryRun && existsSync(dataPath)) {
    recoveryRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-tavern-refresh-'))
    recoveryData = path.join(recoveryRoot, 'data')
    await cp(dataPath, recoveryData, {
      recursive: true,
      dereference: true,
      errorOnExist: true,
      force: false,
    })
    console.log('[dsh-tavern] preserving plugin-local preset data during refresh')
  }

  let refreshed = false
  try {
    run(invocation.command, [
      ...invocation.prefix,
      ...dshPluginArgs('remove', options, PLUGIN_NAME),
    ], {
      cwd: projectRoot,
      environment,
      dryRun: options.dryRun,
    })
    await installFresh(invocation, options, spec, projectRoot, environment)
    if (recoveryData !== undefined) {
      await cp(recoveryData, dataPath, {
        recursive: true,
        dereference: true,
        errorOnExist: false,
        force: true,
      })
      console.log('[dsh-tavern] restored plugin-local preset data')
    }
    refreshed = true
  } catch (error) {
    const recovery = recoveryData === undefined
      ? ''
      : `; preset recovery copy retained at ${recoveryData}`
    throw new Error(`${error.message}${recovery}`, { cause: error })
  } finally {
    if (refreshed && recoveryRoot !== undefined) {
      await rm(recoveryRoot, { recursive: true, force: true })
    }
  }
}

try {
  const options = parseOptions(process.argv.slice(2), 'install')
  if (options.help) {
    console.log(help)
    process.exit(0)
  }

  const environment = { ...process.env }
  if (options.dshHome !== undefined) environment.DSH_HOME = options.dshHome

  if (!options.skipBuild) {
    console.log('[dsh-tavern] building browser bundle')
    run(process.execPath, [path.join(projectRoot, 'build.mjs')], {
      cwd: projectRoot,
      environment,
      dryRun: options.dryRun,
    })
  }

  const dshHome = dshHomePath(options, environment)
  const existingStoreDir = options.storeDir === undefined
    ? profileStoreDir(dshHome, options.profile)
    : undefined
  const installOptions = existingStoreDir === undefined
    ? options
    : { ...options, storeDir: existingStoreDir }
  if (existingStoreDir !== undefined) {
    console.log(`[dsh-tavern] reusing profile pnpm store ${existingStoreDir}`)
  }

  const spec = localPackageSpec(projectRoot)
  const invocation = dshInvocation(process.platform, environment)
  console.log(`[dsh-tavern] installing into dsh profile ${installOptions.profile}`)
  await refreshExisting(invocation, installOptions, spec, projectRoot, environment)
  console.log('[dsh-tavern] installation complete; restart dsh web if it is already running')
} catch (error) {
  console.error(`[dsh-tavern] install failed: ${error.message}`)
  process.exit(1)
}
