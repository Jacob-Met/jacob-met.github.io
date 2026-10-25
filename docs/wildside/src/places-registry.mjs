/** Places registry: every place Wildside can travel to, as one card in the Places picker.
 *
 *   import {registerPlace} from './places-registry.mjs';
 *   registerPlace({
 *     id:'autumn-lake',                 // unique; registering the same id replaces (e.g. soon -> ready)
 *     name:'Autumn Lake',
 *     line:'Maples at the water, a heron in the reeds.',   // one line
 *     kind:'lake',                      // painted thumbnail: courtyard|kyoto|lake|coast|street (or give thumb:'<svg…>' / url)
 *     status:'ready',                   // 'ready' travels; 'soon' shows a quiet "coming soon" card
 *     honesty:'Imagined',               // optional small label; imagined places must say so
 *     order:30,
 *     current:()=>place.id==='autumn-lake',   // is the visitor here now?
 *     async travel(){…}                 // load/switch the place; the picker plays the transition
 *   });
 */
const places=new Map(),listeners=new Set();
export function registerPlace(def){
 if(!def||typeof def.id!=='string'||!def.id)throw new TypeError('A place needs a string id');
 if(typeof def.name!=='string')throw new TypeError(`Place "${def.id}" needs a name`);
 const entry={status:'ready',order:0,kind:def.id,line:'',...def};
 if(entry.status==='ready'&&typeof entry.travel!=='function')throw new TypeError(`Ready place "${def.id}" needs travel()`);
 places.set(def.id,entry);for(const fn of [...listeners])fn({type:'register',id:def.id});
 return ()=>{if(places.get(def.id)===entry){places.delete(def.id);for(const fn of [...listeners])fn({type:'unregister',id:def.id});}};
}
export const listPlaces=()=>[...places.values()].sort((a,b)=>a.order-b.order);
export const currentPlace=()=>listPlaces().find(p=>{try{return p.status==='ready'&&p.current?.();}catch{return false;}})??null;
export const onPlacesChange=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
