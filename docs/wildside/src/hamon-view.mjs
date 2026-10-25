/** HAMON Engine view of the current place (WebGPU), beside the maintained three.js renderer.
 * Wildside's frame loop, navigation, simulation and creatures stay the authority: this module
 * receives a rebuilt place, streams creature part matrices and the camera each frame, and
 * presents the Engine frame on its own canvas. Without WebGPU (or if the Engine fails) it
 * reports `failed` and the host keeps drawing with three.js.
 */
import {exportPlaceForHamon} from './hamon-scene-export.mjs';
import {HAMON_EXTENSIONS} from './hamon-extensions.mjs';

export const LOOK_KEY='wildside.look.v1';
export const RENDERER_KEY='wildside.renderer.v1';
const read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
const write=(key,value)=>{try{value===null?localStorage.removeItem(key):localStorage.setItem(key,value);}catch{}};

/** Whether this viewer asked for the Engine renderer (`?hamon=1`, remembered; `?hamon=0` forgets). */
export function wantsHamon(location=globalThis.location){
 const q=new URLSearchParams(location?.search??'').get('hamon');
 if(q==='1'){write(RENDERER_KEY,'hamon');return true;}
 if(q==='0'){write(RENDERER_KEY,null);return false;}
 return read(RENDERER_KEY)!=='three'; // public build: HAMON Engine view by default
}

/** Render scale for a viewport: native up to 720p of pixels, then TAAU renders that budget and upscales. */
export function hamonResolution(width,height,pixelRatio=1){
 const ratio=Math.min(pixelRatio,1.5),w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
 const pixels=w*h,budget=1280*720,scale=pixels>budget?Math.sqrt(budget/pixels):1;
 return {width:w,height:h,scale:Math.round(scale*1000)/1000};
}

export function mountHamonView(parent,{onState=()=>{},skyContainer=null}={}){
 const canvas=document.createElement('canvas');canvas.className='hamon-canvas';canvas.setAttribute('aria-label','Living place rendered by HAMON Engine');canvas.hidden=true;parent.append(canvas);
 let engine=null,view=null,phase='loading',error=null,stream=null,looks=[],look=null,size=null,busy=false,inhabitants=[],skyState=null;const skyMounts=[];
 const state=()=>({phase,error:error?String(error.message??error):null,look,looks,adapter:view?.adapter()??null,stats:view?JSON.parse(view.stats()):null});
 const emit=()=>{parent.dataset.renderer=phase==='ready'?'hamon':'three';onState(state());};
 const fail=e=>{error=e;phase='failed';canvas.hidden=true;try{view?.free();}catch{}view=null;emit();console.error('HAMON view unavailable:',e);};
 const fit=()=>{
  const next=hamonResolution(parent.clientWidth||innerWidth,parent.clientHeight||innerHeight,devicePixelRatio);
  if(size&&next.width===size.width&&next.height===size.height&&next.scale===size.scale)return;
  size=next;canvas.width=size.width;canvas.height=size.height;view?.resize(size.width,size.height,size.scale);
 };
 const ready=(async()=>{
  try{
   if(!navigator.gpu)throw new Error('WebGPU is not available in this browser');
   engine=await import('../hamon/hamon_browser.js');await engine.default();
   looks=JSON.parse(engine.looks_json());const saved=read(LOOK_KEY);look=looks.some(l=>l.id===saved)?saved:engine.default_look();
   fit();view=await engine.open_view(canvas);view.resize(size.width,size.height,size.scale);
   if(!view.set_look(look))look=view.look();
   phase='waiting';emit();
   const controls={setSky(v){skyState=v??null;view?.set_sky_json(JSON.stringify(skyState));},state:()=>({sky:skyState,look})};
   if(skyContainer)for(const x of HAMON_EXTENSIONS.sky)try{skyMounts.push(x.mount({container:skyContainer,...controls}));}catch(e){console.error('HAMON sky control',x.id,e);}
   return true;
  }catch(e){fail(e);return false;}
 })();
 const api={canvas,ready,state,
  get active(){return phase==='ready'&&!!view;},
  /** Send a rebuilt place: `art` from buildWorldArt, `dynamicRoots` = [{group, role}] of
   * three.js creature art, `ctx` the simulation context for inhabitant extensions. */
  setWorld(art,place,dynamicRoots,ctx={}){
   if(!view)return false;
   try{
    const placeExt=HAMON_EXTENSIONS.places.filter(x=>x.matches?.({place,art})).flatMap(x=>x.contribute({place,art})??[]);
    inhabitants=HAMON_EXTENSIONS.inhabitants.filter(x=>x.state&&(!x.replaces||x.replaces(ctx)));
    const replaced=new Set(inhabitants.map(x=>x.replaces?.(ctx)).filter(Boolean));
    const packet=exportPlaceForHamon(art,place,dynamicRoots.filter(r=>!replaced.has(r.group)),{places:placeExt,inhabitants:inhabitants.map(x=>({kind:x.kind,params:x.params??{}}))});view.set_world(JSON.stringify(packet.desc),packet.verts,packet.indices,packet.texels);stream=packet.stream;phase='ready';emit();return true;}
   catch(e){fail(e);return false;}
  },
  setLook(id){
   if(!view||!looks.some(l=>l.id===id))return false;
   try{if(view.set_look(id)){look=id;write(LOOK_KEY,id);emit();return true;}}catch(e){fail(e);}return false;
  },
  setRain(on){view?.set_rain(!!on);},
  resize(){if(view)try{fit();}catch(e){fail(e);}},
  /** Draw one frame from the three.js `camera` at simulation `time` (seconds). */
  frame(camera,time,ctx={}){
   if(phase!=='ready'||!view||busy)return false;
   busy=true;
   try{
    fit();
    if(stream?.count){const {matrices,visible}=stream.capture();view.set_dynamic(matrices,visible);}
    inhabitants.forEach((x,i)=>view.set_inhabitant_state(i,x.state({...ctx,camera,time})));
    camera.updateMatrixWorld();const e=camera.matrixWorld.elements,eye=[e[12],e[13],e[14]];
    const cam=new Float32Array([...eye,eye[0]-e[8],eye[1]-e[9],eye[2]-e[10],e[4],e[5],e[6],camera.fov,Math.max(camera.near,.01),camera.far]);
    const shown=view.frame(cam,time);canvas.hidden=false;return shown;
   }catch(e){fail(e);return false;}finally{busy=false;}
  },
  dispose(){for(const m of skyMounts)try{m?.dispose?.();}catch{}try{view?.free();}catch{}view=null;canvas.remove();phase='disposed';emit();},
 };
 return api;
}
