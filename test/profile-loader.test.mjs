import test from 'node:test'
import assert from 'node:assert/strict'
import { compileTavernProfile } from '../packages/tavern-loader/src/profile-loader.js'

test('preset-only profile emits authored text without generated identification wrappers', () => {
  const preset = {
    id: 'preset-a',
    name: 'Preset A',
    prompts: [
      { identifier: 'main', role: 'system', content: 'Preset text', enabled: true, marker: false },
      { identifier: 'voice', role: 'assistant', content: 'Requested voice', enabled: true, marker: false },
    ],
    sampling: { temperature: 0.4 },
  }
  const result = compileTavernProfile({ preset })
  assert.equal(result.systemText, 'Preset text\n\nRequested voice')
  assert.doesNotMatch(result.systemText, /\[dsh-tavern selected preset\]|<st-prompt\b/)
  assert.deepEqual(result.sections.map(part => part.sources[0].role), ['system', 'assistant'])
  assert.deepEqual(result.callConfig, { temperature: 0.4 })
})

test('mixed profile emits plain authored bodies and keeps official source metadata', () => {
  const result = compileTavernProfile({
    preset: {
      id: 'mixed-preset',
      name: 'Mixed preset',
      prompts: [
        { identifier: 'main', role: 'user', content: 'Preset body', enabled: true, marker: false, st: {} },
        { identifier: 'charDescription', role: 'system', content: '', enabled: true, marker: true, st: {} },
        { identifier: 'personaDescription', role: 'system', content: '', enabled: true, marker: true, st: {} },
        { identifier: 'worldInfoAfter', role: 'system', content: '', enabled: true, marker: true, st: {} },
      ],
      sampling: {},
    },
    character: { id: 'mixed-character', data: { name: 'Guide', description: 'Character body' } },
    user: { id: 'mixed-user', name: 'Reader', description: 'User body' },
    loreEntries: [{ id: 'mixed-lore', position: 'after', content: 'Lore body' }],
  })

  assert.equal(result.systemText, 'Preset body\n\nCharacter body\n\nUser body\n\nLore body')
  assert.doesNotMatch(result.systemText, /\[dsh-tavern profile\]|<st-(?:prompt|character-field|user-field|world-info)\b/)
  assert.equal(result.sections[0].sources[0].role, 'user')
  assert.deepEqual(result.sections.map(part => part.sources[0].kind), ['preset', 'character', 'user', 'worldbook'])
})

test('author-written wrapper-shaped text is preserved literally', () => {
  const authored = '<st-prompt role="author">keep</st-prompt>\n<st-character-field>keep</st-character-field>\n<st-user-field>keep</st-user-field>\n<st-world-info>keep</st-world-info>'
  const result = compileTavernProfile({
    preset: {
      id: 'literal-wrappers',
      name: 'Literal wrappers',
      prompts: [{ identifier: 'main', role: 'system', content: authored, enabled: true, marker: false }],
      sampling: {},
    },
    character: { id: 'literal-character', data: { name: 'Guide' } },
  })
  assert.equal(result.systemText, authored)
})

test('selected resources without authored bodies do not create placeholder text', () => {
  const presetOnly = compileTavernProfile({
    preset: { id: 'empty-preset-only', name: 'Empty preset only', prompts: [], sampling: {} },
  })
  const result = compileTavernProfile({
    preset: { id: 'empty-preset', name: 'Empty preset', prompts: [], sampling: {} },
    character: { id: 'empty-character', data: { name: 'Guide' } },
    user: { id: 'empty-user', name: 'Reader', description: '' },
  })
  assert.equal(presetOnly.systemText, '')
  assert.deepEqual(presetOnly.sections, [])
  assert.equal(result.systemText, '')
  assert.deepEqual(result.sections, [])
})

test('unified profile accepts normalized character and lore contributions without leaking strict DSH macros', () => {
  const result = compileTavernProfile({
    character: {
      id: 'character-a',
      data: {
        name: 'Lyra',
        description: 'Speak as {{char}}; unknown={{unsupported}}',
        firstMessage: 'Hello {{user}}',
        creatorNotes: 'must never be sent',
      },
    },
    loreEntries: [{ id: 'lore-a', position: 'before', content: 'The observatory belongs to {{char}}.' }],
    context: { user: 'Reader' },
  })
  assert.match(result.systemText, /Speak as Lyra/)
  assert.match(result.systemText, /Hello Reader/)
  assert.match(result.systemText, /observatory belongs to Lyra/)
  assert.doesNotMatch(result.systemText, /creatorNotes|must never be sent|\{\{unsupported\}\}/)
  assert.deepEqual(result.activeLoreEntries, ['lore-a'])
})

test('unified profile fills ST markers, applies character overrides, and leaves DSH history authoritative', () => {
  const result = compileTavernProfile({
    preset: {
      id: 'preset-a',
      name: 'Preset A',
      prompts: [
        { identifier: 'main', role: 'system', content: 'Original main', enabled: true, marker: false, st: {} },
        { identifier: 'charDescription', role: 'system', content: '', enabled: true, marker: true, st: {} },
        { identifier: 'worldInfoBefore', role: 'system', content: '', enabled: true, marker: true, st: {} },
        { identifier: 'chatHistory', role: 'system', content: 'must not render', enabled: true, marker: true, st: {} },
        { identifier: 'jailbreak', role: 'system', content: 'Original PHI', enabled: true, marker: false, st: {} },
      ],
      sampling: {},
    },
    character: {
      id: 'character-a',
      data: {
        name: 'Lyra',
        description: 'Character description',
        systemPrompt: 'Character system + {{original}}',
        postHistoryInstructions: 'Character PHI + {{original}}',
      },
    },
    loreEntries: [{ id: 'before-a', position: 'before', content: 'Before lore' }],
  })

  assert.match(result.systemText, /Character system \+ Original main/)
  assert.match(result.systemText, /Character description/)
  assert.match(result.systemText, /Before lore/)
  assert.match(result.systemText, /Character PHI \+ Original PHI/)
  assert.doesNotMatch(result.systemText, /must not render/)
  assert.equal(result.systemText.match(/Character description/g)?.length, 1)
  assert.ok(result.diagnostics.some((item) => item.code === 'CHARACTER_PHI_APPROXIMATE'))
})

test('character system and PHI switches suppress those fields instead of moving them to fallback', () => {
  const result = compileTavernProfile({
    character: {
      id: 'character-a',
      data: { name: 'Lyra', systemPrompt: 'Hidden system', postHistoryInstructions: 'Hidden PHI' },
    },
    characterSelection: { preferCharacterSystemPrompt: false, preferCharacterPostHistory: false },
  })
  assert.doesNotMatch(result.systemText, /Hidden system|Hidden PHI/)
})

test('selected user fills name macros and persona marker exactly once', () => {
  const result = compileTavernProfile({
    preset: {
      id: 'user-preset',
      name: 'User preset',
      prompts: [
        { identifier: 'main', role: 'system', content: '{{char}} is speaking with {{user}}.', enabled: true, marker: false, st: {} },
        { identifier: 'personaDescription', role: 'system', content: '', enabled: true, marker: true, st: {} },
        { identifier: 'personaDescription', role: 'system', content: '', enabled: true, marker: true, st: {} },
      ],
      sampling: {},
    },
    character: { id: 'synthetic-character', data: { name: 'Synthetic Guide' } },
    user: { id: 'synthetic-user', name: 'Synthetic Reader', description: 'Synthetic Reader studies {{char}}.' },
  })
  assert.match(result.systemText, /Synthetic Guide is speaking with Synthetic Reader\./)
  assert.match(result.systemText, /Synthetic Reader studies Synthetic Guide\./)
  assert.equal(result.systemText.match(/Synthetic Reader studies Synthetic Guide\./g)?.length, 1)
  assert.doesNotMatch(result.systemText, /<st-user-field\b/)
  assert.doesNotMatch(result.systemText, /\{\{/)
  assert.equal(result.diagnostics.some(item => item.code === 'USER_PERSONA_MARKER_FALLBACK'), false)
  assert.deepEqual(result.userInjection, {
    selected: true,
    descriptionAvailable: true,
    descriptionCharacters: 'Synthetic Reader studies {{char}}.'.length,
    descriptionInsertions: 1,
    descriptionPlacement: 'preset-marker:personaDescription',
  })
})

test('selected user uses a stable diagnosed fallback when the persona marker is absent', () => {
  const result = compileTavernProfile({
    preset: {
      id: 'fallback-preset',
      name: 'Fallback preset',
      prompts: [{ identifier: 'main', role: 'system', content: 'Address {{user}}.', enabled: true, marker: false, st: {} }],
      sampling: {},
    },
    character: { id: 'fallback-character', data: { name: 'Guide', description: 'Character fallback.' } },
    user: { id: 'fallback-user', name: 'Fallback Reader', description: 'Stable user fallback.' },
  })
  assert.equal(result.systemText.match(/Stable user fallback\./g)?.length, 1)
  assert.ok(result.systemText.indexOf('Stable user fallback.') < result.systemText.indexOf('Character fallback.'))
  assert.ok(result.diagnostics.some(item => item.code === 'USER_PERSONA_MARKER_FALLBACK'))
  assert.equal(result.userInjection.descriptionInsertions, 1)
  assert.equal(result.userInjection.descriptionPlacement, 'fallback')
})

test('{{persona}} is an explicit single description placement and does not duplicate a later marker', () => {
  const result = compileTavernProfile({
    preset: {
      id: 'persona-macro',
      name: 'Persona macro',
      prompts: [
        { identifier: 'main', role: 'system', content: 'Persona: {{persona}} / duplicate: {{persona}}', enabled: true, marker: false, st: {} },
        { identifier: 'personaDescription', role: 'system', content: '', enabled: true, marker: true, st: {} },
      ],
      sampling: {},
    },
    user: { id: 'macro-user', name: 'Macro User', description: 'Only once.' },
  })
  assert.equal(result.systemText.match(/Only once\./g)?.length, 1)
  assert.doesNotMatch(result.systemText, /<st-user-field\b/)
  assert.equal(result.userInjection.descriptionInsertions, 1)
  assert.equal(result.userInjection.descriptionPlacement, 'preset-macro:main')
})

test('character {{original}} replacement preserves dollar sequences literally', () => {
  const result = compileTavernProfile({
    preset: {
      id: 'literal-original',
      name: 'Literal original',
      prompts: [{ identifier: 'main', role: 'system', content: 'Original $& $1', enabled: true, marker: false, st: {} }],
      sampling: {},
    },
    character: {
      id: 'literal-character',
      data: { name: 'Literal', systemPrompt: 'Card then {{original}}' },
    },
  })
  assert.match(result.systemText, /Card then Original \$& \$1/)
})

test('profile hard limit omits lower-ranked lore without cutting retained entries', () => {
  const loreEntries = Array.from({ length: 4 }, (_, index) => ({
    id: `lore-${index}`,
    position: 'after',
    content: `${index}:${'x'.repeat(240)}`,
  }))
  const result = compileTavernProfile({
    character: { id: 'bounded-character', data: { name: 'Bounded' } },
    loreEntries,
    maxProfileBytes: 700,
  })
  assert.ok(Buffer.byteLength(result.systemText, 'utf8') <= 700)
  assert.ok(result.activeLoreEntries.length > 0)
  assert.ok(result.activeLoreEntries.length < loreEntries.length)
  assert.deepEqual(result.activeLoreEntries, loreEntries.slice(0, result.activeLoreEntries.length).map(entry => entry.id))
  assert.ok(result.diagnostics.some(item => item.code === 'TAVERN_PROFILE_LORE_LIMITED'))
})

test('profile hard limit rejects oversized static content instead of truncating it', () => {
  assert.throws(
    () => compileTavernProfile({
      preset: {
        id: 'oversized-static',
        name: 'Oversized static',
        prompts: [{ identifier: 'main', role: 'system', content: 'x'.repeat(1000), enabled: true, marker: false }],
        sampling: {},
      },
      maxProfileBytes: 200,
    }),
    error => error?.code === 'TAVERN_PROFILE_TOO_LARGE' && error?.maxBytes === 200,
  )
})

test('profile assembly considers at most 4096 ranked lore entries', () => {
  const loreEntries = Array.from({ length: 4100 }, (_, index) => ({
    id: `bounded-${index}`,
    position: 'after',
    content: 'x',
  }))
  const result = compileTavernProfile({ loreEntries })
  assert.equal(result.activeLoreEntries.length, 4096)
  assert.equal(result.activeLoreEntries.at(-1), 'bounded-4095')
  assert.equal(result.diagnostics.find(item => item.code === 'TAVERN_PROFILE_LORE_LIMITED')?.omittedLoreEntries, 4)
})

test('V1 character description and greeting enter the compiled profile', () => {
  const result = compileTavernProfile({
    character: {
      id: 'v1-card',
      data: {
        name: 'V1 Guide',
        description: 'V1 description text',
        firstMessage: 'V1 hello',
      },
    },
  })
  assert.match(result.systemText, /V1 description text/)
  assert.match(result.systemText, /V1 hello/)
  assert.ok(result.diagnostics.some(item => item.code === 'CHARACTER_GREETING_REFERENCE'))
})

test('V2 alternate greeting index 1 uses the second greeting string', () => {
  const result = compileTavernProfile({
    character: {
      id: 'v2-card',
      data: {
        name: 'V2 Guide',
        firstMessage: 'First greeting',
        alternateGreetings: ['Second greeting'],
      },
    },
    characterSelection: { greetingIndex: 1 },
  })
  assert.match(result.systemText, /Second greeting/)
  assert.doesNotMatch(result.systemText, /First greeting/)
})

test('greeting reference can be omitted after the first turn without changing the selected card', () => {
  const result = compileTavernProfile({
    character: {
      id: 'opening-card',
      data: { name: 'Guide', firstMessage: 'Opening reference' },
    },
    includeGreetingReference: false,
  })
  assert.doesNotMatch(result.systemText, /Opening reference/)
  assert.equal(result.systemText, '')
  assert.deepEqual(result.sections, [])
})
