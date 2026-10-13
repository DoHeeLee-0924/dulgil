export const places=[
 {id:'s1',region:'성수',name:'성수 식탁',category:'식사',cost:36000,minutes:60,x:20,y:65},
 {id:'s2',region:'성수',name:'숲길 커피',category:'카페',cost:14000,minutes:45,x:45,y:40},
 {id:'s3',region:'성수',name:'작은 전시실',category:'문화',cost:20000,minutes:60,x:70,y:25},
 {id:'s4',region:'성수',name:'초록 산책길',category:'산책',cost:0,minutes:45,x:82,y:68},
 {id:'y1',region:'연남',name:'연남 식탁',category:'식사',cost:32000,minutes:60,x:22,y:30},
 {id:'y2',region:'연남',name:'골목 커피',category:'카페',cost:12000,minutes:45,x:43,y:60},
 {id:'y3',region:'연남',name:'동네 갤러리',category:'문화',cost:16000,minutes:50,x:68,y:40},
 {id:'y4',region:'연남',name:'공원 산책길',category:'산책',cost:0,minutes:40,x:83,y:75}
];
export function totals(stops) {return {cost:stops.reduce((n,p)=>n+p.cost,0),minutes:stops.reduce((n,p)=>n+p.minutes,0)+Math.max(0,stops.length-1)*15};}
export function recommend({region,budget,hours,activities}) {
 if(!Number.isFinite(budget)||budget<0||!Number.isFinite(hours)||hours<=0||!activities.length) throw new Error('예산·시간과 활동을 확인해주세요.');
 const candidates=places.filter(p=>p.region===region&&activities.includes(p.category));
 const results=[];
 for(let mask=1;mask<2**candidates.length;mask++) {
  const stops=candidates.filter((_,i)=>mask&(1<<i)); const t=totals(stops);
  if(t.cost<=budget&&t.minutes<=hours*60)results.push({stops,...t});
 }
 return results.sort((a,b)=>b.stops.length-a.stops.length||a.cost-b.cost).slice(0,3);
}
export const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function loadState(storage) {
 try {const v=JSON.parse(storage.getItem('dulgil-v1'));if(v&&Array.isArray(v.courses)&&Array.isArray(v.memories)&&Array.isArray(v.anniversaries))return v;}catch{}
 return {courses:[],memories:[],anniversaries:[]};
}
