#!/usr/bin/env node
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
let assembler = join(project, '.local/dsh-prompt-assembler'), output = join(project, '.local/packages')
for (let i = 0; i < args.length; i += 2) {
  if (!['--assembler', '--output'].includes(args[i]) || !args[i + 1]) throw new Error('Usage: node scripts/pack-with-assembler.mjs [--assembler <source>] [--output <directory>]')
  if (args[i] === '--assembler') assembler = resolve(args[i + 1]); else output = resolve(args[i + 1])
}
const npm = (cwd, options) => JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--cache', join(output, '.npm-cache'), ...options], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }))
const manifest = JSON.parse(readFileSync(join(assembler, 'package.json')))
if (manifest.name !== 'dsh-prompt-assembler' || manifest.version !== '0.2.0') throw new Error('Expected dsh-prompt-assembler@0.2.0')
mkdirSync(output, { recursive: true })
const stage = mkdtempSync(join(tmpdir(), 'tavern-assembler-pack-'))
try {
  const [source] = npm(project, ['--dry-run'])
  for (const file of source.files) {
    const target = join(stage, file.path); mkdirSync(dirname(target), { recursive: true }); cpSync(join(project, file.path), target)
  }
  const [assemblyPackage] = npm(assembler, ['--pack-destination', output])
  const [tavernPackage] = npm(stage, ['--pack-destination', output])
  const receipt = { sourceProtocolVersion: 1, dshVersion: '0.2.0-rc.2', published: false, packages: [assemblyPackage, tavernPackage].map(p => ({ name: p.name, version: p.version, filename: p.filename, integrity: p.integrity })) }
  writeFileSync(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
  console.log(JSON.stringify(receipt, null, 2))
} finally { rmSync(stage, { recursive: true, force: true }) }
