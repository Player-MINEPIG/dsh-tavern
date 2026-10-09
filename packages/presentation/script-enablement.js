// Ordinary preferences only. Never accept persisted code approvals or write grants.
export function normalizeScriptEnablement(value) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.entries) || value.entries.length > 128
    || Object.keys(value).some(key=>!['schemaVersion','entries'].includes(key))) throw new TypeError('Invalid scriptEnablement')
  const seen = new Set()
  const entries = value.entries.map(item=>{
    if (!item || Object.keys(item).some(key=>!['owner','key','enabled'].includes(key))
      || typeof item.owner !== 'string' || !/^(character|preset|global):.+/.test(item.owner) || item.owner.length > 300
      || typeof item.key !== 'string' || !item.key || item.key.length > 2048 || typeof item.enabled !== 'boolean') throw new TypeError('Invalid script enablement entry')
    const identity=JSON.stringify([item.owner,item.key])
    if(seen.has(identity)) throw new TypeError('Duplicate script enablement entry')
    seen.add(identity)
    return {owner:item.owner,key:item.key,enabled:item.enabled}
  })
  return {schemaVersion:1,entries}
}
export function updateScriptEnablement(value, owner, key, enabled) {
  const entries = (value?.entries??[]).filter(item=>item.owner!==owner || item.key!==key)
  if (typeof enabled === 'boolean') entries.push({owner,key,enabled})
  return normalizeScriptEnablement({schemaVersion:1,entries})
}
