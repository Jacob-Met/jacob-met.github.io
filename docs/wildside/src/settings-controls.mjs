/** Registers Wildside's own Settings rows (camera, mouse, render scale, fullscreen, key guide). */
import {registerControl} from './controls.mjs';
import {LIMITS} from './settings.mjs';

export function registerSettingsControls(settings,{onChange=()=>{}}={}){
 const fullscreenOK=()=>!!document.fullscreenEnabled;
 const toggleFullscreen=()=>{const g=window.__wildsideGraphics;if(g?.toggleFullscreen)return g.toggleFullscreen();document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();};
 const num=(id,section,order,def)=>registerControl({id,section,order,mount({container,kit}){
  const s=settings.get(),c=kit.range({...def.range,value:def.read(s),format:def.format,onInput:v=>{settings.set(def.patch(v));onChange();}});
  container.append(c.element);const off=settings.subscribe(next=>c.set(def.read(next)));return {update(){c.set(def.read(settings.get()));},dispose:off};}});
 registerControl({id:'graphics-engine-note',section:'graphics',order:0,when:()=>!window.__wildsideGraphics,mount({container,kit}){
  container.append(kit.note('More graphics options, such as quality, anti-aliasing and frame rate, will appear here as they become available on this device. Render scale works now.').element);}});
 num('render-scale','graphics',20,{range:{label:'Render scale',min:LIMITS.renderScale[0],max:LIMITS.renderScale[1],step:.05},read:s=>s.renderScale,patch:v=>({renderScale:v}),format:v=>`${Math.round(v*100)}%`});
 registerControl({id:'fullscreen',section:'graphics',order:30,when:()=>fullscreenOK()&&!window.__wildsideGraphics?.toggleFullscreen,mount({container,kit}){container.append(kit.action({label:'Toggle fullscreen',onClick:toggleFullscreen}).element);}});
 num('fov','camera',0,{range:{label:'Field of view',min:LIMITS.fovOffset[0],max:LIMITS.fovOffset[1],step:1},read:s=>s.fovOffset,patch:v=>({fovOffset:v}),format:v=>v===0?'Natural':`${v>0?'+':''}${v}°`});
 num('mouse-sensitivity','camera',10,{range:{label:'Look sensitivity',min:LIMITS.sensitivity[0],max:LIMITS.sensitivity[1],step:.05},read:s=>s.sensitivity,patch:v=>({sensitivity:v}),format:v=>`${v.toFixed(2)}×`});
 registerControl({id:'invert-y',section:'camera',order:20,mount({container,kit}){
  const c=kit.toggle({label:'Invert vertical look',pressed:settings.get().invertY,onChange:()=>{settings.set({invertY:!settings.get().invertY});onChange();}});
  container.append(c.element);return {update(){c.set(settings.get().invertY);}};}});
 registerControl({id:'reset-settings',section:'camera',order:90,mount({container,kit}){container.append(kit.action({label:'Reset camera and graphics',onClick:()=>{settings.reset();onChange();}}).element);}});
}
