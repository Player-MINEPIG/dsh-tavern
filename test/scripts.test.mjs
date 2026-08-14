import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  backupPresetData,
  dshInvocation,
  dshPluginArgs,
  installedDataPath,
  localPackageSpec,
  parseOptions,
  profileHasPlugin,
  profileStoreDir,
} from '../scripts/shared.mjs'

test('builds local package specs and executable names across platforms', () => {
  const syntheticWindowsProject = ['X:', 'synthetic', 'dsh-tavern'].join('\\')
  const syntheticWindowsSpec = `file:${['X:', 'synthetic', 'dsh-tavern'].join('/')}`
  assert.equal(localPackageSpec(syntheticWindowsProject, 'win32'), syntheticWindowsSpec)
  assert.equal(localPackageSpec('/opt/dsh-tavern', 'linux'), 'file:/opt/dsh-tavern')
  assert.deepEqual(dshInvocation('linux', {}), { command: 'dsh', prefix: [] })
})

test('parses portable install and uninstall options', () => {
  const install = parseOptions([
    '--profile', 'review-1',
    '--store-dir', './store',
    '--skip-build',
  ], 'install')
  assert.equal(install.profile, 'review-1')
  assert.equal(install.storeDir, path.resolve('./store'))
  assert.equal(install.skipBuild, true)

  const uninstall = parseOptions([
    '--profile', 'review-1',
    '--backup-dir', './backup',
  ], 'uninstall')
  assert.equal(uninstall.backupDir, path.resolve('./backup'))
  assert.equal(uninstall.noBackup, false)
  assert.throws(() => parseOptions(['--profile', '../escape'], 'install'), /profile/)
})

test('builds dsh plugin arguments without a shell', () => {
  const options = parseOptions(['--profile', 'web', '--store-dir', './store'], 'install')
  assert.deepEqual(
    dshPluginArgs('add', options, 'file:/project'),
    ['plugin', '--profile', 'web', 'add', 'file:/project', '--store-dir', path.resolve('./store')],
  )
  assert.deepEqual(
    dshPluginArgs('remove', options, 'dsh-tavern'),
    ['plugin', '--profile', 'web', 'remove', 'dsh-tavern', '--store-dir', path.resolve('./store')],
  )
})

test('detects the pnpm store already bound to a profile', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'dsh-tavern-store-test-'))
  try {
    const modules = path.join(temporary, 'profiles', 'web', 'node_modules')
    const store = path.join(temporary, 'existing-store')
    await mkdir(modules, { recursive: true })
    await writeFile(path.join(modules, '.modules.yaml'), JSON.stringify({
      storeDir: path.join(store, 'v11'),
    }))
    assert.equal(profileStoreDir(temporary, 'web'), store)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})

test('detects whether the profile manifest still registers the plugin', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'dsh-tavern-manifest-test-'))
  try {
    const profile = path.join(temporary, 'profiles', 'web')
    await mkdir(profile, { recursive: true })
    await writeFile(path.join(profile, 'package.json'), JSON.stringify({ dependencies: { 'dsh-tavern': 'file:/project' } }))
    assert.equal(profileHasPlugin(temporary, 'web'), true)
    assert.equal(profileHasPlugin(temporary, 'missing'), false)
    await writeFile(path.join(profile, 'package.json'), JSON.stringify({ private: true }))
    assert.equal(profileHasPlugin(temporary, 'web'), false)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})

test('repeated install dry-run removes and re-adds a stale local package', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'dsh-tavern-refresh-test-'))
  try {
    await mkdir(path.dirname(installedDataPath(temporary, 'web')), { recursive: true })
    const profile = path.join(temporary, 'profiles', 'web')
    await writeFile(path.join(profile, 'package.json'), JSON.stringify({ dependencies: { 'dsh-tavern': 'file:/stale' } }))
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL('../scripts/install.mjs', import.meta.url)),
      '--skip-build',
      '--dry-run',
      '--dsh-home', temporary,
    ], {
      encoding: 'utf8',
      env: process.env,
    })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /existing installation found; refreshing package files/)
    assert.match(result.stdout, /"remove" "dsh-tavern"/)
    assert.match(result.stdout, /"add" "file:/)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})

test('interrupted refresh repairs a leftover package without removing a missing dependency', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'dsh-tavern-interrupted-test-'))
  try {
    await mkdir(path.dirname(installedDataPath(temporary, 'web')), { recursive: true })
    const profile = path.join(temporary, 'profiles', 'web')
    await writeFile(path.join(profile, 'package.json'), JSON.stringify({ private: true }))
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL('../scripts/install.mjs', import.meta.url)),
      '--skip-build',
      '--dry-run',
      '--dsh-home', temporary,
    ], {
      encoding: 'utf8',
      env: process.env,
    })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /incomplete previous refresh detected/)
    assert.doesNotMatch(result.stdout, /"remove" "dsh-tavern"/)
    assert.match(result.stdout, /"add" "file:/)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})

test('backs up installed preset data outside the plugin directory', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'dsh-tavern-script-test-'))
  try {
    const source = installedDataPath(temporary, 'web')
    await mkdir(source, { recursive: true })
    await writeFile(path.join(source, 'state.json'), '{"selectedId":null}')
    await assert.rejects(
      backupPresetData({
        source,
        dshHome: temporary,
        destination: path.join(source, 'nested-backup'),
      }),
      /outside the installed plugin directory/,
    )
    const destination = path.join(temporary, 'review-backup')
    const backup = await backupPresetData({
      source,
      dshHome: temporary,
      destination,
      now: new Date('2026-08-14T00:00:00.000Z'),
    })
    assert.equal(backup, destination)
    assert.equal(await readFile(path.join(destination, 'state.json'), 'utf8'), '{"selectedId":null}')
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
