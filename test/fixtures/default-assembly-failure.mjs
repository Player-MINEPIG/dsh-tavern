// Synthetic counterpart of the reported first request: ST chatHistory claims
// input before the character fallback; depth-zero lore follows the greeting.
// No user resource text, ids or filesystem coordinates are retained here.
export function defaultAssemblyFailureInput() {
  const text = (id, role, value = id) => ({ id, role, content: [{ type: 'text', text: value }], source: { kind: role === 'system' ? 'system-prompt' : 'user' } })
  const prompt = (identifier, role) => ({ identifier, enabled: true, role, content: identifier })
  return {
    nativeMessages: [text('official', 'system'), text('input', 'user'), text('context', 'user')], inputIds: ['input', 'context'],
    assets: {
      character: { id: 'card', data: { firstMessage: 'GREETING' } }, includeGreetingReference: true,
      preset: { prompts: [prompt('MAIN', 'system'), ...Array.from({ length: 4 }, (_, i) => prompt(`BEFORE_${i}`, 'user')),
        { identifier: 'worldInfoBefore', marker: true, enabled: true }, prompt('BEFORE_INPUT', 'user'),
        { identifier: 'chatHistory', marker: true, enabled: true }, ...Array.from({ length: 15 }, (_, i) => prompt(`AFTER_${i}`, 'user'))] },
      loreEntries: [...Array.from({ length: 3 }, (_, i) => ({ id: `before-${i}`, content: `LORE_BEFORE_${i}`, position: 'before' })),
        ...Array.from({ length: 3 }, (_, i) => ({ id: `depth-${i}`, content: `LORE_DEPTH_${i}`, requestedPosition: 'at_depth', depth: 0, position: 'after' }))],
    },
  }
}
