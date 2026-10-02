import {dirname,join} from 'node:path'
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
import { fileURLToPath } from 'node:url'
export async function cardWorkerDefines() {
  const version=JSON.parse(readFileSync(join(dirname(require.resolve('quickjs-emscripten-core')),'../package.json'),'utf8')).version
  const variantVersion=JSON.parse(readFileSync(join(dirname(require.resolve('@jitl/quickjs-singlefile-browser-release-asyncify')),'../package.json'),'utf8')).version
  if(version!=='0.31.0'||variantVersion!==version)throw Error('Unsupported QuickJS version for async job compatibility')
  const dom = await build({entryPoints:[fileURLToPath(new URL('../packages/client/src/play/virtual-dom-entry.js',import.meta.url))],bundle:true,write:false,format:'iife',platform:'browser',minify:true})
  const worker = await build({entryPoints:[fileURLToPath(new URL('../packages/client/src/play/card-worker.js',import.meta.url))],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true,define:{TAVERN_QUICKJS_VERSION:JSON.stringify(version),TAVERN_VIRTUAL_DOM_SOURCE:JSON.stringify(dom.outputFiles[0].text),TAVERN_BABEL_SOURCE:JSON.stringify(readFileSync(require.resolve('@babel/standalone/babel.min.js'),'utf8'))}})
  return {TAVERN_CARD_WORKER_SOURCE:JSON.stringify(worker.outputFiles[0].text)}
}
