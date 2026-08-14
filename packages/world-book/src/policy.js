const LOGIC = new Set(['and_any', 'and_all', 'not_any', 'not_all'])

function entryKey(entry, index) {
  const sourceKey = entry?.source?.key
  const uid = entry?.uid
  return `${sourceKey ?? uid ?? 'entry'}@${index}`
}

function clampRoll(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(0.999999999, Math.max(0, value))
    : 0
}

function regexFromKey(key, options = {}) {
  if (typeof key !== 'string' || !key.startsWith('/')) return null
  let slash = -1
  for (let index = key.length - 1; index > 0; index -= 1) {
    if (key[index] !== '/') continue
    let escapes = 0
    for (let cursor = index - 1; cursor >= 0 && key[cursor] === '\\'; cursor -= 1) escapes += 1
    if (escapes % 2 === 0) {
      slash = index
      break
    }
  }
  if (slash <= 0) return null
  const pattern = key.slice(1, slash)
  if (options.allowUnsafeRegex !== true) {
    return {
      regex: null,
      error: 'Native regular-expression keys are disabled by default because JavaScript RegExp has no execution timeout',
      code: 'unsafe-regex-disabled',
    }
  }
  const maxRegexLength = Number.isSafeInteger(options.maxRegexLength) && options.maxRegexLength > 0
    ? options.maxRegexLength
    : 256
  if (pattern.length > maxRegexLength) {
    return {
      regex: null,
      error: `Regular-expression key exceeds the ${maxRegexLength} character limit`,
      code: 'regex-too-long',
    }
  }
  try {
    return { regex: new RegExp(pattern, key.slice(slash + 1)), error: null, code: null }
  } catch (error) {
    return { regex: null, error: error instanceof Error ? error.message : String(error), code: 'invalid-regex' }
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function matchWorldBookKey(text, key, options = {}) {
  const haystack = typeof text === 'string' ? text : ''
  if (typeof key !== 'string' || key.trim() === '') return { matched: false, kind: 'plain', error: null }
  const regexKey = regexFromKey(key.trim(), options)
  if (regexKey !== null) {
    if (regexKey.regex === null) return { matched: false, kind: 'regex', error: regexKey.error, code: regexKey.code }
    regexKey.regex.lastIndex = 0
    return { matched: regexKey.regex.test(haystack), kind: 'regex', error: null, code: null }
  }

  const caseSensitive = options.caseSensitive === true
  const source = caseSensitive ? haystack : haystack.toLowerCase()
  const needle = caseSensitive ? key : key.toLowerCase()
  if (options.matchWholeWords !== true) return { matched: source.includes(needle), kind: 'plain', error: null }
  if (/\s/.test(needle)) return { matched: source.includes(needle), kind: 'plain', error: null }
  return {
    matched: new RegExp(`(?:^|\\W)${escapeRegex(needle)}(?:$|\\W)`).test(source),
    kind: 'plain',
    error: null,
  }
}

function matchKeys(text, keys, options) {
  const matches = []
  const invalidKeys = []
  for (const key of Array.isArray(keys) ? keys : []) {
    const result = matchWorldBookKey(text, key, options)
    if (result.error !== null) invalidKeys.push({ key, error: result.error, code: result.code ?? 'invalid-regex' })
    if (result.matched) matches.push(key)
  }
  return { matches, invalidKeys }
}

export function evaluateWorldBookEntry(entry, text, defaults = {}) {
  if (!entry || typeof entry !== 'object') {
    return { eligible: false, reason: 'invalid-entry', score: 0, primaryMatches: [], secondaryMatches: [], invalidKeys: [] }
  }
  if (entry.enabled !== true) {
    return { eligible: false, reason: 'disabled', score: 0, primaryMatches: [], secondaryMatches: [], invalidKeys: [] }
  }

  const options = {
    caseSensitive: entry.caseSensitive ?? defaults.caseSensitive ?? false,
    matchWholeWords: entry.matchWholeWords ?? defaults.matchWholeWords ?? false,
    allowUnsafeRegex: defaults.allowUnsafeRegex === true,
    maxRegexLength: defaults.maxRegexLength,
  }
  const primary = matchKeys(text, entry.keys, options)
  const secondary = matchKeys(text, entry.secondaryKeys, options)
  const invalidKeys = [
    ...primary.invalidKeys.map(item => ({ ...item, set: 'primary' })),
    ...secondary.invalidKeys.map(item => ({ ...item, set: 'secondary' })),
  ]

  if (entry.constant === true) {
    return { eligible: true, reason: 'constant', score: Math.max(1, primary.matches.length), primaryMatches: primary.matches, secondaryMatches: secondary.matches, invalidKeys }
  }
  if (entry.vectorized === true && defaults.vectorMatched !== true) {
    return { eligible: false, reason: 'external-vector-match-required', score: 0, primaryMatches: primary.matches, secondaryMatches: secondary.matches, invalidKeys }
  }
  if (entry.vectorized === true && defaults.vectorMatched === true) {
    return { eligible: true, reason: 'vector-match', score: Math.max(1, primary.matches.length), primaryMatches: primary.matches, secondaryMatches: secondary.matches, invalidKeys }
  }
  if (primary.matches.length === 0) {
    return { eligible: false, reason: 'primary-key-miss', score: 0, primaryMatches: [], secondaryMatches: secondary.matches, invalidKeys }
  }

  const selective = entry.selective === true && Array.isArray(entry.secondaryKeys) && entry.secondaryKeys.length > 0
  if (!selective) {
    return { eligible: true, reason: 'primary-key-match', score: primary.matches.length, primaryMatches: primary.matches, secondaryMatches: secondary.matches, invalidKeys }
  }

  const logic = LOGIC.has(entry.selectiveLogic) ? entry.selectiveLogic : 'and_any'
  const any = secondary.matches.length > 0
  const all = secondary.matches.length === entry.secondaryKeys.length
  const eligible = logic === 'and_any' ? any
    : logic === 'and_all' ? all
      : logic === 'not_any' ? !any
        : !all
  const positive = logic === 'and_any' || logic === 'and_all'
  return {
    eligible,
    reason: eligible ? `secondary-${logic}-match` : `secondary-${logic}-miss`,
    score: primary.matches.length + (positive && eligible ? secondary.matches.length : 0),
    primaryMatches: primary.matches,
    secondaryMatches: secondary.matches,
    invalidKeys,
  }
}

export function rankWorldBookEntries(entries) {
  if (!Array.isArray(entries)) throw new TypeError('entries must be an array')
  return entries
    .map((entry, index) => ({ entry, index }))
    .toSorted((left, right) => {
      const leftOrder = Number.isFinite(left.entry?.insertionOrder) ? left.entry.insertionOrder : 100
      const rightOrder = Number.isFinite(right.entry?.insertionOrder) ? right.entry.insertionOrder : 100
      return rightOrder - leftOrder || left.index - right.index
    })
    .map(item => item.entry)
}

function lookup(input, key, entry, fallback) {
  if (input instanceof Map) {
    if (input.has(key)) return input.get(key)
    if (input.has(entry.uid)) return input.get(entry.uid)
    if (input.has(String(entry.uid))) return input.get(String(entry.uid))
    return fallback
  }
  if (input && typeof input === 'object') {
    if (Object.hasOwn(input, key)) return input[key]
    if (Object.hasOwn(input, String(entry.uid))) return input[String(entry.uid)]
  }
  return fallback
}

function groupNames(entry) {
  return typeof entry?.group?.name === 'string'
    ? entry.group.name.split(/,\s*/).map(value => value.trim()).filter(Boolean)
    : []
}

function resolveGroups(candidates, options) {
  const active = new Set(candidates)
  const groups = new Map()
  for (const candidate of candidates) {
    for (const name of groupNames(candidate.entry)) {
      if (!groups.has(name)) groups.set(name, [])
      groups.get(name).push(candidate)
    }
  }

  for (const [name, originalMembers] of groups) {
    let members = originalMembers.filter(member => active.has(member))
    if (members.length <= 1) continue

    const scoringEnabled = options.useGroupScoring === true || members.some(member => member.entry.useGroupScoring === true)
    if (scoringEnabled) {
      const maxScore = Math.max(...members.map(member => member.evaluation.score))
      for (const member of members) {
        const scored = member.entry.useGroupScoring ?? options.useGroupScoring ?? false
        if (scored && member.evaluation.score < maxScore) active.delete(member)
      }
      members = members.filter(member => active.has(member))
    }
    if (members.length <= 1) continue

    const overrides = members.filter(member => member.entry.group?.override === true)
    let winner
    if (overrides.length > 0) {
      winner = overrides[0]
    } else {
      const weights = members.map(member => Math.max(0, Number(member.entry.group?.weight) || 0))
      const total = weights.reduce((sum, weight) => sum + weight, 0)
      if (total <= 0) winner = members[0]
      else {
        const roll = clampRoll(lookup(options.groupRolls, name, { uid: name }, 0)) * total
        let cursor = 0
        winner = members.at(-1)
        for (let index = 0; index < members.length; index += 1) {
          cursor += weights[index]
          if (roll < cursor) {
            winner = members[index]
            break
          }
        }
      }
    }
    for (const member of members) if (member !== winner) active.delete(member)
  }
  return active
}

function defaultTokenCost(content) {
  return Math.max(1, Math.ceil(String(content ?? '').length / 4))
}

export function computeWorldBookCandidates(modelOrEntries, options = {}) {
  const entries = Array.isArray(modelOrEntries) ? modelOrEntries : modelOrEntries?.entries
  if (!Array.isArray(entries)) throw new TypeError('Expected a WorldBookModel or an entries array')
  const text = typeof options.text === 'string' ? options.text : ''
  const ranked = entries
    .map((entry, index) => ({ entry, originalIndex: index, key: entryKey(entry, index) }))
    .toSorted((left, right) => {
      const leftOrder = Number.isFinite(left.entry?.insertionOrder) ? left.entry.insertionOrder : 100
      const rightOrder = Number.isFinite(right.entry?.insertionOrder) ? right.entry.insertionOrder : 100
      return rightOrder - leftOrder || left.originalIndex - right.originalIndex
    })

  const rejected = []
  const eligible = []
  for (const candidate of ranked) {
    const vectorMatched = lookup(options.vectorMatches, candidate.key, candidate.entry, false) === true
    const evaluation = evaluateWorldBookEntry(candidate.entry, text, {
      caseSensitive: options.caseSensitive,
      matchWholeWords: options.matchWholeWords,
      vectorMatched,
      allowUnsafeRegex: options.allowUnsafeRegex === true,
      maxRegexLength: options.maxRegexLength,
    })
    const evaluated = { ...candidate, evaluation }
    if (!evaluation.eligible) rejected.push({ ...evaluated, reason: evaluation.reason })
    else eligible.push(evaluated)
  }

  const groupWinners = resolveGroups(eligible, options)
  const afterGroups = []
  for (const candidate of eligible) {
    if (groupWinners.has(candidate)) afterGroups.push(candidate)
    else rejected.push({ ...candidate, reason: 'inclusion-group-loser' })
  }

  const afterProbability = []
  for (const candidate of afterGroups) {
    const entry = candidate.entry
    const probability = entry.useProbability === false ? 100 : Math.min(100, Math.max(0, Number(entry.probability) || 0))
    const roll = clampRoll(lookup(options.probabilityRolls, candidate.key, entry, 0))
    if (probability <= 0 || (probability < 100 && roll * 100 >= probability)) {
      rejected.push({ ...candidate, reason: 'probability-failed', probability, roll })
    } else {
      afterProbability.push({ ...candidate, probability, roll })
    }
  }

  const finiteBudget = typeof options.tokenBudget === 'number' && Number.isFinite(options.tokenBudget)
    ? Math.max(0, Math.floor(options.tokenBudget))
    : Infinity
  let usedTokens = 0
  const accepted = []
  for (const candidate of afterProbability) {
    const supplied = lookup(options.tokenCosts, candidate.key, candidate.entry, undefined)
    const tokenCost = typeof supplied === 'number' && Number.isFinite(supplied) && supplied >= 0
      ? Math.ceil(supplied)
      : defaultTokenCost(candidate.entry.content)
    if (candidate.entry.ignoreBudget !== true && usedTokens + tokenCost > finiteBudget) {
      rejected.push({ ...candidate, reason: 'budget-exceeded', tokenCost })
      continue
    }
    if (candidate.entry.ignoreBudget !== true) usedTokens += tokenCost
    accepted.push({ ...candidate, reason: candidate.evaluation.reason, tokenCost })
  }

  const publicCandidate = candidate => ({
    key: candidate.key,
    entry: candidate.entry,
    reason: candidate.reason,
    score: candidate.evaluation.score,
    primaryMatches: candidate.evaluation.primaryMatches,
    secondaryMatches: candidate.evaluation.secondaryMatches,
    invalidKeys: candidate.evaluation.invalidKeys,
    tokenCost: candidate.tokenCost,
    probability: candidate.probability,
    probabilityRoll: candidate.roll,
  })
  return {
    accepted: accepted.map(publicCandidate),
    rejected: rejected.toSorted((left, right) => left.originalIndex - right.originalIndex).map(publicCandidate),
    budget: {
      limit: Number.isFinite(finiteBudget) ? finiteBudget : null,
      used: usedTokens,
      remaining: Number.isFinite(finiteBudget) ? finiteBudget - usedTokens : null,
    },
  }
}
