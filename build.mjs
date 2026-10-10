import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { cardWorkerDefines } from './scripts/build-card-worker.mjs'
import { build } from 'esbuild'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'

const id = 'pmp-dsh-tavern'
const fromAssembler = createRequire(resolve(process.env.DSH_ASSEMBLER_SOURCE ?? 'node_modules/dsh-prompt-assembler', 'package.json'))

await build({
  entryPoints: ['packages/client/src/entry.js'],
  define: {...await cardWorkerDefines(),TAVERN_PHOTO_DIAGNOSTIC:JSON.stringify(process.argv.includes('--photo-diagnostic'))},
  // Joint packages must embed the same assembler source that is packed for the backend.
  plugins: [{ name: 'assembler-source', setup(builder) {
    // The published plugin-client export is a ModuleLoader wrapper. Embed
    // its fixed-version source entry rather than nesting that wrapper.
    builder.onResolve({ filter: /^dsh-prompt-assembler\/plugin-client$/ }, () => ({ path: resolve(fromAssembler.resolve('dsh-prompt-assembler/package.json'), '../src/plugin-client.js') }))
    if (process.env.DSH_ASSEMBLER_SOURCE) builder.onResolve({ filter: /^dsh-prompt-assembler(?:\/|$)/ }, args => ({ path: fromAssembler.resolve(args.path) }))
  } }],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  outfile: 'dist/client.cjs',
  minify: false,
  external: ['react', '@deepseek-ai/*'],
})

const body = readFileSync('dist/client.cjs', 'utf8')
const interpreterLicense = readFileSync('packages/presentation/THIRD_PARTY_NOTICES.txt', 'utf8')
const virtualDomLicense = readFileSync('packages/presentation/VIRTUAL_DOM_NOTICES.txt', 'utf8')
const mathLicense = readFileSync('node_modules/katex/LICENSE', 'utf8')
const wrapped = `/*! Bundled QuickJS notices:
${interpreterLicense}
\nBundled virtual DOM, parser and compiler licenses:
${virtualDomLicense}
\nBundled KaTeX license:
${mathLicense}
*/
window.__ModuleLoader__.load({
\tid: ${JSON.stringify(id)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
\t\treturn module.exports;
\t}
});
`

writeFileSync('dist/client.js', wrapped)
rmSync('dist/client.cjs')
console.log('built dist/client.js')
