import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPlaceSearch,resultToStop} from '../place-search.mjs';
import {createServer} from '../server.mjs';
const env={NAVER_CLIENT_ID:'test-id',NAVER_CLIENT_SECRET:'test-secret'};
const item={title:'<b>숲길</b> 카페 &amp; 디저트',category:'음식점>카페,디저트',roadAddress:'서울특별시 성동구 왕십리로 1',mapx:'1270437000',mapy:'375445000',link:'https://example.com/menu',description:'테라스가 있는 카페'};
test('Naver results convert coordinates and retain links and descriptions',()=>{
 const place=resultToStop(item);assert.equal(place.name,'숲길 카페 & 디저트');assert.equal(place.lat,37.5445);assert.equal(place.lng,127.0437);assert.equal(place.category,'카페');assert.equal(place.thingsToDo,'테라스가 있는 카페');assert.ok(place.naverMapUrl.startsWith('https://map.naver.com/p/search/'));assert.equal(place.needsEstimate,true);
 assert.equal(resultToStop({...item,mapx:'311277',mapy:'552097',link:'javascript:alert(1)'}).lat,null);
 assert.equal(resultToStop({...item,link:'javascript:alert(1)'}).relatedUrl,'');
});
test('search validates input, authenticates server side and caches identical queries',async()=>{
 let calls=0;const search=createPlaceSearch({env,fetchImpl:async(url,options)=>{calls++;assert.equal(url.hostname,'openapi.naver.com');assert.equal(url.searchParams.get('display'),'5');assert.equal(options.headers['X-Naver-Client-Secret'],'test-secret');return Response.json({items:[item]});}});
 await assert.rejects(()=>search('a'),error=>error.status===400);const result=await search('성수 카페');assert.equal(result.length,1);assert.deepEqual(await search('성수 카페'),result);assert.equal(calls,1);
 await assert.rejects(()=>createPlaceSearch({env:{}})('카페'),error=>error.code==='SEARCH_NOT_CONFIGURED');
 await assert.rejects(()=>createPlaceSearch({env,fetchImpl:async()=>new Response('secret upstream diagnostic',{status:403})})('카페'),error=>error.status===502&&!error.message.includes('secret'));
});
test('API HUB sends the current endpoint and authentication headers',async()=>{
 const search=createPlaceSearch({env:{...env,NAVER_SEARCH_PROVIDER:'hub'},fetchImpl:async(url,options)=>{
  assert.equal(url.origin,'https://naverapihub.apigw.ntruss.com');assert.equal(url.pathname,'/search/v1/local');assert.equal(options.headers['X-NCP-APIGW-API-KEY-ID'],'test-id');assert.equal(options.headers['X-NCP-APIGW-API-KEY'],'test-secret');assert.ok(!('X-Naver-Client-Secret' in options.headers));return Response.json({items:[item]});
 }});assert.equal((await search('성수 카페'))[0].category,'카페');
});
test('place search routes expose results and connection status without secrets',async()=>{
 const server=createServer({env,fetchImpl:async()=>Response.json({items:[item]})});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const base=`http://127.0.0.1:${server.address().port}`;const status=await fetch(base+'/api/place-search/status');assert.deepEqual(await status.json(),{configured:true});const response=await fetch(base+'/api/place-search?q='+encodeURIComponent('성수 카페'));assert.equal(response.status,200);const text=await response.text();assert.ok(!text.includes('test-secret'));assert.equal(JSON.parse(text).items[0].category,'카페');assert.equal((await fetch(base+'/api/place-search?q=a')).status,400);}finally{await new Promise(r=>server.close(r));}
});
test('missing credentials return a clear setup error',async()=>{
 const server=createServer({env:{}});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const base=`http://127.0.0.1:${server.address().port}`;assert.deepEqual(await (await fetch(base+'/api/place-search/status')).json(),{configured:false});const response=await fetch(base+'/api/place-search?q=cafe');assert.equal(response.status,503);assert.equal((await response.json()).code,'SEARCH_NOT_CONFIGURED');}finally{await new Promise(r=>server.close(r));}
});
