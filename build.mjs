import { build } from 'esbuild'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'

const id = 'pmp-dsh-tavern'

await build({
  entryPoints: ['packages/client/src/index.js'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  outfile: 'dist/client.cjs',
  minify: false,
  external: ['react', '@deepseek-ai/*'],
})

const body = readFileSync('dist/client.cjs', 'utf8')
const wrapped = `window.__ModuleLoader__.load({
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
