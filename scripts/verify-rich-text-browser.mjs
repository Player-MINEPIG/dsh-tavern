import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const browser = process.env.CHROME_PATH ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(existsSync)
if (!browser) throw new Error('Set CHROME_PATH to a Chrome/Chromium executable to run browser rendering checks.')
const dir = mkdtempSync(join(tmpdir(), 'tavern-rich-text-'))
try {
  await build({
    entryPoints: [fileURLToPath(new URL('./fixtures/rich-text-browser.js', import.meta.url))],
    bundle: true, platform: 'browser', format: 'iife', outfile: join(dir, 'fixture.js'),
    banner: process.env.TAVERN_REGEX_FIXTURE ? {
      js: `globalThis.__regexFixture=${JSON.stringify(JSON.parse(readFileSync(process.env.TAVERN_REGEX_FIXTURE, 'utf8')))};`,
    } : undefined,
  })
  writeFileSync(join(dir, 'index.html'), '<!doctype html><meta charset="utf-8"><body><script src="fixture.js"></script></body>')
  const output = await new Promise((resolve, reject) => {
    const child = spawn(browser, [
      '--headless', '--disable-gpu', '--no-first-run', '--disable-extensions', '--disable-background-networking',
      `--user-data-dir=${join(dir, 'profile')}`, '--dump-dom', '--virtual-time-budget=3000',
      `file://${join(dir, 'index.html')}`,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    let stderr = ''
    child.stderr.on('data', chunk => { stderr += chunk })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Browser rendering report timed out.'))
    }, 30000)
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      output += chunk
      if (/<pre id="results">[\s\S]*?<\/pre>/.test(output)) {
        clearTimeout(timer)
        child.kill()
        child.stdout.destroy()
        child.stderr.destroy()
      }
    })
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('close', code => {
      clearTimeout(timer)
      if (code && !output) reject(new Error(stderr.slice(-2000)))
      else resolve(output)
    })
  })
  const raw = output.match(/<pre id="results">([\s\S]*?)<\/pre>/)?.[1]
  if (!raw) throw new Error(`Browser did not produce a rendering report: ${output.slice(-3000)}`)
  const results = JSON.parse(raw.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'))
  for (const result of results) console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}`)
  if (results.some(result => !result.pass)) process.exitCode = 1
} finally {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
