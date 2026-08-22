import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('internal packages keep one-way format to preset to loader boundaries', () => {
  const format = read('../packages/tavern-format/src/index.js')
  const worldBookFormat = read('../packages/world-book/src/format.js')
  const worldBookPolicy = read('../packages/world-book/src/policy.js')
  const worldBookBridge = read('../packages/world-book/src/loader-bridge.js')
  const store = read('../packages/preset/src/store.js')
  const loader = read('../packages/tavern-loader/src/index.js')
  const pendingInput = read('../packages/tavern-loader/src/pending-input-projection.js')
  const traceRecorder = read('../packages/tavern-trace/src/recorder.js')

  assert.doesNotMatch(format, /from ['"]node:(?:fs|path)|@deepseek-ai|systemPrompt\.section|agent\/request/)
  assert.doesNotMatch(worldBookFormat, /from ['"]node:|@deepseek-ai|tavern-loader|systemPrompt|agent\/request|fetch\(/)
  assert.doesNotMatch(worldBookPolicy, /from ['"]node:|@deepseek-ai|tavern-loader|systemPrompt|agent\/request|fetch\(|Math\.random/)
  assert.doesNotMatch(worldBookBridge, /from ['"]node:|@deepseek-ai|tavern-loader|systemPrompt|agent\/request|fetch\(|Math\.random|sessionId|\bagent\b/)
  assert.doesNotMatch(store, /tavern-loader|systemPrompt\.section|agent\/request/)
  assert.match(store, /tavern-format/)
  assert.match(loader, /preset\/src/)
  assert.match(loader, /systemPrompt/)
  assert.match(loader, /agent\/request/)
  assert.doesNotMatch(traceRecorder, /\.append\(/)
  assert.doesNotMatch(traceRecorder, /from ['"]@deepseek-ai|querySelector|MutationObserver/)
  assert.match(loader, /agent\/inbox\/spliced|observeSessionEvent/)
  assert.doesNotMatch(pendingInput, /\.inbox\b|\.append\(|from ['"]@deepseek-ai/)
  assert.doesNotMatch(pendingInput, /agent\/request|systemPrompt\.section|fetch\(/)
})

test('character adapter and use-case expose resources without becoming a runtime loader', () => {
  const format = [
    read('../packages/tavern-format/src/character.js'),
    read('../packages/tavern-format/src/png-card.js'),
  ].join('\n')
  const character = [
    read('../packages/character/src/index.js'),
    read('../packages/character/src/store.js'),
    read('../packages/character/src/server.js'),
    read('../packages/character/src/resource.js'),
  ].join('\n')

  assert.doesNotMatch(format, /from ['"]node:|@deepseek-ai|systemPrompt\.section|ctx\.systemPrompt|agent\/request/)
  assert.doesNotMatch(character, /tavern-loader|systemPrompt\.section|system-prompt\/assemble|agent\/request/)
  assert.match(character, /tavern-format/)
  assert.match(character, /character-selection/)
})

test('standalone world-book use-case depends inward and leaves host seams to the loader', () => {
  const worldBookLibrary = [
    read('../packages/world-book-library/src/index.js'),
    read('../packages/world-book-library/src/store.js'),
    read('../packages/world-book-library/src/server.js'),
  ].join('\n')
  const pureWorldBook = [
    read('../packages/world-book/src/index.js'),
    read('../packages/world-book/src/format.js'),
    read('../packages/world-book/src/policy.js'),
    read('../packages/world-book/src/loader-bridge.js'),
  ].join('\n')

  assert.match(worldBookLibrary, /world-book\/src\/format/)
  assert.doesNotMatch(worldBookLibrary, /tavern-loader|systemPrompt\.section|system-prompt\/assemble|agent\/request/)
  assert.doesNotMatch(pureWorldBook, /from ['"]node:(?:fs|path)|world-book-library|systemPrompt\.section|agent\/request/)
})

test('user use-case stays a three-field resource and leaves Host seams to the loader', () => {
  const user = [
    read('../packages/user/src/index.js'),
    read('../packages/user/src/store.js'),
    read('../packages/user/src/server.js'),
    read('../packages/user/src/resource.js'),
  ].join('\n')
  assert.doesNotMatch(user, /tavern-loader|systemPrompt\.section|system-prompt\/assemble|agent\/request|avatar|image\//i)
  assert.match(user, /user-selection/)
  assert.match(user, /\['id', 'name', 'description'\]/)
})

test('user-to-world-book relationships are owned by loader policy, not either resource document', () => {
  const policy = read('../packages/tavern-loader/src/user-world-book-policy.js')
  const profileLoader = read('../packages/tavern-loader/src/profile-loader.js')
  const userStore = read('../packages/user/src/store.js')
  const worldBookStore = read('../packages/world-book-library/src/store.js')
  assert.match(policy, /user-world-book-bindings\.json/)
  assert.match(profileLoader, /composeWorldBookSelection/)
  assert.doesNotMatch(userStore, /worldBookIds|world-book-bindings/)
  assert.doesNotMatch(worldBookStore, /userIds|user-world-book-bindings/)
  assert.doesNotMatch(policy, /packages\/user|packages\/world-book|systemPrompt|agent\/request/)
})

test('session-template use-case stores configuration projections without owning DSH Host seams', () => {
  const sessionTemplate = [
    read('../packages/session-template/src/index.js'),
    read('../packages/session-template/src/model.js'),
    read('../packages/session-template/src/store.js'),
    read('../packages/session-template/src/service.js'),
    read('../packages/session-template/src/server.js'),
  ].join('\n')
  assert.doesNotMatch(sessionTemplate, /tavern-loader|@deepseek-ai|systemPrompt\.section|agent\/request|sessions\.create|connectWorkspace/)
  assert.match(sessionTemplate, /normalizeTemplateSelection/)
  assert.match(sessionTemplate, /session-configurations\/apply/)
})

test('play use-case owns chrome/workspace/timeline logic and leaves Host seams to the loader', () => {
  const play = [
    read('../packages/play/src/index.js'),
    read('../packages/play/src/server.js'),
    read('../packages/play/src/chrome.js'),
    read('../packages/play/src/http.js'),
    read('../packages/play/src/atomic-json.js'),
    read('../packages/play/src/paths.js'),
    read('../packages/play/src/workspace.js'),
    read('../packages/play/src/timeline.js'),
    read('../packages/play/src/sessions.js'),
    read('../packages/play/src/host.js'),
    read('../packages/play/src/server.js'),
  ].join('\n')
  assert.doesNotMatch(play, /tavern-loader|@deepseek-ai|systemPrompt\.section|agent\/request|archiveSession/)
  assert.match(play, /\/chrome/)
  const loader = read('../packages/tavern-loader/src/index.js')
  assert.match(loader, /play\/src/)
  assert.match(loader, /isPlayApiPath/)
  assert.match(read('../packages/tavern-loader/src/play-host.js'), /apiProxy/)
  assert.doesNotMatch(read('../packages/tavern-loader/src/play-host.js'), /archiveSession/)
})
