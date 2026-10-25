/** The Places picker: always shows where you are, one click travels elsewhere.
 * Cards come from src/places-registry.mjs. Presentation only; travel() is owned by each place. */
import {listPlaces,currentPlace,onPlacesChange} from './places-registry.mjs';
import {thumbSvg} from './place-art.mjs';
const SEEN='wildside.places.seen.v1';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const store={get:k=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch{}}};

export function mountPlacesPicker({pill,nameEl,panel,list,close,titleCard,prompt,getPlaceName,onArrive=()=>{},notify=()=>{},isBlocked=()=>false}){
 let open=false,travelling=false,closeTimer=0;
 const veil=document.getElementById('veil');
 function refreshName(){const here=currentPlace();nameEl.textContent=here?.name??getPlaceName();pill.setAttribute('aria-label',`You are in ${nameEl.textContent}. Choose another place`);}
 function card(p){
  const b=document.createElement('button');b.type='button';b.className='place-card';b.dataset.place=p.id;
  const here=(()=>{try{return p.status==='ready'&&!!p.current?.();}catch{return false;}})();
  b.disabled=p.status!=='ready';if(here)b.setAttribute('aria-current','true');
  const art=document.createElement('span');art.className='place-art';art.setAttribute('aria-hidden','true');
  if(p.thumb&&/^(https?:|data:|\.|\/|blob:)/.test(p.thumb)){const i=document.createElement('img');i.src=p.thumb;i.alt='';art.append(i);}else art.innerHTML=p.thumb??thumbSvg(p.kind);
  const text=document.createElement('span');text.className='place-text';
  const name=document.createElement('span');name.className='place-name';name.textContent=p.name;
  const line=document.createElement('span');line.className='place-line';line.textContent=p.line;
  const tag=document.createElement('span');tag.className='place-tag';tag.textContent=p.status!=='ready'?'Coming soon':here?'You are here':(p.honesty??'');
  text.append(name,line);if(tag.textContent)text.append(tag);b.append(art,text);
  if(p.status==='ready')b.onclick=()=>go(p);
  return b;
 }
 function render(){list.replaceChildren(...listPlaces().map(card));refreshName();}
 async function go(p){
  if(travelling)return;
  if(p.current?.()){setOpen(false);return;}
  travelling=true;setOpen(false);document.body.classList.add('travelling');
  if(veil&&!reduced()){veil.classList.remove('lift');veil.classList.add('dip');void veil.offsetWidth;veil.classList.remove('dip');veil.style.opacity='1';veil.style.transition='opacity .45s ease';}
  try{
   await p.travel();
   render();onArrive(p);showTitle(p);
  }catch(e){notify(e?.message||'That place could not be opened. You are still where you were.',true);}
  finally{travelling=false;document.body.classList.remove('travelling');if(veil){veil.style.transition='';veil.style.opacity='';veil.classList.add('lift');}}
 }
 let titleTimer=0;
 function showTitle(p){
  titleCard.querySelector('.title-name').textContent=p.name;titleCard.querySelector('.title-line').textContent=p.line;
  titleCard.querySelector('.title-tag').textContent=p.honesty??'';
  titleCard.hidden=false;void titleCard.offsetWidth;titleCard.classList.add('show');clearTimeout(titleTimer);
  titleTimer=setTimeout(()=>{titleCard.classList.remove('show');setTimeout(()=>{titleCard.hidden=true;},reduced()?0:600);},2800);
 }
 function setOpen(next,{restoreFocus=true}={}){
  if(next===open)return;if(next&&isBlocked())return;open=next;clearTimeout(closeTimer);
  pill.setAttribute('aria-expanded',String(open));document.body.classList.toggle('places-open',open);
  if(open){store.set(SEEN,'1');prompt.classList.remove('show');render();panel.hidden=false;requestAnimationFrame(()=>panel.classList.add('open'));(panel.querySelector('.place-card:not(:disabled)')||close).focus({preventScroll:true});}
  else{panel.classList.remove('open');closeTimer=setTimeout(()=>{if(!open)panel.hidden=true;},reduced()?0:220);if(restoreFocus&&panel.contains(document.activeElement))pill.focus({preventScroll:true});}
 }
 pill.addEventListener('click',()=>setOpen(!open));close.addEventListener('click',()=>setOpen(false));
 addEventListener('pointerdown',e=>{if(open&&!panel.contains(e.target)&&!pill.contains(e.target))setOpen(false,{restoreFocus:false});},true);
 addEventListener('keydown',e=>{if(open&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();setOpen(false);}},true);
 // List arrow keys through the cards.
 list.addEventListener('keydown',e=>{const cards=[...list.querySelectorAll('.place-card:not(:disabled)')],i=cards.indexOf(document.activeElement);const step={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key];if(i<0||!step)return;e.preventDefault();cards[(i+step+cards.length)%cards.length].focus();});
 onPlacesChange(()=>{if(open)render();else refreshName();});
 render();
 // First visit: a gentle nudge toward the other places, gone once opened.
 if(store.get(SEEN)!=='1'&&listPlaces().length>1){
  setTimeout(()=>{if(!open&&store.get(SEEN)!=='1')prompt.classList.add('show');},2500);
  setTimeout(()=>prompt.classList.remove('show'),16000);
 }
 return {open:()=>setOpen(true),close:()=>setOpen(false),refresh:render,get isOpen(){return open;},go};
}
