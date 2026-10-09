import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {IdentityActionProposal} from '../../packages/client/src/play/identity-action-view.js'
import {createIdentityActionBridge,prepareIdentityAction} from '../../packages/client/src/play/identity-action-bridge.js'
import {normalizeVariables} from '../../packages/mvu-adapter/src/updates.js'
import {setClientUiSettings} from '../../packages/client/src/i18n.js'

// Self-authored values only. No imported card, source download, provider or model.
setClientUiSettings({locale:'en',scale:1})
const scope={mode:'initial',sessionId:'authored-browser'},model={choices:[{id:'default',label:'Authored default',trigger:''}],perks:[],initialRoles:['fixture'],apply:root=>root,message:identity=>'Unsent authored opening for '+identity['姓名']}
const identity={'模板ID':'custom','难度':'自定义','姓名':'Browser fixture','年龄':'20','班级':'Fixture','个人信息':'Authored description','照片':'','来源':'首楼学生证','已选择':true,'互斥开场':'Authored default','互斥开场ID':'default','互斥开场触发码':''}
let snapshot={version:1,status:'available',scope,resourceId:'mvu:authored-browser',revision:1,currentRevision:7,variables:normalizeVariables({stat_data:{'系统':{},'角色':{fixture:{}}},schema:{type:'any'}})},mode='success',message='',writes=0,state,render,packet,bridge
let release,persisted,resultLog=[],transportCalls=[]
const report=()=>{document.getElementById('results').textContent=JSON.stringify({state:state?.state??null,writes,message,operationId:state?.operationId??null,transportCalls,resultLog})}
const binding={getSnapshot:()=>structuredClone(snapshot),writeOperation:async request=>{
 writes++;transportCalls.push({operationId:request.operationId,expectedRevision:request.expectedRevision,cause:request.cause})
 if(persisted&&mode==='retry')return persisted
 const intent=prepareIdentityAction(packet,snapshot,model),result={...structuredClone(snapshot),variables:structuredClone(intent.normalized),revision:8,currentRevision:8};snapshot=result;persisted={operationId:request.operationId,result}
 if(mode==='lost'){await new Promise(resolve=>{release=resolve});throw Error('Self-authored lost response after save')}
 return persisted
}}
function begin(nextMode){
 bridge?.dispose();mode=nextMode;message='';writes=0;persisted=null;transportCalls=[]
 snapshot={...snapshot,revision:1,currentRevision:7,variables:normalizeVariables({stat_data:{'系统':{},'角色':{fixture:{}}},schema:{type:'any'}})}
 const value=structuredClone(snapshot.variables);value.stat_data['系统']['_user身份']=identity;packet={version:1,operation:'replace',value,openingId:'default',perkIds:[],prompt:model.message(identity),observedRevision:7}
 bridge=createIdentityActionBridge({model,prepareBinding:async()=>({binding,isCurrent:()=>true,messageLease:{}}),onState:value=>{state=value;render();report()},deliverMessage:value=>{if(mode==='message-fail')throw Error('Self-authored presentation failure');message=value;render();report()}})
 const token=bridge.beginOpening('default');bridge.completeOpening(token,{ok:true,method:'empty-selection'});bridge.request(packet).then(value=>{resultLog.push(value);report()},error=>{resultLog.push({error:error.message});report()})
}
function App(){
 const [,update]=useState(0);render=()=>update(value=>value+1)
 const error=text=>{resultLog.push({error:text});report()}
 return React.createElement('main',{style:{maxWidth:880,margin:'12px auto',fontFamily:'system-ui'}},
  React.createElement('h1',null,'Identity confirmation fixture'),
  React.createElement('p',null,'Self-authored variables; no real card, model or network writes.'),
  ...[['Prepare success','success'],['Prepare lost response','lost'],['Prepare message failure','message-fail']].map(([label,next])=>React.createElement('button',{key:next,onClick:()=>begin(next)},label)),
  React.createElement('button',{onClick:()=>{release?.();mode='retry';report()}},'Release lost response'),
  React.createElement('button',{onClick:()=>{mode='success';report()}},'Allow message presentation'),
  React.createElement('button',{onClick:()=>{const button=document.querySelector('.dtv-card-identity-proposal button');button?.click();resultLog.push({syntheticClickWrites:writes});report()}},'Try synthetic confirmation'),
  React.createElement('label',null,'Native input draft ',React.createElement('input',{defaultValue:'Preserve this draft'})),
  React.createElement(IdentityActionProposal,{proposal:state,bridge,onError:error}),
  message?React.createElement('p',{id:'message'},message):null)
}
const root=document.createElement('div'),output=document.createElement('pre');output.id='results';document.body.append(root,output);createRoot(root).render(React.createElement(App));report()
