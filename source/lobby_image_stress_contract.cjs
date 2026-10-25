const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dir=process.argv[2],helper=fs.readFileSync(dir+'/lobby-journey.js','utf8'),adapter=fs.readFileSync(dir+'/lobby.js','utf8'),handoffSource=fs.readFileSync(dir+'/scene-handoff.js','utf8');let count=0,failures=[];
function setup(initial='',mode={}){
 let activeElement=null,nextTimer=0,journey;const raf=[],timers=new Map(),events={},motionEvents={},pending=[];
 function node(name,attrs={}){const classes=new Set();const n={name,attrs:{...attrs},hidden:false,open:false,isConnected:true,listeners:{},parentElement:null,children:[],classList:{toggle(k,v){v?classes.add(k):classes.delete(k)},add(k){classes.add(k)},contains:k=>classes.has(k)},setAttribute(k,v){this.attrs[k]=String(v)},removeAttribute(k){delete this.attrs[k]},hasAttribute(k){return k in this.attrs},getAttribute(k){return this.attrs[k]??null},getClientRects(){for(let a=this;a;a=a.parentElement)if(a.hidden||(a!==this&&a.tagName==='DETAILS'&&!a.open))return [];return[{}]},closest(sel){for(let a=this;a;a=a.parentElement){if(sel==='.work-section'&&a.classList.contains('work-section'))return a;if((sel==='details'||sel==='details:not([open])')&&a.tagName==='DETAILS'&&(sel==='details'||!a.open))return a;if(sel==='[hidden],[inert]'&&(a.hidden||a.hasAttribute('inert')))return a;}return null},querySelector(sel){return sel==='h2'?this.h2:null},focus(){if(this.getClientRects().length)activeElement=this},scrollIntoView(){this.scrolled=true},addEventListener(k,f){(this.listeners[k]??=[]).push(f)}};return n}

 const body=node('body'),still=node('still'),heading=node('heading'),travelUI=node('travelUI'),travelLabel=node('travelLabel'),skipMovement=node('skipMovement'),presentation=node('presentation'),opener=node('opener'),skipLink=node('skipLink',{'data-skip':''}),home=node('home'),identity=node('identity');

 const buffer=node('buffer');buffer.hidden=true;const imageLoads=[],decodeTasks=[];
 for(const frame of [still,buffer]){
  frame.attrs.src=frame===still?'forge-entrance.png':'';frame.complete=frame===still;frame.naturalWidth=frame===still?1280:0;
  Object.defineProperty(frame,'src',{get(){return this.attrs.src},set(value){if(!this.hidden)throw Error('Preparing an image overwrote the visible still');this.attrs.src=value;this.complete=false;this.naturalWidth=0;imageLoads.push({frame:this,src:value})}});
  frame.removeEventListener=function(k,f){this.listeners[k]=(this.listeners[k]||[]).filter(v=>v!==f)};
  frame.decode=function(){return new Promise((resolve,reject)=>decodeTasks.push({frame:this,src:this.src,resolve,reject}))};
  frame.loadReady=function(){this.complete=true;this.naturalWidth=1280;for(const f of [...this.listeners.load||[]])f()};
  frame.loadFailed=function(){this.complete=true;this.naturalWidth=0;for(const f of [...this.listeners.error||[]])f()};
 }
 const research=node('research',{id:'research'}),projects=node('projects',{id:'projects'}),hackathons=node('hackathons',{id:'hackathons'});for(const n of[research,projects,hackathons]){n.classList.add('work-section');n.h2=node(n.name+'Heading');n.h2.textContent=n.name;n.h2.parentElement=n}
 const details=node('details');details.tagName='DETAILS';details.parentElement=projects;const caption=node('captionverse');caption.parentElement=details;
 const researchLink=node('researchLink',{href:'#research'}),captionLink=node('captionLink',{href:'#captionverse'}),projectLink=node('projectLink',{href:'#projects'});
 const sections=[research,projects,hackathons];const hackLink=node('hackLink',{href:'#hackathons'});

 function video(name){return{...node(name),hidden:true,duration:4,currentTime:0,readyState:mode.unloaded?0:1,plays:0,pauses:0,loads:0,play(){this.plays++;return mode.rejectPlay?Promise.reject(Error('blocked')):Promise.resolve()},pause(){this.pauses++},load(){this.loads++}}}
 const forward=video('forward'),reverse=video('reverse');const branchVideos=[];const videoPairs={engine:{forward,reverse}};for(const id of ['projects','hackathons']){videoPairs[id]={};for(const dir of ['forward','reverse']){const v=video(id+'-'+dir);v.attrs={'data-route':id,'data-direction':dir};videoPairs[id][dir]=v;branchVideos.push(v);}}for(const id of ['engine','projects','hackathons'])still.setAttribute(id==='engine'?'data-arrival-src':'data-'+id+'-src',id+'-arrival.png');still.setAttribute('data-entrance-src','forge-entrance.png');
 const location={href:'https://example.test/private/lobby.html'+initial,hash:initial};let stack=[{url:location.href,state:null}],index=0,backCalls=0,writes=0;
 const setUrl=u=>{location.href=String(u);location.hash=new URL(location.href).hash};
 const history={state:null,pushState(s,_,u){if(mode.denyHistory)throw Error('denied');writes++;this.state=s;stack.splice(++index);stack[index]={url:String(u),state:s};setUrl(u)},replaceState(s,_,u){if(mode.denyHistory)throw Error('denied');writes++;this.state=s;stack[index]={url:String(u),state:s};setUrl(u)},forward(){pending.push(()=>{index=Math.min(stack.length-1,index+1);setUrl(stack[index].url);this.state=stack[index].state;emit('popstate',{})})},back(){backCalls++;if(mode.denyBack)throw Error('denied');pending.push(()=>{index=Math.max(0,index-1);setUrl(stack[index].url);this.state=stack[index].state;emit('popstate',{})})}};
 const motion={matches:!!mode.reduced,addEventListener:(k,f)=>motionEvents[k]=f};
 const document={body,title:'',getElementById(id){return{buffer,imageLoads,decodeTasks,research,projects,hackathons,captionverse:caption}[id]},querySelector(s){return{'#scene-still':still,'#scene-buffer':buffer,'#route-forward':forward,'#route-reverse':reverse,'#engine-heading':heading,'.journey-ui':travelUI,'#journey-label':travelLabel,'#skip-journey':skipMovement,'#presentation-label':presentation,'.identity':identity}[s]},querySelectorAll:s=>s==='video[data-route]'?branchVideos:s==='.work-section'?sections:s==='a[href^="#"]'?[researchLink,captionLink,projectLink,hackLink]:s==='[data-engine]'?[skipLink,opener]:s==='[data-home]'?[home,identity]:[]};
 const window={scrollTo(){},addEventListener(k,f,o){(events[k]??=[]).push({f,once:o?.once})}};
 function emit(k,e={}){for(const entry of [...events[k]||[]]){entry.f(e);if(entry.once)events[k]=events[k].filter(x=>x!==entry)}}
 const ctx=vm.createContext({document,window,history,location,URL,Promise,matchMedia:()=>motion,requestAnimationFrame:f=>raf.push(f),setTimeout(f){const id=++nextTimer;timers.set(id,f);return id},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(handoffSource,ctx);vm.runInContext(helper,ctx);const make=ctx.createLobbyJourney;ctx.createLobbyJourney=o=>(journey=make(o));vm.runInContext(adapter,ctx);
 function click(n,mods={}){const e={button:0,currentTarget:n,...mods,preventDefault(){this.defaultPrevented=true}};for(const f of n.listeners.click??[])f(e);return e}
 function historyOnly(){while(pending.length)pending.shift()()} function rafOnly(){while(raf.length)raf.shift()()} function flush(){historyOnly();rafOnly()} function ended(v){v.ended=true;v.currentTime=v.duration;v.onended?.()}
 return{buffer,imageLoads,decodeTasks,research,projects,hackathons,hackLink,videoPairs,presentation,travelLabel,details,caption,researchLink,captionLink,projectLink,body,still,heading,travelUI,skipMovement,opener,skipLink,home,identity,forward,reverse,location,history,motion,journey,click,emit,flush,historyOnly,rafOnly,ended,reduced(v){motion.matches=v;motionEvents.change?.({matches:v})},timeouts(){for(const[id,f]of [...timers]){timers.delete(id);f()}},get active(){return activeElement},get writes(){return writes},get backCalls(){return backCalls}};
}


let seed=707419,transitions=0;const results=[];
function rnd(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
async function drain(){for(let n=0;n<6;n++)await Promise.resolve()}
function visible(x){return [x.still,x.buffer].filter(frame=>!frame.hidden)}
async function settleImages(x){for(const frame of [x.still,x.buffer]){if(frame.listeners.load?.length){frame.loadReady();}}for(const task of x.decodeTasks){task.resolve();}await drain();}
(async()=>{
for(let run=0;run<50;run++){
 const x=setup(['','#engine','#projects','#hackathons','#research','#captionverse'][run%6]);x.flush();const seq=[];
 for(let i=0;i<40;i++){
  const j=x.journey.getState();
  const choices=j.phase==='travelling'?['return','escape','skip','end','reduce','back','forward','load','error','decode']:['return','engine','projects','hackathons','research','caption','reduce','back','forward','load','error','decode'];
  const act=choices[rnd(choices.length)];seq.push(act);transitions++;
  try{
  if(act==='return')x.click(x.home);else if(act==='engine')x.click(x.opener);else if(act==='projects')x.click(x.projectLink);else if(act==='hackathons')x.click(x.hackLink);else if(act==='research')x.click(x.researchLink);else if(act==='caption')x.click(x.captionLink);else if(act==='escape')x.emit('keydown',{key:'Escape',preventDefault(){}});else if(act==='skip')x.click(x.skipMovement);else if(act==='end')x.ended(x.videoPairs[j.route][j.direction]);else if(act==='reduce')x.reduced(!x.motion.matches);else if(act==='back')x.history.back();else if(act==='forward')x.history.forward();
  else if(act==='load'||act==='error'){const frames=[x.still,x.buffer].filter(f=>f.hidden&&f.listeners.load?.length);if(frames.length){const f=frames[rnd(frames.length)];act==='load'?f.loadReady():f.loadFailed();}}
  else if(act==='decode'&&x.decodeTasks.length){const task=x.decodeTasks[rnd(x.decodeTasks.length)];rnd(3)?task.resolve():task.reject(Error('controlled decode error'));}
  x.flush();await drain();
  assert.equal(visible(x).length,1,'exactly one valid still should stay visible');assert.ok(visible(x)[0].complete&&visible(x)[0].naturalWidth>0,'the visible still must be usable');
  const playing=Object.values(x.videoPairs).flatMap(p=>[p.forward,p.reverse]).filter(v=>!v.hidden);assert.ok(playing.length<=1,'no overlapping visible route videos');
  if(x.journey.getState().phase!=='travelling'){
   const hash=x.location.hash,expected=hash==='#research'?'research':hash==='#hackathons'?'hackathons':['#projects','#captionverse'].includes(hash)?'projects':['#engine','#hamon-engine'].includes(hash)?'engine':'forge';
   for(const id of ['research','projects','hackathons'])assert.equal(!x[id].hidden,expected===id,'visible section must match the URL');
  }
  }catch(e){results.push({run,seq,error:e.message});break;}
 }
 // When every pending image succeeds, the final stable destination must win over all stale callbacks.
 if(x.journey.getState().phase==='travelling'){x.click(x.skipMovement);x.flush();await drain();}
 await settleImages(x);x.flush();await drain();
}
const receipt={transitions,failures:results,sha256:Object.fromEntries(['lobby-journey.js','scene-handoff.js','lobby.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(dir+'/'+f)).digest('hex')])),scope:'Independent controlled DOM/image load/decode events, mixed histories and three actual route pairs. No browser acceptance.'};
console.log(JSON.stringify(receipt,null,2));if(results.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
