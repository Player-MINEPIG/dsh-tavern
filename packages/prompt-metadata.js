import { createHash } from 'node:crypto'

export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
export const counts = text => ({ characters: [...text].length, utf16Units: text.length, utf8Bytes: Buffer.byteLength(text) })

