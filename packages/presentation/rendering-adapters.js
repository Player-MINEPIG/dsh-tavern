// Preferences describe a replacement choice, never code approval or write grants.
export function normalizeRenderingAdapters(value) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.entries) || value.entries.length > 128
    || Object.keys(value).some(key=>!['schemaVersion','entries'].includes(key))) throw new TypeError('Invalid renderingAdapters')
  const seen=new Set()
  const entries=value.entries.map(item=>{
    if(!item || Object.keys(item).some(key=>!['owner','source','mode'].includes(key))
      || typeof item.owner!=='string' || !/^(character|preset|global):.+/.test(item.owner) || item.owner.length>300
      || typeof item.source!=='string' || item.source.length>2048 || !['builtin','original'].includes(item.mode))throw new TypeError('Invalid rendering adapter preference')
    let url
    try{url=new URL(item.source)}catch{throw new TypeError('Invalid rendering adapter source')}
    if(url.protocol!=='https:' || url.username || url.password || url.hash)throw new TypeError('Invalid rendering adapter source')
    const key=JSON.stringify([item.owner,item.source])
    if(seen.has(key))throw new TypeError('Duplicate rendering adapter preference')
    seen.add(key);return {owner:item.owner,source:item.source,mode:item.mode}
  })
  return {schemaVersion:1,entries}
}
export function updateRenderingAdapter(value,owner,source,mode) {
  const entries=(value?.entries??[]).filter(item=>item.owner!==owner||item.source!==source)
  if(mode!==undefined)entries.push({owner,source,mode})
  return normalizeRenderingAdapters({schemaVersion:1,entries})
}
