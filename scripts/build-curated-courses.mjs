import {readFile,writeFile} from 'node:fs/promises';
import {normalizeStop,totals} from '../public/domain.js';
const sources=JSON.parse(await readFile(new URL('../data/curated-place-sources.json',import.meta.url),'utf8'));
function place(query,name,category,minutes,thingsToDo,notes=''){
 const match=sources.places[query]?.find(p=>p.name===name);if(!match)throw Error(`Place not verified: ${name}`);
 return normalizeStop({...match,category,minutes,cost:0,needsEstimate:true,thingsToDo,notes,source:'curated',verifiedAt:sources.checkedAt});
}
const p={
 palace:place('창덕궁 궁궐','창덕궁','문화',90,'궁궐 전각 둘러보기\n함께 산책하고 기념사진 남기기','입장·휴관일·예약 여부를 확인하세요. 지도 핀은 검색 좌표이며 입구는 네이버지도에서 확인해주세요.'),
 bread:place('스탠다드브레드 익선','스탠다드브레드 익선','카페',60,'빵과 음료 고르기\n익선동에서 쉬어가기'),
 meat:place('탑골공원 종로3가점','탑골공원 종로3가점','식사',75,'함께 고기 식사하기','이름이 비슷한 공원이 아닌, 사진에 있는 고깃집입니다.'),
 dark:place('어둠속의대화 북촌점','어둠속의대화 북촌점','문화',110,'어둠속의대화 관람·체험','관람 회차와 실제 소요시간, 예매 가능 여부를 확인하세요.'),
 wood:place('나비상점공방','나비상점공방','문화',90,'나무 소품·반지 만들기 체험 알아보기','원하는 체험의 운영 여부와 예약 시간을 확인하세요.'),
 chinese:place('구룡관 혜화본점','구룡관 혜화본점','식사',70,'중식 메뉴를 골라 함께 식사하기'),
 park:place('낙산공원','낙산공원','산책',50,'성곽을 따라 산책하기\n전망을 보며 함께 사진 남기기','오르막 구간이 있어 이동 시간을 넉넉히 잡았습니다.'),
 cafe:place('개뿔 카페','개뿔','카페',60,'음료를 마시며 쉬어가기\n전망을 보며 사진 남기기'),
 bake:place('감정선프로젝트 베이킹 혜화대학로점','감정선프로젝트 베이킹 혜화대학로점','문화',120,'베이킹 원데이클래스 알아보기\n함께 만든 결과물 기념사진 남기기','클래스 종류·가격·실제 소요시간을 예약 페이지에서 확인하세요.'),
 art:place('끄적끄적 미술공방 혜화','끄적끄적 미술공방','문화',120,'함께 그림 그리기 체험 알아보기','프로그램과 예약 시간을 확인하세요.'),
 cats:place('너즐 성수 고양이카페','너즐','카페',75,'고양이카페에서 쉬어가기','입장·이용 규칙을 확인하고 고양이에게 무리하게 접촉하지 않아요.'),
 bakeSeongsu:place('감정선프로젝트 베이킹 성수점','감정선프로젝트 베이킹 성수점','문화',120,'베이킹 원데이클래스 알아보기','첨부 사진과 현재 검색 주소가 달라 최신 검색 주소를 사용했습니다. 예약 시간을 확인하세요.'),
 pork:place('숙수돈가 송리단길점','숙수돈가 송리단길점','식사',75,'송리단길에서 함께 고기 식사하기'),
 bracelet:place('플라비 송파 공방','플라비','문화',90,'커플 액세서리 만들기 체험 알아보기','체험 종류와 예약 시간을 확인하세요.'),
 charms:place('체리시유 송파','체리시유','문화',90,'키링·꾸미기 체험 알아보기','체험 종류와 예약 시간을 확인하세요.'),
 ring:place('잠실 웯우드스튜디오 나무반지공방','잠실 웯우드스튜디오 나무반지공방','문화',120,'커플 나무반지 만들기 체험 알아보기','현재 검색된 지점 주소를 사용했습니다. 예약 시간을 확인하세요.'),
 braceletHongdae:place('플라비 홍대점','플라비 홍대점','문화',90,'함께 커플 액세서리 만들기 체험 알아보기','첨부 사진과 현재 검색 주소가 달라 최신 검색 주소를 사용했습니다.'),
 exhibit:place('아이아이 연남','아이아이 연남','문화',60,'전시 둘러보기\n서로 인상 깊었던 작품 이야기하기','운영일과 진행 중인 전시를 확인하세요.')
};
const rad=n=>n*Math.PI/180;
function km(a,b){const dlat=rad(b.lat-a.lat),dlng=rad(b.lng-a.lng),h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2;return 6371*2*Math.asin(Math.sqrt(h));}
function template(id,name,region,description,startTime,keys,note){
 const stops=keys.map(key=>structuredClone(p[key]));let distance=0;
 stops.forEach((stop,i)=>{stop.id=`${id}-stop-${i+1}`;if(!i){stop.travelMinutes=0;return;}const leg=km(stops[i-1],stop);distance+=leg;stop.travelMinutes=Math.max(5,Math.ceil((leg*1.4*1000/70+2)/5)*5);if(stop.name==='낙산공원')stop.travelMinutes=Math.max(20,stop.travelMinutes);});
 const total=totals(stops);
 return {id,name,region,description,startTime,budget:150000,hours:Math.ceil(total.minutes/30)/2,notes:`${note}\n체류·이동 시간은 계획용 추정입니다. 실제 길찾기와 예약 시간에 맞춰 조정하세요. 비용은 아직 확인되지 않았습니다.`,stops,distanceKm:Number(distance.toFixed(2)),checkedAt:sources.checkedAt};
}
const courses=[
 template('iksun','궁궐 산책과 익선동 빵·고기','익선·종로','창덕궁에서 시작해 익선동 카페와 종로3가 저녁으로 이어지는 코스.','13:00',['palace','bread','meat'],'궁궐 관람을 먼저 하고 카페와 식사로 마무리합니다.'),
 template('bukchon','북촌에서 함께 느끼고 만들기','북촌','가까운 두 체험 장소를 묶은 실내 중심 데이트.','13:00',['dark','wood'],'어둠속의대화와 공방 모두 예약 시간에 맞춰 순서를 바꿔주세요.'),
 template('hyehwa-bake','혜화 베이킹부터 낙산 전망까지','혜화·낙산','베이킹 체험, 중식, 성곽 산책과 전망 카페를 한 코스로.','12:00',['bake','chinese','park','cafe'],'베이킹 예약을 기준으로 시작 시간을 정하세요. 오르막 산책이 포함됩니다.'),
 template('hyehwa-art','그림 그리고 성곽을 걷는 오후','혜화·낙산','미술공방과 가까운 낙산공원·개뿔을 묶은 코스.','14:00',['art','park','cafe'],'베이킹 대신 그림 그리기를 고른 대안 코스입니다.'),
 template('seongsu','성수에서 굽고 고양이와 쉬기','성수','베이킹 공방과 고양이카페를 가까운 동선으로 연결.','13:00',['bakeSeongsu','cats'],'공방 예약 후 카페로 이동합니다. 최신 주소로 동선을 구성했습니다.'),
 template('songpa-ring','송리단길 나무반지와 맛있는 저녁','송리단길','나무반지 체험 하나에 식사를 더한 여유 있는 코스.','15:00',['ring','pork'],'예약 시간이 있다면 그 시간을 먼저 정하고 식사를 뒤에 배치하세요.'),
 template('songpa-accessory','송리단길 식사와 커플 액세서리','송리단길','숙수돈가와 가까운 플라비 공방을 묶은 코스.','13:00',['pork','bracelet'],'플라비 대신 가까운 체리시유를 선택할 수도 있습니다. 코스 편집에서 장소를 바꿔보세요.'),
 template('hongdae','홍대에서 만들고 연남에서 감상하기','홍대·연남','액세서리 만들기와 전시를 연결하는 마포 데이트.','13:00',['braceletHongdae','exhibit'],'다른 코스보다 이동이 길어요. 홍대에서 연남 구간은 지도 길찾기로 확인하세요.')
];
courses[6].alternatives=[{replaceIndex:1,stop:p.charms,label:'플라비 대신 체리시유'}];
await writeFile(new URL('../data/curated-courses.json',import.meta.url),JSON.stringify(courses,null,2),'utf8');
const domainPath=new URL('../public/domain.js',import.meta.url),domain=(await readFile(domainPath,'utf8')).split('// BEGIN CURATED COURSES')[0].trimEnd();
await writeFile(domainPath,domain+'\n\n// BEGIN CURATED COURSES\nexport const curatedCourses='+JSON.stringify(courses,null,2)+';\n','utf8');
console.log(JSON.stringify(courses.map(c=>({name:c.name,places:c.stops.map(p=>p.name),minutes:totals(c.stops).minutes,straightLineKm:c.distanceKm})),null,2));
