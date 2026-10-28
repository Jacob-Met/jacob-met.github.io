/** Wildside controls registry: one home for world settings.
 *
 * Feature modules (HAMON styles, example places, time of day, weather, sound…)
 * register their controls here; the World drawer (src/world-drawer.mjs) renders
 * them in fixed sections so every feature looks and behaves the same, keyboard
 * and touch included. A module never positions its own floating UI.
 *
 *   import {registerControl,kit,refreshControls} from './controls.mjs';
 *   const off=registerControl({
 *     id:'my-time',            // unique; registering the same id replaces it
 *     section:'time',          // one of SECTION_IDS
 *     order:10,                // lower first within the section (default 0)
 *     when:()=>true,           // optional: hide while false (re-checked on refresh)
 *     mount({container,kit,refresh}){   // called once, when the drawer mounts it
 *       const c=kit.range({label:'Time of day',min:0,max:24,step:.25,value:17,
 *         format:v=>`${Math.floor(v)}:${String(Math.round(v%1*60)).padStart(2,'0')}`,
 *         onInput:v=>setHour(v)});
 *       container.append(c.element);
 *       return {update(){c.set(currentHour());},dispose(){}};   // both optional
 *     }
 *   });
 *   off();               // unregister (dispose is called)
 *   refreshControls();   // after outside state changes: re-runs when() and update()
 *
 * For extension points that already take a container (HAMON sky extensions),
 * `controlSlot(section)` returns a stable element inside that section.
 */
export const SECTIONS=Object.freeze([
 {id:'style',title:'Look',note:'How the place is painted. The place itself is unchanged.'},
 {id:'place',title:'Place'},
 {id:'time',title:'Time of day'},
 {id:'weather',title:'Weather'},
 {id:'life',title:'Life'},
 {id:'sound',title:'Sound'},
 {id:'graphics',title:'Graphics',note:'How the view is drawn on this device. Your place is unchanged.'},
 {id:'camera',title:'Camera and mouse'},
 {id:'about',title:'What you are seeing'},
 {id:'keys',title:'Keys'},
]);
/** Which sections each surface shows: the World drawer (look, place, time, weather) and Settings. */
export const WORLD_SECTIONS=Object.freeze(['style','place','time','weather','life','about']);
export const SETTINGS_SECTIONS=Object.freeze(['graphics','camera','sound','keys']);
export const SECTION_IDS=Object.freeze(SECTIONS.map(s=>s.id));

const controls=new Map(),listeners=new Set(),slots=new Map();
const emit=reason=>{for(const fn of [...listeners])try{fn(reason);}catch(e){console.error('controls listener',e);}};

export function registerControl(def){
 if(!def||typeof def.id!=='string'||!def.id)throw new TypeError('A control needs a string id');
 if(!SECTION_IDS.includes(def.section))throw new RangeError(`Unknown controls section "${def.section}". Use one of: ${SECTION_IDS.join(', ')}`);
 if(typeof def.mount!=='function')throw new TypeError(`Control "${def.id}" needs mount({container,kit,refresh})`);
 const entry={order:0,...def,seq:controls.has(def.id)?controls.get(def.id).seq:controls.size};
 controls.set(def.id,entry);emit({type:'register',id:def.id});
 return ()=>{if(controls.get(def.id)===entry){controls.delete(def.id);emit({type:'unregister',id:def.id});}};
}
export function listControls(section){
 return [...controls.values()].filter(c=>!section||c.section===section).sort((a,b)=>a.order-b.order||a.seq-b.seq);
}
export function onControlsChange(fn){listeners.add(fn);return ()=>listeners.delete(fn);}
export function refreshControls(){emit({type:'refresh'});}
/** A stable container in `section` for code that mounts its own elements. */
export function controlSlot(section){
 if(!SECTION_IDS.includes(section))throw new RangeError(`Unknown controls section "${section}"`);
 if(!slots.has(section)){const doc=globalThis.document;if(!doc)return null;const div=doc.createElement('div');div.className='control-slot';div.dataset.section=section;slots.set(section,div);emit({type:'slot',section});}
 return slots.get(section);
}
export function slotFor(section){return slots.get(section)??null;}

/** Building blocks that match the drawer. Each returns {element,set(value)}. */
export const kit={
 /** Exclusive choice. options: [{value,label,hint?}]. layout 'list' (default) or 'segmented'. */
 choice({label,options=[],value,onChange=()=>{},layout='list'}){
  const doc=document,element=doc.createElement('div');element.className=`ctl ctl-choice ctl-${layout}`;
  const name=doc.createElement('span');name.className='ctl-label';name.textContent=label??'';name.id=uniq('ctl');
  const group=doc.createElement('div');group.setAttribute('role','radiogroup');group.setAttribute('aria-labelledby',name.id);group.className='ctl-options';
  let current=value,items=[];
  const render=list=>{items=list.map(o=>{const b=doc.createElement('button');b.type='button';b.setAttribute('role','radio');b.dataset.value=o.value;
   const t=doc.createElement('span');t.className='ctl-option-label';t.textContent=o.label;b.append(t);
   if(o.hint&&layout==='list'){const h=doc.createElement('span');h.className='ctl-option-hint';h.textContent=o.hint;b.append(h);}else if(o.hint)b.title=o.hint;
   b.onclick=()=>{if(current===o.value)return;set(o.value);onChange(o.value);};return b;});group.replaceChildren(...items);set(current);};
  const set=v=>{current=v;items.forEach(b=>{const on=b.dataset.value===String(v);b.setAttribute('aria-checked',String(on));b.tabIndex=on||(!items.some(x=>x.dataset.value===String(v))&&b===items[0])?0:-1;});};
  group.addEventListener('keydown',e=>{const i=items.indexOf(doc.activeElement);if(i<0)return;const step={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1}[e.key];if(!step)return;e.preventDefault();e.stopPropagation();const n=items[(i+step+items.length)%items.length];n.focus();n.click();});
  if(label)element.append(name);element.append(group);render(options);
  return {element,set,setOptions(list,v=current){current=v;render(list);}};
 },
 /** On/off switch. */
 toggle({label,hint,pressed=false,onChange=()=>{}}){
  const doc=document,element=doc.createElement('button');element.type='button';element.className='ctl ctl-toggle';element.setAttribute('role','switch');
  const text=doc.createElement('span');text.className='ctl-toggle-text';const l=doc.createElement('span');l.className='ctl-label';l.textContent=label;text.append(l);
  if(hint){const h=doc.createElement('span');h.className='ctl-hint';h.textContent=hint;text.append(h);}
  const knob=doc.createElement('span');knob.className='ctl-switch';knob.setAttribute('aria-hidden','true');element.append(text,knob);
  let on=!!pressed;const set=v=>{on=!!v;element.setAttribute('aria-checked',String(on));};set(on);
  element.onclick=()=>{set(!on);onChange(on);};
  return {element,set};
 },
 /** Continuous value. */
 range({label,min=0,max=1,step=.01,value=0,format=v=>String(v),onInput=()=>{}}){
  const doc=document,element=doc.createElement('div');element.className='ctl ctl-range';
  const head=doc.createElement('span');head.className='ctl-range-head';const l=doc.createElement('label');l.className='ctl-label';l.textContent=label;
  const out=doc.createElement('output');head.append(l,out);
  const input=doc.createElement('input');input.type='range';input.id=uniq('ctl');l.htmlFor=input.id;Object.assign(input,{min,max,step});
  const set=v=>{input.value=String(v);out.textContent=format(Number(input.value));};set(value);
  input.addEventListener('input',()=>{out.textContent=format(Number(input.value));onInput(Number(input.value));});
  element.append(head,input);return {element,set,input};
 },
 /** Quiet text, e.g. an honesty note. */
 note(text){const element=document.createElement('p');element.className='ctl-note';element.textContent=text;return {element,set(v){element.textContent=v;}};},
 /** A secondary action. */
 button(o){return kit.action(o);},
 action({label,onClick=()=>{}}){const element=document.createElement('button');element.type='button';element.className='ctl ctl-action';element.textContent=label;element.onclick=onClick;return {element,set(v){element.textContent=v;}};},
};
let n=0;const uniq=p=>`${p}-${++n}`;
