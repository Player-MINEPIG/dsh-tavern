import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

// npm supplies a portable CLI path on Windows as well as POSIX. Run this
// package-boundary check through npm test, without a network or real profile.
test('source archive installs its Assembler dependency when node_modules is absent', { skip: !process.env.npm_execpath }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'tavern-source-install-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const source = join(directory, 'source'), assembler = join(directory, 'assembler'), consumer = join(directory, 'consumer')
  await Promise.all([source, assembler, consumer].map(p => mkdir(p)))
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
  // DSH installs Tavern as a subdependency. Current pnpm defaults reject
  // Git/URL subdependencies, so the source must pin a registry version.
  assert.match(manifest.dependencies['dsh-prompt-assembler'], /^\d+\.\d+\.\d+$/, 'Assembler must use an exact npm version')
  const packageJson = { name: manifest.name, version: manifest.version, type: 'module', main: 'index.js', dependencies: { 'dsh-prompt-assembler': pathToFileURL(assembler).href } }
  for (const key of ['bundleDependencies', 'bundledDependencies']) if (key in manifest) packageJson[key] = manifest[key]
  await writeFile(join(source, 'package.json'), JSON.stringify(packageJson))
  await writeFile(join(source, 'index.js'), "export { marker } from 'dsh-prompt-assembler'\n")
  await writeFile(join(assembler, 'package.json'), JSON.stringify({ name: 'dsh-prompt-assembler', version: '1.1.0', type: 'module', main: 'index.js' }))
  await writeFile(join(assembler, 'index.js'), "export const marker = 'installed dependency'\n")
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ private: true }))
  const npm = (cwd, args) => {
    const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args, '--cache', join(directory, 'cache')], { cwd, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    return result.stdout
  }
  const [packed] = JSON.parse(npm(source, ['pack', '--json', '--ignore-scripts', '--pack-destination', directory]))
  npm(consumer, ['install', join(directory, packed.filename), '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--legacy-peer-deps'])
  const installed = await import(pathToFileURL(join(consumer, 'node_modules', manifest.name, 'index.js')).href)
  assert.equal(installed.marker, 'installed dependency')
})
