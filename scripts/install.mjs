#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  dshInvocation,
  dshPluginArgs,
  localPackageSpec,
  parseOptions,
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
`

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

  const spec = localPackageSpec(projectRoot)
  const invocation = dshInvocation(process.platform, environment)
  console.log(`[dsh-tavern] installing into dsh profile ${options.profile}`)
  run(invocation.command, [...invocation.prefix, ...dshPluginArgs('add', options, spec)], {
    cwd: projectRoot,
    environment,
    dryRun: options.dryRun,
  })
  console.log('[dsh-tavern] installation complete; restart dsh web if it is already running')
} catch (error) {
  console.error(`[dsh-tavern] install failed: ${error.message}`)
  process.exit(1)
}
