#!/usr/bin/env node
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { requireAssemblerVersion } from '../packages/tavern-loader/src/assembler-compatibility.js'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let assembler = join(project, 'node_modules/dsh-prompt-assembler'), output = join(project, '.local/packages')
const args = process.argv.slice(2)
for (let i = 0; i < args.length; i += 2) {
  if (!['--assembler', '--output'].includes(args[i]) || !args[i + 1]) throw new Error('Usage: npm run pack:release -- [--assembler <source>] [--output <directory>]')
  if (args[i] === '--assembler') assembler = resolve(args[i + 1]); else output = resolve(args[i + 1])
}
if (!process.env.npm_execpath) throw new Error('Run this command through npm run pack:release')
const npm = (cwd, args, env = process.env) => execFileSync(process.execPath, [process.env.npm_execpath, ...args], { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
const pack = (cwd, args) => JSON.parse(npm(cwd, ['pack', '--ignore-scripts', '--json', '--cache', join(output, '.npm-cache'), ...args]))[0]
const assembly = JSON.parse(readFileSync(join(assembler, 'package.json')))
if (assembly.name !== 'dsh-prompt-assembler') throw new Error('Expected the independent dsh-prompt-assembler source')
requireAssemblerVersion(assembly.version, 'Release source')
npm(assembler, ['run', 'build'])
npm(project, ['run', 'build'], { ...process.env, DSH_ASSEMBLER_SOURCE: assembler })
mkdirSync(output, { recursive: true })
const stage = mkdtempSync(join(tmpdir(), 'tavern-release-'))
try {
  const packages = []
  for (const source of [assembler, project]) {
    const listing = pack(source, ['--dry-run'])
    const targetRoot = join(stage, listing.name)
    for (const file of listing.files) {
      if (file.path.startsWith('node_modules/') || file.path.startsWith('core-extension/')) throw new Error('Release packages must not carry nested runtime packages or a core extension')
      const target = join(targetRoot, file.path)
      mkdirSync(dirname(target), { recursive: true }); cpSync(join(source, file.path), target)
    }
    const manifest = JSON.parse(readFileSync(join(targetRoot, 'package.json')))
    if (manifest.bundleDependencies || manifest.bundledDependencies) throw new Error('Release packages must declare independent dependencies')
    if (manifest.name === 'pmp-dsh-tavern' && manifest.dependencies?.['dsh-prompt-assembler']) throw new Error('Tavern must use the independent Assembler peer')
    delete manifest.devDependencies
    delete manifest.scripts
    writeFileSync(join(targetRoot, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
    const packed = pack(targetRoot, ['--pack-destination', output])
    packages.push({ name: packed.name, version: packed.version, filename: packed.filename, integrity: packed.integrity, shasum: packed.shasum })
  }
  const receipt = { defaultBackend: 'native', optionalCoreIncluded: false, independentAssembler: true, published: false, packages }
  writeFileSync(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
  console.log(JSON.stringify(receipt, null, 2))
} finally {
  rmSync(stage, { recursive: true, force: true })
}
