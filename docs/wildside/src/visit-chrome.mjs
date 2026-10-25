/** The visit's chrome: World drawer, quiet-while-exploring behaviour, shortcuts
 * and the arrival transition. It only presents UI; app.mjs keeps every action.
 * See src/controls.mjs for how features place controls in the drawer.
 */
import {SECTIONS,kit,listControls,onControlsChange,slotFor,controlSlot} from './controls.mjs';

const IDLE_MS=3200,HINT_MS=22000,HINT_KEY='wildside.hints.v1';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountWorldDrawer({drawer,toggle,close,sectionsRoot,sections:only=null,isBlocked=()=>false}){
 const mounted=new Map(),sectionEls=new Map(),mine=SECTIONS.filter(s=>!only||only.includes(s.id));
 for(const s of mine){
  const sec=document.createElement('section');sec.className='drawer-section';sec.dataset.section=s.id;sec.hidden=true;
  const h=document.createElement('h3');h.textContent=s.title;h.id=`drawer-${s.id}`;sec.setAttribute('aria-labelledby',h.id);
  const body=document.createElement('div');body.className='drawer-section-body';sec.append(h);
  if(s.note){const p=document.createElement('p');p.className='drawer-section-note';p.textContent=s.note;sec.append(p);}
  sec.append(body);sectionsRoot.append(sec);sectionEls.set(s.id,{sec,body});
 }
 const attachSlot=section=>{const slot=slotFor(section),target=sectionEls.get(section);if(!slot||!target||slot.parentElement===target.body)return;target.body.append(slot);new MutationObserver(layout).observe(slot,{childList:true});};
 function sync(){
  const live=new Set();
  for(const c of listControls()){
   if(only&&!only.includes(c.section))continue;
   live.add(c.id);let m=mounted.get(c.id);
   if(m&&m.def!==c){dispose(m);mounted.delete(c.id);m=null;}
   if(!m){
    const wrap=document.createElement('div');wrap.className='drawer-control';wrap.dataset.control=c.id;
    let handle=null;try{handle=c.mount({container:wrap,kit,refresh:layout})||null;}catch(e){console.error('Control',c.id,'failed to mount',e);wrap.remove();continue;}
    m={def:c,wrap,handle};mounted.set(c.id,m);
   }
   sectionEls.get(c.section).body.append(m.wrap);
  }
  for(const [id,m] of mounted)if(!live.has(id)){dispose(m);mounted.delete(id);}
  for(const s of mine){const slot=slotFor(s.id);if(slot)attachSlot(s.id);const b=sectionEls.get(s.id).body;if(slot&&slot.parentElement===b)b.append(slot);}
  layout();
 }
 function dispose(m){try{m.handle?.dispose?.();}catch(e){console.error(e);}m.wrap.remove();}
 function layout(){
  for(const m of mounted.values()){let show=true;try{show=m.def.when?!!m.def.when():true;}catch{show=false;}m.wrap.hidden=!show;if(show)try{m.handle?.update?.();}catch(e){console.error('Control',m.def.id,'update failed',e);}}
  for(const [id,{sec,body}] of sectionEls){const slot=slotFor(id);sec.hidden=![...body.children].some(c=>c!==slot&&!c.hidden)&&!(slot&&slot.childElementCount);}
 }
 onControlsChange(e=>{if(e.type==='refresh')layout();else sync();});
 let open=false,closeTimer=0;
 function setOpen(next,{restoreFocus=true}={}){
  if(next===open)return;if(next&&isBlocked())return;open=next;clearTimeout(closeTimer);
  toggle.setAttribute('aria-expanded',String(open));document.body.classList.toggle('drawer-open',open);
  if(open)dispatchEvent(new CustomEvent('wildside:drawer-open',{detail:drawer}));
  if(open){layout();drawer.hidden=false;requestAnimationFrame(()=>{if(open)drawer.classList.add('open');});const first=drawer.querySelector('.drawer-sections [aria-checked=true],.drawer-sections button,.drawer-sections input,.drawer-sections select');(first||close).focus({preventScroll:true});}
  else{drawer.classList.remove('open');closeTimer=setTimeout(()=>{if(!open)drawer.hidden=true;},reduced()?0:220);if(restoreFocus&&drawer.contains(document.activeElement))toggle.focus({preventScroll:true});}
 }
 addEventListener('wildside:drawer-open',e=>{if(e.detail!==drawer&&open)setOpen(false,{restoreFocus:false});});
 toggle.addEventListener('click',()=>setOpen(!open));close.addEventListener('click',()=>setOpen(false));
 addEventListener('pointerdown',e=>{if(open&&!drawer.contains(e.target)&&!toggle.contains(e.target))setOpen(false,{restoreFocus:false});},true);
 addEventListener('keydown',e=>{if(open&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();setOpen(false);}},true);
 sync();
 return {open:()=>setOpen(true),close:()=>setOpen(false),get isOpen(){return open;},layout,slot:controlSlot};
}

/** Quiet chrome while exploring, scale shortcuts and the arrival veil. */
export function mountVisitChrome({panel,drawer}){
 const body=document.body,chrome=[...document.querySelectorAll('.chrome')];
 let idleTimer=0,hintTimer=0,hovering=false,swallowClick=false,wasExploring=body.classList.contains('exploring');
 const exploring=()=>body.classList.contains('exploring');
 const blocked=()=>panel.open||drawer.isOpen||hovering||chrome.some(c=>c.contains(document.activeElement));
 function wake(){body.classList.remove('chrome-idle');clearTimeout(idleTimer);idleTimer=setTimeout(rest,IDLE_MS);}
 function rest(){if(!exploring()||blocked()){idleTimer=setTimeout(rest,IDLE_MS);return;}body.classList.add('chrome-idle');}
 for(const c of chrome){c.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){hovering=true;wake();}});c.addEventListener('pointerleave',()=>{hovering=false;});}
 addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&!e.buttons)wake();},{passive:true});
 // A first touch on faded chrome only reveals it; it does not press an unseen control.
 addEventListener('pointerdown',e=>{
  const onChrome=chrome.some(c=>c.contains(e.target));
  if(e.pointerType!=='mouse'&&onChrome&&body.classList.contains('chrome-idle')){swallowClick=true;wake();}
  else if(onChrome||e.pointerType!=='mouse')wake();
 },true);
 addEventListener('click',e=>{if(swallowClick){swallowClick=false;e.preventDefault();e.stopImmediatePropagation();}},true);
 addEventListener('keydown',e=>{if(e.key==='Tab')wake();},true);
 addEventListener('focusin',e=>{if(chrome.some(c=>c.contains(e.target)))wake();});
 document.getElementById('encounter-dismiss')?.addEventListener('click',()=>{body.classList.add('encounter-dismissed');});
 const veil=document.getElementById('veil');
 function dip(){if(reduced()||!veil)return;veil.classList.remove('lift');veil.classList.add('dip');void veil.offsetWidth;veil.classList.remove('dip');veil.classList.add('lift');}
 // Hints teach by use: they stay until the visitor has looked around and moved, then are done for good.
 const stored=k=>{try{return localStorage.getItem(k);}catch{return null;}},store=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
 let looked=false,moved=false,hintsDone=stored(HINT_KEY)==='done';
 function used(kind){if(kind==='look')looked=true;else moved=true;if(looked&&moved&&!hintsDone){hintsDone=true;store(HINT_KEY,'done');body.classList.remove('hint-visible');}}
 const world=document.getElementById('world');
 world?.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch')used('look');},{passive:true});
 addEventListener('keydown',e=>{if(/^(Key[WASDEQ]|Arrow(Up|Down|Left|Right))$/.test(e.code))used('move');},true);
 document.getElementById('touch-controls')?.addEventListener('pointerdown',()=>used('move'),true);
 function showHint(){if(hintsDone)return;body.classList.add('hint-visible');clearTimeout(hintTimer);hintTimer=setTimeout(()=>body.classList.remove('hint-visible'),HINT_MS);}
 new MutationObserver(()=>{
  const now=exploring();if(now===wasExploring)return;wasExploring=now;
  if(now){body.classList.add('has-entered');dip();showHint();wake();}else{body.classList.remove('chrome-idle');}
 }).observe(body,{attributes:true,attributeFilter:['class']});
 // Scale indicator glides between the pressed scale.
 const group=document.querySelector('.mode-group'),modes=[...group.querySelectorAll('[data-mode]')];
 const placeThumb=()=>{const on=modes.find(b=>b.getAttribute('aria-pressed')==='true');group.classList.toggle('has-thumb',!!on);if(!on)return;group.style.setProperty('--thumb-x',`${on.offsetLeft}px`);group.style.setProperty('--thumb-w',`${on.offsetWidth}px`);};
 const mo=new MutationObserver(()=>{placeThumb();if(exploring())showHint();});for(const b of modes)mo.observe(b,{attributes:true,attributeFilter:['aria-pressed']});
 addEventListener('resize',placeThumb);placeThumb();
 // Shortcuts that never collide with movement (W A S D E Q, arrows) or text entry.
 const keys={Digit1:'mode-human',Digit2:'mode-bird',Digit3:'mode-insect',KeyR:'rain-toggle',KeyP:'motion-toggle',KeyK:'save-memory'};
 addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey||e.repeat||panel.open)return;
  const t=e.target;if(t&&(/INPUT|TEXTAREA|SELECT/.test(t.tagName)||t.isContentEditable))return;
  const id=keys[e.code];if(!id)return;const b=document.getElementById(id);if(!b||b.disabled||b.hidden)return;
  e.preventDefault();b.click();
 });
 // Arrival: the paper veil lifts once the world has drawn.
 requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>{body.classList.remove('arriving');veil?.classList.add('lift');},reduced()?0:120)));
 return {wake,showHint};
}
