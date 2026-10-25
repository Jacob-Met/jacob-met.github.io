/** Imagined, opt-in sound bound to the actual simulated habitat and visit pose.
 * No sample downloads, microphone, observed wildlife claims or autoplay.
 */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite3=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);

/** Listener-relative stereo position and smooth inverse-square falloff. */
export function spatialMix(source,listener,forward,near=3,up=[0,1,0]){
 if(!finite3(source)||!finite3(listener)||!finite3(forward)||!finite3(up)||!Number.isFinite(near)||near<=0)return {gain:0,pan:0};
 const dx=source[0]-listener[0],dy=source[1]-listener[1],dz=source[2]-listener[2];
 const right=[forward[1]*up[2]-forward[2]*up[1],forward[2]*up[0]-forward[0]*up[2],forward[0]*up[1]-forward[1]*up[0]];
 const distance=Math.hypot(dx,dy,dz),width=Math.hypot(...right);
 if(!Number.isFinite(distance)||!Number.isFinite(width)||width<1e-8)return {gain:0,pan:0};
 return {gain:1/(1+(distance/near)**2),pan:distance>1e-8?clamp((dx*right[0]+dy*right[1]+dz*right[2])/width/distance,-1,1):0};
}

/** Pure audio intent: perspective and simulation drive the sound, never source inference. */
export function soundFrame({listener,forward,up=[0,1,0],mode='human',bird=null,crawler=null,rain=false,paused=false,hidden=false}={}){
 const silent={rain:0,wind:0,bird:{gain:0,pan:0},crawler:{gain:0,pan:0}};
 if(paused||hidden||!finite3(listener)||!finite3(forward)||!finite3(up))return silent;
 const birdMix=bird?.state!=='unplaced'&&finite3(bird?.position)?spatialMix(bird.position,listener,forward,5,up):silent.bird;
 const activity=bird?.state==='perched'?0.17:bird?.state==='landing'?0.11:bird?.state==='flight'?0.06:0;
 const crawlerMix=mode==='insect'&&crawler?.state!=='unplaced'&&finite3(crawler?.position)
  ?spatialMix(crawler.position,listener,forward,.34,up):silent.crawler;
 const crawlerActivity=crawler?.state==='walking'?0.048:crawler?.state==='turning'?0.023:0;
 return {rain:rain?.082:0,wind:rain?.018:.012,
  bird:{gain:birdMix.gain*activity*(rain?.48:1),pan:birdMix.pan},
  crawler:{gain:crawlerMix.gain*crawlerActivity,pan:crawlerMix.pan}};
}

function noiseBuffer(ctx){
 const samples=Math.max(1,Math.floor(ctx.sampleRate*2)),buffer=ctx.createBuffer(1,samples,ctx.sampleRate);
 const data=buffer.getChannelData(0);let seed=0x715c9d;
 for(let i=0;i<samples;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
 return buffer;
}

/** Creates no AudioContext until a user-initiated enable(). */
export function createSoundscape({createContext}={}){
 let ctx=null,master=null,rainGain=null,windGain=null,enabled=false,nextBird=0,nextCrawler=0;
 let paused=false,hidden=false,generation=0,transition=Promise.resolve();
 const loops=[],voices=new Set();
 const audible=()=>enabled&&!paused&&!hidden;
 function gainNow(param,value){
  param.cancelScheduledValues?.(ctx.currentTime);
  param.value=value;
  param.setValueAtTime(value,ctx.currentTime);
 }
 function clearVoices(){
  for(const voice of voices){try{voice.osc.stop();}catch{}voice.disconnect();}
  voices.clear();
 }
 function reset(){
  clearVoices();
  if(!ctx)return;
  gainNow(windGain.gain,0);gainNow(rainGain.gain,0);
  nextBird=ctx.currentTime;nextCrawler=ctx.currentTime;
 }
 function reconcile(){
  const target=ctx,version=generation;
  if(target&&!audible())gainNow(master.gain,0);
  // Audio operations can finish after a later pause, hide, disable or disposal.
  // Serialize them, and use current intent before and after every resume.
  const pending=transition.catch(()=>{}).then(async()=>{
   if(!target||target!==ctx||version!==generation||target.state==='closed')return;
   if(audible()){
    if(target.state!=='running')await target.resume();
    if(target!==ctx||version!==generation){if(target.state!=='closed')await target.close();return;}
    if(audible())gainNow(master.gain,.48);
    else {gainNow(master.gain,0);if(target.state!=='suspended')await target.suspend();}
   }else if(target.state!=='suspended')await target.suspend();
  });
  transition=pending;return pending;
 }
 function loop(buffer,filterFrequency,initialGain){
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
  source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=filterFrequency;
  gain.gain.value=initialGain;source.connect(filter);filter.connect(gain);gain.connect(master);source.start();
  loops.push(source);return gain;
 }
 function tone(at,frequency,finish,seconds,volume,panValue){
  const osc=ctx.createOscillator(),envelope=ctx.createGain(),panner=ctx.createStereoPanner();
  osc.type='sine';osc.frequency.setValueAtTime(frequency,at);
  osc.frequency.exponentialRampToValueAtTime(finish,at+seconds*.8);
  envelope.gain.setValueAtTime(.0001,at);
  envelope.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),at+.018);
  envelope.gain.exponentialRampToValueAtTime(.0001,at+seconds);
  panner.pan.value=clamp(panValue,-1,1);
  osc.connect(envelope);envelope.connect(panner);panner.connect(master);
  const voice={osc,disconnect(){osc.disconnect();envelope.disconnect();panner.disconnect();}};
  voices.add(voice);osc.onended=()=>{voice.disconnect();voices.delete(voice);};
  osc.start(at);osc.stop(at+seconds+.01);
 }
 async function enable(){
  if(enabled)return reconcile();
  if(!ctx){
   const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
   if(!createContext&&!Context)throw new Error('This browser does not support Web Audio');
   ctx=createContext?createContext():new Context();
   master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
   const buffer=noiseBuffer(ctx);
   windGain=loop(buffer,310,0);rainGain=loop(buffer,1550,0);
  }
  enabled=true;nextBird=ctx.currentTime;nextCrawler=ctx.currentTime;
  const target=ctx;
  try{await reconcile();}catch(error){
   if(ctx===target){enabled=false;gainNow(master.gain,0);}
   throw error;
  }
 }
 async function disable(){
  enabled=false;reset();await reconcile();
 }
 function setHidden(value){
  hidden=Boolean(value);if(hidden)reset();
  return reconcile();
 }
 function setPaused(value){
  if(paused===Boolean(value))return transition;
  paused=Boolean(value);if(paused)reset();
  return reconcile();
 }
 function update(input){
  if(!audible()||!ctx||ctx.state!=='running')return;
  const frame=soundFrame(input),now=ctx.currentTime;
  rainGain.gain.setTargetAtTime(frame.rain,now,.18);
  windGain.gain.setTargetAtTime(frame.wind,now,.22);
  if(frame.bird.gain>.008&&now>=nextBird){
   tone(now,1930,2510,.14,frame.bird.gain,frame.bird.pan);
   tone(now+.13,2280,1790,.115,frame.bird.gain*.76,frame.bird.pan);
   nextBird=now+(input?.bird?.state==='perched'?2.6:4.1);
  }
  if(frame.crawler.gain>.006&&now>=nextCrawler){
   tone(now,640,470,.035,frame.crawler.gain,frame.crawler.pan);
   nextCrawler=now+.45;
  }
 }
 async function dispose(){
  enabled=false;generation++;
  if(!ctx)return;
  gainNow(master.gain,0);reset();const closing=ctx;
  for(const source of loops){try{source.stop();}catch{}source.disconnect();}
  loops.length=0;ctx=null;master=null;windGain=null;rainGain=null;
  // A browser can leave resume pending while activation is unavailable. Closing
  // and the next explicitly enabled context must not wait behind that promise.
  transition=Promise.resolve();await closing.close();
 }
 return {enable,disable,update,setHidden,setPaused,reset,dispose,isEnabled:()=>enabled};
}
