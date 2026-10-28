import {intertidalAttachments,createIntertidalLife} from './intertidal-habitat.mjs';
import {intertidalFaces,createIntertidalArt} from './intertidal-art.mjs';
import {mapEntryView} from './map-entry-view.mjs';
import {mountContextEnrichment} from './context-enrichment-view.mjs';
import {deriveUrbanHabitatDetail} from './urban-habitat-detail.mjs';
import {createRainField} from './rain-field.mjs';
import {createResidentFocus,residentView} from './resident-focus.mjs';
import {createCrawlerFocusRules} from './crawler-focus.mjs';
import {flightSegmentClear} from './flight-path.mjs';
import {birdForagingSites} from './bird-foraging.mjs';
import {mountLocationContext} from './location-context-view.mjs';
import {mountEcologyDiscovery} from './ecology-discovery-view.mjs';
import {createFrameLoop} from './frame-loop.mjs';
import {createPausedObservationClock} from './paused-observation-clock.mjs';
import {createOverviewZoom} from './overview-zoom.mjs';
import {createOverviewPan,overviewKeyboardDrag} from './overview-pan.mjs';
import {downloadRenderedPNG} from './visit-picture.mjs';
import {createShadowReuseGuard} from './shadow-reuse-guard.mjs';
import {prepareWorldContact} from './surface-contact-art.mjs';
import * as THREE from '../vendor/three.module.js';
import {createPlace,placeAtRevision,admitObservation} from './place.mjs';
import {createExamplePlace} from './example-place.mjs';
import {createNavigator,fitOverview,captureVisit,resolveVisit,admitCameraViewpoint,MODES} from './visits.mjs';
import {createUrbanBirdHabitat} from './urban-bird-habitat.mjs';
import {createHabitatSimulation} from './habitat.mjs';
import {createCrawlerSimulation,CRAWLER_BODY} from './crawler.mjs';
import {createCrawlerArt} from './crawler-art.mjs';
import {createSalamanderSimulation,SALAMANDER_BODY} from './salamander-motion.mjs';
import {createSalamanderArt} from './salamander-art.mjs';
import {createOrbWeaver,nearestSilkPoint} from './orb-web.mjs';
import {createOrbWebArt} from './orb-web-art.mjs';
import {createPondSkater} from './pond-skater.mjs';
import {createPondSkaterArt} from './pond-skater-art.mjs';
import {createWaterColumn,createSubmergedLife,freshwaterWaterSurfaces} from './submerged-habitat.mjs';
import {createSubmergedArt} from './submerged-art.mjs';
import {createSubmergedView} from './submerged-view.mjs';
import {buildWorldArt,createBirdArt} from './world-art.mjs';
import {batchStaticWorld} from './static-batch.mjs';
import {createSoundscape} from './soundscape.mjs';
import {mountObservationEditor} from './observation-editor.mjs';
import {mountSourceRevisit} from './source-revisit.mjs';
import {recoverSourceCamera} from './source-camera.mjs';
import {mountTransferView} from './transfer-view.mjs';
import {commitTransfer} from './transfer.mjs';
import {createSessionStore,defaultSession,removePlaceSource,discardEmptyPlace,SESSION_KEY} from './session.mjs';
import {listKeptMoments,replacementChoices,admitKeptMoment} from './moment-library.mjs';
import {mountHamonView,wantsHamon} from './hamon-view.mjs';
import {createMobile,webgpuNotice} from './mobile.mjs';
import {hamonResidents,residentLine} from './hamon-residents.mjs';
import {buildPlacesList} from './places-list.mjs';
import {LIVE_PLACES,liveIdOf,createLiveImaginedPlace,liveWalkWorld} from './hamon-places.mjs';
import {registerControl,refreshControls,controlSlot} from './controls.mjs';
import {mountWorldDrawer,mountVisitChrome} from './visit-chrome.mjs';
import {createEmbodiment} from './embody.mjs';
import {mountEmbodyUI} from './embody-ui.mjs';
import {createGamepad} from './gamepad.mjs';
import {createSettings} from './settings.mjs';
import {registerSettingsControls} from './settings-controls.mjs';
import {WORLD_SECTIONS,SETTINGS_SECTIONS} from './controls.mjs';
import {registerPlace} from './places-registry.mjs';
import {mountPlacesPicker} from './places-picker.mjs';
const $=id=>document.getElementById(id), el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const uid=prefix=>`${prefix}-${crypto.randomUUID()}`;
let store,session,saveFault=null,frameLoop=null,placesPicker=null,pausedObservation=null;
const requestWorldFrame=()=>{pausedObservation?.sync();frameLoop?.invalidate();};
try{store=createSessionStore(localStorage);session=store.load();}catch(e){saveFault=e.message;session=defaultSession();}
let place=session.places.find(p=>p.id===session.activePlaceId),displayPlace=place,historical=false;
let simContext=null,crawlerContext=null,crawler=null,crawlerArt=null,crawlerNear=false;
let salamanderContext=null,salamander=null,salamanderArt=null;
let orbWeaver=null,orbArt=null,orbContext=null,webFocus=false;
let pondSkater=null,skaterArt=null,skaterContext=null,skaterFocus=false;
let intertidalLife=null,intertidalArt=null,intertidalContext=null,anemoneFocus=false;
let submergedLife=null,submergedArt=null,submergedView=null,submergedContext=null,underwaterFocus=false;
function leaveUnderwater(){underwaterFocus=false;submergedView?.clear();}
let art,sim,nav,bird,frameCount=0,worldTime=0,rain=false,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,overview=true;
let pictureSerial=0,picturePending=null,pictureSaving=false;
function cancelPicture(){pictureSerial++;picturePending=null;pictureSaving=false;const button=$('save-view-image');if(button)button.disabled=false;}
let editor=null,toastTimer,worldReady=false,orbit=0,pointer=null,pendingMode=null,focusFov=null,sourceView=null;
const overviewZoom=createOverviewZoom(),overviewPan=createOverviewPan(),overviewTouches=new Map();let lastPinchDistance=null,lastPinchCenter=null;
let birdFocus=null,crawlerFocus=null;
function releaseResidentFocus(){anemoneFocus=false;if(birdFocus||crawlerFocus){birdFocus=null;crawlerFocus=null;if(sim)updateEncounter();}}

const pressed=new Set(),touch={},padTouch={};
const soundscape=createSoundscape(),soundForward=new THREE.Vector3(),soundUp=new THREE.Vector3();
const syncSoundState=()=>soundscape.setPaused(paused||underwaterFocus).catch(()=>{});
function notify(message,persistent=false){$('status').textContent=message;$('status').classList.add('visible');clearTimeout(toastTimer);if(!persistent)toastTimer=setTimeout(()=>$('status').classList.remove('visible'),6500);}
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch(e){$('world').append(el('div','This browser could not open the 3D world. Use a browser with WebGL 2 enabled. Your saved places are unchanged.','panel-body'));throw e;}
const mobile=createMobile({world:$('world'),onChange:()=>requestWorldFrame(),canPinch:()=>!overview&&!sourceView&&!$('panel').open});
renderer.setPixelRatio(mobile.pixelRatio(Math.min(devicePixelRatio,1.5)));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.shadowMap.enabled=true;renderer.shadowMap.type=mobile.active?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
$('world').append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Living garden scene');
// HAMON Engine renderer (WebGPU, or WebGL2 without it). three.js keeps the scene graph and is the last resort.
// World drawer: features register controls (src/controls.mjs); the drawer gives them one home.
const worldDrawer=mountWorldDrawer({drawer:$('world-drawer'),toggle:$('world-toggle'),close:$('world-drawer-close'),sectionsRoot:$('drawer-sections'),sections:WORLD_SECTIONS,isBlocked:()=>$('panel').open});
const settingsDrawer=mountWorldDrawer({drawer:$('settings-drawer'),toggle:$('settings-toggle'),close:$('settings-close'),sectionsRoot:$('settings-sections'),sections:SETTINGS_SECTIONS,isBlocked:()=>$('panel').open});
mountVisitChrome({panel:$('panel'),drawer:{get isOpen(){return worldDrawer.isOpen||settingsDrawer.isOpen;}}});
const settings=createSettings();
const applyRenderScale=()=>{renderer.setPixelRatio(mobile.pixelRatio(Math.min(devicePixelRatio,1.5))*settings.get().renderScale);renderer.setSize(innerWidth,innerHeight);hamon?.resize?.();requestWorldFrame();};
registerSettingsControls(settings,{onChange:()=>{applyRenderScale();updateViewCameraSafe();}});
function updateViewCameraSafe(){try{if(worldReady)requestWorldFrame();}catch{}}
let hamonState=null,hamonNoticeShown=false; // declared before mountHamonView: without WebGPU it reports failure synchronously
const hamon=wantsHamon()?mountHamonView($('world'),{budget:mobile.active?mobile.profile.pixels:undefined,quality:mobile.active?mobile.profile:undefined,onState:s=>updateLookPicker(s),skyContainer:controlSlot('time'),requestFrame:()=>requestWorldFrame()}):null;
if(hamon)registerControl({id:'hamon-look',section:'style',order:0,when:()=>!!hamonState&&hamonState.phase!=='failed'&&hamonState.looks.length>0,
 mount({container,kit}){
  const options=()=>(hamonState?.looks??[]).map(l=>({value:l.id,label:l.name,hint:l.summary}));
  const c=kit.choice({label:'Rendering style',options:options(),value:hamonState?.look,onChange:id=>{if(hamon.setLook(id))requestWorldFrame();}});
  c.element.id='look-picker';container.append(c.element);let shown=0;
  return {update(){const list=options();if(list.length!==shown){shown=list.length;c.setOptions(list,hamonState?.look);}else c.set(hamonState?.look);}};
 }});
function updateLookPicker(s){
 hamonState=s;hamonResidents.setVisible(!!hamon&&s.phase==='ready');refreshControls();try{registerCorePlaces();}catch{}
 if(s.phase==='failed'&&s.error&&!hamonNoticeShown){hamonNoticeShown=true;notify(/WebGPU is not available/i.test(s.error)?webgpuNotice(s.error,mobile.device,navigator.userAgent):'Wildside is showing its standard view here: this device can’t draw the painted view just now. Your place is unchanged.');}
}
function hamonContext(){return {sim,bird,crawler,crawlerArt,salamander,salamanderArt,orbWeaver,orbArt,pondSkater,skaterArt,submergedLife,submergedArt,nav:momentPreview?{pose:()=>momentPreview}:nav,place:displayPlace,art,embody};}
// Watch or become an animal (embody.mjs). The host supplies the simulation and applies the camera.
const embodyRay=new THREE.Raycaster();
const embodyProbe=new THREE.Vector3();
let embodyClock=0;
let momentPreview=null,momentPreviewCanvas=null,lastEmbodiedView=null,viewGeneration=0;
let observationGeneration=0,observedGeneration=-1,observationContextLost=false,observationPageActive=true;
const embody=createEmbodiment({
  context:()=>({sim,nav,groundAt:art?.groundAt,crawler,salamander,pondSkater,orbWeaver,submergedLife,hamon}),
 hamonActive:()=>!!hamon?.active,
 occlude:(from,to,{foliage=false}={})=>{
  const d=to.map((v,i)=>v-from[i]),length=Math.hypot(...d);if(length<1e-9||!art)return null;
  embodyRay.set(new THREE.Vector3(...from),new THREE.Vector3(...d).normalize());embodyRay.near=.001;embodyRay.far=length;
  // Leaves and blades are not walls: a camera may pass through foliage, never through trunks, walls or ground.
  const solid=embodyRay.intersectObjects(art.group.children,true).find(h=>foliage||(!h.object.isInstancedMesh&&!(h.object.material&&!Array.isArray(h.object.material)&&h.object.material.side===THREE.DoubleSide)))?.distance??null;
  // The Engine's tree crowns are drawn only on the GPU; an animal is seen from within a leaf's reach of it, or from outside the crown.
  let crown=null;
  if(foliage&&hamon?.active&&hamon.trees.length){
   if(inCrown(hamon.trees,...from))crown=Math.min(.55,length);
   else for(let i=1;i<=48&&crown===null;i++){const t=i/48;if(inCrown(hamon.trees,from[0]+d[0]*t,from[1]+d[1]*t,from[2]+d[2]*t))crown=length*t;}
  }
  return solid===null?crown:crown===null?solid:Math.min(solid,crown);
 },
 project:p=>{embodyProbe.fromArray(p).project(camera);const rect=$('world').getBoundingClientRect();return {x:rect.left+(embodyProbe.x+1)/2*rect.width,y:rect.top+(1-embodyProbe.y)/2*rect.height,visible:embodyProbe.z>-1&&embodyProbe.z<1};},
 storage:(()=>{try{return localStorage;}catch{return null;}})(),
 onActive:on=>{
  lastEmbodiedView=null;viewGeneration++;
  if(on){releaseResidentFocus();leaveUnderwater();webFocus=false;skaterFocus=false;sourceView=null;overview=false;focusFov=null;pendingMode=null;pressed.clear();Object.keys(touch).forEach(k=>delete touch[k]);Object.keys(padTouch).forEach(k=>delete padTouch[k]);if($('panel').open)closePanel();worldDrawer.close?.();embodyClock=0;}
  else{overview=true;}
  updateLabels();requestWorldFrame();
 },
 onChange:()=>{observationGeneration++;requestWorldFrame();embodyUI.sync();},
 onUnlock:({creature,beat})=>{embodyUI?.unlocked(beat.id);notify(`A new moment in the ${creature}\u2019s story: ${beat.title}`);},
});
const embodyUI=mountEmbodyUI(embody,{notify,onKeep:keepMoment,canKeep:()=>!historical});
// Attentive watching can reveal a story while the simulation and renderer stay still.
pausedObservation=createPausedObservationClock({
 enabled:()=>worldReady&&paused&&observationPageActive&&!document.hidden&&!observationContextLost&&embody.mode==='outside',
 target:()=>{
  if(!embody.canObserveTime()||$('panel').open||worldDrawer.isOpen||settingsDrawer.isOpen||!$('places').hidden||
     momentPreview||sourceView||document.body.matches('.arriving,.travelling')||
     observedGeneration!==observationGeneration||!lastEmbodiedView||
     lastEmbodiedView.generation!==viewGeneration||lastEmbodiedView.placeId!==displayPlace.id||
     lastEmbodiedView.revision!==displayPlace.revision||lastEmbodiedView.creature!==embody.creature)return null;
  return JSON.stringify([displayPlace.id,displayPlace.revision,displayPlace.epoch??0,embody.creature,observationGeneration,viewGeneration]);
 },
 observe:dt=>{const accepted=embody.observeTime(dt);if(accepted)embodyUI.refreshObservation();return accepted;},
});
// Observe existing visibility state without changing drawer or Places behavior.
const observationVisibility=new MutationObserver(()=>pausedObservation.sync());
observationVisibility.observe(document.body,{attributes:true,attributeFilter:['class']});
observationVisibility.observe($('places'),{attributes:true,attributeFilter:['hidden']});
// Simulated residents and the third-person traveller (HAMON view only; see hamon-residents.mjs).
let residentEncounter=null;
if(hamon){hamonResidents.onChange=()=>syncHamonWorld();
 registerControl({id:'hamon-residents',section:'life',order:5,when:()=>!!hamonState&&hamonState.phase==='ready',mount({container}){hamonResidents.mount(container);return {update(){hamonResidents.refresh();}};}});}
function hamonDynamicRoots(){return [bird,crawlerArt,salamanderArt,orbArt,skaterArt,submergedArt,intertidalArt].filter(Boolean).map(a=>({group:a.group,role:'creature'}));}
function syncHamonWorld(){if(!hamon&&liveIdOf(displayPlace))notify('This imagined place is drawn by the HAMON Engine, which needs WebGPU or WebGL2 — this browser offers neither (or the painted view is turned off; ?hamon=1 turns it back on).');if(hamon&&art)void hamon.ready.then(ok=>{if(ok&&art){const shown=hamon.setWorld(art,displayPlace,hamonDynamicRoots(),hamonContext());return Promise.resolve(shown).then(()=>{adoptLiveWalk();if(ok)hamon.setRain(rain);requestWorldFrame();});}if(ok)hamon.setRain(rain);requestWorldFrame();});}
// An Engine live place (hamon-places.mjs): walk its own ground, buildings and trunks, not the token patch Wildside built.
function adoptLiveWalk(){
 const live=hamon?.livePlace();if(!live||!art||!liveIdOf(displayPlace))return;
 const w=liveWalkWorld(live.walk,live.heights);
 art.group.visible=false;Object.assign(art,{bounds:w.bounds,obstacles:w.obstacles,surfaceAt:w.surfaceAt,groundAt:w.groundAt,groundCoverageRequired:true,surfaceContact:undefined,liveStart:w.start});
 const old=nav?.pose();nav=createNavigator(world(),{mode:old?.mode||'human',position:[w.start.position[0],w.start.position[1]+(MODES[old?.mode||'human'].eye),w.start.position[2]],yaw:w.start.yaw,pitch:-.06});
 crawler?.setWorld?.(world());updateLabels();
}
async function activatePlace(next,message,request=null,expectedSequence=session.sequence){
 const saved=await changeSession(s=>({...s,places:s.places.some(p=>p.id===next.id)?s.places:[...s.places,next],activePlaceId:next.id}),{request,expectedSequence});
 if(saved===false||(request&&!request.isCurrent()))return false;
 displayPlace=place;historical=false;rebuild(place);overview=true;updateLabels();closePanel();if(message)notify(message);
 return true;
}
/** The "Places" list for the controls registry (src/places-list.mjs): window.__wildsidePlaces(). */
const placesActions={
 hamonAvailable:()=>!!hamon&&['waiting','ready'].includes(hamon.state().phase),
 courtyard:request=>activatePlace(session.places.find(p=>p.id==='imagined-courtyard')??createExamplePlace(),'An imagined courtyard. Its life is simulated.',request),
 kyoto:async request=>{const expectedSequence=session.sequence;const r=await fetch('data/kyoto-public-block.json');if(!r.ok)throw Error('The bundled public map is unavailable.');const {parseTransfer}=await import('./transfer.mjs');const parsed=await parseTransfer(await r.text());if(parsed.data.places.length!==1)throw Error('The bundled map has an unsupported layout.');return activatePlace(parsed.data.places[0],'A Kyoto block from public map data, with imagined life.',request,expectedSequence);},
 live:(id,request)=>openLiveImagined(id,request),
};
export const getPlacesList=()=>buildPlacesList(placesActions);
window.__wildsidePlaces=getPlacesList;
window.__wildsideSetLook=id=>hamon?.setLook(id)&&(requestWorldFrame(),true);
async function openLiveImagined(id,request=null){
 return activatePlace(createLiveImaginedPlace(id),'An imagined place, composed by the HAMON Engine. Its wildlife is simulated. Choose Human, Bird or Insect to step in.',request);
}
const scene=new THREE.Scene();scene.background=new THREE.Color('#d8e3cb');scene.fog=new THREE.FogExp2('#d8e3cb',.023);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.02,150);
const sky=new THREE.HemisphereLight('#fbf5d6','#667655',2.1);scene.add(sky);
const sun=new THREE.DirectionalLight('#fff0c7',3.5);sun.position.set(5,11,7);sun.castShadow=true;sun.shadow.mapSize.set(mobile.profile.shadow,mobile.profile.shadow);sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;sun.shadow.camera.near=.1;sun.shadow.camera.far=40;sun.shadow.bias=-.00015;sun.shadow.normalBias=.02;scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight('#b3d9d4',.6);fill.position.set(-7,4,-8);scene.add(fill);
let shadowReuse=createShadowReuseGuard(THREE);
let shadowResourceEpoch=0;
let worldFogDensity=.023;
const shadowCache={refreshRenders:0,reuses:0,commits:0,lastReason:'not rendered'};
window.__wildsideShadowInspect=()=>({...shadowCache,resourceEpoch:shadowResourceEpoch});
renderer.shadowMap.autoUpdate=false;
const rainGeo=new THREE.BufferGeometry(),rainPoints=new Float32Array(240*6);rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPoints,3));const rainLines=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#dbe9df',transparent:true,opacity:.58,depthWrite:false}));rainLines.visible=false;scene.add(rainLines);
// Drops move through the bounded local field, so a cached geometry sphere from
// the first rainy viewpoint must never hide later fields after a long walk.
rainLines.frustumCulled=false;
let rainField=null,rainFieldStats={segments:0,supportQueries:0,cachedColumns:0};
const rainRay=new THREE.Raycaster(),rainDown=new THREE.Vector3(0,-1,0);
function rainSupportAt(x,z){
 rainRay.set(new THREE.Vector3(x,art.bounds.max[1]+1,z),rainDown);
 rainRay.near=0;rainRay.far=art.bounds.max[1]-art.bounds.min[1]+2;
 // Query the actual static world, including finite water and source roof forms.
 // The field caches at most 75 columns and queries only newly entered columns.
 return rainRay.intersectObject(art.group,true)[0]?.point.y??art.surfaceAt(x,z);
}
const cameraTarget=new THREE.Vector3();
function world(){return {bounds:art.bounds,obstacles:art.obstacles,groundAt:art.groundAt,surfaceAt:art.surfaceAt,groundCoverageRequired:art.groundCoverageRequired,surfaceContact:art.surfaceContact};}
// An imagined large salamander on the bank: the authored slow crawl of salamander-motion.mjs, on supported ground near water.
function salamanderWorld(){return {surfaceAt:art.surfaceAt,bounds:art.bounds,obstacles:art.obstacles,routeXZ:[]};}
function spawnSalamander(p){
 const candidates=[],{min,max}=art.bounds;
 for(const a of p.anchors??[])if(a.kind==='water')for(let k=0;k<16;k++){const t=k/16*Math.PI*2,r=Math.max(a.size[0],a.size[2])*.5+.55;candidates.push([a.position[0]+Math.cos(t)*r,a.position[2]+Math.sin(t)*r,t]);}
 for(let z=0;z<9;z++)for(let x=0;x<9;x++)candidates.push([min[0]+(max[0]-min[0])*(x+.5)/9,min[2]+(max[2]-min[2])*(z+.5)/9,(x*7+z*3)%6]);
 for(const [x,z,yaw] of candidates){const y=art.surfaceAt(x,z);if(y===null)continue;
  try{const sim=createSalamanderSimulation(salamanderWorld(),{position:[x,y+SALAMANDER_BODY.clearance,z],yaw,seed:17,initialRest:3});if(sim.snapshot().salamander.state!=='unplaced')return sim;}catch{}}
 return null;
}
function spawnGroundCrawler(p){
 const candidates=[];
 for(const a of p.anchors)if(['ground','path'].includes(a.kind))candidates.push([a.position[0]+a.size[0]*.22,a.position[2]+a.size[2]*.22],[a.position[0],a.position[2]]);
 for(const o of p.observations)if(o.controlPoints?.length)candidates.push([0,1].map(axis=>o.controlPoints.reduce((sum,c)=>sum+c.ground[axis],0)/o.controlPoints.length));
 const selected=candidates.slice(0,64),{min,max}=art.bounds;
 for(let z=0;z<12;z++)for(let x=0;x<12;x++)selected.push([min[0]+(max[0]-min[0])*(x+.5)/12,min[2]+(max[2]-min[2])*(z+.5)/12]);
 for(const [x,z] of selected){const y=art.surfaceAt(x,z);if(y===null)continue;const candidate=createCrawlerSimulation(world(),{position:[x,y+CRAWLER_BODY.clearance,z],yaw:.7,seed:91});if(candidate.snapshot().crawler.state!=='unplaced')return candidate;}
 return null;
}
function updateEncounter(){
 if(!sim)return;
 if(liveIdOf(displayPlace)){$('encounter').hidden=true;return;} // an Engine place's own wildlife is drawn by the Engine
 const robin=sim.snapshot().bird,beetle=crawler?.snapshot().crawler;
 const hasBird=robin.state!=='unplaced',hasBeetle=!!beetle&&beetle.state!=='unplaced';
 const web=orbWeaver?.snapshot(),hasWeb=!!web?.web;
 const skater=pondSkater?.snapshot().skater,hasSkater=skater&&skater.state!=='unplaced';
 const aquatic=submergedLife?.snapshot().swimmers[0],hasAquatic=!!aquatic;
 if(!hasAquatic&&!submergedView?.pose())leaveUnderwater();
 if(!hasSkater)skaterFocus=false;
 if(!hasWeb)webFocus=false;
 $('discover-ecology').textContent=anemoneFocus?'Coastal sources':'Its story';
 const small=(!overview&&nav.pose().mode==='insect')||robin.state==='unplaced';
 const inhabitant=underwaterFocus?aquatic:skaterFocus?skater:webFocus?web.spider:small?beetle:robin;
 const neutralEncounter=!underwaterFocus&&!skaterFocus&&!webFocus&&(!inhabitant||inhabitant.state==='unplaced');
 $('discover-ecology').hidden=neutralEncounter;
 $('encounter').hidden=(!inhabitant||inhabitant.state==='unplaced')&&!hasWeb&&!hasSkater&&!hasAquatic;
 $('encounter-title').textContent=underwaterFocus?'A world within the water':skaterFocus?'On a silver surface':webFocus?'A world held by silk':small?'Between the stems':['foraging','hopping'].includes(robin.activity)?'A closer look at the ground':'A pause between flights';
 $('bird-state').textContent=underwaterFocus&&!hasAquatic?'A kept underwater viewpoint':`Simulated ${underwaterFocus?'water flea':skaterFocus?'water strider':webFocus?'orb-weaver':small?'ground beetle':'robin'} · ${inhabitant?.activity==='hopping'?'hopping':inhabitant?.activity==='foraging'?'searching':inhabitant?.state.replaceAll('-',' ')||'no supported ground'}`;
 $('watch-bird').textContent=birdFocus?'Stop following':'Look closer';$('watch-bird').setAttribute('aria-pressed',String(!!birdFocus));$('watch-bird').hidden=!hasBird||small||webFocus||skaterFocus||underwaterFocus;$('watch-crawler').hidden=!hasBeetle||!small||webFocus||skaterFocus||underwaterFocus;
 if(neutralEncounter){$('encounter-title').textContent='Life nearby';$('bird-state').textContent='Simulated life · Choose a nearby inhabitant to look closer.';}
 embodyUI.bindEncounter($('become-creature'),underwaterFocus?(hasAquatic?'flea':null):skaterFocus?'skater':webFocus?'spider':small?(beetle&&beetle.state!=='unplaced'?'beetle':null):robin.state!=='unplaced'?'robin':null);
 $('watch-underwater').hidden=!hasAquatic;$('watch-underwater').textContent=underwaterFocus?'Find the swimmers':'Underwater';
 $('watch-skater').hidden=!hasSkater;$('ripple-water').hidden=!hasSkater||!skaterFocus;
 $('watch-skater').textContent=skaterFocus?'Find the skater':'On the water';
 if(webFocus&&web.awareness?.responding){$('bird-state').textContent=`Simulated neighbors · ${web.spider.reason}`;}
 else if(webFocus&&web.encounter?.visible){const visitor=web.encounter;const activity=visitor.phase==='flying'?'A winged visitor drifts past':visitor.phase==='escaping'?'The visitor slips free':web.spider.reason;$('bird-state').textContent=`Simulated life · ${activity}`;}
 $('watch-web').hidden=!hasWeb;$('watch-spider').hidden=!hasWeb||!webFocus;
 $('watch-visitor').hidden=!hasWeb||!webFocus||!web.encounter?.visible;
 $('watch-visitor').textContent=['flying','escaping'].includes(web.encounter?.phase)?'Meet the visitor':'Look at the catch';
 // HAMON view: a simulated resident nearby in Human view takes the card (labelled simulated)
 residentEncounter=hamon?.active&&!overview&&!webFocus&&!skaterFocus&&!underwaterFocus&&!birdFocus&&nav.pose().mode==='human'?hamonResidents.encounter(camera):null;
 if(residentEncounter){$('discover-ecology').hidden=false;$('encounter').hidden=false;$('encounter-title').textContent={squirrel:'A life up and down the trunk',songbird:'Voices in the crown',rabbit:'Out on the grass',butterfly:'Among the flowers',gull:'Over open water'}[residentEncounter.kind];$('bird-state').textContent=residentLine(residentEncounter);$('watch-bird').hidden=true;$('watch-crawler').hidden=true;}
 $('brush-web').hidden=!hasWeb||!webFocus;$('brush-web').disabled=paused;
 $('brush-web').title=paused?'Resume simulated life to brush a strand':'Send a ripple along the silk';
 if(anemoneFocus){const a=intertidalLife?.snapshot().residents[0];if(a){$('discover-ecology').hidden=false;$('encounter').hidden=false;$('encounter-title').textContent='Held to the rocky shore';$('bird-state').textContent=`Illustrative anemone · ${a.wet?'opening under water':'contracted on an exposed shelf'}`;$('watch-bird').hidden=true;$('watch-crawler').hidden=true;$('become-creature').hidden=true;}}
 $('watch-crawler').textContent=crawlerFocus?'Stop following':'Look closer';$('watch-crawler').setAttribute('aria-pressed',String(!!crawlerFocus));
 $('navigation-hint').textContent=touchHint(overview&&!sourceView?'Drag to orbit · Shift-drag, Shift+Arrow or two fingers to pan · Scroll or pinch to zoom':crawlerFocus?'Following the beetle · Drag or move to explore · Esc for overview':birdFocus?'Following the robin · Drag or move to explore · Esc for overview':underwaterFocus?'Drag to look · W A S D to swim · E / Q to rise / sink · Esc to surface':webFocus?'Tap a strand · Drag to look · W A S D to move · Esc for overview':(nav.pose().mode==='bird'?'Drag to look around · W A S D to fly · E / Q for up and down · Esc to step back':'Drag to look around · W A S D to walk · Esc to step back'));
 $('watch-web').textContent=webFocus?'See the whole web':'Find a web';
}
function safeStart(mode='human'){
 const b=art.bounds,cx=(b.min[0]+b.max[0])/2,cz=(b.min[2]+b.max[2])/2,eye=mode==='human'?1.62:mode==='insect'?.018:2.8;
 if(art.liveStart){const [x,,z]=art.liveStart.position,g=art.groundAt(x,z),test=createNavigator(world(),{mode,position:[x,g+eye,z],yaw:art.liveStart.yaw,pitch:mode==='insect'?.10:-.06});if(test.restore(test.pose()).ok)return test;}
 // Public maps can include a long road beyond the buildings. Arrive on a mapped
 // street near the requested origin rather than at the outermost map edge.
 const mapped=displayPlace.anchors.some(a=>a.mapGeometry),roadStarts=[];
 if(mapped)for(const surface of art.surfaces){
  if(surface.kind!=='path'||!surface.id.includes(':map:'))continue;
  const points=surface.polygonXZ;
  for(const triangle of THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(...p)),[])){
   const center=triangle.reduce((sum,i)=>[sum[0]+points[i][0]/3,sum[1]+points[i][1]/3],[0,0]);
   roadStarts.push([center[0],eye,center[1]]);
  }
 }
 roadStarts.sort((a,b)=>Math.hypot(a[0],a[2])-Math.hypot(b[0],b[2]));
 const choices=[...roadStarts,[cx,eye,b.max[2]-.5],[cx+1,eye,cz+2],[b.min[0]+.5,eye,b.max[2]-.5],[cx,eye,cz]];
 for(let iz=0;iz<5;iz++)for(let ix=0;ix<5;ix++)choices.push([b.min[0]+.3+(b.max[0]-b.min[0]-.6)*ix/4,eye,b.min[2]+.3+(b.max[2]-b.min[2]-.6)*iz/4]);
 for(const position of choices){
  const test=createNavigator(world(),{mode,position,yaw:0,pitch:mode==='insect'?.10:-.06});
  if(!test.restore(test.pose()).ok)continue;
  if(mapped&&roadStarts.includes(position)){
   // Face along the longest clear mapped street direction, not a nearby wall.
   let bestYaw=0,bestDistance=-1;
   for(let i=0;i<32;i++){
    const yaw=i*Math.PI/16;let distance=0;
    for(let step=1;step<=20;step++){
     const candidate=[position[0]+Math.sin(yaw)*step,position[1],position[2]-Math.cos(yaw)*step];
     if(art.surfaceAt(candidate[0],candidate[2])===null||!test.restore({mode,position:candidate,yaw,pitch:0}).ok)break;
     distance=step;
    }
    if(distance>bestDistance){bestDistance=distance;bestYaw=yaw;}
   }
   test.restore({mode,position,yaw:bestYaw,pitch:mode==='insect'?.10:-.06});
   // A clear road ray can face away from every acquired building. Preserve the
   // admitted street position, but let human arrivals see surviving map geometry.
   if(mode==='human'){const view=mapEntryView(test.pose().position,displayPlace.anchors);if(view)test.restore({...test.pose(),yaw:view.yaw,pitch:view.pitch});}
  }
  return test;
 }
 return null;
}
/** A public-map place opens from a few metres up, looking along the street, so the buildings, street and sky read at once. */
function enterMapVantage(){
 try{
  const ground=safeStart('human');if(!ground)return false;
  const p=ground.pose(),pos=[p.position[0],p.position[1]-MODES.human.eye+8,p.position[2]];
  const probe=createNavigator(world(),{mode:'bird',position:pos,yaw:-2.05,pitch:-.5});
  if(!probe.restore(probe.pose()).ok)return false;
  releaseResidentFocus();leaveUnderwater();webFocus=false;skaterFocus=false;sourceView=null;focusFov=null;
  nav=probe;overview=false;pendingMode=null;updateLabels();$('world').focus({preventScroll:true});return true;
 }catch{return false;}
}
function rebuild(p,{keepPose=false}={}){
 momentPreview=null;momentPreviewCanvas=null;lastEmbodiedView=null;viewGeneration++;
 overviewZoom.reset();overviewPan.reset();overviewTouches.clear();lastPinchDistance=null;lastPinchCenter=null;pointer=null;
 releaseResidentFocus();
 embody.exit();
 cancelPicture();
 soundscape.reset();
 leaveUnderwater();
 webFocus=false;
 skaterFocus=false;
 sourceView=null; // Source camera belongs to a particular calibrated evidence revision.
 const old=nav?.pose();if(art){scene.remove(art.group);art.dispose();}art=buildWorldArt(p,{rain});batchStaticWorld(art.group);scene.add(art.group);Object.assign(art,prepareWorldContact(art.group));let contactNotice=document.getElementById('surface-contact-notice');if(!contactNotice){contactNotice=el('p');contactNotice.id='surface-contact-notice';contactNotice.setAttribute('role','status');document.body.append(contactNotice);contactNotice.style.cssText='position:fixed;left:1rem;right:1rem;bottom:5rem;z-index:15;padding:.65rem;background:#fff4da;color:#302d22;font-size:.8rem;max-width:36rem;pointer-events:none';}contactNotice.textContent=art.contactNotice||'';contactNotice.hidden=!art.contactNotice;
 // Reuse Mesh.raycast's existing box rejection before testing source faces.
 art.group.traverse(o=>{if(o.isMesh&&o.geometry?.boundingBox===null)o.geometry.computeBoundingBox();});
 rainField=createRainField({supportAt:rainSupportAt,requireSupport:art.groundCoverageRequired});
 const b=art.bounds,c=b.min.map((v,i)=>(v+b.max[i])/2);sun.target.position.set(c[0],0,c[2]);sun.position.set(c[0]+5,11,c[2]+7);const span=Math.max(b.max[0]-b.min[0],b.max[2]-b.min[2],8);sun.shadow.camera.left=-span;sun.shadow.camera.right=span;sun.shadow.camera.top=span;sun.shadow.camera.bottom=-span;sun.shadow.camera.updateProjectionMatrix();
 const lightingScale=Math.max(1,span/20);sun.shadow.normalBias=.02*lightingScale;sun.position.set(c[0]+5*lightingScale,11*lightingScale,c[2]+7*lightingScale);sun.shadow.camera.far=40*lightingScale+Math.max(0,b.max[1]-11);sun.shadow.camera.updateProjectionMatrix();worldFogDensity=.023/lightingScale;scene.fog.density=worldFogDensity;
 const coastal=p.observations.some(o=>o.geographicContext?.profileId==='redwood-rocky-intertidal');
 // Marine eligibility is deliberately limited to the new attached inhabitant.
 if(!bird){bird=createBirdArt();scene.add(bird.group);}const habitat={perches:coastal?[]:art.perches,foragingSites:coastal?[]:birdForagingSites(art),obstacles:art.obstacles,groundY:art.groundAt?.(0,0)||0};
 const birdHabitat=coastal?habitat:createUrbanBirdHabitat(art,habitat);
 const context=p.id+':'+(historical?'revision-'+p.revision:'current');
 if(sim&&simContext===context)sim.setHabitat(birdHabitat);else sim=createHabitatSimulation(birdHabitat,{seed:42});simContext=context;sim.setWeather({rain:rain?1:0});
 if(!salamanderArt){salamanderArt=createSalamanderArt();scene.add(salamanderArt.group);}
 if(coastal)salamander=null;else if(!salamander||salamanderContext!==context){salamander=spawnSalamander(p);}else salamander.setWorld(salamanderWorld());salamanderContext=context;
 if(salamander)salamanderArt.update(salamander.snapshot().salamander);else salamanderArt.group.visible=false;
 if(!crawlerArt){crawlerArt=createCrawlerArt();scene.add(crawlerArt.group);}
 if(coastal){crawler=null;crawlerNear=false;}else if(!crawler||crawlerContext!==context){crawler=spawnGroundCrawler(p);crawlerNear=false;}else crawler.setWorld(world());crawlerContext=context;
 if(crawler)crawlerArt.update(crawler.snapshot().crawler);else crawlerArt.group.visible=false;
 if(orbWeaver&&orbContext===context)orbWeaver.setHabitat(habitat);else orbWeaver=createOrbWeaver(habitat,{encounters:true});orbContext=context;orbWeaver.setWeather({rain:rain?1:0});
 if(!orbArt){orbArt=createOrbWebArt(orbWeaver.getWeb());scene.add(orbArt.group);}else orbArt.setWeb(orbWeaver.getWeb());orbArt.update(orbWeaver.snapshot(),{rain});
 // The new marine context must not borrow the existing freshwater strider.
 const marineSources=new Set(p.observations.filter(o=>o.geographicContext?.profileId==='redwood-rocky-intertidal').map(o=>o.source.id));
 const skaterSurfaces=art.waterSurfaces.filter(w=>!w.sourceIds?.some(id=>marineSources.has(id))).slice(0,64);
 if(pondSkater&&skaterContext===context)pondSkater.setHabitat(skaterSurfaces);else pondSkater=createPondSkater(skaterSurfaces);skaterContext=context;pondSkater.setWeather({rain:rain?1:0});
 if(!skaterArt){skaterArt=createPondSkaterArt();scene.add(skaterArt.group);}skaterArt.update(pondSkater.snapshot());
 const column=createWaterColumn({waterSurfaces:freshwaterWaterSurfaces(p,art.waterSurfaces.slice(0,64)),groundSupports:art.groundSupports,obstacles:art.obstacles});
 if(submergedLife&&submergedContext===context)submergedLife.setColumn(column);else submergedLife=createSubmergedLife(column);submergedContext=context;
 submergedView=createSubmergedView(column);if(!submergedArt){submergedArt=createSubmergedArt();scene.add(submergedArt.group);}submergedArt.update(submergedLife.snapshot());
 const attached=intertidalAttachments(p,intertidalFaces(art.group),art.waterSurfaces,art.obstacles);
 if(intertidalLife&&intertidalContext===context)intertidalLife.setHabitat(attached);else intertidalLife=createIntertidalLife(attached);intertidalContext=context;
 if(intertidalArt){scene.remove(intertidalArt.group);intertidalArt.dispose();}intertidalArt=createIntertidalArt();intertidalArt.update(intertidalLife.snapshot());scene.add(intertidalArt.group);
 nav=safeStart(old?.mode||'human')||createNavigator(world(),{mode:'bird',position:[c[0],b.max[1]-.2,c[2]]});
 if(keepPose&&old){const result=nav.restore(old);if(!result.ok){overview=true;notify('The revised place covers your previous viewpoint. Choose a scale to enter at an open location.');}}
 syncHamonWorld();
 worldReady=true;updateLabels();
}
function updateLabels(){
 placesPicker?.refresh();
 if(overview||sourceView||underwaterFocus||webFocus||skaterFocus||$('panel').open||(birdFocus&&nav.pose().mode!=='bird')||(crawlerFocus&&nav.pose().mode!=='insect'))releaseResidentFocus();
 void syncSoundState();
 $('sound-toggle').setAttribute('aria-pressed',String(soundscape.isEnabled()));
 $('sound-toggle').title=soundscape.isEnabled()?'Turn off imagined habitat sounds':'Hear imagined habitat sounds';
 $('sound-toggle').setAttribute('aria-label',soundscape.isEnabled()?'Turn off imagined habitat sounds':'Turn on imagined habitat sounds');
 document.body.classList.toggle('underwater',underwaterFocus);mobile.setMode(overview?'overview':underwaterFocus?'underwater':nav.pose().mode);if(overview||sourceView)mobile.resetZoom();
 const empty=!displayPlace.observations.length,imagined=!empty&&displayPlace.observations.every(o=>o.source.kind==='imagined');$('world-kind').textContent=historical?'A KEPT REVISION':empty?'A PLACE TO BEGIN':imagined?'AN IMAGINED PLACE':'YOUR INTERPRETED PLACE';
 const liveDef=LIVE_PLACES.find(p=>p.id===liveIdOf(displayPlace));$('place-name').textContent=liveDef?liveDef.title:imagined?'A little closer\nto the living world.':displayPlace.name;$('place-name').style.whiteSpace='pre-line';
 $('place-description').textContent=liveDef?liveDef.blurb+'\n'+liveDef.note+'.':imagined?'A leaning tree. A quiet patch of sun.\nA whole world, when you stop to look.':displayPlace.anchors.length?'Your views, held together in one place.\nReturn, look closer, and let it grow.':'A familiar place begins with one view.\nAdd a photo and mark what matters.';$('place-description').style.whiteSpace='pre-line';
 $('memory-count').textContent=String(session.memories.filter(m=>m.placeId===place.id).length);document.body.classList.toggle('exploring',!overview);for(const btn of document.querySelectorAll('[data-mode]'))btn.setAttribute('aria-pressed',String(!overview&&!underwaterFocus&&nav.pose().mode===btn.dataset.mode));
 $('rain-toggle').setAttribute('aria-pressed',String(rain));$('motion-toggle').setAttribute('aria-pressed',String(paused));$('motion-toggle').title=paused?'Resume simulated life · P':'Pause simulated life · P';$('motion-toggle').setAttribute('aria-label',paused?'Resume simulated life':'Pause simulated life');
 $('observe').disabled=historical;$('save-memory').disabled=historical;$('save-memory').title='Keep this viewpoint · K';for(const control of document.querySelectorAll('[data-move="up"],[data-move="down"]'))control.hidden=nav.pose().mode!=='bird'&&!underwaterFocus&&!embody.driving;updateEncounter();refreshControls();requestWorldFrame();
}
async function changeSession(transform,{request=null,expectedSequence=null}={}){
 if(saveFault)throw new Error(saveFault);
 const task=async()=>{
  // Admission belongs inside the existing lock: a later choice can arrive
  // while an earlier travel is queued. A cancelled trip must not save at all.
  if(request&&!request.isCurrent())return false;
  const latest=store.load();
  if(request&&latest.sequence!==expectedSequence)return false;
  const next=transform(latest),saved=store.save(next,latest.sequence);session=saved;place=session.places.find(p=>p.id===session.activePlaceId);return saved;
 };
 return navigator.locks? navigator.locks.request('wildside-local-session',task):task();
}
async function importPlaceFile(transfer,options){
 if(saveFault)throw new Error(saveFault);
 const task=()=>{const result=commitTransfer(store,transfer,options);if(result.ok){session=result.next;place=session.places.find(p=>p.id===session.activePlaceId);if(result.changed){displayPlace=place;historical=false;rebuild(place);overview=true;updateLabels();}}return result;};
 return navigator.locks?navigator.locks.request('wildside-local-session',task):task();
}
function openTransfer(){editor=mountTransferView(openPanel('Move a continuing place'),{getSession:()=>session,onImport:importPlaceFile,onClose:closePanel});}
function clearMomentPreview(){if(momentPreview)lastEmbodiedView=null;momentPreview=null;momentPreviewCanvas=null;}
function closePanel(){clearMomentPreview();editor?.dispose();editor=null;$('panel').close();pressed.clear();pointer=null;$('world').focus({preventScroll:true});requestWorldFrame();}
function openPanel(label){placesPicker?.cancelTravel();clearMomentPreview();mobile.releaseStick?.();mobile.resetZoom();releaseResidentFocus();editor?.dispose();editor=null;pressed.clear();Object.keys(touch).forEach(k=>delete touch[k]);Object.keys(padTouch).forEach(k=>delete padTouch[k]);pointer=null;$('panel-label').textContent=label;$('panel-content').replaceChildren();if(!$('panel').open)$('panel').showModal();pausedObservation?.sync();const body=el('div',undefined,'panel-body');$('panel-content').append(body);return body;}
$('close-panel').onclick=closePanel;$('panel').addEventListener('cancel',e=>{e.preventDefault();closePanel();});
function button(parent,text,action,cls){const b=el('button',text,cls);b.type='button';b.onclick=async()=>{try{await action(b);}catch(e){notify(e.message,true);}};parent.append(b);return b;}
function field(parent,label,initial='',type='text'){const wrap=el('label',label),input=el('input');input.type=type;input.value=initial;wrap.append(input);parent.append(wrap);return input;}
function returnCurrent(){historical=false;displayPlace=place;rebuild(place);overview=true;updateLabels();}
function showSourceView(observation){
 if(!place.observations.some(o=>o.id===observation.id&&o.source.id===observation.source.id))
   throw new Error('This source is no longer part of the place.');
 if(!observation.cameraAssumption||!observation.controlPoints)
   throw new Error('This photo predates camera assumptions. Add a new calibrated view to try source perspective.');
 const fit=recoverSourceCamera(observation.controlPoints,observation.cameraAssumption);
 if(!fit.qualified)throw new Error('Source pose is not qualified under the declared lens assumption. Ground reprojection error: '+(100*fit.rmsImageHeightFraction).toFixed(2)+'% of image height. The safe overview remains available.');
 historical=false;displayPlace=place;rebuild(place);
 sourceView={...fit,observationId:observation.id,sourceId:observation.source.id};
 overview=true;closePanel();updateLabels();
 notify('Looking from a reconstructed source perspective (assumed lens and annotated ground; not a measured camera pose). Choose Overview to exit.',true);
}
function openSources(){
 const sourcePlaceId=place.id;
 const body=openPanel('The story of this place');body.id='source-panel';body.append(el('h2',place.name));
 body.append(el('p','A place grows through observations. Its shapes are interpreted; the robin, beetle, spider and silk, water strider, freshwater micro-life, attached anemones, weather, fine foliage and surface detail are imagined.','lede'));
 const select=el('select');select.setAttribute('aria-label','Choose a saved place');for(const p of session.places){const o=el('option',p.name);o.value=p.id;o.selected=p.id===place.id;select.append(o);}body.append(select);
 select.onchange=async()=>{try{await changeSession(s=>({...s,activePlaceId:select.value}));returnCurrent();openSources();}catch(e){notify(e.message,true);}};
 body.append(el('p',`Revision ${place.revision} · ${place.anchors.length} stable landmarks · saved on this browser only`,'note'));
 button(body,'Export or import places',openTransfer).id='transfer';
 if(!historical&&!place.observations.some(o=>o.geographicContext?.profileId==='london-urban-courtyard'))button(body,'Add habitat context',enrichHabitat).id='add-habitat-context';
 if(historical)button(body,'Return to the current place',()=>{returnCurrent();closePanel();});
 if(place.conflicts.length)body.append(el('p',`${place.conflicts.length} conflicting interpretation(s) remain unresolved. The existing landmark has been preserved. Reopen Add a view and choose a correction or a change deliberately.`,'conflict'));
 for(const o of place.observations){const card=el('div',undefined,'source-card');card.append(el('span',o.source.kind==='imagined'?'Imagined example':'Original source → interpreted structure','tag'),el('h3',o.source.label||'A view of this place'),el('small',o.source.capturedAt?`Recorded ${o.source.capturedAt}`:'Recording time unknown'),el('p',o.mapContext?`${o.features.length} public map features · ${o.mapContext.year} dataset · ${o.mapContext.verticalPolicy==='source-relative'?'source-derived terrain and elevations':'illustrative flat terrain'}`:o.geographicContext?`${o.geographicContext.region} · procedural habitat interpretation · ${o.geographicContext.waterScenario==='illustrative-wet'?'illustrative wet state':'illustrative dry state'}`:o.regionProposals?`${o.regionProposals.regions.length} automatic image-region proposals · ${o.features.length} spatial landmarks · descriptions are inferred.`:`${o.features.length} annotated landmarks · ${o.mode} · geometry comes from supplied points and dimensions.`),el('small',o.mapContext?'Public source file identities and derived geometry are retained; the original map XML is not stored in this visit.':'Original photo or clip bytes are not saved or uploaded. Source identity binds each annotation to the same file.'));
   if(o.mapContext){card.append(el('p',o.mapContext.attribution,'note'),el('p',o.mapContext.verticalPolicy==='source-relative'?'Historical building and terrain geometry share a source-height frame. Streets follow available terrain; missing ground is unsupported. Materials and life are imagined.':'Building outlines and heights come from public city geometry. Each building and street is grounded independently; terrain, textures and current conditions are not measured.','note'));for(const [label,url] of [['Original public map file',o.mapContext.url],['Source terms',o.mapContext.licenseURL]]){const link=el('a',label);link.href=url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}}
   if(o.geographicContext){card.append(el('p',`${o.geographicContext.resolution}. Scene geometry is procedural, not surveyed.`,'note'));for(const source of o.geographicContext.sources){const link=el('a',source.publisher+' · habitat context');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link,el('small',`Retrieved ${source.retrieved}; source updated ${source.updated??'date not supplied'}.`));}}
   if(['photo','video'].includes(o.source.kind)){
    if(o.source.kind==='video'&&!Number.isFinite(o.source.offsetSeconds)){
     card.append(el('small','This older clip has no kept frame offset and cannot be reopened as a particular moment.'));
    }else button(card,o.source.kind==='video'?('Reopen clip at '+o.source.offsetSeconds.toFixed(2)+' seconds'):'Reopen original photo',()=>openPlaceSource(sourcePlaceId,o.id));
    if(o.cameraAssumption&&o.controlPoints){
      try{
       const estimate=recoverSourceCamera(o.controlPoints,o.cameraAssumption);
       card.append(el('p','Conditional source-camera fit: '+(100*estimate.rmsImageHeightFraction).toFixed(2)+'% RMS image-height reprojection; '+(estimate.qualified?'qualified for this declared lens':'not qualified')+'. This is not measured 3D accuracy.','note'));
       if(estimate.qualified)button(card,'View from this source frame’s ground perspective',()=>showSourceView(o));
      }catch(error){card.append(el('small','Source camera unavailable: '+error.message));}
    }
   }
   let armed=false;button(card,'Remove this source',async b=>{if(!armed){armed=true;b.textContent='Remove source and its dependent moments';return;}await changeSession(s=>{if(s.activePlaceId!==sourcePlaceId)throw new Error('The active place changed. Reopen its sources.');return removePlaceSource(s,sourcePlaceId,o.source.id);});returnCurrent();openSources();notify('Source, derived historical geometry, and dependent moments removed.');},'remove');body.append(card);
 }
 if(!place.observations.length){
   body.append(el('p','No observations yet. Add a view to start interpreting this place.'));
   const discardId=place.id;
   // A clean revision-zero shell is the only disposable state. In particular,
   // an emptied-by-source-removal place retains revocation history and cannot
   // be erased through this recovery control.
   try{
     discardEmptyPlace(session,discardId);
     let armed=false;
     const discardButton=button(body,'Discard this empty place',async b=>{
       if(!armed){
         armed=true;
         b.textContent='Confirm: discard this empty place';
         b.setAttribute('aria-label','Confirm permanent disposal of empty place '+place.name);
         b.insertAdjacentElement('afterend',el('p','This removes only the unstarted place. Other places, source histories and moments remain.','note'));
         return;
       }
       await changeSession(s=>{
         if(s.activePlaceId!==discardId)throw new Error('The active place changed. Reopen its details.');
         return discardEmptyPlace(s,discardId);
       });
       returnCurrent();openSources();notify('Empty place discarded. Your other places and moments are unchanged.');
     },'remove');
     discardButton.id='discard-empty-place';
   }catch{/* A meaningful or final place must never offer a discard action. */}
 }
 const anchors=el('div');anchors.append(el('h3','Recognition anchors'));for(const a of place.anchors){const p=el('p',`${a.label} · ${a.kind} · ${a.position.map(n=>n.toFixed(2)).join(', ')} m`,'note');anchors.append(p);}body.append(anchors);
 body.append(el('p','This first build is local and private. It has no remote sharing or live camera connection. Manual planar calibration does not recover arbitrary 3D or validate ecology.','note'));
}
function openPlaceSource(sourcePlaceId,observationId){
 if(place.id!==sourcePlaceId)throw new Error('The active place changed. Reopen its sources.');
 const sourcePlace=session.places.find(p=>p.id===sourcePlaceId);const body=openPanel('The original behind this place');
 editor=mountSourceRevisit(body,{place:sourcePlace,getPlace:()=>session.places.find(p=>p.id===sourcePlaceId),observationId,onClose:openSources});
}
function observation(provisionalPlace=null){
 if(!provisionalPlace&&place.observations.some(o=>o.source.kind==='imagined')){newPlace();return;}
 const previousPlaceId=place.id,editingPlace=provisionalPlace??place,editingPlaceId=editingPlace.id;
 const body=openPanel(provisionalPlace?'Bring your first view':'Bring another view');body.id='observation-panel';body.classList.remove('panel-body');
 editor=mountObservationEditor(body,{place:editingPlace,getPlace:()=>{
   if(place.id!==previousPlaceId)throw new Error('The active place changed. Reopen this editor.');
   return provisionalPlace??session.places.find(p=>p.id===editingPlaceId);
 },onClose:closePanel,onCommit:async next=>{
   await changeSession(s=>{
     if(next.id!==editingPlaceId)throw new Error('The edited place changed. Reopen this editor.');
     if(provisionalPlace){
       // A cancelled or invalid new-photo attempt must not consume one of 24
       // places. Admit the first source observation and switch worlds together.
       if(s.activePlaceId!==previousPlaceId)throw new Error('The active place changed. Reopen this editor.');
       if(s.places.some(p=>p.id===editingPlaceId))throw new Error('This place already exists. Reopen the editor.');
       if(s.places.length>=24)throw new Error('This browser can keep up to 24 places. The original visit is unchanged.');
       if(provisionalPlace.revision!==0||next.revision!==1||next.observations.length!==1)
         throw new Error('The first view is not a single new observation.');
       return {...s,places:[...s.places,next],activePlaceId:editingPlaceId};
     }
     if(s.activePlaceId!==editingPlaceId)throw new Error('The active place changed. Reopen this editor.');
     const current=s.places.find(p=>p.id===next.id);
     if(!current)throw new Error('This place is no longer available.');
     if(current.revision!==next.revision-1){
       const incoming=next.observations.at(-1),saved=current.observations.find(o=>o.id===incoming.id);
       if(saved&&JSON.stringify(saved)===JSON.stringify(incoming))return s;
       throw new Error('Another view changed the place. Reopen the editor to use the latest revision.');
     }
     return {...s,places:s.places.map(p=>p.id===next.id?next:p)};
   });
   displayPlace=place;historical=false;rebuild(place,{keepPose:!provisionalPlace});closePanel();overview=true;updateLabels();notify('Your view is now part of this place. Original media stays with you.');
 }});
}
function enrichHabitat(){
 const originalId=place.id,originalRevision=place.revision,body=openPanel('Enrich this place');
 editor=mountContextEnrichment(body,{preview:observation=>deriveUrbanHabitatDetail(admitObservation(place,observation),{surfaceAt:art.surfaceAt}).length,
  onApply:async observation=>{await changeSession(s=>{const current=s.places.find(p=>p.id===originalId);
   if(s.activePlaceId!==originalId||current?.revision!==originalRevision)throw Error('This place changed. Reopen habitat context to fit its current structure.');
   return {...s,places:s.places.map(p=>p.id===originalId?admitObservation(p,observation):p)};
  });returnCurrent();closePanel();notify('Habitat context now follows the supported walls and containers of this place.');}
 });
}
function newPlace(){const body=openPanel('Begin with somewhere you care about');editor=mountLocationContext(body,{existingPlace:place,onPhoto:newPhotoPlace,imagined:{places:LIVE_PLACES,available:()=>!!hamon&&['waiting','ready'].includes(hamon.state().phase),open:openLiveImagined},onCreate:async next=>{await changeSession(s=>({...s,places:s.places.some(p=>p.id===next.id)?s.places:[...s.places,next],activePlaceId:next.id}));displayPlace=place;historical=false;rebuild(place);overview=true;updateLabels();closePanel();notify('Your place is ready to explore. Add local views to keep enriching it.');}});}
function newPhotoPlace(){const body=openPanel('Begin with somewhere you care about');body.append(el('h2','Bring your place.'),el('p','Choose an original photo or a moment from a local clip you are allowed to use. Mark a patch of approximately flat ground and its familiar landmarks. New views will refine this same place.','lede'));const name=field(body,'What do you call this place?','Our quiet corner');name.maxLength=100;body.append(el('p','Your original stays in this browser session. Saved geometry records your interpretation, not automatic recognition. No upload or exact geographic location is needed.','note'));const b=button(body,'Choose a photo or video →',async()=>{const value=name.value.trim();if(!value)throw new Error('Give this place a name.');const pendingPlace=createPlace({id:uid('place'),name:value});observation(pendingPlace);},'dark');b.id='create-place-confirm';}
function keepMoment(){
 if(historical)return;
 if(embody.mode==='inside'){notify('Watch the animal from outside to keep a viewpoint.');return;}
 if(!embody.active&&!underwaterFocus&&nav.pose().transitioning){notify('Let this change of scale finish before keeping its viewpoint.');return;}
 if(!place.anchors.length){notify('Add a landmark before keeping a moment.');return;}
 let watchedPose=null;
 if(embody.active){
  const shown=lastEmbodiedView,state=embody.snapshot();
  if(!shown||shown.generation!==viewGeneration||shown.placeId!==displayPlace.id||shown.revision!==displayPlace.revision||shown.creature!==state.creature||shown.mode!==state.mode||shown.view!==state.view){notify('Wait for the view to appear, then try again.');return;}
  // Painted Human view can use the traveller's third-person camera. A Bird
  // viewpoint uses the admitted camera itself when returning to this moment.
  const result=admitCameraViewpoint(world(),shown,hamon?.active?'bird':nav.pose().mode);
  if(!result.ok){notify('This view cannot be kept here. Zoom out, or leave the animal view and choose a viewpoint, then try again.');return;}
  const p=result.pose;
  watchedPose=Object.freeze({...p,position:Object.freeze(p.position.slice()),forward:Object.freeze(p.forward.slice()),up:Object.freeze(p.up.slice())});
 }
 if(overview){overview=false;nav=safeStart()||nav;updateLabels();}
 const memoryPlace=place,pose=watchedPose||(underwaterFocus?submergedView.pose():nav.pose());
 const waterAnchor=pose?.mode==='underwater'?memoryPlace.anchors.find(a=>a.kind==='water'&&`${a.id}:water`===pose.waterId):null;
 if(!pose||(pose.mode==='underwater'&&!waterAnchor)){notify('This underwater viewpoint no longer belongs to a surviving water landmark.');return;}
 const body=openPanel('Keep a moment');
 if(watchedPose){momentPreview=watchedPose;requestWorldFrame();}
 body.append(el('h2',watchedPose?'Keep this viewpoint.':'Somewhere to return to.'),el('p',waterAnchor?'Keep this underwater viewpoint with its water. You can return to this revision even if the place later changes.':'This saves your viewpoint and a personal memory, attached to a landmark. It does not record a wildlife sighting.'));
 if(watchedPose){
  const note=el('p','Preview in '+(pose.mode==='bird'?'Bird':pose.mode==='insect'?'Insect':'Human')+' view, with ordinary framing. Closing returns to watching.','note');note.id='memory-viewpoint-preview';
  const figure=el('figure',undefined,'moment-viewpoint-preview'),image=el('canvas'),caption=el('figcaption','Still preview of this viewpoint. Simulated life can change when you return.');
  image.id='memory-viewpoint-image';image.width=1;image.height=1;image.setAttribute('role','img');image.setAttribute('aria-label','Still preview of the viewpoint to keep');
  caption.id='memory-viewpoint-caption';figure.append(image,caption);body.append(note,figure);momentPreviewCanvas=image;
 }
 const name=field(body,'A name for this moment','A quiet pause');name.maxLength=100;name.id='memory-label';
 let select=null;
 if(waterAnchor)body.append(el('p',`Kept with ${waterAnchor.label||'this water'}. Simulated life can change when you return.`,'note'));
 else {
  const label=el('label','Keep it with this landmark');select=el('select');select.id='memory-anchor';
  const sorted=[...memoryPlace.anchors].sort((a,b)=>Math.hypot(...a.position.map((v,i)=>v-pose.position[i]))-Math.hypot(...b.position.map((v,i)=>v-pose.position[i])));
  for(const a of sorted){const o=el('option',a.label);o.value=a.id;select.append(o);}label.append(select);body.append(label);
 }
 // Reaching capacity must never make someone discard a memory before their
 // new viewpoint has been verified and committed in the same local save.
 let replacing=null;
 if(session.memories.length>=500){
  body.append(el('p','You have kept 500 moments. Choose exactly one older moment to replace with this new viewpoint. The old moment stays untouched unless the new save succeeds.','note'));
  const find=field(body,'Find an older moment to replace','','search');find.id='memory-replace-search';find.placeholder='Search moment and place names';
  const choiceLabel=el('label','Choose the moment to replace');
  const choices=el('select');choices.id='memory-replace-choice';choiceLabel.append(choices);body.append(choiceLabel);
  const details=el('p',undefined,'note');details.id='memory-replace-status';body.append(details);
  // The full value, not just the ID, is checked against the latest locked
  // session so a changed same-ID moment cannot be silently discarded.
  const originals=new Map(session.memories.map(m=>[m.id,JSON.stringify(m)]));
  const renderChoices=()=>{
   const selected=choices.value,matching=replacementChoices(session.memories,session.places,find.value);
   const blank=el('option','Choose an old moment first');blank.value='';
   choices.replaceChildren(blank);
   for(const m of matching){
    const option=el('option',m.placeName+' · '+m.label+' · '+m.mode);option.value=m.id;choices.append(option);
   }
   choices.value=matching.some(m=>m.id===selected)?selected:'';
   details.textContent=matching.length?matching.length+' moment(s) available in this search. Nothing is removed until you confirm the new viewpoint.':'No kept moments match this search.';
  };
  find.addEventListener('input',renderChoices);renderChoices();
  replacing=()=>({replaceId:choices.value||null,expected:originals.get(choices.value)||null});
 }
 // navigator.locks serializes writes, but it cannot decide whether two rapid
 // activations were one visitor intention. Claim this dialog synchronously.
 // Only a failed save makes its confirmation usable again.
 let savingMoment=false;
 const b=button(body,'Keep this moment',async saveButton=>{
  if(savingMoment)return;
  savingMoment=true;saveButton.disabled=true;
  try{
   if(watchedPose&&momentPreviewCanvas?.dataset.ready!=='true')throw new Error('Wait for the viewpoint preview, or close this review and try again.');
   const m=captureVisit(memoryPlace,pose,{id:uid('visit'),anchorId:waterAnchor?.id??select.value,label:name.value.trim()||'A quiet pause',at:new Date().toISOString()});
   const selection=replacing?replacing():{};
   if(replacing&&!selection.replaceId)throw new Error('Choose an older moment to replace before keeping the new viewpoint.');
   await changeSession(s=>{if(s.activePlaceId!==memoryPlace.id||s.places.find(p=>p.id===memoryPlace.id)?.revision!==memoryPlace.revision)throw new Error('The place changed while keeping this moment. Reopen it at the latest revision.');return {...s,memories:admitKeptMoment(s.memories,m,selection)};});
   closePanel();updateLabels();notify('Moment kept. It will follow its landmark as the place improves.');
  }catch(error){savingMoment=false;saveButton.disabled=false;throw error;}
 },'dark');b.id='memory-save-confirm';
}
function refuseMomentViewpoint(moment,historicalVisit){
 const underwater=moment.mode==='underwater';
 const supportMessage=historicalVisit?'That retained surface cannot support the kept viewpoint. Your moment is preserved.':'The current surface no longer supports your kept viewpoint. Your moment is preserved; try As remembered.';
 const message=underwater?'This water no longer supports the kept viewpoint. Your moment is preserved; try As remembered.':moment.supportAnchorId?supportMessage:'The viewpoint is covered by changed geometry. The memory is preserved; choose another place to stand.';
 if(moment.supportAnchorId&&$('moment-results')){
  $('moment-visit-error')?.remove();
  const notice=el('p',message,'conflict');notice.id='moment-visit-error';notice.setAttribute('role','alert');
  $('moment-results').prepend(notice);
  notice.scrollIntoView({block:'center'});
 }
 throw new Error(message);
}
function visitMoment(moment,historicalVisit){
 const p=historicalVisit?placeAtRevision(place,moment.revision):place;
 const resolved=resolveVisit(p,moment);if(!resolved.ok)throw new Error(`This moment is unavailable: ${resolved.reason}.`);
 displayPlace=p;historical=historicalVisit;rebuild(p);
 const underwater=resolved.pose.mode==='underwater';
 const result=underwater?submergedView.restore(resolved.pose):nav.restore(resolved.pose);
 if(!result.ok||(moment.supportAnchorId&&result.adjusted)){
  returnCurrent();
  refuseMomentViewpoint(moment,historicalVisit);
 }
 underwaterFocus=underwater;overview=false;focusFov=null;pendingMode=null;updateLabels();closePanel();
 notify(historicalVisit?'Visiting the retained revision. Simulated life remains imagined.':resolved.revised?'Your viewpoint followed its landmark into the current place.':'Welcome back.');
}
function moments(){
 const body=openPanel('Your kept moments');
 body.append(el('h2','Your kept moments.'));
 const controls=el('div',undefined,'memory-browser-controls');
 const placeLabel=el('label','Browse places'),placeScope=el('select');placeScope.id='moment-place';
 for(const [value,title] of [['current','This place'],['all','All your places']]){const option=el('option',title);option.value=value;placeScope.append(option);}
 placeLabel.append(placeScope);
 const searchLabel=el('label','Find a kept moment');
 const search=el('input');search.type='search';search.id='moment-search';search.autocomplete='off';search.placeholder='Search moment names';search.maxLength=160;
 searchLabel.append(search);
 const modeLabel=el('label','Show scale');
 const mode=el('select');mode.id='moment-mode';
 for(const [value,title] of [['all','All scales'],['human','Human'],['bird','Bird'],['insect','Insect'],['underwater','Underwater']]){
  const option=el('option',title);option.value=value;mode.append(option);
 }
 modeLabel.append(mode);controls.append(placeLabel,searchLabel,modeLabel);
 const resultCount=el('p',undefined,'note');resultCount.id='moment-results-status';resultCount.setAttribute('role','status');resultCount.setAttribute('aria-live','polite');
 const results=el('div');results.id='moment-results';
 const more=el('button','Show more kept moments');more.type='button';more.id='moment-show-more';
 body.append(controls,resultCount,results,more);
 let shown=40;
 // Switching worlds is a real saved-session action, not merely a change of
 // displayed label. Verify the selected original is still the one inspected.
 async function switchToMomentPlace(m){
  if(place.id===m.placeId)return;
  const expected=JSON.stringify(m);
  await changeSession(s=>{
   const saved=s.memories.find(v=>v.id===m.id);
   if(!saved||JSON.stringify(saved)!==expected||!s.places.some(p=>p.id===m.placeId))
    throw new Error('This kept moment changed in another view. Reopen your kept moments.');
   return {...s,activePlaceId:m.placeId};
  });
  displayPlace=place;historical=false;
 }
 async function visitFromLibrary(m,historicalVisit){
  const target=session.places.find(p=>p.id===m.placeId);
  const resolved=target&&resolveVisit(historicalVisit?placeAtRevision(target,m.revision):target,m);
  if(!resolved?.ok)
   throw new Error('This moment cannot be revisited. Its original place or supported viewpoint changed.');
  // Probe the world already on screen before any place switch or rebuild can
  // discard the visitor's current view. A different place, retained revision,
  // or Engine live world must still use its existing receiving path.
  if(!historicalVisit&&!historical&&target===place&&displayPlace.id===target.id&&
     displayPlace.revision===target.revision&&(displayPlace.epoch??0)===(target.epoch??0)&&
     !liveIdOf(target)){
   const result=resolved.pose.mode==='underwater'
    ?createSubmergedView(createWaterColumn({waterSurfaces:freshwaterWaterSurfaces(target,art.waterSurfaces.slice(0,64)),groundSupports:art.groundSupports,obstacles:art.obstacles})).restore(resolved.pose)
    :createNavigator(world()).restore(resolved.pose);
   if(!result.ok||(m.supportAnchorId&&result.adjusted))refuseMomentViewpoint(m,false);
  }
  await switchToMomentPlace(m);
  visitMoment(m,historicalVisit);
 }
 async function sourceFromLibrary(m,observationId){
  await switchToMomentPlace(m);
  displayPlace=place;historical=false;rebuild(place);overview=true;updateLabels();
  openPlaceSource(m.placeId,observationId);
 }
 function render(){
  const allPlaces=placeScope.value==='all';
  const {total,matching,visible,remaining}=listKeptMoments(session.memories,allPlaces?null:place.id,{query:search.value,mode:mode.value,limit:shown,places:session.places});
  resultCount.textContent=total===0?(allPlaces?'No kept moments in your places yet.':'No kept moments in this place yet.'):matching===0?'No kept moments match this search.':`Showing ${visible.length} of ${matching} matching kept moments${matching===total?'':` (${total} ${allPlaces?'in your places':'in this place'})`}.`;
  results.replaceChildren();
  if(total===0)results.append(el('p','Walk somewhere you like and keep a moment. It will still belong here when the place grows.','lede'));
  for(const m of visible){
   const card=el('div',undefined,'memory-card');
   const origin=session.places.find(p=>p.id===m.placeId);
   card.append(el('h3',m.label),el('p',`${allPlaces?(origin?.name??'Unavailable place')+' · ':''}${m.mode==='underwater'?'Underwater viewpoint':m.mode+' scale'} · revision ${m.revision} · personal memory`,'note'));
   const row=el('div',undefined,'row');
   for(const historicalVisit of [false,true])button(row,historicalVisit?'As remembered':'Visit now',()=>visitFromLibrary(m,historicalVisit));
   const sources=(origin?.observations??[]).filter(o=>['photo','video'].includes(o.source.kind)&&m.sourceIds.includes(o.source.id));
   for(const source of sources){
    if(source.source.kind==='video'&&!Number.isFinite(source.source.offsetSeconds))continue;
    button(row,source.source.kind==='video'?'Clip moment '+source.source.offsetSeconds.toFixed(2)+' s':'Original photo',()=>sourceFromLibrary(m,source.id));
   }
   // Deletion is permanent: browsing, a stray click, or a rapid double-click
   // must not silently discard an original personal memory.
   const expected=JSON.stringify(m);
   const forget=button(row,'Forget moment',()=>{
    forget.disabled=true;
    const confirmation=el('div',undefined,'memory-forget-confirm');
    confirmation.setAttribute('role','group');
    confirmation.setAttribute('aria-label','Confirm forgetting '+m.label);
    confirmation.append(el('p','Permanently forget this personal moment? Its place and original observations will remain.','note'));
    const actions=el('div',undefined,'row');
    let removing=false;
    button(actions,'Yes, forget this moment',async confirm=>{
     if(removing)return;
     removing=true;confirm.disabled=true;
     try{
      await changeSession(s=>{
       const current=s.memories.find(v=>v.id===m.id);
       if(!current||JSON.stringify(current)!==expected)
        throw new Error('This moment changed in another view. Reopen your kept moments before forgetting it.');
       return {...s,memories:s.memories.filter(v=>v.id!==m.id)};
      });
      updateLabels();render();search.focus({preventScroll:true});
     }catch(error){removing=false;confirm.disabled=false;throw error;}
    },'remove');
    button(actions,'Keep this moment',()=>{
     confirmation.remove();forget.disabled=false;forget.focus({preventScroll:true});
    });
    confirmation.append(actions);card.append(confirmation);
   });
   card.append(row);results.append(card);
  }
  more.hidden=remaining===0;
  more.textContent=`Show ${Math.min(40,remaining)} more kept moment${Math.min(40,remaining)===1?'':'s'}`;
 }
 for(const input of [placeScope,search,mode])input.addEventListener('input',()=>{shown=40;render();});
 more.addEventListener('click',()=>{shown+=40;render();if(!more.hidden)more.focus();else results.lastElementChild?.querySelector('button')?.focus();});
 render();
}

function openEcologyDiscovery(){
 if(anemoneFocus){openSources();return;}
 // A simulated inhabitant invites an optional comparison, never a sighting claim.
 const encounter=residentEncounter?.kind??(underwaterFocus?'water-flea':skaterFocus?'water-strider':webFocus?'orb-weaver':!overview&&nav.pose().mode==='insect'?'beetle':'robin');
 const region=[...displayPlace.observations].reverse().find(o=>o.geographicContext)?.geographicContext.region??null;
 editor=mountEcologyDiscovery(openPanel('Every life has a place'),{encounter,region,onClose:closePanel});
}
$('discover-ecology').onclick=openEcologyDiscovery;
$('sources').onclick=openSources;$('observe').onclick=()=>observation();$('new-place').onclick=newPlace;$('save-memory').onclick=keepMoment;$('memories').onclick=moments;
// An explicit viewpoint choice hands the camera back to ordinary exploration.
// exit() synchronously sets overview in onActive(false), so commit the chosen
// viewpoint after it returns; failed encounter admission keeps the animal view.
$('overview').onclick=()=>{embody.exit();leaveUnderwater();if(historical)returnCurrent();webFocus=false;skaterFocus=false;sourceView=null;overview=true;updateLabels();};
function enter(mode){try{releaseResidentFocus();leaveUnderwater();webFocus=false;skaterFocus=false;sourceView=null;focusFov=null;if(overview||embody.active){const start=safeStart(mode);if(!start)throw new Error('This scale has no clear starting location in the current geometry.');embody.exit();nav=start;overview=false;pendingMode=null;}else{nav.changeMode(mode,{duration:paused?.05:1.2});pendingMode=mode;}updateLabels();$('world').focus({preventScroll:true});if(mode==='insect')notify('At ground level, small edges become a landscape. Move slowly and look upward.');}catch(e){notify(e.message);}}
/** Metres of `a`→`b` that pass through an Engine crown (their leaf masses fill the lens when the camera sits inside). */
function crownChord(a,b){
 if(!hamon?.active)return 0;
 const trees=hamon.trees;if(!trees.length)return 0;
 const n=48,length=Math.hypot(...b.map((v,i)=>v-a[i])),step=length/n;let inside=0;
 for(let i=0;i<=n;i++){
  const t=i/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,z=a[2]+(b[2]-a[2])*t;
  if(inCrown(trees,x,y,z))inside+=step;
 }
 return inside;
}
const inCrown=(trees,x,y,z)=>trees.some(c=>Math.hypot(x-c.pos[0],z-c.pos[2])<c.radius*1.45&&y>c.pos[1]+.8&&y<c.pos[1]+c.height+2.5);
function birdFocusRules(){
 const probe=createNavigator(world(),{mode:'bird'}),ray=new THREE.Raycaster();
 const rayClear=(a,b,trim=0)=>{
  const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d);if(length<1e-9)return true;
  ray.set(new THREE.Vector3(...a),new THREE.Vector3(...d).normalize());ray.near=0;ray.far=Math.max(0,length-trim);
  return !ray.intersectObjects(art.group.children,true).length;
 };
 return {
  admit:pose=>{const result=probe.restore(pose);return result.ok&&!result.adjusted;},
  visible:(position,target)=>rayClear(position,target,.13)&&(!hamon?.active||!inCrown(hamon.trees,...position)&&crownChord(position,target)<=1.5),
  clear:(a,b)=>flightSegmentClear(a,b,art.obstacles,.09)&&rayClear(a,b)
 };
}
function updateResidentFocus(inhabitant){
 const focus=birdFocus||crawlerFocus,kind=birdFocus?'robin':'beetle';
 art.group.updateMatrixWorld(true);
 const result=focus.controller.step(!inhabitant||inhabitant.state==='unplaced'?null:inhabitant.position,focus.rules);
 if(result.ok){const restored=nav.restore(result.pose);if(restored.ok&&!restored.adjusted)return;}
 releaseResidentFocus();overview=true;focusFov=null;updateLabels();
 notify(`The ${kind} moved behind cover. Explore the place, or look closer again when it emerges.`);
}
$('watch-bird').onclick=()=>{
 if(birdFocus){releaseResidentFocus();requestWorldFrame();return;}
 releaseResidentFocus();
 leaveUnderwater();webFocus=false;skaterFocus=false;
 const birdState=sim.snapshot().bird;if(birdState.state==='unplaced')return;const target=birdState.position,rules=birdFocusRules();
 scene.updateMatrixWorld(true);
 for(const radius of [1.4,2.1,2.8,3.6,4.6])for(const height of [.12,-.12,.55,1.2,-.9])for(const angle of [birdState.yaw,birdState.yaw+.8,birdState.yaw-.8,birdState.yaw+1.6,birdState.yaw-1.6,birdState.yaw+Math.PI]){
  const position=[target[0]+Math.sin(angle)*radius,target[1]+height,target[2]+Math.cos(angle)*radius],pose=residentView(position,target);
  if(!pose||!rules.visible(position,target)||!rules.admit(pose))continue;
  const result=nav.restore(pose);
  if(result.ok&&!result.adjusted){
   embody.exit();
   birdFocus={controller:createResidentFocus(position,target),rules};sourceView=null;overview=false;focusFov=36;pendingMode=null;
   pressed.clear();Object.keys(touch).forEach(k=>delete touch[k]);Object.keys(padTouch).forEach(k=>delete padTouch[k]);updateLabels();$('world').focus({preventScroll:true});return;
  }
 }
 notify('The robin is tucked behind foliage. Let it settle at an open perch, or explore around the tree.');
};
$('watch-crawler').onclick=()=>{
 if(crawlerFocus){releaseResidentFocus();requestWorldFrame();return;}
 releaseResidentFocus();leaveUnderwater();webFocus=false;skaterFocus=false;
 const inhabitant=crawler?.snapshot().crawler;if(!inhabitant||inhabitant.state==='unplaced')return;
 const target=inhabitant.position,ray=new THREE.Raycaster();scene.updateMatrixWorld(true);
 const rayClear=(a,b,trim=0)=>{const delta=b.map((v,i)=>v-a[i]),length=Math.hypot(...delta);if(length<1e-9)return true;ray.set(new THREE.Vector3(...a),new THREE.Vector3(...delta).normalize());ray.near=.001;ray.far=Math.max(.001,length-trim);return !ray.intersectObjects(art.group.children,true).length;};
 const rules=createCrawlerFocusRules(world(),{visible:(a,b)=>rayClear(a,b,.012),clearSight:rayClear});
 for(const radius of [.09,.13,.18])for(const turn of [0,.8,-.8,1.6,-1.6,Math.PI]){
  const angle=inhabitant.yaw+turn,x=target[0]+Math.sin(angle)*radius,z=target[2]+Math.cos(angle)*radius,y=art.surfaceAt(x,z);if(y===null)continue;
  const position=[x,y+.018,z],d=target.map((v,i)=>v-position[i]),distance=Math.hypot(...d);
  ray.set(new THREE.Vector3(...position),new THREE.Vector3(...d).normalize());ray.near=.001;ray.far=distance-.012;if(ray.intersectObjects(art.group.children,true).length)continue;
  const pose={mode:'insect',position,yaw:Math.atan2(d[0],-d[2]),pitch:Math.asin(d[1]/distance)};
  if(!rules.admit(pose))continue;
  const result=nav.restore(pose);
  if(result.ok&&!result.adjusted){embody.exit();crawlerFocus={controller:createResidentFocus(position,target,'insect'),rules};sourceView=null;overview=false;focusFov=48;pendingMode=null;pressed.clear();Object.keys(touch).forEach(k=>delete touch[k]);Object.keys(padTouch).forEach(k=>delete padTouch[k]);updateLabels();$('world').focus({preventScroll:true});return;}
 }
 notify('The beetle is behind a plant or near an edge. Try again after it reaches an open patch.');
};
function watchWeb(detail=false,visitor=false){
 const snap=orbWeaver?.snapshot();if(!snap?.web)return;
 if(visitor&&!snap.encounter?.visible)return;
 const target=visitor?snap.encounter.position:detail?snap.spider.position:snap.web.center,ray=new THREE.Raycaster();scene.updateMatrixWorld(true);
 const distances=detail?[.28,.4,.65]:[Math.max(.5,snap.web.radius*3.4),1.2,1.8];
 for(const sign of [1,-1])for(const distance of distances){
  const position=target.map((v,i)=>v+snap.web.normal[i]*distance*sign),direction=target.map((v,i)=>v-position[i]);
  ray.set(new THREE.Vector3(...position),new THREE.Vector3(...direction).normalize());ray.near=.005;ray.far=distance-.025;
  if(ray.intersectObjects(art.group.children,true).length)continue;
  const result=nav.restore({mode:'bird',position,yaw:Math.atan2(direction[0],-direction[2]),pitch:Math.asin(direction[1]/distance)});
  if(result.ok){embody.exit();leaveUnderwater();sourceView=null;overview=false;webFocus=true;skaterFocus=false;focusFov=detail?26:46;pendingMode=null;updateLabels();$('world').focus({preventScroll:true});return;}
 }
 notify('The web is behind these branches. Try exploring around the tree.');
}
$('watch-web').onclick=()=>watchWeb();$('watch-spider').onclick=()=>watchWeb(true);
$('watch-skater').onclick=()=>{
 const s=pondSkater?.snapshot().skater;if(!s||s.state==='unplaced')return;
 const target=s.position,ray=new THREE.Raycaster();scene.updateMatrixWorld(true);
 for(const radius of [.20,.28,.36])for(const turn of [Math.PI*.7,-Math.PI*.7,0,Math.PI]){
  const angle=s.yaw+turn,requested=[target[0]+Math.sin(angle)*radius,target[1]+.10,target[2]+Math.cos(angle)*radius];
  const probe=createNavigator(world(),{mode:'bird',position:requested}),position=probe.pose().position;
  const direction=target.map((v,i)=>v-position[i]),distance=Math.hypot(...direction);
  if(distance<.08)continue;
  ray.set(new THREE.Vector3(...position),new THREE.Vector3(...direction).normalize());ray.near=.005;ray.far=distance-.008;
  if(ray.intersectObjects(art.group.children,true).length)continue;
  const result=nav.restore({mode:'bird',position,yaw:Math.atan2(direction[0],-direction[2]),pitch:Math.asin(direction[1]/distance)});
  if(result.ok){embody.exit();leaveUnderwater();sourceView=null;overview=false;webFocus=false;skaterFocus=true;focusFov=40;pendingMode=null;updateLabels();$('world').focus({preventScroll:true});return;}
 }
 notify('The water is hidden from this angle. Explore around its edge and try again.');
};
function watchAnemone(){
 const resident=intertidalLife?.snapshot().residents[0];if(!resident)return;
 const target=resident.position.map((v,i)=>v+(i===1?.07:0)),ray=new THREE.Raycaster();scene.updateMatrixWorld(true);
 for(const radius of [.38,.5,.7])for(const turn of [0,.8,-.8,Math.PI]){
  const position=[target[0]+Math.sin(turn)*radius,target[1]+.11,target[2]+Math.cos(turn)*radius],direction=target.map((v,i)=>v-position[i]),distance=Math.hypot(...direction);
  ray.set(new THREE.Vector3(...position),new THREE.Vector3(...direction).normalize());ray.near=.005;ray.far=distance-.12;
  const solids=art.group.children.filter(g=>g.userData.kind!=='water');if(ray.intersectObjects(solids,true).length)continue;
  const result=nav.restore({mode:'bird',position,yaw:Math.atan2(direction[0],-direction[2]),pitch:Math.asin(direction[1]/distance)});
  if(!result.ok||result.adjusted)continue;
  embody.exit();releaseResidentFocus();leaveUnderwater();sourceView=null;overview=false;webFocus=false;skaterFocus=false;focusFov=38;pendingMode=null;anemoneFocus=true;pressed.clear();Object.keys(touch).forEach(k=>delete touch[k]);Object.keys(padTouch).forEach(k=>delete padTouch[k]);worldDrawer.close?.();updateLabels();$('world').focus({preventScroll:true});return;
 }
 notify('This attachment is hidden from a clear close view. Explore around the shelf.');
}
registerControl({id:'intertidal-life',section:'life',order:15,when:()=>!!intertidalLife?.snapshot().residents.length,mount({container,kit}){
 const action=kit.action({label:'Look into the tidepool',onClick:watchAnemone});action.element.id='watch-anemone';
 const note=kit.note('Illustrative anemones attached to this interpreted coast. Shape, motion and exposure timing are authored; no animal was observed.');container.append(action.element,note.element);return {};
}});
$('watch-underwater').onclick=()=>{
 const swimmer=submergedLife?.snapshot().swimmers[0];if(!swimmer||!submergedView.focus(swimmer)){notify('This water has no clear submerged viewpoint.');return;}
 embody.exit();sourceView=null;overview=false;webFocus=false;skaterFocus=false;underwaterFocus=true;focusFov=null;pendingMode=null;pressed.clear();Object.keys(touch).forEach(k=>delete touch[k]);Object.keys(padTouch).forEach(k=>delete padTouch[k]);updateLabels();$('world').focus({preventScroll:true});
};
$('ripple-water').onclick=()=>{
 const snap=pondSkater?.snapshot();if(!snap?.surface||snap.skater.state==='unplaced')return;
 const s=snap.skater,point=[s.position[0]-.035*Math.cos(s.yaw),snap.surface.y,s.position[2]+.035*Math.sin(s.yaw)];
 if(pondSkater.disturb(point)){updateLabels();if(paused)notify('Resume life to watch the skater respond.');}
};
$('watch-visitor').onclick=()=>watchWeb(true,true);
function brushWeb(edge,t){if(paused||!webFocus||!orbWeaver)return false;const sent=orbWeaver.pluck(edge,t);if(sent)requestWorldFrame();return sent;}
$('brush-web').onclick=()=>{
 const snap=orbWeaver?.snapshot();if(!snap?.web)return;
 // An accessible counterpart to touching a strand near the resident.
 const foot=snap.spider.feet.find(f=>f.contact&&f.silkT>.05&&f.silkT<.95);
 if(foot)brushWeb(foot.silkEdge,Math.min(.9,foot.silkT+.08));else brushWeb(0,.35);
};
function brushFromScreen(x,y){
 if(paused||!webFocus)return;
 const web=orbWeaver?.getWeb();if(!web)return;
 const rect=$('world').getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);
 const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(...web.normal),new THREE.Vector3(...web.center)),point=new THREE.Vector3();
 if(!ray.ray.intersectPlane(plane,point))return;
 ray.near=.001;ray.far=point.distanceTo(camera.position)-.004;
 if(ray.far<=ray.near||ray.intersectObjects(art.group.children,true).length)return;
 // Eight screen pixels, bounded in world space, keeps picking coherent across scales.
 const tolerance=Math.min(.025,Math.max(.002,point.distanceTo(camera.position)*Math.tan(camera.fov*Math.PI/360)*16/rect.height));
 const target=nearestSilkPoint(web,point.toArray(),tolerance);if(target)brushWeb(target.edge,target.t);
}
$('enter').onclick=()=>enter('human');document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>enter(b.dataset.mode));
$('save-view-image').onclick=()=>{
 if(pictureSaving||!worldReady)return;
 if(document.hidden||renderer.getContext().isContextLost()){notify('This picture cannot be captured while the world is unavailable.');return;}
 const serial=++pictureSerial;
 picturePending={serial,placeId:place.id,revision:displayPlace.revision,sourceId:sourceView?.sourceId??null};
 pictureSaving=true;$('save-view-image').disabled=true;requestWorldFrame();
};
$('sound-toggle').onclick=async()=>{const control=$('sound-toggle');control.disabled=true;try{if(soundscape.isEnabled()){await soundscape.disable();notify('The imagined soundscape is off.');}else{await soundscape.setHidden(document.hidden);await soundscape.enable();notify('Listening to imagined habitat sounds, not field recordings.');}}catch(error){notify(error?.message||'Sound is unavailable in this browser.',true);}finally{control.disabled=false;updateLabels();}};
$('rain-toggle').onclick=()=>{rain=!rain;sim.setWeather({rain:rain?1:0});orbWeaver?.setWeather({rain:rain?1:0});pondSkater?.setWeather({rain:rain?1:0});rainLines.visible=rain;hamon?.setRain(rain);updateLabels();notify(rain?'An imagined rain. Inhabitants seek available shelter.':'Returning to a dry imagined visit.');};$('motion-toggle').onclick=()=>{paused=!paused;updateLabels();};
function overviewPinchDistance(){
 const points=[...overviewTouches.values()];
 return points.length===2?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y):null;
}
function overviewPinchCenter(){
 const points=[...overviewTouches.values()];
 return points.length===2?{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}:null;
}
function moveOverviewFocus(dx,dy){
 if(!overview||sourceView||!art?.bounds)return;
 const direction=[Math.sin(.5+orbit)*.9,.48,Math.cos(.5+orbit)];
 const pose=fitOverview(art.bounds,innerWidth<=750?Math.max(camera.aspect,.78):camera.aspect,direction,48,1.05);
 const distance=Math.hypot(...pose.position.map((v,i)=>v-pose.target[i]));
 overviewPan.drag(dx,dy,{bounds:art.bounds,zoom:overviewZoom.value(),viewportHeight:innerHeight,fovDegrees:48,direction,distance});
}
function resetOverviewTouch(){overviewTouches.clear();lastPinchDistance=null;lastPinchCenter=null;pointer=null;}
$('world').addEventListener('wheel',e=>{
 if(embody.mode==='outside'&&!$('panel').open){e.preventDefault();embody.zoom(e.deltaY*(e.deltaMode===1?33:1));requestWorldFrame();return;}
 if(!overview||sourceView||$('panel').open)return;
 e.preventDefault();overviewZoom.wheel(e.deltaY,e.deltaMode);requestWorldFrame();
},{passive:false});
$('world').addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 if(e.pointerType==='touch'&&overview&&!sourceView&&!$('panel').open){
  if(overviewTouches.size>=2)return;
  overviewTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(overviewTouches.size===2){lastPinchDistance=overviewPinchDistance();lastPinchCenter=overviewPinchCenter();pointer=null;}
 }
 if(overviewTouches.size<2)pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,drag:false};
 $('world').setPointerCapture(e.pointerId);
});
$('world').addEventListener('pointermove',e=>{
 if(overviewTouches.has(e.pointerId)){
  overviewTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const next=overviewPinchDistance();
  if(next!==null){
   const center=overviewPinchCenter();
   if(lastPinchDistance!==null)overviewZoom.pinch(lastPinchDistance,next);
   if(lastPinchCenter&&center)moveOverviewFocus(center.x-lastPinchCenter.x,center.y-lastPinchCenter.y);
   lastPinchCenter=center;lastPinchDistance=next;pointer=null;requestWorldFrame();return;
  }
 }
 if(!pointer||pointer.id!==e.pointerId)return;
 const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer.x=e.clientX;pointer.y=e.clientY;
 if(mobile.pinching)return;
 pointer.drag ||= Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>4;
 if(!pointer.drag)return;
 releaseResidentFocus();
 if(overview){if(e.shiftKey&&!sourceView)moveOverviewFocus(dx,dy);else orbit-=dx*.005;}else if(embody.active)embody.look(dx*.003*settings.get().sensitivity,-dy*.003*settings.get().sensitivity*(settings.get().invertY?-1:1));else (underwaterFocus?submergedView:nav).look(dx*.003*settings.get().sensitivity,-dy*.003*settings.get().sensitivity*(settings.get().invertY?-1:1));
 requestWorldFrame();
});
function finishWorldPointer(e){
 overviewTouches.delete(e.pointerId);if(overviewTouches.size<2){lastPinchDistance=null;lastPinchCenter=null;}
 if(pointer?.id===e.pointerId&&e.type==='pointerup'&&!pointer.drag&&embody.mode!=='inside'){const picked=embody.mode==='outside'||$('panel').open?null:embody.pick(e.clientX,e.clientY);if(picked)embody.observe(picked);else brushFromScreen(e.clientX,e.clientY);}
 if(pointer?.id===e.pointerId)pointer=null;
}
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('world').addEventListener(type,finishWorldPointer);
const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyE','KeyQ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
// Drawers own keyboard focus. A held key or touch must not resume motion after dismissal.
addEventListener('wildside:drawer-open',()=>{
 mobile.releaseStick?.();pressed.clear();Object.keys(touch).forEach(key=>delete touch[key]);Object.keys(padTouch).forEach(key=>delete padTouch[key]);requestWorldFrame();
});
addEventListener('keydown',e=>{
 if($('panel').open||e.target?.isContentEditable||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName||''))return;
 if((worldDrawer.isOpen||settingsDrawer.isOpen)&&movementKeys.has(e.code))return;
 if(e.key==='Escape'&&embody.exit())return;
 if(e.code==='KeyV'&&hamon?.active&&!embody.active){hamonResidents.toggleTraveller();return;}
 if(e.key==='Escape'&&overview&&!sourceView&&!worldDrawer.isOpen&&!settingsDrawer.isOpen&&document.body.classList.contains('has-entered')){settingsDrawer.open();return;}
 if(e.key==='Escape'){leaveUnderwater();sourceView=null;webFocus=false;skaterFocus=false;overview=true;updateLabels();return;}
 if(overview&&!sourceView&&['Equal','Minus','NumpadAdd','NumpadSubtract','Digit0','Numpad0'].includes(e.code)){
  e.preventDefault();
  if(e.code==='Digit0'||e.code==='Numpad0')overviewZoom.reset();
  else overviewZoom.step(e.code==='Equal'||e.code==='NumpadAdd'?1:-1);
  requestWorldFrame();return;
 }
 // Shift+arrows translate only the unobstructed overview. Never start travel
 // from a source review or open drawer, or steal a browser modifier shortcut.
 if(overview&&e.shiftKey){
  const delta=overviewKeyboardDrag(e.code);
  if(delta){
   if(sourceView||worldDrawer.isOpen||settingsDrawer.isOpen||e.altKey||e.ctrlKey||e.metaKey)return;
   e.preventDefault();moveOverviewFocus(...delta);requestWorldFrame();return;
  }
 }
 if(movementKeys.has(e.code)){
  e.preventDefault();releaseResidentFocus();focusFov=null;pressed.add(e.code);requestWorldFrame();
  if(overview){overview=false;updateLabels();}
 }
});
addEventListener('keyup',e=>{if(pressed.delete(e.code))requestWorldFrame();});
addEventListener('blur',()=>{mobile.releaseStick?.();pressed.clear();Object.keys(touch).forEach(k=>delete touch[k]);Object.keys(padTouch).forEach(k=>delete padTouch[k]);resetOverviewTouch();requestWorldFrame();});
document.querySelectorAll('[data-move]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();releaseResidentFocus();focusFov=null;touch[b.dataset.move]=true;b.setPointerCapture(e.pointerId);requestWorldFrame();});for(const t of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(t,()=>{delete touch[b.dataset.move];requestWorldFrame();});});
addEventListener('resize',()=>{if(momentPreviewCanvas)momentPreviewCanvas.dataset.ready='';camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);hamon?.resize();requestWorldFrame();});

addEventListener('storage',e=>{if(e.key!==SESSION_KEY)return;placesPicker?.cancelTravel();try{session=store.load();place=session.places.find(p=>p.id===session.activePlaceId);const hadPanel=$('panel').open;if(hadPanel)closePanel();displayPlace=place;historical=false;rebuild(place,{keepPose:true});notify(hadPanel?'Another window changed the saved world. The open review closed to keep its actions bound to the right place.':'Received the latest saved place from another window.');}catch(err){notify(err.message,true);}});
function renderWorld(viewportHeight){
 const shadow=sun.shadow,pixelsPerWorldUnit=Math.max(shadow.mapSize.x/(shadow.camera.right-shadow.camera.left),shadow.mapSize.y/(shadow.camera.top-shadow.camera.bottom));
 art.updateDetail(camera,viewportHeight*renderer.getPixelRatio(),pixelsPerWorldUnit);
 // Capture after all art, geometry-detail and world-matrix updates. Observe
 // every frame so partial uploads cannot disappear during live simulation.
 scene.updateMatrixWorld(true);camera.updateMatrixWorld();
 const input={scene,camera,light:sun,renderer,resourceEpoch:shadowResourceEpoch,force:!paused};
 const decision=shadowReuse.prepare(input);
 renderer.shadowMap.autoUpdate=false;
 renderer.shadowMap.needsUpdate=!decision.reuse;
 shadowCache.lastReason=decision.reason;
 try{
  renderer.render(scene,camera);
  const completed=!renderer.getContext().isContextLost()&&!renderer.shadowMap.needsUpdate&&!shadow.needsUpdate&&!!shadow.map;
  if(decision.reuse){if(completed)shadowCache.reuses++;else shadowReuse.invalidate();}
  else if(completed){
   shadowCache.refreshRenders++;
   // Active frames need upload-history observation, but cannot reuse a map.
   // Avoid a second capture; the first paused frame will refresh and commit.
   if(input.force)shadowReuse.invalidate();
   else if(shadowReuse.commit(decision.ticket,input,{shadowRendered:true}))shadowCache.commits++;
  }
  else shadowReuse.invalidate();
 }catch(error){shadowReuse.invalidate();renderer.shadowMap.needsUpdate=true;throw error;}
}
function paintMomentPreview(source){
 const canvas=momentPreviewCanvas;if(!momentPreview||!canvas)return;
 try{
  if(!source||!Number.isFinite(source.width)||!Number.isFinite(source.height)||source.width<=0||source.height<=0)throw Error('No presented image');
  const scale=Math.min(640/source.width,320/source.height);
  const width=Math.max(1,Math.round(source.width*scale)),height=Math.max(1,Math.round(source.height*scale));
  if(canvas.width===width&&canvas.height===height&&canvas.dataset.ready)return;
  canvas.dataset.ready='';canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');if(!context)throw Error('No preview canvas');
  context.drawImage(source,0,0,width,height);canvas.dataset.ready='true';
  const caption=$('memory-viewpoint-caption');if(caption)caption.textContent='Still preview of this viewpoint. Simulated life can change when you return.';
 }catch{
  canvas.dataset.ready='unavailable';
  const caption=$('memory-viewpoint-caption');
  if(caption)caption.textContent='The preview could not be drawn. Close this review and try again.';
 }
}

function applyOrdinaryViewCamera(pose,{focused=true}={}){
 const focus=focused?focusFov:null;
 camera.up.fromArray(pose.up);camera.aspect=innerWidth/innerHeight;
 camera.position.fromArray(pose.position);cameraTarget.fromArray(pose.position.map((v,i)=>v+pose.forward[i]));camera.lookAt(cameraTarget);
 camera.fov=(skaterFocus||!webFocus&&pose.mode==='bird')&&focus?2*Math.atan(Math.tan(focus*Math.PI/360)/Math.min(1,camera.aspect))*180/Math.PI:focus||mobile.horizontalFov(pose.fov+settings.get().fovOffset,camera.aspect);
 camera.fov=mobile.zoomFov(camera.fov);camera.near=pose.near;
 camera.far=Math.max(150,Math.hypot(...art.bounds.max.map((v,i)=>v-art.bounds.min[i]))*1.2);
}
function updateViewCamera(){
 if(momentPreview)applyOrdinaryViewCamera(momentPreview,{focused:false});
 else if(underwaterFocus&&submergedView.pose()){
   const p=submergedView.pose();camera.position.fromArray(p.position);camera.up.fromArray(p.up);camera.lookAt(new THREE.Vector3(...p.position.map((v,i)=>v+p.forward[i])));camera.aspect=innerWidth/innerHeight;camera.fov=2*Math.atan(Math.tan(p.fov*Math.PI/360)/Math.min(1,camera.aspect))*180/Math.PI;camera.near=p.near;camera.far=8;
  }else if(sourceView){
   camera.position.fromArray(sourceView.position);camera.up.fromArray(sourceView.up);
   cameraTarget.fromArray(sourceView.position.map((v,i)=>v+sourceView.forward[i]));camera.lookAt(cameraTarget);
   camera.fov=sourceView.verticalFovDegrees;camera.aspect=sourceView.imageAspect;camera.near=.02;camera.far=200;
  }else if(overview){camera.up.set(0,1,0);camera.aspect=innerWidth/innerHeight;const direction=[Math.sin(.5+orbit)*.9,.48,Math.cos(.5+orbit)];const pose=fitOverview(art.bounds,innerWidth<=750?Math.max(camera.aspect,.78):camera.aspect,direction,48,1.05);camera.position.fromArray(pose.target).lerp(new THREE.Vector3(...pose.position),1/overviewZoom.value());cameraTarget.fromArray(pose.target);const pan=overviewPan.position(art.bounds,overviewZoom.value());camera.position.x+=pan.x;camera.position.z+=pan.z;cameraTarget.x+=pan.x;cameraTarget.z+=pan.z;cameraTarget.y+=innerWidth<=750?1.4:-.4;if(innerWidth>750)cameraTarget.x-=2;camera.up.fromArray(pose.up);camera.lookAt(cameraTarget);camera.fov=48;camera.near=.05;camera.far=Math.max(200,pose.far);}else applyOrdinaryViewCamera(nav.pose());camera.updateProjectionMatrix();
}
function advanceWorld(dt){if(!worldReady)return;if(!paused&&!document.hidden)worldTime+=dt;
 if(!overview&&!$('panel').open&&!worldDrawer.isOpen&&!settingsDrawer.isOpen){const moveInput={forward:Math.max(-1,Math.min(1,Number(Boolean(pressed.has('KeyW')||pressed.has('ArrowUp')||touch.forward||padTouch.forward))-Number(Boolean(pressed.has('KeyS')||pressed.has('ArrowDown')||touch.back||padTouch.back))+mobile.axes.forward)),right:Math.max(-1,Math.min(1,Number(Boolean(pressed.has('KeyD')||pressed.has('ArrowRight')||touch.right||padTouch.right))-Number(Boolean(pressed.has('KeyA')||pressed.has('ArrowLeft')||touch.left||padTouch.left))+mobile.axes.right)),up:Number(Boolean(pressed.has('KeyE')||touch.up||padTouch.up))-Number(Boolean(pressed.has('KeyQ')||touch.down||padTouch.down))};
  if((birdFocus||crawlerFocus)&&(moveInput.forward||moveInput.right||moveInput.up)){releaseResidentFocus();focusFov=null;}
  if(embody.active){if(!paused)embody.update(moveInput,dt);}else (underwaterFocus?submergedView:nav).step(moveInput,dt);}
 if(!paused&&!document.hidden){
  const visitor=!overview&&!sourceView&&!underwaterFocus&&!embody.active&&!$('panel').open?nav.pose():null;
  sim.setVisitor(visitor?{position:visitor.position,radius:visitor.mode==='human'?1.1:visitor.mode==='bird'?.65:.045}:null);
  const advanced=sim.step(dt);orbWeaver?.setNearbyBird(advanced.bird);orbWeaver?.step(dt);pondSkater?.step(dt);submergedLife?.step(dt);intertidalLife?.step(dt);if(crawler){
  if(!overview&&!underwaterFocus){const visitor=nav.pose(),c=crawler.snapshot().crawler,feet=[visitor.position[0],visitor.position[1]-visitor.eye,visitor.position[2]],distance=Math.hypot(...feet.map((v,i)=>v-c.position[i])),radius=visitor.mode==='human'?.3:visitor.mode==='bird'?.12:.035;
   if(distance<radius&&!crawlerNear){crawler.disturb();crawlerNear=true;}else if(distance>radius*1.5)crawlerNear=false;
  }crawler.step(dt);
 }
  if(salamander)salamander.step(Math.min(dt,.25));
 }
}
function animate(){if(!worldReady)return;
 if(!birdFocus&&!crawlerFocus)updateViewCamera();
 if(embody.active&&!momentPreview){const now=performance.now(),dt=embodyClock?Math.min(.1,(now-embodyClock)/1000):1/60;embodyClock=now;embody.applyCamera(camera,dt);}
 embodyUI.sync();
 if(pendingMode&&!nav.pose().transitioning){if(nav.pose().mode!==pendingMode)notify('There is not enough clearance to change scale here. Move to an open part of the place.');pendingMode=null;updateLabels();}$('save-memory').disabled=historical||(!embody.active&&!underwaterFocus&&nav.pose().transitioning);
const snap=sim.snapshot();bird.update(snap.bird);if(crawler)crawlerArt.update(crawler.snapshot().crawler);if(salamander)salamanderArt.update(salamander.snapshot().salamander);if(orbArt)orbArt.update(orbWeaver.snapshot(),{rain});if(skaterArt)skaterArt.update(pondSkater.snapshot());if(submergedArt){const aquatic=submergedLife.snapshot();submergedArt.update(aquatic);submergedArt.group.visible=aquatic.swimmers.some(s=>camera.position.distanceTo(new THREE.Vector3(...s.position))<.20);}intertidalArt?.update(intertidalLife.snapshot());art.update(worldTime,{rain});
 if(birdFocus||crawlerFocus){updateResidentFocus(birdFocus?snap.bird:crawler?.snapshot().crawler);updateViewCamera();}
 soundscape.update({listener:camera.position.toArray(),forward:camera.getWorldDirection(soundForward).toArray(),up:soundUp.setFromMatrixColumn(camera.matrixWorld,1).toArray(),mode:overview?'human':(momentPreview||nav.pose()).mode,bird:snap.bird,crawler:crawler?.snapshot().crawler??null,rain,paused:paused||underwaterFocus,hidden:document.hidden});
 if(frameCount%15===0)updateEncounter();
 sun.intensity=underwaterFocus?2.0:rain?1.45:3.5;sky.intensity=underwaterFocus?1.45:rain?1.7:2.1;scene.background.set(underwaterFocus?'#557f73':rain?'#b9ccc0':'#d8e3cb');scene.fog.color.copy(scene.background);scene.fog.density=underwaterFocus?6:worldFogDensity;
 rainLines.visible=rain&&!underwaterFocus;
 if(rainLines.visible){
  const mode=overview?'overview':sourceView?'human':(momentPreview||nav.pose()).mode;
  const center=(overview?cameraTarget:camera.position).toArray();
  const cellSize=overview?Math.min(1000,Math.max(1.6,(art.bounds.max[0]-art.bounds.min[0])/5,(art.bounds.max[2]-art.bounds.min[2])/5)):undefined;
  rainFieldStats=rainField.update({time:worldTime,center,mode,cellSize,positions:rainPoints});
  rainGeo.setDrawRange(0,rainFieldStats.segments*2);
  rainGeo.attributes.position.needsUpdate=true;
 }
 let presentedCamera=camera;
 if(sourceView){
   // Letterbox without changing the camera's source-image aspect.
   // Explicitly clear the entire canvas so previous frames cannot survive in the bars.
   const w=Math.min(innerWidth,innerHeight*sourceView.imageAspect),h=w/sourceView.imageAspect;
   const x=(innerWidth-w)/2,y=(innerHeight-h)/2;
   renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
   renderer.setClearColor('#10201d',1);renderer.clear(true,true,true);
   renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.setScissorTest(true);
   renderWorld(h);
   renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
  }else if(hamon?.active){presentedCamera=hamonResidents.view(camera,{nav:momentPreview?{pose:()=>momentPreview}:nav,art,follow:!overview&&!birdFocus&&!crawlerFocus&&!underwaterFocus});hamon.frame(presentedCamera,worldTime,hamonContext());}
  else{renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderWorld(innerHeight);}
  // Copy once in the same task as rendering, before an unpreserved buffer can clear.
  if(momentPreviewCanvas)paintMomentPreview(hamon?.active&&!sourceView?hamon.canvas:renderer.domElement);
  if(embody.mode==='outside'&&!momentPreview){
   const state=embody.snapshot();presentedCamera.updateMatrixWorld();
   lastEmbodiedView={generation:viewGeneration,placeId:displayPlace.id,revision:displayPlace.revision,creature:state.creature,mode:state.mode,view:state.view,position:presentedCamera.getWorldPosition(new THREE.Vector3()).toArray(),forward:presentedCamera.getWorldDirection(new THREE.Vector3()).toArray(),up:new THREE.Vector3().setFromMatrixColumn(presentedCamera.matrixWorld,1).toArray()};
   observedGeneration=observationGeneration;
  }
  // Snapshot the complete presented view in the same rendering task before
  // an unpreserved WebGL drawing buffer can be cleared by composition.
  const pending=picturePending;
  if(pending){
    picturePending=null;
    const valid=()=>pictureSerial===pending.serial&&place.id===pending.placeId&&
      displayPlace.revision===pending.revision&&(sourceView?.sourceId??null)===pending.sourceId&&
      !document.hidden&&!renderer.getContext().isContextLost();
    if(!valid())cancelPicture();
    else void downloadRenderedPNG(hamon?.active&&!sourceView?hamon.canvas:renderer.domElement,{filename:'wildside-visit.png',valid})
      .then(()=>{if(valid())notify('Saved a picture of this visit locally as PNG.');})
      .catch(error=>{if(pictureSerial===pending.serial)notify(error?.message||'Could not save this picture.');})
      .finally(()=>{if(pictureSerial===pending.serial){pictureSaving=false;$('save-view-image').disabled=false;}});
  }
  frameCount++;
}
frameLoop=createFrameLoop({draw:animate,minInterval:()=>mobile.minInterval(),advance:advanceWorld,maxCatchUpSteps:3,hidden:()=>document.hidden,continuous:()=>!paused||(!overview&&!$('panel').open&&!worldDrawer.isOpen&&!settingsDrawer.isOpen&&(pressed.size>0||mobile.moving()||Object.values(touch).some(Boolean)||Object.values(padTouch).some(Boolean)||(!underwaterFocus&&nav.pose().transitioning)))});
document.addEventListener('visibilitychange',()=>{void soundscape.setHidden(document.hidden).catch(()=>{});pausedObservation.reset();if(document.hidden){mobile.releaseStick?.();cancelPicture();pressed.clear();Object.keys(touch).forEach(k=>delete touch[k]);Object.keys(padTouch).forEach(k=>delete padTouch[k]);resetOverviewTouch();}else pausedObservation.sync();frameLoop.visibilityChanged();});
addEventListener('pagehide',()=>{observationPageActive=false;pausedObservation.reset();void soundscape.dispose().catch(()=>{});});
addEventListener('pageshow',()=>{observationPageActive=true;if(worldReady)updateLabels();pausedObservation.sync();});
renderer.domElement.addEventListener('webglcontextlost',()=>{observationContextLost=true;observedGeneration=-1;pausedObservation.reset();cancelPicture();shadowResourceEpoch++;shadowReuse.invalidate();});
renderer.domElement.addEventListener('webglcontextrestored',()=>{observationContextLost=false;observedGeneration=-1;shadowResourceEpoch++;shadowReuse=createShadowReuseGuard(THREE);renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;requestWorldFrame();});
createGamepad({touch:padTouch,requestFrame:()=>requestWorldFrame(),
 canAct:()=>worldReady&&!overview&&!$('panel').open&&!worldDrawer.isOpen&&!settingsDrawer.isOpen&&!sourceView,
 look:(dx,dy)=>{
  releaseResidentFocus();const s=settings.get();
  const activeView=embody.active?embody:underwaterFocus?submergedView:nav;
  activeView.look(dx*s.sensitivity,-dy*s.sensitivity*(s.invertY?-1:1));
 },
 wake:()=>{document.body.classList.remove('chrome-idle');},
 onStart:()=>{if(settingsDrawer.isOpen)settingsDrawer.close();else settingsDrawer.open();}});
registerCoreControls();
if(settings.get().renderScale!==1)applyRenderScale();
registerCorePlaces();
placesPicker=mountPlacesPicker({pill:$('place-pill'),nameEl:$('place-pill-name'),panel:$('places'),list:$('places-list'),close:$('places-close'),titleCard:$('title-card'),prompt:$('places-prompt'),getPlaceName:()=>displayPlace.name,notify,isBlocked:()=>$('panel').open,
 onArrive:(_,request)=>{try{requestAnimationFrame(()=>{if(!request?.isCurrent()||!overview||$('panel').open)return;if(displayPlace.anchors.some(x=>x.mapGeometry)&&enterMapVantage())return;enter('human');});}catch{}}});
registerControl({id:'places-open',section:'place',order:0,mount({container,kit}){container.append(kit.action({label:'Choose another place',onClick:()=>{worldDrawer.close();placesPicker.open();}}).element);}});
rebuild(displayPlace);requestWorldFrame();if(saveFault)notify(saveFault,true);
window.__wildsideEmbody=()=>({...embody.snapshot(),orbit:embody.orbitState?.(),body:embody.bodyState('robin')});
window.__wildsideInspect=()=>({overviewZoom:overviewZoom.value(),overviewPan:overviewPan.position(art?.bounds,overviewZoom.value()),hamon:hamon?.state()??null,hamonTrees:hamon?.trees??[],crawlerFocus:crawlerFocus?.controller.snapshot()??null,birdFocus:birdFocus?.controller.snapshot()??null,sourceView:sourceView?{observationId:sourceView.observationId,sourceId:sourceView.sourceId,rms:sourceView.rmsImageHeightFraction,imageAspect:sourceView.imageAspect}:null,mode:underwaterFocus?'underwater':sourceView?'source-view':overview?'overview':nav.pose().mode,pose:underwaterFocus?submergedView.pose():nav.pose(),placeId:place.id,revision:place.revision,memoryCount:session.memories.filter(m=>m.placeId===place.id).length,rain,rainField:{visible:rainLines.visible,segments:rainFieldStats.segments,supportQueries:rainFieldStats.supportQueries,cachedColumns:rainFieldStats.cachedColumns},paused,soundEnabled:soundscape.isEnabled(),simulationTime:worldTime,frameCount,anchorCount:place.anchors.length,anchorIds:place.anchors.map(a=>a.id),historical,birdDetail:{activity:sim.snapshot().bird.activity,forageAmount:sim.snapshot().bird.forageAmount,attention:sim.snapshot().bird.attention,reason:sim.snapshot().bird.reason,perchId:sim.snapshot().bird.perchId,targetId:sim.snapshot().bird.targetId,position:sim.snapshot().bird.position,wingLeft:sim.snapshot().bird.wingLeft,feet:sim.snapshot().bird.feet.map(f=>({toe:f.toe,contact:f.contact}))},foliageDetail:art.detailSnapshot(),publicContext:place.observations.find(o=>o.geographicContext)?.geographicContext??null,urbanHabitatDetails:art.urbanHabitatDetails??[],birdVegetationObstacles:art.birdVegetationObstacles??[],contextForms:place.anchors.filter(a=>a.contextForm).map(a=>({id:a.id,form:a.contextForm})),renderer:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures},bird:sim.snapshot().bird.state,crawler:crawler?.snapshot().crawler??null,salamander:salamander?.snapshot().salamander??null,residentVisibility:{crawler:!!crawlerArt?.group.visible,salamander:!!salamanderArt?.group.visible},orbWeb:orbWeaver?.snapshot()??null,orbSilk:orbWeaver?.getWeb()?.silkGeometry??null,webVisitor:orbArt?.visitorInspection()??null,webResident:orbArt?.residentInspection()??null,webFocus,pondSkater:pondSkater?.snapshot()??null,skaterFocus,underwaterFocus,submergedLife:submergedLife?.snapshot()??null,intertidalLife:intertidalLife?.snapshot()??null,anemoneFocus,camera:{position:camera.position.toArray(),forward:camera.getWorldDirection(new THREE.Vector3()).toArray(),up:new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1).toArray(),fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far}});






/** On touch screens, describe the on-screen pad rather than keys. */
function touchHint(text){
 if(!matchMedia('(pointer: coarse)').matches)return text;
 return text.replace('W A S D to walk','use the pad to walk').replace('W A S D to fly','use the pad to fly').replace(' · E / Q for up and down','').replace(' · Esc to step back','').replace('W A S D to move','use the pad to move').replace('W A S D to swim','use the pad to swim').replace(' · E / Q to fly','').replace(' · E / Q to rise / sink','').replace(' · Esc for overview','').replace(' · Esc to surface','').replace('Drag or move to explore','Drag or move to explore');
}
/** Wildside's own world controls, in the same drawer other features use. */
function registerCoreControls(){
 registerControl({id:'who-lives',section:'life',order:5,mount:({container,kit})=>embodyUI.mountList({container,kit,close:()=>worldDrawer.close()})});
 registerControl({id:'imagined-rain',section:'weather',order:0,mount({container,kit}){
  const c=kit.toggle({label:'Rain',hint:'An imagined shower to see how water and life respond. Not a forecast or a record.',pressed:rain,onChange:()=>$('rain-toggle').click()});
  container.append(c.element);return {update(){c.set(rain);}};
 }});
 registerControl({id:'simulated-life',section:'life',order:0,mount({container,kit}){
  const c=kit.toggle({label:'Animals move',hint:'Turn off to hold every animal still. They are simulated, not live.',pressed:!paused,onChange:()=>$('motion-toggle').click()});
  container.append(c.element);return {update(){c.set(!paused);}};
 }});
 registerControl({id:'save-picture',section:'style',order:90,mount({container,kit}){const c=kit.action({label:'Save a picture of this view',onClick:()=>{worldDrawer.close();$('save-view-image').click();}});container.append(c.element);return {update(){c.element.disabled=$('save-view-image').disabled;}};}});
 registerControl({id:'imagined-sound',section:'sound',order:0,mount({container,kit}){
  const c=kit.toggle({label:'Sound',hint:'Imagined habitat sounds, not field recordings.',pressed:soundscape.isEnabled(),onChange:()=>$('sound-toggle').click()});
  container.append(c.element);return {update(){c.set(soundscape.isEnabled());}};
 }});
 registerControl({id:'honesty-legend',section:'about',order:0,mount({container,kit}){
  const list=document.createElement('dl');list.className='honesty-legend';
  for(const [term,text] of [['Observed','Shapes and colours from the views you brought.'],['Interpreted','Our best reading of those views: geometry, ground and landmarks.'],['Simulated','Inhabitants, weather and sound. Illustrations of possibility, never sightings.']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=term;dd.textContent=text;list.append(dt,dd);}
  container.append(list,kit.action({label:'About this place',onClick:()=>{worldDrawer.close();$('sources').click();}}).element);
 }});
 registerControl({id:'keys',section:'keys',order:0,when:()=>matchMedia('(pointer: fine)').matches,mount({container}){
  const list=document.createElement('dl');list.className='key-legend';
  for(const [k,v] of [['W A S D','move'],['E / Q','rise / sink'],['1 2 3','human · bird · insect'],['R','imagine rain'],['P','pause life'],['K','keep a moment'],['Drag','look around'],['Shift + arrows','pan overview focus'],['F','fullscreen'],['Esc','back to overview, then Settings'],['Gamepad','left stick move · right stick look · A up · B down · Start settings']]){const dt=document.createElement('dt'),dd=document.createElement('dd');const kbd=document.createElement('kbd');kbd.textContent=k;dt.append(kbd);dd.textContent=v;list.append(dt,dd);}
  container.append(list);
 }});
}

/** Places a visitor can travel to: the list in src/places-list.mjs, shown by the Places picker.
 * Other modules add or replace cards with registerPlace (src/places-registry.mjs). */
function registerCorePlaces(){
 const honest={'courtyard':'Imagined','kyoto-block':'Public map · imagined life'};
 getPlacesList().forEach((p,order)=>{
  const ok=p.available();
  registerPlace({id:p.id,name:p.name,line:p.description,thumb:p.thumbnail,honesty:honest[p.id]??'Imagined',order:order*10,
   status:ok?'ready':'soon',soonLabel:p.needsHamon&&!ok?'Needs the painted view':undefined,
   current:()=>p.id==='courtyard'?place.id==='imagined-courtyard':p.id==='kyoto-block'?place.anchors.some(a=>a.mapGeometry):liveIdOf(displayPlace)===p.id,
   travel:request=>p.enter(request)});
 });
}
