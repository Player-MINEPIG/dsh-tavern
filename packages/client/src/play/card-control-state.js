// DOM checked properties are live state, not serialized HTML attributes. Only
// bounded booleans for already admitted nodes cross this presentation boundary.
export function cardControlEventChecked(type,node,phases,now=performance.now()) {
  if(!['click','input','change'].includes(type))return undefined
  const previous=phases.get(node),continued=previous&&now-previous.at>=0&&now-previous.at<1000&&(type==='input'&&previous.type==='click'||type==='change'&&['click','input'].includes(previous.type))
  if(type==='change')phases.delete(node);else phases.set(node,{type,at:now})
  // Native click/input/change describe one toggle. Later events must preserve
  // any checked change made by the guest's earlier handler in that same chain.
  return continued?undefined:node.checked===true
}
export function projectCardControlState(controls=[],nodes,{connected=false,apply=true,preserve}={}) {
  if(!Array.isArray(controls)||controls.length>512)throw Error('Invalid card control state')
  const seen=new Set(),pending=[]
  for(const value of controls){
    if(!value||Array.isArray(value)||Object.keys(value).length!==2||!Object.hasOwn(value,'id')||!Object.hasOwn(value,'checked')||!Number.isSafeInteger(value.id)||value.id<1||typeof value.checked!=='boolean'||seen.has(value.id))throw Error('Invalid card control state')
    const node=nodes.get(value.id)
    if(!node||node.localName!=='input'||!['radio','checkbox'].includes(node.type)||connected&&!node.isConnected)throw Error('Card control is outside this view')
    const previous=preserve?.get(value.id)
    seen.add(value.id);pending.push([node,previous?.isConnected===true&&previous.localName==='input'&&['radio','checkbox'].includes(previous.type)?previous.checked===true:value.checked])
  }
  if(apply)for(const [node,checked]of pending)node.checked=checked
}
