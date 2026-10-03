// DOM checked properties are live state, not serialized HTML attributes. Only
// bounded booleans for already admitted nodes cross this presentation boundary.
export function projectCardControlState(controls=[],nodes) {
  if(!Array.isArray(controls)||controls.length>512)throw Error('Invalid card control state')
  const seen=new Set(),pending=[]
  for(const value of controls){
    if(!value||Array.isArray(value)||Object.keys(value).length!==2||!Object.hasOwn(value,'id')||!Object.hasOwn(value,'checked')||!Number.isSafeInteger(value.id)||value.id<1||typeof value.checked!=='boolean'||seen.has(value.id))throw Error('Invalid card control state')
    const node=nodes.get(value.id)
    if(!node||node.localName!=='input'||!['radio','checkbox'].includes(node.type))throw Error('Card control is outside this view')
    seen.add(value.id);pending.push([node,value.checked])
  }
  for(const [node,checked]of pending)node.checked=checked
}
