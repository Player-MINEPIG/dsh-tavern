import test from 'node:test'
import assert from 'node:assert/strict'
import { createDraftPreviewContext } from '../packages/tavern-loader/src/draft-preview-context.js'

test('concurrent draft resource reads are isolated, including escaped asynchronous work', async () => {
  const scope = createDraftPreviewContext(), a = { id: 'a' }, b = { id: 'b' }
  let escaped, release
  const gate = new Promise(resolve => { release = resolve })
  await Promise.all([a,b].map(record => scope.run(record, async () => {
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(scope.current(), record)
    if (record === a) escaped = gate.then(() => scope.current())
  })))
  assert.equal(scope.current(), undefined); release(); assert.equal(await escaped, undefined)
  await assert.rejects(scope.run(a, async () => { throw Error('failed') }), /failed/)
  assert.equal(scope.current(), undefined)
})
