import {loadEnvFile} from 'node:process';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {createPlaceSearch} from '../place-search.mjs';
loadEnvFile(new URL('../.env',import.meta.url));
const queries=['탑골공원 종로3가점','스탠다드브레드 익선','창덕궁','어둠속의대화 북촌점','나비상점공방','구룡관 혜화본점','낙산공원','개뿔 카페','감정선프로젝트 베이킹 혜화대학로점','끄적끄적 미술공방 혜화','너즐 성수 고양이카페','감정선프로젝트 베이킹 성수점','숙수돈가 송리단길점','플라비 송파 공방','잠실 웰우드스튜디오 나무반지공방','체리시유 송파','플라비 홍대점','아이아이 연남','랩포터리 쌍림동','서울한방진흥센터'];
queries.push('창덕궁 궁궐','웯우드스튜디오','웰우드스튜디오 잠실','잠실 웯우드스튜디오 나무반지공방');
const search=createPlaceSearch();let result;try{result=JSON.parse(await readFile(new URL('../data/curated-place-sources.json',import.meta.url),'utf8'));}catch{result={checkedAt:'2026-10-14',places:{}};}
for(const query of queries){if(query in result.places)continue;try{const items=await search(query);result.places[query]=items;console.log(JSON.stringify({query,candidates:items.slice(0,5).map(p=>({name:p.name,address:p.address,lat:p.lat,lng:p.lng}))}));}catch(error){result.places[query]=[];console.log(JSON.stringify({query,error:error.message}));}await new Promise(r=>setTimeout(r,350));}
await mkdir(new URL('../data/',import.meta.url),{recursive:true});
await writeFile(new URL('../data/curated-place-sources.json',import.meta.url),JSON.stringify(result,null,2),'utf8');
