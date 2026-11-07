import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createMoodTimeline } from './helpers/mood-timeline.mjs'

const judge = input => {
  const text = input.user.join('\n')
  if (/缓存.*已经澄清/.test(text)) return { resolution: 'current', mood: { feeling: 'relieved', intensity: 2, reason: '缓存失败的原因已澄清，仍需完成验证。' } }
  if (/缓存.*已经修复/.test(text)) return { resolution: 'current', mood: null }
  if (input.eventKind === 'repair-or-clarification') return { mood: null }
  return { mood: { feeling: 'concerned', intensity: 4, reason: '缓存检查失败，协作目标尚未完成。' } }
}
function fixture(t, assessment = judge) {
  const dir = mkdtempSync(join(tmpdir(), 'mood-timeline-'))
  const f = createMoodTimeline(dir, assessment)
  t.after(() => { f.dispose(); rmSync(dir, { recursive: true, force: true }) })
  return f
}

test('neutral, failed retry, unrelated repair, clarification, idle, repair and manual override follow one grounded trajectory', async t => {
  const f = fixture(t)
  await f.turn('把标题列出来。')
  assert.equal(f.calls.length, 0)
  await f.turn('检查缓存。', { failure: 'cache unreachable' })
  assert.equal(f.calls.length, 1)
  assert.equal(f.read().mood.feeling, 'concerned')
  await f.turn('再试一次缓存检查。', { failure: 'cache unreachable' })
  assert.equal(f.calls.length, 1, 'same tool failure does not buy another judgment')
  await f.turn('排版问题已经修复。')
  assert.equal(f.calls.length, 2)
  assert.equal(f.read().mood.feeling, 'concerned', 'unrelated repair keeps the cache mood')
  await f.turn('缓存检查的原因已经澄清，不是你的错。')
  assert.equal(f.calls.length, 3)
  assert.equal(f.read().mood.feeling, 'relieved')
  const disk = readFileSync(f.moods.file('p'), 'utf8')
  f.tick(4 * 3600000)
  assert.equal(f.read().mood.intensity, 1)
  assert.equal(readFileSync(f.moods.file('p'), 'utf8'), disk, 'idle decay never writes or invokes a model')
  assert.equal(f.calls.length, 3)
  await f.turn('缓存问题已经修复。')
  assert.equal(f.calls.length, 4)
  assert.equal(f.read().mood, null)
  f.manual({ feeling: '平静、安定', intensity: 3, reason: '人工设定。' })
  await f.turn('缓存检查又失败了。', { failure: 'cache unreachable again' })
  await f.turn('缓存问题已经修复。')
  assert.equal(f.calls.length, 4)
  assert.equal(f.read().mood.source, 'manual')
  assert.equal(f.read().mood.feeling, '平静、安定')
  f.tick(24 * 3600000)
  assert.equal(f.read().mood, null)
  await f.turn('缓存检查再次失败。', { failure: 'cache unreachable after idle' })
  assert.equal(f.calls.length, 5)
  assert.equal(f.read().mood.source, 'event')
  assert.deepEqual(f.errors, [])
})

test('generic no-change answers and unconfirmed repairs cannot clear a current event mood', async t => {
  const f = fixture(t, input => input.eventKind === 'new-event'
    ? { mood: { feeling: 'concerned', intensity: 3, reason: '缓存检查失败。' } }
    : { mood: null })
  await f.turn('缓存检查失败了。')
  await f.turn('问题已经修复。')
  assert.equal(f.read().mood.feeling, 'concerned')
  const calls = f.calls.length
  await f.turn('你以为问题解决了吗？')
  assert.equal(f.calls.length, calls)
  assert.equal(f.read().mood.feeling, 'concerned')
})

test('an unrelated repair arriving during a failure judgment does not discard that failure', async t => {
  let enter, release
  const entered = new Promise(resolve => { enter = resolve }), blocked = new Promise(resolve => { release = resolve })
  const f = fixture(t, async input => {
    if (input.eventKind === 'new-event') { enter(); await blocked }
    return judge(input)
  })
  const failure = f.turn('缓存检查失败了。', { failure: 'cache unreachable' })
  await entered
  const unrelated = f.turn('排版问题已经修复。')
  release()
  await Promise.all([failure, unrelated])
  assert.equal(f.calls.length, 2)
  assert.equal(f.calls[1].input.currentMood.feeling, 'concerned')
  assert.equal(f.read().mood.feeling, 'concerned')
  assert.deepEqual(f.errors, [])
})
