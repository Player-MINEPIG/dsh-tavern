import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../packages/client/src/play/io-menu.js', import.meta.url), 'utf8')

test('play import input ref is declared at component scope before the menu renders', () => {
  const component = source.slice(
    source.indexOf('export function PlayIoMenu'),
    source.indexOf('\n}', source.indexOf('export function PlayIoMenu')) + 2,
  )
  const refDeclaration = component.indexOf('const importInput = useRef(null)')
  const effectDeclaration = component.indexOf('useEffect(() =>')

  assert.ok(refDeclaration > 0)
  assert.ok(effectDeclaration > refDeclaration)
  assert.equal(component.match(/const importInput = useRef\(null\)/g)?.length, 1)
})

test('sidebar IO menu sizes to its content within the narrow sidebar budget', () => {
  assert.match(source, /data-placement=sidebar[^}]*width:max-content;min-width:0;max-width:168px/)
  assert.match(source, /data-placement=sidebar[^}]*\.dtv-play-io-item\{white-space:nowrap\}/)
})
