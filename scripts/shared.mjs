import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { cp, mkdir, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const PLUGIN_NAME = 'dsh-tavern'
export const DEFAULT_PROFILE = 'web'

function valueAfter(argv, index, flag) {
  const value = argv[index + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`)
  }
  return value
}

export function parseOptions(argv, mode) {
  const options = {
    profile: DEFAULT_PROFILE,
    storeDir: undefined,
    dshHome: undefined,
    dryRun: false,
    help: false,
    skipBuild: false,
    noBackup: false,
    backupDir: undefined,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--profile') {
      options.profile = valueAfter(argv, index, argument)
      index += 1
    } else if (argument === '--store-dir') {
      options.storeDir = path.resolve(valueAfter(argv, index, argument))
      index += 1
    } else if (argument === '--dsh-home') {
      options.dshHome = path.resolve(valueAfter(argv, index, argument))
      index += 1
    } else if (argument === '--dry-run') {
      options.dryRun = true
    } else if (argument === '--help' || argument === '-h') {
      options.help = true
    } else if (mode === 'install' && argument === '--skip-build') {
      options.skipBuild = true
    } else if (mode === 'uninstall' && argument === '--no-backup') {
      options.noBackup = true
    } else if (mode === 'uninstall' && argument === '--backup-dir') {
      options.backupDir = path.resolve(valueAfter(argv, index, argument))
      index += 1
    } else {
      throw new Error(`unknown option: ${argument}`)
    }
  }

  if (!/^[A-Za-z0-9._-]+$/.test(options.profile)) {
    throw new Error('profile may contain only letters, numbers, dot, underscore, and hyphen')
  }
  return options
}

export function dshHomePath(options, environment = process.env, home = os.homedir()) {
  return path.resolve(options.dshHome ?? environment.DSH_HOME ?? path.join(home, '.dsh'))
}

export function installedDataPath(dshHome, profile) {
  return path.join(dshHome, 'profiles', profile, 'node_modules', PLUGIN_NAME, 'data')
}

export function profileHasPlugin(dshHome, profile, pluginName = PLUGIN_NAME) {
  const manifestPath = path.join(dshHome, 'profiles', profile, 'package.json')
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw new Error(`cannot read profile manifest ${manifestPath}: ${error.message}`, { cause: error })
  }
  return ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
    .some(field => manifest?.[field] !== null
      && typeof manifest?.[field] === 'object'
      && Object.hasOwn(manifest[field], pluginName))
}

export function profileStoreDir(dshHome, profile) {
  const manifestPath = path.join(dshHome, 'profiles', profile, 'node_modules', '.modules.yaml')
  let content
  try {
    content = readFileSync(manifestPath, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }

  let storeDir
  try {
    storeDir = JSON.parse(content)?.storeDir
  } catch {
    const match = /^\s*storeDir:\s*['"]?(.+?)['"]?\s*$/m.exec(content)
    storeDir = match?.[1]
  }
  if (typeof storeDir !== 'string' || storeDir.trim() === '') return undefined
  const resolved = path.resolve(storeDir.trim())
  return /^v\d+$/i.test(path.basename(resolved)) ? path.dirname(resolved) : resolved
}

export function localPackageSpec(projectRoot, platform = process.platform) {
  const resolved = platform === 'win32'
    ? path.win32.resolve(projectRoot)
    : path.posix.resolve(projectRoot)
  return `file:${resolved.replaceAll('\\', '/')}`
}

function pathEntries(environment) {
  return (environment.PATH ?? environment.Path ?? '')
    .split(path.delimiter)
    .map((entry) => entry.replace(/^"|"$/g, ''))
    .filter(Boolean)
}

export function dshInvocation(platform = process.platform, environment = process.env) {
  if (platform !== 'win32') return { command: 'dsh', prefix: [] }

  for (const directory of pathEntries(environment)) {
    const executable = path.join(directory, 'dsh.exe')
    if (existsSync(executable)) return { command: executable, prefix: [] }
  }

  for (const directory of pathEntries(environment)) {
    const shim = path.join(directory, 'dsh.ps1')
    if (!existsSync(shim)) continue
    const systemPowerShell = environment.SystemRoot === undefined
      ? undefined
      : path.join(environment.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    return {
      command: systemPowerShell !== undefined && existsSync(systemPowerShell)
        ? systemPowerShell
        : 'powershell.exe',
      prefix: ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', shim],
    }
  }

  return { command: 'dsh.exe', prefix: [] }
}

export function dshPluginArgs(action, options, packageSpec) {
  const args = ['plugin', '--profile', options.profile, action]
  if (packageSpec !== undefined) args.push(packageSpec)
  if (options.storeDir !== undefined) args.push('--store-dir', options.storeDir)
  return args
}

export function run(command, args, { cwd, environment = process.env, dryRun = false } = {}) {
  const rendered = [command, ...args].map((part) => JSON.stringify(part)).join(' ')
  if (dryRun) {
    console.log(`[dsh-tavern] dry-run: ${rendered}`)
    return
  }

  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    stdio: 'inherit',
    shell: false,
  })
  if (result.error !== undefined) {
    if (result.error.code === 'ENOENT') {
      throw new Error(`cannot find ${command}; install dsh and ensure it is on PATH`)
    }
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`)
  }
}

async function directoryExists(directory) {
  try {
    return (await stat(directory)).isDirectory()
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function timestamp(now) {
  return now.toISOString().replaceAll(':', '-').replaceAll('.', '-')
}

export async function backupPresetData({ source, dshHome, destination, now = new Date() }) {
  if (!(await directoryExists(source))) return null

  const resolvedSource = path.resolve(source)
  const installedPluginRoot = path.dirname(resolvedSource)
  const target = path.resolve(destination ?? path.join(dshHome, 'backups', PLUGIN_NAME, timestamp(now)))
  if (target === installedPluginRoot || target.startsWith(`${installedPluginRoot}${path.sep}`)) {
    throw new Error('backup destination must be outside the installed plugin directory')
  }
  await mkdir(path.dirname(target), { recursive: true })
  await cp(resolvedSource, target, {
    recursive: true,
    dereference: true,
    errorOnExist: true,
    force: false,
  })
  return target
}
