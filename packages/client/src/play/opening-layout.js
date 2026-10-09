import {createElement as h,createContext,useContext,useLayoutEffect,useSyncExternalStore} from 'react'
import {translate} from '../i18n.js'
import {MowanChatView} from './chat.js'

export const OPENING_SESSION_SLOT='pmp-dsh-tavern.opening.session'
const Opening=createContext(null)
const css=`
.dtv-rp-opening-shell{flex:1;width:100%;height:100%;min-height:0;min-width:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.dtv-rp-opening-header{flex:none;display:flex;align-items:center;gap:12px;padding:12px 72px 12px 16px;border-bottom:1px solid var(--dsw-alias-border-l3);min-width:0}
.dtv-rp-opening-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.dtv-rp-opening-tabs{flex:none;display:flex;gap:6px}.dtv-rp-opening-header button{font:inherit;font-size:12px;padding:7px 10px;border:0;border-radius:8px;color:inherit;background:transparent;cursor:pointer;white-space:nowrap}.dtv-rp-opening-header [aria-selected=true]{background:var(--dsw-alias-interactive-bg-selected);color:var(--dsw-alias-state-business-primary)}
.dtv-rp-opening-shell [data-conversation-scroll]{scroll-padding-bottom:calc(var(--dsh-composer-height,160px) + 12px)}
.dtv-rp-opening-view{flex:1 0 auto;min-height:auto;min-width:0}.dtv-rp-opening-view .dtv-play-chat{height:auto;min-height:100%;overflow:visible;padding:16px max(12px,calc((100% - 1040px)/2)) 24px}.dtv-rp-opening-view .dtv-play-chat-bubble{max-width:100%;min-width:0}
.dtv-rp-opening-view .dtv-play-greeting .dtv-play-chat-bubble:has(.dtv-interactive-card){width:100%!important}
.dtv-rp-opening-view .dtv-play-greeting .dtv-message:has(.dtv-interactive-card){grid-template-columns:42px minmax(0,1fr)!important}
@media(max-width:520px){.dtv-rp-opening-header{gap:6px;padding:8px 64px 8px 8px}.dtv-rp-opening-tabs{gap:2px}.dtv-rp-opening-header button{padding:7px 8px}.dtv-rp-opening-view .dtv-play-chat{padding:12px 8px 20px}}
`
function installStyles(){
 if(document.querySelector('style[data-dtv-opening-layout]'))return
 const style=document.createElement('style');style.dataset.dtvOpeningLayout='';style.textContent=css;document.head.append(style)
}

// This caller-selected component is authorized by the public content Factory.
// All Session hooks remain scoped to the Factory occurrence.
function OpeningViews(props){
 const opening=useContext(Opening)
 return h('div',{className:'dtv-rp-opening-view','data-dtv-opening-session':props.sessionId},h(MowanChatView,{
  ...props,playClient:opening.playClient,playthrough:opening.binding.playthrough,openSession:opening.openSession,onComposerPending:opening.onComposerPending,
 }))
}
const OPENING_VIEWS={views:OpeningViews}

export function OpeningConversationRoot({renderSlot}){
 return renderSlot(OPENING_SESSION_SLOT,{})
}

/** Owns only presentation; it never writes or substitutes Session lifecycle. */
export function OpeningConversationSession({sessionId,useSession,useSessions,useConversation,useStore,actions,renderFactorySlot,getBinding,subscribeBindings,playClient,openSession,conversationPhase,switchToNative,activateView,getComposerPending=()=>false,onComposerPending}){
 installStyles()
 const binding=useSyncExternalStore(subscribeBindings,getBinding,getBinding)
 const composerPending=useSyncExternalStore(subscribeBindings,getComposerPending,getComposerPending)
 const session=useSession(s=>s),conversation=useConversation(s=>s)
 const selected=useStore(s=>s.view)
 const title=useSessions(s=>s.byId?.[sessionId]?.displayTitle??sessionId)
 const current=binding?.sessionId===sessionId
 const blank=current&&session?.blank===true&&conversationPhase(session,conversation)==='blank'
 const rp=selected===null||selected===undefined||selected==='rp'
 useLayoutEffect(()=>{if(current&&(selected===null||selected===undefined))actions.setView('rp')},[actions,current,selected])
 if(!current)return null
 const choose=view=>{activateView?.(sessionId,view);actions.setView(view)}
 return h(Opening.Provider,{value:{binding,playClient,openSession,onComposerPending}},h('section',{
  className:'dtv-rp-opening-shell','data-dtv-rp-opening':'','data-phase':blank&&!rp?'hero':'active',
 },h('header',{className:'dtv-rp-opening-header'},
  h('span',{className:'dtv-rp-opening-title'},title),
  h('div',{className:'dtv-rp-opening-tabs',role:'tablist','aria-label':translate('play.opening.views')},
   h('button',{type:'button',role:'tab','aria-selected':rp,onClick:()=>choose('rp')},translate('play.chat.label')),
   h('button',{type:'button',role:'tab','aria-selected':!rp,onClick:()=>choose('chat')},translate('play.opening.chat'))),
  h('button',{type:'button',onClick:switchToNative},translate('play.opening.native'))),
 renderFactorySlot('conversation.content',{variant:'embedded',phase:blank&&!rp?'hero':'active',hero:blank&&!rp},(blank||composerPending)&&rp?{slots:OPENING_VIEWS}:undefined)))
}

export function openingLayoutSession(snapshot,bindings,pendingSessionId=null){
 const rows=Object.values(snapshot?.byId??{})
 const main=rows.find(row=>(row.retainedBy?.mainView??0)>0)
 const binding=main&&bindings.get(main.id),ext=binding?.playthrough?.ext?.pmpDshTavern
 return (main?.blank===true||main?.id===pendingSessionId)&&binding?.characterId&&binding.characterId===ext?.characterId&&ext?.rootSessionId===main.id?main.id:null
}
