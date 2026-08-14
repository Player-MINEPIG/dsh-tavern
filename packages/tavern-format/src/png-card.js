const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])
const DEFAULT_MAX_CHUNKS = 10_000
const DEFAULT_MAX_METADATA_BYTES = 2 * 1024 * 1024

function bytes(input) {
  if (input instanceof Uint8Array) return input
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  throw new TypeError('PNG input must be bytes')
}

function uint32(input, offset) {
  return ((input[offset] * 0x1000000)
    + (input[offset + 1] << 16)
    + (input[offset + 2] << 8)
    + input[offset + 3]) >>> 0
}

function ascii(input, start, end) {
  let value = ''
  for (let index = start; index < end; index += 1) value += String.fromCharCode(input[index])
  return value
}

function decodeBase64(value) {
  const compact = value.trim()
  if (compact.length === 0 || compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    throw new TypeError('Character-card PNG metadata is not valid base64')
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const outputLength = (compact.length / 4) * 3 - (compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0)
  const output = new Uint8Array(outputLength)
  let outputIndex = 0
  for (let index = 0; index < compact.length; index += 4) {
    const a = alphabet.indexOf(compact[index])
    const b = alphabet.indexOf(compact[index + 1])
    const c = compact[index + 2] === '=' ? 0 : alphabet.indexOf(compact[index + 2])
    const d = compact[index + 3] === '=' ? 0 : alphabet.indexOf(compact[index + 3])
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new TypeError('Character-card PNG metadata is not valid base64')
    const combined = (a << 18) | (b << 12) | (c << 6) | d
    if (outputIndex < outputLength) output[outputIndex++] = (combined >>> 16) & 0xff
    if (outputIndex < outputLength) output[outputIndex++] = (combined >>> 8) & 0xff
    if (outputIndex < outputLength) output[outputIndex++] = combined & 0xff
  }
  return output
}

function decodeUtf8(input) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(input)
  } catch {
    throw new TypeError('Character-card PNG metadata is not valid UTF-8')
  }
}

export function isPng(input) {
  let value
  try {
    value = bytes(input)
  } catch {
    return false
  }
  return value.length >= PNG_SIGNATURE.length
    && PNG_SIGNATURE.every((byte, index) => value[index] === byte)
}

export function extractCharacterCardPng(input, options = {}) {
  const value = bytes(input)
  if (!isPng(value)) throw new TypeError('Character-card PNG has an invalid signature')

  const maxChunks = options.maxChunks ?? DEFAULT_MAX_CHUNKS
  const maxMetadataBytes = options.maxMetadataBytes ?? DEFAULT_MAX_METADATA_BYTES
  let offset = PNG_SIGNATURE.length
  let chunkCount = 0
  let sawEnd = false
  const candidates = new Map()

  while (offset < value.length) {
    if (value.length - offset < 12) throw new TypeError('Character-card PNG contains a truncated chunk header')
    const length = uint32(value, offset)
    const type = ascii(value, offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    const next = dataEnd + 4
    if (dataEnd < dataStart || next > value.length) throw new TypeError(`Character-card PNG chunk ${type} exceeds the file boundary`)
    chunkCount += 1
    if (chunkCount > maxChunks) throw new TypeError(`Character-card PNG exceeds the ${maxChunks} chunk limit`)
    if (chunkCount === 1 && (type !== 'IHDR' || length !== 13)) throw new TypeError('Character-card PNG must begin with a 13-byte IHDR chunk')
    if (type === 'IEND' && length !== 0) throw new TypeError('Character-card PNG IEND chunk must be empty')

    if (type === 'tEXt') {
      let separator = -1
      for (let index = dataStart; index < dataEnd; index += 1) {
        if (value[index] === 0) {
          separator = index
          break
        }
      }
      if (separator !== -1) {
        const keyword = ascii(value, dataStart, separator)
        if (keyword === 'chara' || keyword === 'ccv3') {
          const encoded = ascii(value, separator + 1, dataEnd)
          if (encoded.length > Math.ceil(maxMetadataBytes / 3) * 4 + 4) {
            throw new TypeError(`Character-card PNG metadata exceeds the ${maxMetadataBytes} byte limit`)
          }
          const decoded = decodeBase64(encoded)
          if (decoded.length > maxMetadataBytes) {
            throw new TypeError(`Character-card PNG metadata exceeds the ${maxMetadataBytes} byte limit`)
          }
          candidates.set(keyword, decodeUtf8(decoded))
        }
      }
    }

    offset = next
    if (type === 'IEND') {
      sawEnd = true
      break
    }
  }

  if (!sawEnd) throw new TypeError('Character-card PNG is missing IEND')
  const keyword = candidates.has('ccv3') ? 'ccv3' : candidates.has('chara') ? 'chara' : null
  if (keyword === null) throw new TypeError('PNG does not contain a chara or ccv3 character-card chunk')
  return {
    keyword,
    jsonText: candidates.get(keyword),
    availableKeywords: [...candidates.keys()],
  }
}

export const pngCharacterCardConstants = Object.freeze({
  signature: PNG_SIGNATURE,
  maxChunks: DEFAULT_MAX_CHUNKS,
  maxMetadataBytes: DEFAULT_MAX_METADATA_BYTES,
})
