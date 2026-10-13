import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recommend,totals,escapeHTML,loadState} from '../public/domain.js';
import {createServer} from '../server.mjs';
test('recommendations respect budget, time, region and activities',()=>{
 const conditions={region:'성수',budget:50000,hours:3,activities:['식사','산책']};
 const results=recommend(conditions);assert.ok(results.length);
 for(const r of results){assert.ok(r.cost<=50000);assert.ok(r.minutes<=180);assert.ok(r.stops.every(p=>p.region==='성수'&&conditions.activities.includes(p.category)));}
});
test('impossible and invalid conditions',()=>{assert.deepEqual(recommend({region:'성수',budget:0,hours:0.5,activities:['식사']}),[]);assert.throws(()=>recommend({region:'성수',budget:-1,hours:3,activities:['카페']}));});
test('editing recalculates totals and inter-stop travel',()=>{assert.deepEqual(totals([{cost:100,minutes:30},{cost:200,minutes:20}]),{cost:300,minutes:65});assert.deepEqual(totals([]),{cost:0,minutes:0});});
test('untrusted text is escaped and corrupt storage recovers',()=>{assert.equal(escapeHTML('<script>"&'),'&lt;script&gt;&quot;&amp;');assert.deepEqual(loadState({getItem:()=>'{bad'}),{courses:[],memories:[],anniversaries:[]});});
test('server serves app and blocks unknown paths and writes',async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const url=`http://127.0.0.1:${server.address().port}`;const page=await fetch(url);assert.equal(page.status,200);assert.ok((await page.text()).includes('둘길'));assert.equal((await fetch(url+'/missing')).status,404);assert.equal((await fetch(url,{method:'POST'})).status,405);assert.equal((await fetch(url+'/app.js')).status,200);}finally{await new Promise(r=>server.close(r));}});
