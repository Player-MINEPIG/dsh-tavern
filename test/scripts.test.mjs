import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  backupPresetData,
  dshInvocation,
  dshPluginArgs,
  installedDataPath,
  localPackageSpec,
  parseOptions,
} from '../scripts/shared.mjs'

test('builds local package specs and executable names across platforms', () => {
  assert.equal(localPackageSpec('D:\\code\\dsh-tavern', 'win32'), 'file:D:/code/dsh-tavern')
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
