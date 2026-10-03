import {createElement as h} from 'react'
import {translate} from '../i18n.js'

// Only the trusted renderer mounts this view. A native parent event authorizes
// one already-frozen intent; no event/callback/task is forwarded into the VM.
export function IdentityActionProposal({proposal,bridge,onError}) {
 if(!proposal)return null
 const action=(method,event)=>{if(event.isTrusted!==true)return;const at=performance.now();bridge?.[method](proposal.proposalId,{trusted:true,at}).catch(error=>onError(error.message))}
 return h('section',{className:'dtv-card-identity-proposal',style:{border:'1px solid currentColor',padding:10,marginTop:8}},
  h('strong',null,translate('appearance.identityProposal')),
  h('p',null,translate('appearance.identityScope')),
  h('p',{role:'status'},translate('appearance.identityState.'+proposal.state)),
  proposal.opening?h('p',null,translate('appearance.identityWorldbook',{method:proposal.opening.method,inserted:proposal.opening.inserted,existing:proposal.opening.existing})):null,
  ...[['current','appearance.identityCurrent'],['normalized','appearance.identityNormalized'],['requested','appearance.identityRaw']].filter(([key])=>proposal[key]).map(([key,label])=>h('details',{key},h('summary',null,translate(label)),h('pre',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},JSON.stringify(proposal[key],null,2)))),
  proposal.message?h('details',{open:true},h('summary',null,translate('appearance.identityMessage')),h('pre',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},proposal.message)):null,
  proposal.error?h('p',{role:'alert'},proposal.error):null,
  h('small',null,'operationId: '+proposal.operationId),
  proposal.state==='prepared'?h('button',{type:'button',onClick:event=>action('confirm',event)},translate('appearance.identityConfirm')):null,
  proposal.state==='unknown'?h('button',{type:'button',disabled:proposal.busy,onClick:event=>action('retryOperation',event)},translate('appearance.identityRetryOperation')):null,
  proposal.state==='committed'&&!proposal.messagePresented&&proposal.coherent?h('button',{type:'button',onClick:event=>action('retryMessage',event)},translate('appearance.identityRetryMessage')):null,
  ['prepared','accepted','pending','unknown'].includes(proposal.state)?h('button',{type:'button',onClick:()=>bridge?.cancel(proposal.proposalId)},translate('appearance.close')):null)
}
