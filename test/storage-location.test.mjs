import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  LEGACY_MIGRATION_MARKER,
  defaultStorageDir,
  prepareStorageDir,
} from '../packages/tavern-loader/src/storage-location.js'

test('default Tavern storage follows DSH_HOME without using the storage backend root', () => {
  assert.equal(
    defaultStorageDir({ environment: { DSH_HOME: '/srv/harness' }, home: '/home/tester' }),
    join('/srv/harness', 'pmp-dsh-tavern'),
  )
  assert.equal(
    defaultStorageDir({ environment: {}, home: '/home/tester' }),
    join('/home/tester', '.dsh', 'pmp-dsh-tavern'),
  )
  assert.equal(
    defaultStorageDir({ environment: { DSH_HOME: '~/isolated' }, home: '/home/tester' }),
    join('/home/tester', 'isolated', 'pmp-dsh-tavern'),
  )
})

test('legacy package data migrates atomically while retaining the source', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-tavern-storage-migration-'))
  const legacy = join(root, 'installed-package', 'data')
  const target = join(root, 'dsh-home', 'pmp-dsh-tavern')
  const logs = []
  try {
    mkdirSync(join(legacy, 'characters'), { recursive: true })
    writeFileSync(join(legacy, 'characters', 'card.json'), '{"name":"kept"}\n')

    const result = prepareStorageDir({
      storageDir: target,
      legacyStorageDir: legacy,
      logger: { info: message => logs.push(message) },
    })

    assert.equal(result.migration, 'migrated')
    assert.equal(readFileSync(join(target, 'characters', 'card.json'), 'utf8'), '{"name":"kept"}\n')
    assert.equal(readFileSync(join(legacy, 'characters', 'card.json'), 'utf8'), '{"name":"kept"}\n')
    assert.deepEqual(JSON.parse(readFileSync(join(target, LEGACY_MIGRATION_MARKER), 'utf8')), { schemaVersion: 1 })
    assert.equal(logs.length, 1)

    writeFileSync(join(legacy, 'characters', 'card.json'), '{"name":"legacy changed"}\n')
    assert.equal(prepareStorageDir({ storageDir: target, legacyStorageDir: legacy }).migration, 'already-complete')
    assert.equal(readFileSync(join(target, 'characters', 'card.json'), 'utf8'), '{"name":"kept"}\n')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('legacy migration never overwrites a populated destination', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-tavern-storage-conflict-'))
  const legacy = join(root, 'legacy')
  const target = join(root, 'target')
  const warnings = []
  try {
    mkdirSync(legacy, { recursive: true })
    mkdirSync(target, { recursive: true })
    writeFileSync(join(legacy, 'state.json'), '{"source":"legacy"}\n')
    writeFileSync(join(target, 'state.json'), '{"source":"target"}\n')

    const result = prepareStorageDir({
      storageDir: target,
      legacyStorageDir: legacy,
      logger: { warn: message => warnings.push(message) },
    })

    assert.equal(result.migration, 'target-not-empty')
    assert.equal(readFileSync(join(target, 'state.json'), 'utf8'), '{"source":"target"}\n')
    assert.equal(readFileSync(join(legacy, 'state.json'), 'utf8'), '{"source":"legacy"}\n')
    assert.equal(warnings.length, 1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('bundle config places default storage directly under DSH_HOME', () => {
  const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
  assert.match(patch, /storageDir:\s*!!js dshHomePath\('pmp-dsh-tavern'\)/)
  assert.doesNotMatch(patch, /dshHomePath\('storages'/)
})
