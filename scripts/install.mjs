#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PLUGIN_NAME,
  dshHomePath,
  dshInvocation,
  dshPluginArgs,
  installedDataPath,
  localPackageSpec,
  materializeInstalledPackage,
  parseOptions,
  profileHasPlugin,
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
is copied to a persistent pending-recovery directory and restored after a
successful add. A later run resumes that recovery automatically if refresh was
interrupted.
`

async function installFresh(invocation, options, spec, projectRoot, environment) {
  run(invocation.command, [...invocation.prefix, ...dshPluginArgs('add', options, spec)], {
    cwd: projectRoot,
    environment,
    dryRun: options.dryRun,
  })
  await materializeInstalledPackage({
    projectRoot,
    dshHome: dshHomePath(options, environment),
    profile: options.profile,
    dryRun: options.dryRun,
  })
  if (!options.dryRun) console.log('[dsh-tavern] materialized an independent package copy for deterministic refreshes')
}

async function refreshExisting(invocation, options, spec, projectRoot, environment) {
  const dshHome = dshHomePath(options, environment)
  const dataPath = installedDataPath(dshHome, options.profile)
  const pluginRoot = path.dirname(dataPath)
  const recoveryRoot = path.join(dshHome, 'backups', PLUGIN_NAME, `pending-refresh-${options.profile}`)
  const recoveryData = path.join(recoveryRoot, 'data')
  let hasRecovery = !options.dryRun && existsSync(recoveryData)
  const registered = profileHasPlugin(dshHome, options.profile)
  if (!registered) {
    if (existsSync(pluginRoot)) {
      console.log('[dsh-tavern] incomplete previous refresh detected; repairing dependency registration')
    }
    try {
      await installFresh(invocation, options, spec, projectRoot, environment)
      if (hasRecovery) {
        await cp(recoveryData, dataPath, {
          recursive: true,
          dereference: true,
          errorOnExist: false,
          force: true,
        })
        console.log('[dsh-tavern] restored plugin-local data from the interrupted refresh')
        await rm(recoveryRoot, { recursive: true, force: true })
      }
    } catch (error) {
      const recovery = hasRecovery ? `; plugin data recovery retained at ${recoveryData}` : ''
      throw new Error(`${error.message}${recovery}`, { cause: error })
    }
    return
  }

  console.log('[dsh-tavern] existing installation found; refreshing package files')
  if (hasRecovery) {
    console.log('[dsh-tavern] resuming plugin-local data recovery from an interrupted refresh')
  } else if (!options.dryRun && existsSync(dataPath)) {
    await mkdir(recoveryRoot, { recursive: true })
    await cp(dataPath, recoveryData, {
      recursive: true,
      dereference: true,
      errorOnExist: true,
      force: false,
    })
    hasRecovery = true
    console.log('[dsh-tavern] preserving plugin-local data during refresh')
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
    if (hasRecovery) {
      await cp(recoveryData, dataPath, {
        recursive: true,
        dereference: true,
        errorOnExist: false,
        force: true,
      })
      console.log('[dsh-tavern] restored plugin-local data')
    }
    refreshed = true
  } catch (error) {
    const recovery = !hasRecovery
      ? ''
      : `; plugin data recovery retained at ${recoveryData}`
    throw new Error(`${error.message}${recovery}`, { cause: error })
  } finally {
    if (refreshed && hasRecovery) {
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
