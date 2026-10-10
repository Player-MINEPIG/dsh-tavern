#!/usr/bin/env node
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
let assembler = join(project, '.local/dsh-prompt-assembler'), output = join(project, '.local/packages'), withCore = false
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--with-core') { withCore = true; continue }
  if (!['--assembler', '--output'].includes(args[i]) || !args[i + 1]) throw new Error('Usage: node scripts/pack-with-assembler.mjs [--assembler <source>] [--output <directory>] [--with-core]')
  if (args[i] === '--assembler') assembler = resolve(args[i + 1]); else output = resolve(args[i + 1])
  i++
}
const npm = (cwd, options) => JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--cache', join(output, '.npm-cache'), ...options], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }))
const manifest = JSON.parse(readFileSync(join(assembler, 'package.json')))
if (manifest.name !== 'dsh-prompt-assembler' || manifest.version !== '1.1.0') throw new Error('Expected dsh-prompt-assembler@1.1.0')
// Build before copying package files; npm pack --ignore-scripts cannot refresh dist.
execFileSync('npm', ['run', 'build'], { cwd: assembler, stdio: 'inherit' })
execFileSync('npm', ['run', 'build'], { cwd: project, stdio: 'inherit', env: { ...process.env, DSH_ASSEMBLER_SOURCE: assembler } })
mkdirSync(output, { recursive: true })
const stage = mkdtempSync(join(tmpdir(), 'tavern-assembler-pack-'))
try {
  const [source] = npm(project, ['--dry-run'])
  for (const file of source.files) {
    const target = join(stage, file.path); mkdirSync(dirname(target), { recursive: true }); cpSync(join(project, file.path), target)
  }
  const [assemblyPackage] = npm(assembler, ['--pack-destination', output])
  if (assemblyPackage.files.some(f => f.path.startsWith('core-extension/') || f.path.endsWith('prepare-request-assembly.mjs'))) throw new Error('Standard package contains core installation tooling')
  const stagedManifest = JSON.parse(readFileSync(join(stage, 'package.json')))
  stagedManifest.dependencies['dsh-prompt-assembler'] = manifest.version
  // GitHub archives have no node_modules: declaring this in the source
  // manifest makes package managers skip downloading the dependency.
  // Only this prebuilt stage actually carries the bundled package.
  stagedManifest.bundleDependencies = [manifest.name]
  // Bundle the selected standard source, including its freshly built client.
  // The optional standalone tgz must not be required to install Tavern.
  const bundledRoot = join(stage, 'node_modules', manifest.name)
  rmSync(bundledRoot, { recursive: true, force: true })
  for (const file of assemblyPackage.files) {
    const target = join(bundledRoot, file.path)
    mkdirSync(dirname(target), { recursive: true })
    cpSync(join(assembler, file.path), target)
  }
  if (stagedManifest.dependencies['dsh-prompt-assembler-core']) throw new Error('Tavern must not depend on the optional core extension')
  writeFileSync(join(stage, 'package.json'), JSON.stringify(stagedManifest, null, 2) + '\n')
  const corePackages = withCore ? npm(join(assembler, 'core-extension'), ['--pack-destination', output]) : []
  const [tavernPackage] = npm(stage, ['--pack-destination', output])
  const receipt = { sourceProtocolVersion: 1, defaultBackend: 'native', optionalCoreIncluded: withCore, installTogether: false, dshVersion: '0.2.0-rc.2', published: false, packages: [assemblyPackage, tavernPackage, ...corePackages].map(p => ({ name: p.name, version: p.version, filename: p.filename, integrity: p.integrity })) }
  writeFileSync(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
  console.log(JSON.stringify(receipt, null, 2))
} finally { rmSync(stage, { recursive: true, force: true }) }
