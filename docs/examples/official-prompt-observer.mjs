// A DSH backend plugin. No Tavern imports or v3 requests.
export const name = 'example-prompt-observer'
export const inject = ['systemPrompt']
export function apply(ctx) {
  ctx.on('system-prompt/assemble', async (_input, context, next) => {
    const assembly = await next()
    // Inspect assembly.sections: each item has name/text; variables render later.
    // A consumer may return its own ordered sections here. Do not change tools
    // or contexts unless the user requested that separate behavior.
    ctx.logger.info(`Prompt assembly: ${assembly.sections.length} sections`)
    return assembly
  })
  ctx.on('llm/stream', async function* (options, next) {
    // DSH 0.1.7-rc.1 AgentLoop system text is in system-role options.messages.
    // One-shot callers can also use options.system. Requests are immutable.
    // This is an observation at the LLM boundary, not provider success proof.
    yield* next()
  })
}
