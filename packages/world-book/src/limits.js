export const WORLD_BOOK_LIMITS = Object.freeze({
  maxEntries: 10_000,
  maxJsonDepth: 32,
  maxJsonNodes: 100_000,
  maxStringCharacters: 1024 * 1024,
  maxObjectKeyCharacters: 1024,
  maxRuntimeEntries: 10_000,
})

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export class WorldBookLimitError extends TypeError {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'WorldBookLimitError'
    this.code = code
    Object.assign(this, details)
  }
}

function positiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}

/**
 * Iterative structural guard for untrusted World Book JSON. It inspects data
 * without rewriting it, so unknown ST fields remain lossless while recursion,
 * node, string, key and entry-count work are all bounded before normalization.
 */
export function assertWorldBookStructure(value, options = {}) {
  const limits = {
    maxEntries: positiveInteger(options.maxEntries, WORLD_BOOK_LIMITS.maxEntries),
    maxJsonDepth: positiveInteger(options.maxJsonDepth, WORLD_BOOK_LIMITS.maxJsonDepth),
    maxJsonNodes: positiveInteger(options.maxJsonNodes, WORLD_BOOK_LIMITS.maxJsonNodes),
    maxStringCharacters: positiveInteger(options.maxStringCharacters, WORLD_BOOK_LIMITS.maxStringCharacters),
    maxObjectKeyCharacters: positiveInteger(options.maxObjectKeyCharacters, WORLD_BOOK_LIMITS.maxObjectKeyCharacters),
  }
  if (!isRecord(value)) throw new WorldBookLimitError('WORLD_BOOK_ROOT_INVALID', 'World book must be an object')
  const entries = value.entries
  const entryCount = Array.isArray(entries)
    ? entries.length
    : isRecord(entries)
      ? Object.keys(entries).length
      : null
  if (entryCount !== null && entryCount > limits.maxEntries) {
    throw new WorldBookLimitError(
      'WORLD_BOOK_ENTRY_LIMIT',
      `World book may contain at most ${limits.maxEntries} entries`,
      { entryCount, limit: limits.maxEntries },
    )
  }

  const pending = [{ value, depth: 0 }]
  let nodes = 0
  while (pending.length > 0) {
    const current = pending.pop()
    nodes += 1
    if (nodes > limits.maxJsonNodes) {
      throw new WorldBookLimitError(
        'WORLD_BOOK_NODE_LIMIT',
        `World book may contain at most ${limits.maxJsonNodes} JSON values`,
        { nodes, limit: limits.maxJsonNodes },
      )
    }
    if (current.depth > limits.maxJsonDepth) {
      throw new WorldBookLimitError(
        'WORLD_BOOK_DEPTH_LIMIT',
        `World book nesting may not exceed ${limits.maxJsonDepth} levels`,
        { depth: current.depth, limit: limits.maxJsonDepth },
      )
    }
    if (typeof current.value === 'string' && current.value.length > limits.maxStringCharacters) {
      throw new WorldBookLimitError(
        'WORLD_BOOK_STRING_LIMIT',
        `World book strings may not exceed ${limits.maxStringCharacters} characters`,
        { characters: current.value.length, limit: limits.maxStringCharacters },
      )
    }
    if (Array.isArray(current.value)) {
      for (const item of current.value) pending.push({ value: item, depth: current.depth + 1 })
    } else if (isRecord(current.value)) {
      for (const [key, item] of Object.entries(current.value)) {
        if (key.length > limits.maxObjectKeyCharacters) {
          throw new WorldBookLimitError(
            'WORLD_BOOK_KEY_LIMIT',
            `World book object keys may not exceed ${limits.maxObjectKeyCharacters} characters`,
            { characters: key.length, limit: limits.maxObjectKeyCharacters },
          )
        }
        pending.push({ value: item, depth: current.depth + 1 })
      }
    }
  }
  return { entryCount, nodes, limits }
}
