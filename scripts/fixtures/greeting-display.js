// Synthetic card: exercise the same placeholder/variable templates as ST cards
// without checking private card content into the repository.
export function greetingDisplayFixture() {
  const character = {
    id: 'card', name: 'Guide',
    data: {
      name: 'Guide',
      firstMessage: 'Hello {{user}}.\n<UpdateVariable>[{"op":"replace","path":"/status","value":"Ready"}]</UpdateVariable>\n<StatusPlaceHolderImpl/>',
      alternateGreetings: ['Alternate {{char}}.\n<StatusPlaceHolderImpl/>', ''],
    },
    source: { raw: { data: { extensions: { regex_scripts: [
      { id: 'panel', findRegex: '<StatusPlaceHolderImpl/>', replaceString: '<style>.greeting-status{display:grid;color:rgb(12,34,56)}</style><section class="greeting-status"><strong>Character status</strong><span>Loading...</span></section>', placement: [2], markdownOnly: true },
      { id: 'variables', findRegex: '/<UpdateVariable>([\\s\\S]*?)<\\/UpdateVariable>/g', replaceString: '<details><summary>Variable updates</summary>$1</details>', placement: [1, 2], markdownOnly: true },
      { id: 'prompt-only', findRegex: '/[\\s\\S]+/g', replaceString: 'PROMPT ONLY', placement: [2], promptOnly: true },
      { id: 'disabled', findRegex: '/[\\s\\S]+/g', replaceString: 'DISABLED', placement: [2], disabled: true },
      { id: 'user-only', findRegex: '/[\\s\\S]+/g', replaceString: 'USER ONLY', placement: [1], markdownOnly: true },
    ] } } } },
  }
  const selection = { characterCardId: 'card', character: { greetingIndex: 0 } }
  const timeline = { nodes: [] }
  const messages = { incompleteTurn: false, messages: [] }
  const rules = [
    { id: 'global', find: 'Hello Reader', replace: 'Welcome Reader', target: 'assistant' },
    { id: 'other-card', find: 'Welcome', replace: 'WRONG CARD', scope: { kind: 'character', resourceId: 'other' } },
  ]
  const playthrough = { id: 'play', path: 'timeline.json', ext: { pmpDshTavern: { rootSessionId: 'session', characterId: 'card' } } }
  const client = {
    async getMessages() { return messages },
    async getTimeline() { return timeline },
    async putTimeline() { throw new Error('Rendering must not write history') },
    async getCharacterSelection() { return { selection } },
    async getCharacter() { return { character } },
    async getActive() { return { selection: { ...selection, presetId: 'preset' }, resources: { user: { name: 'Reader' } } } },
    async getPreset() { return { preset: { source: { raw: { regex_scripts: [
      { id: 'preset', findRegex: 'Welcome Reader', replaceString: 'Greetings Reader', placement: [2] },
    ] } } } } },
    async getFile() { return { content: JSON.stringify({ schemaVersion: 1, rules }) } },
  }
  return { character, selection, timeline, messages, rules, playthrough, client }
}
