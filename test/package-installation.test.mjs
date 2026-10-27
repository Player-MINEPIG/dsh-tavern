import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

// npm supplies a portable CLI path on Windows as well as POSIX.
test('a source package uses the explicitly installed shared Assembler peer', { skip: !process.env.npm_execpath }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'tavern-shared-install-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const source = join(directory, 'source'), assembler = join(directory, 'assembler'), consumer = join(directory, 'consumer')
  await Promise.all([source, assembler, consumer].map(p => mkdir(p)))
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
  assert.equal(manifest.dependencies?.['dsh-prompt-assembler'], undefined)
  assert.equal(manifest.bundleDependencies, undefined)
  assert.equal(manifest.bundledDependencies, undefined)
  assert.equal(manifest.peerDependencies['dsh-prompt-assembler'], '~1.1.3')
  await writeFile(join(source, 'package.json'), JSON.stringify({ name: manifest.name, version: manifest.version, type: 'module', main: 'index.js', peerDependencies: { 'dsh-prompt-assembler': manifest.peerDependencies['dsh-prompt-assembler'] } }))
  await writeFile(join(source, 'index.js'), "export { marker } from 'dsh-prompt-assembler'\n")
  await writeFile(join(assembler, 'package.json'), JSON.stringify({ name: 'dsh-prompt-assembler', version: '1.1.3', type: 'module', main: 'index.js' }))
  await writeFile(join(assembler, 'index.js'), "export const marker = 'shared dependency'\n")
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ private: true }))
  const npm = (cwd, args) => {
    const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args, '--cache', join(directory, 'cache')], { cwd, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    return result.stdout
  }
  const [packed] = JSON.parse(npm(source, ['pack', '--json', '--ignore-scripts', '--pack-destination', directory]))
  npm(consumer, ['install', assembler, join(directory, packed.filename), '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--legacy-peer-deps'])
  const installed = await import(pathToFileURL(join(consumer, 'node_modules', manifest.name, 'index.js')).href)
  assert.equal(installed.marker, 'shared dependency')
  await assert.rejects(readFile(join(consumer, 'node_modules', manifest.name, 'node_modules/dsh-prompt-assembler/package.json')), { code: 'ENOENT' })
})
