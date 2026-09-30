import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { UserStore } from '../packages/user/src/store.js'
import { normalizeAvatar, editAvatar, avatarFor, validateAppearance } from '../packages/presentation/avatar.js'
import { normalizeBubbleStyle, BUBBLE_STYLES, bubbleCss } from '../packages/presentation/bubble-style.js'
import { ConversationSettingsStore } from '../packages/tavern-loader/src/conversation-settings.js'
import { normalizeTimeline } from '../packages/play/src/timeline.js'
import { createCardRuntime } from '../packages/client/src/play/card-runtime.js'
import { conversationDisplayStyle } from '../packages/client/src/play/display-settings.js'
import { splitCards } from '../packages/client/src/play/scripted-content.js'
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='

test('avatar hierarchy, replace-all, reset, persistence and source boundaries',()=>{
  const initial={nodes:[],ext:{thirdParty:{keep:true}}}, other=structuredClone(initial)
  let current=editAvatar(initial,{role:'user',key:'one',scope:'message',avatar:image})
  assert.equal(avatarFor(current.ext.pmpDshTavern.appearance,'user','one',{user:'default'}),image)
  assert.equal(avatarFor(current.ext.pmpDshTavern.appearance,'user','two',{user:'default'}),'default')
  current=editAvatar(current,{role:'user',key:'one',scope:'playthrough',avatar:image})
  assert.equal(current.ext.pmpDshTavern.appearance.messages.one,undefined)
  assert.equal(avatarFor(current.ext.pmpDshTavern.appearance,'user','two'),image)
  assert.deepEqual(initial,other)
  assert.deepEqual(current.ext.thirdParty,{keep:true})
  assert.deepEqual(normalizeTimeline(current).ext,current.ext)
  current=editAvatar(current,{role:'user',key:'one',scope:'reset-playthrough'})
  assert.equal(avatarFor(current.ext.pmpDshTavern.appearance,'user','one',{user:'default'}),'default')
  assert.throws(()=>normalizeTimeline({nodes:[],ext:{pmpDshTavern:{appearance:{schemaVersion:99}}}}),/schema/)
})
test('raster avatars round trip user export/import and reject active or remote content',()=>{
  const dir=mkdtempSync(join(tmpdir(),'tavern-avatar-'))
  try{const store=new UserStore(dir);const user=store.create({name:'User',avatar:image});assert.equal(store.import(store.export(user.id)).avatar,image);assert.equal(new UserStore(dir).get(user.id).avatar,image);assert.equal(store.update(user.id,{avatar:null}).avatar,undefined)}finally{rmSync(dir,{recursive:true,force:true})}
  for(const input of ['https://example.org/avatar.png','data:image/svg+xml;base64,PHN2Zz4=',image.replace('image/png','image/jpeg'),'data:image/png;base64,'+'a'.repeat(150000)])assert.throws(()=>normalizeAvatar(input))
  assert.throws(()=>validateAppearance({schemaVersion:1,messages:JSON.parse('{"__proto__":{}}')}))
})
test('bubble v1 validates tokens, survives settings restart, rejects code and future versions',()=>{
  const dir=mkdtempSync(join(tmpdir(),'tavern-bubble-'))
  try{const store=new ConversationSettingsStore(dir);const style=normalizeBubbleStyle(BUBBLE_STYLES[1]);store.set({textScale:1,actionScale:1,bubbleStyle:style,interactiveCards:true});assert.deepEqual(new ConversationSettingsStore(dir).get().bubbleStyle,style);assert.equal(store.reset().interactiveCards,undefined)}finally{rmSync(dir,{recursive:true,force:true})}
  for(const patch of [{version:2},{css:'body{}'},{script:'evil()'},{padding:200},{user:{...BUBBLE_STYLES[0].user,background:'url(https://evil.test)'}}])assert.throws(()=>normalizeBubbleStyle({...BUBBLE_STYLES[0],...patch}))
})
test('card interpreter denies ambient authority and stops CPU/memory abuse',async()=>{
  const events=[];const vm=await createCardRuntime(({op,args})=>{if(op==='context')return {version:1};if(op==='propose'){events.push(args[0]);return}throw Error('Unsupported capability')})
  try{
    vm.evaluate('TavernUI.proposeMessage("hello")');assert.deepEqual(events,['hello'])
    for(const code of ['parent.document','fetch("https://evil.test")','document.cookie.toString()','require("node:fs")','localStorage.getItem("token")','location.href="https://evil.test"','__bridge(JSON.stringify({op:"send",args:["steal"]})) && (()=>{throw Error("unsupported")})()', 'while(true){}', 'let x=[];while(true)x.push(new Array(10000).fill("payload"))'])assert.throws(()=>vm.evaluate(code))
  }finally{vm.dispose()}
  assert.throws(()=>vm.evaluate('1'),/disposed/)
  const fresh=await createCardRuntime(()=>null);fresh.evaluate('1+1');fresh.dispose()
})
test('streaming fences never activate partial scripts; surrounding Markdown remains separate',()=>{
 const complete='before\n```html\n<html><body><button>OK</button><script>1</script></body></html>\n```\nafter'
 assert.equal(splitCards(complete).filter(x=>x.html).length,1)
 assert.equal(splitCards(complete.slice(0,-10)).filter(x=>x.html).length,0)
 assert.deepEqual(splitCards('plain **text**'),[{text:'plain **text**'}])
})

test('bubble body font size is portable and old v1 styles preserve legacy scaling', () => {
  assert.equal(bubbleCss(BUBBLE_STYLES[0]).fontSize, undefined)
  const style = normalizeBubbleStyle({ ...BUBBLE_STYLES[0], fontSize: 23 })
  assert.equal(bubbleCss(JSON.parse(JSON.stringify(style))).fontSize, 23)
  assert.equal(conversationDisplayStyle({ textScale: 1.25, actionScale: 1, bubbleStyle: style })['--dtv-rp-text-scale'], 23 / 14)
  assert.equal(conversationDisplayStyle({ textScale: 1.25, actionScale: 1 })['--dtv-rp-text-scale'], 1.25)
  for (const fontSize of [7, 49, 14.5, '18']) assert.throws(() => normalizeBubbleStyle({ ...style, fontSize }), /fontSize/)
})
