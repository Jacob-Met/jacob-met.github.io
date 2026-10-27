/* Recorded native camera journeys with semantic, progressively enhanced work sections. */
(()=>{'use strict';
const body=document.body,still=document.querySelector('#scene-still'),forward=document.querySelector('#route-forward'),reverse=document.querySelector('#route-reverse'),heading=document.querySelector('#engine-heading'),travelUI=document.querySelector('.journey-ui'),travelLabel=document.querySelector('#journey-label'),skip=document.querySelector('#skip-journey'),presentation=document.querySelector('#presentation-label'),links=[...document.querySelectorAll('[data-engine]')];
if(typeof createLobbyJourney!=='function'||!still||!forward||!reverse||!heading)return;
const sections=[...document.querySelectorAll('.work-section')];
const routeMedia={engine:{forward,reverse}};
for(const video of document.querySelectorAll('video[data-route]')){const id=video.getAttribute('data-route'),direction=video.getAttribute('data-direction');if(['hackathons','projects'].includes(id)&&['forward','reverse'].includes(direction)){routeMedia[id]??={};routeMedia[id][direction]=video;}}
for(const id of ['hackathons','projects'])if(!routeMedia[id]?.forward||!routeMedia[id]?.reverse)delete routeMedia[id];
const allVideos=Object.values(routeMedia).flatMap(pair=>[pair.forward,pair.reverse]);
// Prime only the route the visitor approaches. No automatic media download on page load.
// The browser controls how much a metadata hint fetches; Save-Data disables the hint.
const primedRoutes=new Set(),primedStills=new Map();
function primeRoute(id){
 if(primedRoutes.has(id)||window.navigator?.connection?.saveData)return;
 const pair=routeMedia[id];if(!pair)return;primedRoutes.add(id);
 const video=pair.forward;
 if(video&&video.preload==='none'&&!(video.readyState>0)){
  video.preload='metadata';try{video.load();}catch{}
 }
 const src=still.getAttribute?.(id==='engine'?'data-arrival-src':`data-${id}-src`);
 if(src&&typeof Image==='function'){const image=new Image();image.decoding='async';primedStills.set(id,image);image.src=src;}
}
for(const link of document.querySelectorAll('a[href^="#"]')){
 const id=link.getAttribute('href')?.slice(1);if(!routeMedia[id]||typeof link.addEventListener!=='function')continue;
 for(const event of ['pointerenter','focus','touchstart'])link.addEventListener(event,()=>primeRoute(id),{passive:true});
}
const places={engine:'the hearth',hackathons:'the anvil',projects:'the workbench'},routeNames={engine:'Engine',hackathons:'Hackathons',projects:'Projects'};
const motion=matchMedia('(prefers-reduced-motion: reduce)');
// The visitor may choose network savings as well as reduced motion. Both select
// the already shipped still-image arrival instead of fetching a camera movie.
const connection=window.navigator?.connection;
const avoidRecordedJourney=()=>motion.matches||connection?.saveData===true;
let active=null,shownVideo=null,mediaEpoch=0,mediaTimer=null,opener=links.find(x=>!x.hasAttribute('data-skip')),target=null,leaving=false,reenterPending=null,viewEpoch=0,boot=true,journey,desiredSection=null;
function span(v){return Math.max(.001,v.duration-.05);}
function readProgress(){if(!active)return 0;const v=active.video;if(!Number.isFinite(v.duration)||!v.duration)return active.progress;return Math.max(0,Math.min(1,active.direction==='forward'?v.currentTime/span(v):1-v.currentTime/span(v)));}
function stop(){mediaEpoch++;if(mediaTimer)clearTimeout(mediaTimer);mediaTimer=null;if(active){const v=active.video;v.pause();v.onloadedmetadata=v.onended=v.onerror=null;}active=null;}
function play(segment,done,failed){
 const v=routeMedia[segment.route]?.[segment.direction];if(!v){failed();return;}const epoch=++mediaEpoch;active={...segment,video:v};if(shownVideo!==v)v.hidden=true;
 const current=()=>active?.video===v&&mediaEpoch===epoch;
 const fail=()=>{if(current())failed();};
 mediaTimer=setTimeout(fail,10000);
 v.onerror=fail;v.onended=()=>{if(current()&&v.ended&&v.currentTime>=v.duration-.075)done();};
 function begin(){if(!current())return;if(!Number.isFinite(v.duration)||v.duration<=0){fail();return;}const time=(segment.direction==='forward'?segment.progress:1-segment.progress)*span(v);
  try{v.currentTime=Math.max(0,Math.min(v.duration-.001,time));}catch{fail();return;}
  let result;try{result=v.play();}catch{fail();return;}
  Promise.resolve(result).then(()=>{if(current()){v.hidden=false;if(shownVideo&&shownVideo!==v)shownVideo.hidden=true;shownVideo=v;}else if(active?.video!==v)v.pause();}).catch(fail);
 }
 if(v.readyState>=1)begin();else{v.onloadedmetadata=begin;try{v.load();}catch{fail();}}
}
const buffer=document.querySelector('#scene-buffer');
let visibleStill=still,preparing=null,preparationEpoch=0;
function sceneSource(id){return (still.getAttribute?.(id===null?'data-entrance-src':id==='engine'?'data-arrival-src':`data-${id}-src`))||(id==='engine'?'assets/scene/forge-engine-arrival.png':'assets/scene/forge-lobby-entrance.png');}
function revealStill(frame,id){if(frame.getAttribute('src')!==sceneSource(id))return;frame.hidden=false;if(visibleStill!==frame)visibleStill.hidden=true;visibleStill=frame;body.setAttribute('data-scene',id||'forge');allVideos.forEach(v=>{v.hidden=true;});shownVideo=null;}
function prepareStill(id){
 const src=sceneSource(id);if(visibleStill.getAttribute('src')===src&&visibleStill.complete&&visibleStill.naturalWidth>0)return visibleStill;
 if(preparing?.src===src)return preparing.promise;
 preparing?.cancel();const frame=visibleStill===still?buffer:still,epoch=++preparationEpoch;let cancel;
 const promise=new Promise(resolve=>{let settled=false;
  const done=ok=>{if(settled)return;settled=true;frame.removeEventListener('load',loaded);frame.removeEventListener('error',failed);resolve(ok&&preparationEpoch===epoch?frame:null);};
  const loaded=()=>{if(typeof frame.decode==='function'){Promise.resolve(frame.decode()).then(()=>done(true),()=>done(frame.complete&&frame.naturalWidth>0));}else done(frame.complete&&frame.naturalWidth>0);};
  const failed=()=>done(false);cancel=failed;frame.addEventListener('load',loaded);frame.addEventListener('error',failed);frame.src=src;if(frame.complete&&frame.naturalWidth>0)loaded();
 });preparing={src,promise,cancel};promise.then(frame=>{if(!frame&&preparing?.promise===promise)preparing=null;});return promise;
}
const handoff=buffer&&typeof createSceneHandoff==='function'?createSceneHandoff({prepare:prepareStill,commit:revealStill}):null;
function scene(id){if(handoff){handoff.arrive(id);return;}still.src=sceneSource(id);if(still.complete&&still.naturalWidth>0)body.setAttribute('data-scene',id||'forge');else body.removeAttribute('data-scene');allVideos.forEach(v=>{v.hidden=true;});shownVideo=null;}
function sectionForHash(hash){
 let id;try{id=decodeURIComponent((hash||'').replace(/^#/,''));}catch{return null;}
 id=({about:'research',work:'projects',credits:'about-art'})[id]||id;
 const node=document.getElementById?.(id),section=node?.closest?.('.work-section');
 return section?{section,node:node===section?(section.querySelector('h2')||section):node,hash:id}:null;
}
function showSection(value){sections.forEach(section=>{section.hidden=section!==value?.section;});body.classList.toggle('section-view',!!value);if(value){let node=value.node.parentElement;while(node&&node!==value.section){if(node.tagName==='DETAILS')node.open=true;node=node.parentElement;}}}
function sectionRoute(value){const id=value?.section?.getAttribute('id');return ['projects','hackathons'].includes(id)?(routeMedia[id]?id:'engine'):null;}
function locationIntent(){const section=sectionForHash(location.hash);return ['#engine','#hamon-engine'].includes(location.hash)?{id:'engine',section:null}:{id:sectionRoute(section),section};}
function state(s){if(s.phase==='travelling'){handoff?.invalidate();body.removeAttribute('data-scene');}showSection(s.phase!=='travelling'?desiredSection:null);body.setAttribute('data-room',s.phase==='travelling'?'journey':desiredSection?.section?.getAttribute('id')||(s.phase==='arrived'?'engine':'forge'));body.classList.toggle('travelling',s.phase==='travelling');body.classList.toggle('arrived',s.phase==='arrived');travelUI.hidden=s.phase!=='travelling';if(s.phase!=='travelling')scene(s.phase==='arrived'?s.route:null);travelLabel.textContent=s.direction==='reverse'?`Returning from ${places[s.route]||'the forge'}`:`${routeNames[s.route]||'Engine'} · Approaching ${places[s.route]||'the hearth'}`;presentation.textContent=s.phase==='travelling'?'Prerecorded HAMON Engine route':desiredSection?.section?.getAttribute('id')==='research'?'Observe · Model · Question':'Forge rendered with HAMON Engine';document.title=desiredSection?`${desiredSection.section.querySelector('h2')?.textContent||'Work'} — Jacob Metoyer`:s.phase==='home'?'Jacob Metoyer — The forge':'Hamon Engine — Jacob Metoyer';links.forEach(a=>target==='engine'&&!desiredSection?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));document.querySelectorAll('.room-nav a').forEach(a=>a.getAttribute('href')==='#'+(desiredSection?.section?.getAttribute('id')||(target||'forge'))?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));}
function arrived(id){if(boot||leaving)return;const epoch=viewEpoch;window.scrollTo({top:0,behavior:'instant'});requestAnimationFrame(()=>{if(target!==id||viewEpoch!==epoch||leaving||journey.getState().phase!==(id===null?'home':'arrived'))return;const visible=e=>e?.isConnected&&e.getClientRects().length&&!e.closest('[hidden],[inert]');const focus=desiredSection?.node||(id==='engine'?heading:(visible(opener)?opener:document.querySelector('.identity')));if(desiredSection&&focus){if(!focus.hasAttribute('tabindex'))focus.setAttribute('tabindex','-1');if(focus!==desiredSection.section.querySelector('h2'))focus.scrollIntoView?.({block:'start',behavior:'instant'});}focus?.focus({preventScroll:true});});}
journey=createLobbyJourney({routes:Object.keys(routeMedia),reduceMotion:avoidRecordedJourney,readProgress,play,stop,onState:state,onArrive:arrived});
function write(hash,replace=false){try{const u=new URL(location.href);u.hash=hash;history[replace?'replaceState':'pushState']({portfolioLobby:true,view:hash,returnTo:location.hash},'',u);}catch{}}
function go(id,{instant=false,section=null}={}){viewEpoch++;handoff?.invalidate();handoff?.warm(id);desiredSection=section;target=id;leaving=false;const before=journey.getState();window.scrollTo({top:0,behavior:'instant'});if(instant)journey.jump(id);else journey.navigate(id);state(journey.getState());if(before.phase!=='travelling'&&before.target===id)arrived(id);}
function leave(){if(desiredSection&&!leaving){write('forge');go(null);return;}if(leaving){reenterPending=null;viewEpoch++;return;}if(target===null){if(desiredSection){write('forge');go(null);}return;}viewEpoch++;reenterPending=null;leaving=true;if(history.state?.portfolioLobby&&history.state.view==='engine'&&['','#forge','#intro'].includes(history.state.returnTo)){try{history.back();return;}catch{}}write('forge',true);go(null);}
links.forEach(a=>a.addEventListener('click',e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;e.preventDefault();if(!target&&!desiredSection)opener=e.currentTarget;if(leaving){viewEpoch++;reenterPending={id:'engine',instant:a.hasAttribute('data-skip')};return;}if(target==='engine'&&!desiredSection){if(a.hasAttribute('data-skip'))go('engine',{instant:true});else if(journey.getState().phase==='arrived')heading.focus({preventScroll:true});return;}write('engine');go('engine',{instant:a.hasAttribute('data-skip')});}));
[...document.querySelectorAll('[data-home]'),...document.querySelectorAll('a[href="#forge"]:not([data-home]),a[href="#intro"]:not([data-home])')].forEach(a=>a.addEventListener('click',e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;e.preventDefault();leave();}));
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
 if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;
 const section=sectionForHash(a.getAttribute('href'));if(!section)return;e.preventDefault();if(!target&&!desiredSection)opener=e.currentTarget;if(leaving){viewEpoch++;reenterPending={id:null,sectionHash:section.hash};return;}reenterPending=null;if(sectionForHash(location.hash)?.node!==section.node)write(section.hash);go(sectionRoute(section),{section});
}));
skip.addEventListener('click',()=>{viewEpoch++;if(leaving)reenterPending={id:'engine',instant:true};else journey.jump(target);});
window.addEventListener('popstate',()=>{const again=reenterPending;reenterPending=null;leaving=false;if(again){if(again.id===null){const section=sectionForHash(again.sectionHash);if(section){if(location.hash!=='#'+section.hash)write(section.hash);go(sectionRoute(section),{section});}else go(null);}else{if(!['#engine','#hamon-engine'].includes(location.hash))write('engine');go('engine',again);}}else{const intent=locationIntent();go(intent.id,{section:intent.section});}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&(target||desiredSection)&&!e.defaultPrevented){e.preventDefault();leave();}});
const reduce=()=>{if(avoidRecordedJourney())journey.jump(target);};motion.addEventListener?.('change',reduce);connection?.addEventListener?.('change',reduce);
body.classList.add('enhanced');const initial=locationIntent();target=initial.id;desiredSection=initial.section;journey.jump(target);state(journey.getState());boot=false;if(desiredSection||target)arrived(target);
window.addEventListener('pagehide',e=>{if(e.persisted)journey.jump(target);else{journey.destroy();stop();handoff?.destroy();preparing?.cancel();}});
})();
