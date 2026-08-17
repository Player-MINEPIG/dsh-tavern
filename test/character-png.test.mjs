import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  embedCharacterCardPng,
  extractCharacterCardPng,
  parseSillyTavernCharacterCard,
  stripCharacterCardPng,
} from '../packages/tavern-format/src/index.js'

const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])

function chunk(type, data = new Uint8Array()) {
  const result = new Uint8Array(12 + data.length)
  new DataView(result.buffer).setUint32(0, data.length)
  result.set(new TextEncoder().encode(type), 4)
  result.set(data, 8)
  return result
}

function textChunk(keyword, value) {
  const encoded = Buffer.from(value, 'utf8').toString('base64')
  return chunk('tEXt', new TextEncoder().encode(`${keyword}\0${encoded}`))
}

function png(...metadata) {
  const ihdr = chunk('IHDR', new Uint8Array(13))
  const iend = chunk('IEND')
  return Buffer.concat([signature, ihdr, ...metadata, iend])
}

test('reads legacy chara PNG metadata', () => {
  const bytes = png(textChunk('chara', JSON.stringify({ name: 'PNG V1', description: 'Synthetic' })))
  const card = parseSillyTavernCharacterCard(bytes, { id: 'png-v1', fileName: 'synthetic.png' })
  assert.equal(card.source.container, 'png')
  assert.equal(card.source.pngKeyword, 'chara')
  assert.equal(card.name, 'PNG V1')
})

test('prefers ccv3 when both PNG card chunks are present', () => {
  const bytes = png(
    textChunk('ccv3', JSON.stringify({ spec: 'chara_card_v3', spec_version: '3.0', data: { name: 'V3 selected' } })),
    textChunk('chara', JSON.stringify({ name: 'V1 ignored' })),
  )
  const card = parseSillyTavernCharacterCard(bytes, { id: 'png-v3' })
  assert.equal(card.name, 'V3 selected')
  assert.equal(card.source.pngKeyword, 'ccv3')
  assert.ok(card.compatibility.warnings.some((item) => item.code === 'png-v3-precedence'))
})

test('rejects malformed PNG boundaries, metadata, and structure', () => {
  const truncated = png(textChunk('chara', JSON.stringify({ name: 'x' }))).subarray(0, 30)
  assert.throws(() => extractCharacterCardPng(truncated), /boundary|missing IEND|truncated/)
  assert.throws(() => extractCharacterCardPng(Buffer.concat([
    signature,
    chunk('tEXt', new TextEncoder().encode('chara\0!!!!')),
    chunk('IEND'),
  ])), /IHDR/)
  assert.throws(() => extractCharacterCardPng(png(chunk('tEXt', new TextEncoder().encode('chara\0!!!!')))), /base64/)
  assert.throws(() => extractCharacterCardPng(png(chunk('tEXt', new TextEncoder().encode('other\0ignored')))), /does not contain/)
})

test('enforces the decoded metadata limit', () => {
  const bytes = png(textChunk('chara', JSON.stringify({ name: 'metadata' })))
  assert.throws(() => extractCharacterCardPng(bytes, { maxMetadataBytes: 2 }), /metadata exceeds/)
})

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let crc = index
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1)
    }
    table[index] = crc >>> 0
  }
  return table
})()

function crc32(input) {
  let crc = 0xffffffff
  for (let index = 0; index < input.length; index += 1) {
    crc = CRC_TABLE[(crc ^ input[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function assertPngCrcs(bytes) {
  let offset = 8
  let sawEnd = false
  while (offset < bytes.length) {
    const length = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
    const stored = ((bytes[offset + 8 + length] << 24) | (bytes[offset + 9 + length] << 16) | (bytes[offset + 10 + length] << 8) | bytes[offset + 11 + length]) >>> 0
    const actual = crc32(bytes.subarray(offset + 4, offset + 8 + length))
    assert.equal(stored, actual)
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
    offset += 12 + length
    if (type === 'IEND') {
      sawEnd = true
      break
    }
  }
  assert.equal(sawEnd, true)
}

test('rewrites character-card PNG chunks with valid CRC and round-trips JSON', () => {
  const placeholder = readFileSync(new URL('../packages/tavern-format/assets/character-placeholder.png', import.meta.url))
  const raw = { spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'Embedded', first_mes: 'Hello' } }
  const embedded = embedCharacterCardPng(placeholder, JSON.stringify(raw))
  assertPngCrcs(embedded)
  const extracted = extractCharacterCardPng(embedded)
  assert.equal(extracted.keyword, 'chara')
  assert.deepEqual(JSON.parse(extracted.jsonText), raw)
  const card = parseSillyTavernCharacterCard(embedded, { id: 'embedded-png' })
  assert.equal(card.name, 'Embedded')
  assert.equal(card.source.container, 'png')
  assert.equal(embedded[16] << 24 | embedded[17] << 16 | embedded[18] << 8 | embedded[19], placeholder[16] << 24 | placeholder[17] << 16 | placeholder[18] << 8 | placeholder[19])
})

test('V3 PNG export writes ccv3 and a compatible chara chunk', () => {
  const placeholder = readFileSync(new URL('../packages/tavern-format/assets/character-placeholder.png', import.meta.url))
  const raw = { spec: 'chara_card_v3', spec_version: '3.0', data: { name: 'V3 PNG' } }
  const embedded = embedCharacterCardPng(placeholder, JSON.stringify(raw), { keywords: ['ccv3', 'chara'] })
  const extracted = extractCharacterCardPng(embedded)
  assert.equal(extracted.keyword, 'ccv3')
  assert.deepEqual(extracted.availableKeywords.toSorted(), ['ccv3', 'chara'])
  assert.equal(parseSillyTavernCharacterCard(embedded).name, 'V3 PNG')
})

test('strips character-card chunks from a PNG cover image', () => {
  const placeholder = readFileSync(new URL('../packages/tavern-format/assets/character-placeholder.png', import.meta.url))
  const embedded = embedCharacterCardPng(placeholder, JSON.stringify({ name: 'Cover' }))
  const stripped = stripCharacterCardPng(embedded)
  assertPngCrcs(stripped)
  assert.throws(() => extractCharacterCardPng(stripped), /does not contain/)
})
