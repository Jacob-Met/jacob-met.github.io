/** Phones and tablets: device detection, a mobile performance profile, and touch-first controls.
 *
 * One thumb moves (a floating analog stick, bottom-left), the other drags the world to look (that is
 * the app's ordinary drag), and two fingers pinch to zoom the view. Everything here is additive: on a
 * desktop (fine pointer) `createMobile` reports `active:false` and touches nothing.
 *
 * The profile is a plain description (internal pixel budget, device-pixel-ratio cap, shadow size,
 * planting density, frame-rate cap). The HAMON view and the three.js fallback read it; the graphics
 * presets (hamon-settings) can override it once the user picks a quality by hand.
 */

const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

/** What kind of device is this? Pure: pass a plain environment so it can be tested. */
export function detectDevice({ua='',maxTouchPoints=0,coarse=false,hover=true,width=1024,height=768,platform=''}={}){
 const ipadOS=/Macintosh/.test(ua)&&maxTouchPoints>1&&(coarse||!hover);           // iPadOS 13+ reports itself as a Mac
 const ios=/iPhone|iPad|iPod/.test(ua)||ipadOS;
 const android=/Android/.test(ua);
 const touch=maxTouchPoints>0||coarse;
 const short=Math.min(width,height);
 // "phone" is by the short side of the window, so rotation does not change what we are
 const phone=touch&&(/iPhone|iPod/.test(ua)||(android&&/Mobile/.test(ua))||(!ios&&!android&&coarse&&short<560));
 const tablet=touch&&!phone&&(ios||android||(coarse&&!hover));
 const mobile=phone||tablet||(coarse&&!hover);
 return {ios,android,touch,phone,tablet,mobile,platform};
}

/** Safari 26 (iOS 26) is the first iOS with WebGPU; older iPhones fall back to three.js. */
export function iosMajor(ua=''){const m=/OS (\d+)[_.]\d+/.exec(ua);return m?Number(m[1]):null;}

/** The mobile performance profile. `pixels` is the internal render budget (TAAU upsamples to the canvas);
 * `dprCap` caps the three.js fallback's device-pixel-ratio; `shadow` is the shadow-map size per cascade;
 * `foliage` the planting-density multiplier; `fpsCap` the frame-rate cap (0 = every display refresh).
 * A phone targets 30 fps: half the heat and battery of 60, and a steadier frame than chasing 60. */
export function mobileProfile(device){
 if(!device?.mobile)return {tier:'desktop',pixels:921600,dprCap:1.5,shadow:2048,foliage:1,fpsCap:0};
 if(device.phone)return {tier:'phone',pixels:518400,dprCap:1.25,shadow:1024,foliage:.5,fpsCap:30};
 return {tier:'tablet',pixels:737280,dprCap:1.5,shadow:1536,foliage:.75,fpsCap:30};
}

/** Analog stick: a thumb offset (px) from the stick centre becomes movement in -1..1. A dead zone
 * keeps a resting thumb still; the response is eased so small pushes are slow and exact. */
export function stickVector(dx,dy,radius,dead=.16){
 const len=Math.hypot(dx,dy);if(!(radius>0)||!(len>0))return {x:0,y:0,magnitude:0};
 const raw=clamp(len/radius,0,1);if(raw<dead)return {x:0,y:0,magnitude:0};
 const magnitude=((raw-dead)/(1-dead))**1.25,k=magnitude/len;
 return {x:dx*k,y:dy*k,magnitude};
}

/** Pinch: scale `zoom` by how the finger gap changed. Spreading zooms in. */
export function pinchZoom(zoom,previousGap,nextGap,{min=1,max=3.2}={}){
 if(!(previousGap>0)||!(nextGap>0))return zoom;
 return clamp(zoom*nextGap/previousGap,min,max);
}

/** A vertical field of view narrowed by `zoom` (so zoom 2 shows half the width and height). */
export function zoomedFov(fovDegrees,zoom){
 if(!(zoom>1))return fovDegrees;
 return 2*Math.atan(Math.tan(fovDegrees*Math.PI/360)/zoom)*180/Math.PI;
}

/** Portrait screens: keep a usable horizontal view by widening the vertical field of view (as the
 * underwater view already does), but not past what looks like a fisheye. Landscape is unchanged. */
export function portraitFov(fovDegrees,aspect,{floor=.62,cap=88}={}){
 if(!(aspect<1))return fovDegrees;
 return Math.max(fovDegrees,Math.min(cap,2*Math.atan(Math.tan(fovDegrees*Math.PI/360)/Math.max(floor,aspect))*180/Math.PI));
}

/** Why the HAMON view is not running, in words a visitor can use (shown once, then the maintained
 * three.js view carries on). `reason` is `error.message` from the HAMON view. */
export function webgpuNotice(reason,device={},ua=''){
 const text=String(reason??'');
 if(/WebGPU is not available/i.test(text)){
  if(device.ios){const v=iosMajor(ua);
   return v&&v<26?`This iPhone is on iOS ${v}. HAMON's painted view needs WebGPU, which arrives with iOS 26. Showing the simpler view for now.`
    :'HAMON’s painted view needs WebGPU. In Safari, turn it on under Settings, Apps, Safari, Advanced, Feature Flags, WebGPU. Showing the simpler view for now.';}
  if(device.android)return 'HAMON’s painted view needs WebGPU, which this browser does not offer (try Chrome 121 or newer on Android 12+). Showing the simpler view for now.';
  return 'HAMON’s painted view needs WebGPU or WebGL2, and this browser offers neither. Showing the simpler view for now.';
 }
 return `HAMON’s painted view could not start on this device (${text.slice(0,120)||'unknown error'}). Showing the simpler view for now.`;
}

const STICK_RADIUS=56;

/** Wire the touch controls. `world` receives the look drag and pinch; `host` is the element the stick is
 * added to. Returns the live controller the app reads each frame. */
export function createMobile({win=globalThis.window,doc=globalThis.document,world,onChange=()=>{},canPinch=()=>true}={}){
 const nav=win?.navigator,mm=q=>{try{return !!win?.matchMedia?.(q).matches;}catch{return false;}};
 const device=detectDevice({ua:nav?.userAgent??'',maxTouchPoints:nav?.maxTouchPoints??0,coarse:mm('(pointer:coarse)'),hover:mm('(hover:hover)'),width:win?.innerWidth??1024,height:win?.innerHeight??768,platform:nav?.platform??''});
 const profile=mobileProfile(device);
 const api={
  device,profile,active:device.mobile||device.touch&&mm('(pointer:coarse)'),
  axes:{forward:0,right:0},zoomLevel:1,pinching:false,
  /** Pixel ratio for three.js (the HAMON view is governed by `profile.pixels` instead). */
  pixelRatio:ratio=>Math.min(ratio,profile.dprCap),
  minInterval:()=>profile.fpsCap>0?1000/profile.fpsCap:0,
  horizontalFov:(fov,aspect)=>api.active?portraitFov(fov,aspect):fov,
  zoomFov:fov=>zoomedFov(fov,api.zoomLevel),
  resetZoom(){if(api.zoomLevel!==1){api.zoomLevel=1;onChange();}},
  moving:()=>api.axes.forward!==0||api.axes.right!==0,
  setMode(){},dispose(){},
 };
 if(!api.active||!doc||!world)return api;
 doc.body.classList.add('mobile');doc.body.classList.toggle('phone',device.phone);doc.body.classList.toggle('ios',device.ios);

 // browsers must not zoom or scroll the page itself: the world is the only thing that moves
 for(const t of ['gesturestart','gesturechange','gestureend'])doc.addEventListener(t,e=>e.preventDefault(),{passive:false});
 const orient=()=>doc.body.classList.toggle('landscape',(win.innerWidth||0)>(win.innerHeight||0));
 orient();win.addEventListener('resize',orient);

 // --- the stick ---
 const host=doc.getElementById('touch-controls')||doc.body;
 const base=doc.createElement('div');base.className='stick';base.setAttribute('role','group');base.setAttribute('aria-label','Move: drag the thumb');
 const nub=doc.createElement('div');nub.className='stick-nub';base.append(nub);host.prepend(base);
 let stickId=null,cx=0,cy=0;
 const set=(x,y,mag)=>{api.axes.forward=-y;api.axes.right=x;nub.style.transform=`translate(${x*STICK_RADIUS}px,${y*STICK_RADIUS}px)`;base.classList.toggle('held',mag>0);onChange();};
 const move=e=>{const v=stickVector(e.clientX-cx,e.clientY-cy,STICK_RADIUS);set(v.x,v.y,v.magnitude);};
 const release=e=>{if(e.pointerId!==stickId)return;stickId=null;set(0,0,0);base.classList.remove('down');};
 base.addEventListener('pointerdown',e=>{
  if(stickId!==null)return;e.preventDefault();e.stopPropagation();stickId=e.pointerId;base.setPointerCapture?.(e.pointerId);
  const r=base.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;base.classList.add('down');move(e);
 });
 base.addEventListener('pointermove',e=>{if(e.pointerId===stickId)move(e);});
 for(const t of ['pointerup','pointercancel','lostpointercapture'])base.addEventListener(t,release);
 api.releaseStick=()=>{if(stickId!==null){stickId=null;set(0,0,0);}};

 // --- pinch to zoom (explore views; the overview has its own pinch) ---
 const fingers=new Map();let gap=null;
 const dist=()=>{const [a,b]=[...fingers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
 world.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch')return;fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(fingers.size===2&&canPinch()){gap=dist();api.pinching=true;}
 },{capture:true});
 world.addEventListener('pointermove',e=>{
  if(!fingers.has(e.pointerId))return;fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(api.pinching&&fingers.size===2){const next=dist();api.zoomLevel=pinchZoom(api.zoomLevel,gap,next);gap=next;onChange();}
 },{capture:true});
 const lift=e=>{if(!fingers.delete(e.pointerId))return;if(fingers.size<2){gap=null;if(api.pinching)setTimeout(()=>{api.pinching=false;},60);}};
 for(const t of ['pointerup','pointercancel'])world.addEventListener(t,lift,{capture:true});

 // vertical movement (bird flight) only exists in bird view
 api.setMode=mode=>{doc.body.dataset.scale=mode||'';};
 api.dispose=()=>{win.removeEventListener('resize',orient);base.remove();doc.body.classList.remove('mobile','phone','ios','landscape');};
 return api;
}
