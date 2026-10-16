import {escapeHTML as e,normalizeLink,normalizePhoto} from './domain.js';
const link=(value,naver=false)=>{try{return normalizeLink(value,naver);}catch{return '';}};
export function placePhotos(place){return (Array.isArray(place.photos)?place.photos:place.photo?[place.photo]:[]).slice(0,3).flatMap(value=>{try{const photo=normalizePhoto(value);return photo?[photo]:[];}catch{return [];}});}
export function attachmentsHTML(place,{builderIndex}={}){
 const naver=link(place.naverMapUrl,true),related=link(place.relatedUrl),photos=placePhotos(place);
 const activities=String(place.thingsToDo||'').split(/\n/).map(x=>x.trim()).filter(Boolean);
 return `${photos.length?`<div class="place-photo-gallery">${photos.map((photo,i)=>`<button type="button" data-photo-view class="place-photo-link" aria-label="${e(place.name)} 사진 ${i+1} 크게 보기"><img src="${e(photo)}" alt="${e(place.name)} 첨부 사진 ${i+1}" loading="lazy"></button>`).join('')}</div>`:''}${activities.length?`<div class="things-to-do"><span class="attachment-title">여기서 할 수 있는 것</span><ul>${activities.map(x=>`<li>${e(x)}</li>`).join('')}</ul></div>`:''}${naver||related?`<div class="place-links">${naver?`<a class="naver-link" href="${e(naver)}" target="_blank" rel="noopener noreferrer">N 네이버지도 열기 ↗</a>`:''}${related?`<a class="related-link" href="${e(related)}" target="_blank" rel="noopener noreferrer">${e(place.linkLabel||'관련 링크')} ↗</a>`:''}</div>`:''}`;
}
export function installPhotoViewer(app){
 app.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-photo-view]');if(!trigger)return;
  event.preventDefault();event.stopPropagation();const image=trigger.querySelector('img');if(!image)return;
  let dialog=document.querySelector('#place-photo-viewer');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='place-photo-viewer';dialog.className='photo-viewer';dialog.innerHTML='<form method="dialog"><button aria-label="사진 닫기">닫기 ×</button></form><img alt=""><p></p>';document.body.append(dialog);dialog.addEventListener('click',ev=>{if(ev.target===dialog)dialog.close();});}
  dialog.querySelector('img').src=normalizePhoto(image.getAttribute('src'));dialog.querySelector('img').alt=image.alt;dialog.querySelector('p').textContent=image.alt;dialog.showModal();
 },true);
}
export async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('사진은 JPG·PNG·WebP, 한 장당 10MB 이하로 선택해주세요.');
 const url=URL.createObjectURL(file),image=new Image();
 try{
  image.src=url;await image.decode();
  if(!image.naturalWidth||!image.naturalHeight)throw Error('사진을 읽지 못했어요.');
  const canvas=document.createElement('canvas'),scale=Math.min(1,1000/Math.max(image.naturalWidth,image.naturalHeight));
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('사진을 처리하지 못했어요.');ctx.drawImage(image,0,0,canvas.width,canvas.height);
  for(const quality of [.82,.65,.45,.25]){const photo=canvas.toDataURL('image/webp',quality);if(photo.length<=650000)return normalizePhoto(photo);}
  throw Error('사진 용량을 줄이지 못했어요. 더 작은 사진을 선택해주세요.');
 }catch(error){throw Error(error.message||'사진을 읽지 못했어요. 다른 사진을 선택해주세요.');}finally{URL.revokeObjectURL(url);}
}
