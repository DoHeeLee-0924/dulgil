import {createHash} from 'node:crypto';
import {normalizeLink,normalizeStop} from './public/domain.js';

export function searchConfigured(env){return !!(env.NAVER_CLIENT_ID?.trim()&&env.NAVER_CLIENT_SECRET?.trim());}
function cleanText(value){return String(value??'').replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|apos|#39);/g,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"}[s])).trim();}
export function resultToStop(item){
 const name=cleanText(item.title).slice(0,80),address=cleanText(item.roadAddress||item.address).slice(0,250),classification=cleanText(item.category);
 const category=/카페|커피|디저트/.test(classification)?'카페':/음식|한식|양식|일식|중식|분식|식당/.test(classification)?'식사':/공원|숲|산책/.test(classification)?'산책':/전시|미술|박물|공연|영화/.test(classification)?'문화':/쇼핑|백화점|시장/.test(classification)?'쇼핑':'기타';
 let lng=Number(item.mapx),lat=Number(item.mapy);
 if(Math.abs(lng)>180||Math.abs(lat)>90){lng/=10000000;lat/=10000000;}
 if(!item.mapx||!item.mapy||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<32||lat>40||lng<123||lng>133){lat=null;lng=null;}
 let relatedUrl='';try{relatedUrl=normalizeLink(item.link);}catch{}
 const description=cleanText(item.description).slice(0,1000);
 return normalizeStop({id:'naver-'+createHash('sha256').update(name+'|'+address).digest('hex').slice(0,20),name,address,category,cost:0,minutes:60,travelMinutes:15,lat,lng,naverMapUrl:`https://map.naver.com/p/search/${encodeURIComponent(name+' '+address)}`,relatedUrl,linkLabel:'홈페이지',thingsToDo:description,notes:'',photos:[],source:'naver',sourceCategory:classification,needsEstimate:true});
}
export function createPlaceSearch({env=process.env,fetchImpl=fetch,now=Date.now}={}){
 const cache=new Map();let active=0,lastRequest=-Infinity;
 return async query=>{
  const q=String(query??'').trim();if(q.length<2||q.length>100)throw Object.assign(Error('검색어를 2~100자로 입력해주세요.'),{status:400,code:'INVALID_QUERY'});
  if(!searchConfigured(env))throw Object.assign(Error('네이버 장소 검색 연결이 필요해요. 저장한 장소 검색이나 직접 입력을 이용해주세요.'),{status:503,code:'SEARCH_NOT_CONFIGURED'});
  const cached=cache.get(q);if(cached&&cached.expires>now())return cached.items;
  if(active>=2||now()-lastRequest<300)throw Object.assign(Error('검색 요청이 많아요. 잠시 후 다시 검색해주세요.'),{status:429,code:'SEARCH_BUSY'});
  active++;lastRequest=now();
  try{
   const hub=env.NAVER_SEARCH_PROVIDER==='hub';
   const url=new URL(hub?'https://naverapihub.apigw.ntruss.com/search/v1/local':'https://openapi.naver.com/v1/search/local.json');url.searchParams.set('query',q);url.searchParams.set('display','5');url.searchParams.set('sort','random');
   const headers=hub?{'X-NCP-APIGW-API-KEY-ID':env.NAVER_CLIENT_ID,'X-NCP-APIGW-API-KEY':env.NAVER_CLIENT_SECRET}:{'X-Naver-Client-Id':env.NAVER_CLIENT_ID,'X-Naver-Client-Secret':env.NAVER_CLIENT_SECRET};
   const response=await fetchImpl(url,{headers,signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Object.assign(Error(response.status===401||response.status===403?'네이버 검색 인증 또는 검색 API 권한을 확인해주세요.':response.status===429?'네이버 검색 사용량을 초과했어요. 잠시 후 다시 시도해주세요.':'네이버 검색을 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),{status:502,code:'SEARCH_UPSTREAM_ERROR'});
   const data=await response.json();if(!Array.isArray(data.items))throw Error('Invalid search response');
   const items=data.items.slice(0,5).flatMap(item=>{try{return [resultToStop(item)];}catch{return [];}});
   if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(q,{items,expires:now()+5*60*1000});return items;
  }catch(error){if(error.status)throw error;throw Object.assign(Error('검색 서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.'),{status:502,code:'SEARCH_UNAVAILABLE'});}finally{active--;}
 };
}
