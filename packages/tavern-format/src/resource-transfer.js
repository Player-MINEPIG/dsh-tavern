/** Versioned portable resource documents contain editable fields, never local identity. */
export function readResourceTransfer(value, resourceType) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || value.format !== 'pmp-dsh-tavern' || value.version !== 1 || value.resourceType !== resourceType) {
    throw new TypeError(`Expected a Tavern version 1 ${resourceType} document`)
  }
  const extra = Object.keys(value).find(key => !['format', 'version', 'resourceType', 'data'].includes(key))
  if (extra !== undefined) throw new TypeError(`Unsupported transfer field "${extra}"`)
  if (value.data === null || typeof value.data !== 'object' || Array.isArray(value.data)) {
    throw new TypeError('Transfer data must be an object')
  }
  return value.data
}

export function resourceTransfer(resourceType, data) {
  return { format: 'pmp-dsh-tavern', version: 1, resourceType, data }
}
