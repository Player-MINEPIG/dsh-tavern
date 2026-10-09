import test from 'node:test'
import assert from 'node:assert/strict'
import {runInNewContext} from 'node:vm'
import {CARD_CONVENIENCE} from '../packages/client/src/play/card-convenience.js'

test('finite data paths preserve bracket keys and reject prototype traversal or unsupported syntax',()=>{
 const helper=runInNewContext(CARD_CONVENIENCE+'; globalThis._')
 const value={stat_data:{hp:7,'a.b':9,items:[{label:'map'}]}}
 for(const path of ['stat_data.hp','["stat_data"].hp'])assert.equal(helper.get(value,path,'missing'),7)
 assert.equal(helper.get(value,'stat_data["a.b"]'),9)
 assert.equal(helper.get(value,"stat_data['items'][0].label"),'map')
 assert.equal(helper.get([{hp:7}],'[0].hp'),7)
 assert.equal(helper.get(Object.create({inherited:1}),'inherited','missing'),'missing')
 for(const path of ['__proto__.x','stat_data.constructor','stat_data[missing]','stat_data..hp','stat_data.'])assert.throws(()=>helper.get(value,path))
 assert.equal(helper.isEmpty({}),true);assert.equal(helper.isEmpty({x:0}),false)
})
