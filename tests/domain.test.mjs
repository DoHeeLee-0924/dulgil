import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recommend,totals,escapeHTML,loadState,createCourse,places,normalizeStop,itinerary,normalizeLink,normalizePhoto,curatedCourses} from '../public/domain.js';
import {attachmentsHTML,placePhotos,preparePhoto} from '../public/place-media.js';
import {createServer} from '../server.mjs';
test('recommendations respect budget, time, region and activities',()=>{
 const conditions={region:'성수',budget:50000,hours:3,activities:['식사','산책']};
 const results=recommend(conditions);assert.ok(results.length);
 for(const r of results){assert.ok(r.cost<=50000);assert.ok(r.minutes<=180);assert.ok(r.stops.every(p=>p.region==='성수'&&conditions.activities.includes(p.category)));}
});
test('impossible and invalid conditions',()=>{assert.deepEqual(recommend({region:'성수',budget:0,hours:0.5,activities:['식사']}),[]);assert.throws(()=>recommend({region:'성수',budget:-1,hours:3,activities:['카페']}));});
test('editing recalculates totals and inter-stop travel',()=>{assert.deepEqual(totals([{cost:100,minutes:30},{cost:200,minutes:20}]),{cost:300,minutes:65});assert.deepEqual(totals([]),{cost:0,minutes:0});});
test('manual courses preserve chosen stops, isolate edits and survive storage reload',()=>{
 const input={name:'  주말 데이트  ',date:'2026-10-18',region:'성수',budget:80000,hours:4,stopIds:['s2','s1']};
 const course=createCourse(input,'manual-1');
 assert.equal(course.name,'주말 데이트');assert.equal(course.completed,false);
 assert.deepEqual(course.stops.map(p=>p.id),['s2','s1']);assert.deepEqual(totals(course.stops),{cost:50000,minutes:120});
 course.stops[0].name='수정';assert.equal(places.find(p=>p.id==='s2').name,'숲길 커피');
 const state={courses:[course],memories:[],anniversaries:[]};assert.deepEqual(loadState({getItem:()=>JSON.stringify(state)}),state);
 for(const patch of [{name:' '},{stopIds:[]},{stopIds:['s1','s1']},{stopIds:['missing']},{stopIds:['y1']},{budget:-1},{hours:0}])assert.throws(()=>createCourse({...input,...patch},'invalid'));
});
test('untrusted text is escaped and corrupt storage recovers',()=>{assert.equal(escapeHTML('<script>"&'),'&lt;script&gt;&quot;&amp;');assert.deepEqual(loadState({getItem:()=>'{bad'}),{courses:[],memories:[],anniversaries:[]});});
test('curated courses use nearby verified places and copy without changing templates',()=>{
 assert.equal(curatedCourses.length,8);assert.equal(new Set(curatedCourses.map(c=>c.id)).size,8);
 const rad=n=>n*Math.PI/180;
 for(const template of curatedCourses){
  assert.ok(template.stops.length>=2);assert.ok(template.distanceKm<2);
  for(const [i,p] of template.stops.entries()){assert.ok(p.address);assert.ok(p.naverMapUrl.startsWith('https://map.naver.com/'));assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lng));if(i){const a=template.stops[i-1],h=Math.sin(rad(p.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(p.lat))*Math.sin(rad(p.lng-a.lng)/2)**2;assert.ok(6371*2*Math.asin(Math.sqrt(h))<2);}}
  const copied=createCourse({...template,date:'2026-10-18'},'copied-'+template.id);assert.ok(totals(copied.stops).minutes<=copied.hours*60);copied.stops[0].name='수정';assert.notEqual(template.stops[0].name,'수정');
 }
});
test('custom places retain coordinates, details and configured travel time',()=>{
 const stop={id:'custom',name:' 서울숲 ',address:'서울 성동구',category:'산책',cost:0,minutes:45,travelMinutes:25,lat:37.5445,lng:127.0437,notes:'함께 산책'};
 const course=createCourse({name:'서울 데이트',date:'2026-10-18',region:'서울',budget:50000,hours:4,startTime:'23:30',notes:'편한 신발',stops:[stop,{...stop,id:'custom2',name:'카페',cost:14000,minutes:60}]},'custom-course');
 assert.equal(course.stops[0].name,'서울숲');assert.equal(course.stops[0].lat,37.5445);assert.equal(course.notes,'편한 신발');assert.deepEqual(totals(course.stops),{cost:14000,minutes:130});
 assert.deepEqual(itinerary(course.stops,course.startTime),[{arrival:'23:30',departure:'+1일 00:15'},{arrival:'+1일 00:40',departure:'+1일 01:40'}]);
 assert.deepEqual(loadState({getItem:()=>JSON.stringify({courses:[course],memories:[],anniversaries:[]})}).courses[0],course);
 for(const patch of [{lat:91},{lng:181},{lat:null},{cost:-1},{minutes:0},{minutes:1.5},{travelMinutes:-1}])assert.throws(()=>normalizeStop({...stop,...patch}));
 assert.throws(()=>createCourse({...course,date:'2026-02-30'},'bad-date'));
 assert.throws(()=>createCourse({...course,startTime:'25:30'},'bad-time'));
});
test('Naver-only places retain photos, activities and related links across saving',()=>{
 const photo='data:image/png;base64,iVBORw0KGgo=';
 const stop=normalizeStop({name:'테라스 카페',cost:14000,minutes:60,naverMapUrl:'https://naver.me/example',relatedUrl:'https://example.com/menu',linkLabel:'메뉴 보기',thingsToDo:'라떼 마시기\n테라스에서 사진 찍기',photos:[photo]});
 assert.equal(stop.lat,null);assert.equal(stop.lng,null);assert.equal(stop.photos[0],photo);
 const course=createCourse({name:'카페 데이트',date:'2026-10-18',region:'성수',budget:50000,hours:3,stops:[stop]},'naver-course');
 const loaded=loadState({getItem:()=>JSON.stringify({courses:[course],memories:[],anniversaries:[]})});assert.deepEqual(loaded.courses[0].stops[0],stop);
 const markup=attachmentsHTML(stop);assert.ok(markup.includes('네이버지도 열기'));assert.ok(markup.includes('테라스에서 사진 찍기'));assert.ok(markup.includes('data-photo-view'));assert.ok(markup.includes('메뉴 보기'));
 const modified=normalizeStop({...stop,photos:[],naverMapUrl:'',thingsToDo:'디저트 먹기'});assert.deepEqual(modified.photos,[]);assert.equal(modified.naverMapUrl,'');assert.equal(modified.thingsToDo,'디저트 먹기');
});
test('attachments reject unsafe links and image payloads and escape activity text',async()=>{
 for(const value of ['javascript:alert(1)','data:text/html,test','https://user:pass@example.com'])assert.throws(()=>normalizeLink(value));
 assert.throws(()=>normalizeLink('https://naver.me.evil.example/place',true));assert.equal(normalizeLink('https://map.naver.com/p/entry/place/123',true),'https://map.naver.com/p/entry/place/123');
 assert.throws(()=>normalizePhoto('data:image/svg+xml;base64,PHN2Zz4='));assert.throws(()=>normalizePhoto('data:image/png;base64,'+'A'.repeat(700000)));
 assert.throws(()=>normalizeStop({name:'카페',cost:0,minutes:30,photos:['a','b','c','d']}));
 const markup=attachmentsHTML({name:'<카페>',thingsToDo:'<script>alert(1)</script>',relatedUrl:'javascript:alert(1)',photos:['data:text/html,bad']});assert.ok(!markup.includes('<script>'));assert.ok(!markup.includes('javascript:'));assert.ok(markup.includes('&lt;script&gt;'));assert.deepEqual(placePhotos({photos:['invalid']}),[]);
 await assert.rejects(()=>preparePhoto({type:'image/svg+xml',size:100}));await assert.rejects(()=>preparePhoto({type:'image/jpeg',size:11*1024*1024}));
});
test('map assets and course builder are served with the map content policy',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const base=`http://127.0.0.1:${server.address().port}`;for(const path of ['/course-builder.js','/place-media.js','/vendor/leaflet.js','/vendor/leaflet.css']){const response=await fetch(base+path);assert.equal(response.status,200);assert.ok((await response.text()).length>100);assert.ok(response.headers.get('content-security-policy').includes('https://tile.openstreetmap.org'));}assert.equal((await fetch(base+'/vendor/../server.mjs')).status,404);}finally{await new Promise(r=>server.close(r));}
});
test('server serves app and blocks unknown paths and writes',async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const url=`http://127.0.0.1:${server.address().port}`;const page=await fetch(url);assert.equal(page.status,200);assert.ok((await page.text()).includes('둘길'));assert.equal((await fetch(url+'/missing')).status,404);assert.equal((await fetch(url,{method:'POST'})).status,405);assert.equal((await fetch(url+'/app.js')).status,200);}finally{await new Promise(r=>server.close(r));}});
