/** Player settings that Wildside itself owns (camera, mouse, render scale). Stored on this device only.
 * Graphics quality, anti-aliasing and frame cap belong to the HAMON view (src/hamon-settings.mjs). */
const KEY='wildside.settings.v1';
export const DEFAULTS=Object.freeze({fovOffset:0,sensitivity:1,invertY:false,renderScale:1});
export const LIMITS=Object.freeze({fovOffset:[-10,30],sensitivity:[.3,2.5],renderScale:[.5,1.5]});
const clamp=(v,[a,b])=>Math.min(b,Math.max(a,v));
export function sanitize(raw){
 const r=raw&&typeof raw==='object'?raw:{},n=(k)=>Number.isFinite(r[k])?clamp(r[k],LIMITS[k]):DEFAULTS[k];
 return {fovOffset:n('fovOffset'),sensitivity:n('sensitivity'),invertY:r.invertY===true,renderScale:n('renderScale')};
}
export function createSettings(storage=globalThis.localStorage){
 let value;try{value=sanitize(JSON.parse(storage?.getItem(KEY)??'null'));}catch{value={...DEFAULTS};}
 const subs=new Set();
 return {
  get:()=>value,
  set(patch){value=sanitize({...value,...patch});try{storage?.setItem(KEY,JSON.stringify(value));}catch{}for(const fn of [...subs])fn(value);return value;},
  reset(){return this.set({...DEFAULTS});},
  subscribe(fn){subs.add(fn);return()=>subs.delete(fn);},
 };
}
