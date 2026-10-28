import {circleIntersectsPolygon} from './boundary.mjs';
import {supportFrame} from './surface-contact.mjs';
/** Wildside spatial visits. Meters; +Y up; yaw 0 looks along -Z. No storage or network. */
export const MODES = Object.freeze({
  human: Object.freeze({eye:1.62,radius:.24,speed:1.8,near:.035,fov:58,step:.24}),
  bird: Object.freeze({eye:.16,radius:.09,speed:3.2,near:.008,fov:66,step:Infinity}),
  insect: Object.freeze({eye:.018,radius:.009,speed:.13,near:.001,fov:62,step:.025}),
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const vec=(a)=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const length=(a)=>Math.hypot(...a);
const unit=(a)=>a.map(v=>v/(length(a)||1));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const finite=(x,f=0)=>Number.isFinite(x)?x:f;
function profile(mode){if(!Object.hasOwn(MODES,mode))throw new TypeError('Unknown embodiment');return MODES[mode];}
function floorAt(world,x,z){return finite(world.groundAt?.(x,z),0);}
function bounds(world){return world.bounds||{min:[-10,0,-10],max:[10,8,10]};}
function surfaceAt(world,p,mode){return mode==='insect'?world.surfaceContact?.at(p[0],p[2],{maximumY:p[1]-MODES.insect.eye+MODES.insect.step})??null:null;}
function blocked(world,p,r,mode,ignoreId=null){const support=surfaceAt(world,p,mode);if(world.groundCoverageRequired&&mode!=='bird'&&!support&&!Number.isFinite(world.surfaceAt?.(p[0],p[2])))return true;return (world.obstacles||[]).some(o=>o.id!==ignoreId&&!(support&&o.id===support.anchorId&&Math.abs(p[1]-MODES.insect.eye-support.position[1])<1e-7)&&(!o.modes||o.modes.includes(mode))&&p[1]+r>o.min[1]&&p[1]-(mode==='human'?MODES.human.eye:r)<o.max[1]&&p[0]+r>o.min[0]&&p[0]-r<o.max[0]&&p[2]+r>o.min[2]&&p[2]-r<o.max[2]&&(!o.polygonXZ||circleIntersectsPolygon([p[0],p[2]],r,o.polygonXZ)));}
function constrain(world,p,mode){const c=profile(mode),b=bounds(world);const q=p.slice();q[0]=clamp(q[0],b.min[0]+c.radius,b.max[0]-c.radius);q[2]=clamp(q[2],b.min[2]+c.radius,b.max[2]-c.radius);const support=surfaceAt(world,q,mode),g=Math.max(floorAt(world,q[0],q[2]),support?.position[1]??-Infinity);q[1]=mode==='bird'?clamp(q[1],g+c.eye,b.max[1]-c.radius):g+c.eye;return q;}

/** Geometry-aware first-person controller. setWorld preserves orientation and reports invalidated poses. */
export function createNavigator(initialWorld,options={}){
 let world=initialWorld,mode=options.mode||'human',yaw=finite(options.yaw),pitch=clamp(finite(options.pitch),-1.35,1.35);
 let position=constrain(world,vec(options.position)?options.position:[0,1.62,4],mode),transition=null;
 const pose=()=>{const support=!transition?surfaceAt(world,position,mode):null;const attached=support&&Math.abs(position[1]-profile(mode).eye-support.position[1])<1e-7;return {mode,position:position.slice(),yaw,pitch,forward:[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)],up:[0,1,0],...profile(mode),transitioning:!!transition,...(attached?{...supportFrame(support,yaw,pitch),surfaceContact:{anchorId:support.anchorId,surfaceId:support.surfaceId,position:support.position}}:{})};};
 function moveTo(target,activeMode=mode){const c=profile(activeMode),distance=length(sub(target,position));const n=Math.max(1,Math.ceil(distance/Math.max(c.radius*.5,.003)));const start=position.slice();let hit=false,travelled=0;
  const accept=candidate=>{const delta=sub(candidate,position),distance=length(delta),horizontal=Math.hypot(delta[0],delta[2]),hasSurface=surfaceAt(world,position,activeMode)||surfaceAt(world,candidate,activeMode);const discreteStep=activeMode==='insect'&&Math.abs(delta[1])<=c.step&&Math.abs(delta[1])>horizontal*Math.tan(80*Math.PI/180)+1e-9;const cost=discreteStep?horizontal:distance;if(activeMode!=='insect'||!hasSurface||travelled+cost<=length(sub(target,start))+1e-12){travelled+=cost;position=candidate;return;}const remaining=Math.max(0,length(sub(target,start))-travelled);let low=0,high=1,best=position;for(let j=0;j<32;j++){const t=(low+high)/2,probe=constrain(world,position.map((v,k)=>v+(candidate[k]-v)*t),activeMode);if(length(sub(probe,position))<=remaining&&!blocked(world,probe,c.radius,activeMode)){low=t;best=probe;}else high=t;}travelled+=length(sub(best,position));position=best;};
  // Subdivision bounded by frame dt/speed in step; external restore is checked separately.
  const cuts=activeMode==='insect'&&world.surfaceContact?world.surfaceContact.breaks(start,target):[0,1];const samples=[...new Set([...Array.from({length:n},(_,i)=>(i+1)/n),...cuts,...cuts.slice(1).map((t,i)=>(t+cuts[i])/2)])].filter(t=>t>0).sort((a,b)=>a-b);
  for(const t of samples){if(activeMode==='insect'&&travelled>=distance-1e-12)break;const goal=start.map((v,k)=>v+(target[k]-v)*t);if(activeMode==='insect')goal[1]=position[1];const q=constrain(world,goal,activeMode);const oldGround=activeMode==='insect'?position[1]-c.eye:floorAt(world,position[0],position[2]),newGround=activeMode==='insect'?q[1]-c.eye:floorAt(world,q[0],q[2]);if(activeMode!=='bird'&&Math.abs(newGround-oldGround)>c.step){hit=true;break;}
   if(!blocked(world,q,c.radius,activeMode)){accept(q);continue;}
   hit=true; // slide on the unblocked axis, never tunnel through a thin wall.
   for(const axis of [0,2,1]){const s=position.slice();s[axis]=q[axis];const candidate=constrain(world,s,activeMode);if((activeMode!=='insect'||Math.abs(candidate[1]-position[1])<=c.step)&&!blocked(world,candidate,c.radius,activeMode))accept(candidate);}
  }return !hit;
 }
 return {pose,
  look(dx,dy){yaw+=finite(dx);pitch=clamp(pitch+finite(dy),-1.35,1.35);return pose();},
  changeMode(next,{duration=1.2}={}){profile(next);if(next===mode)return pose();const from=position.slice(),previousMode=mode,departureSupport=next==='bird'?pose().surfaceContact?.anchorId:null;mode=next;const target=constrain(world,from,next);if(next==='bird')target[1]=Math.min(bounds(world).max[1]-profile(next).radius,Math.max(target[1],floorAt(world,target[0],target[2])+2.8));if(blocked(world,target,profile(next).radius,next)){mode=previousMode;throw new Error('Embodiment has insufficient clearance');}transition={from,fromMode:previousMode,departureSupport:departureSupport??(next==='insect'?surfaceAt(world,target,next)?.anchorId:null),to:target,t:0,duration:Math.max(.01,finite(duration,1.2))};return pose();},
  step(input={},dt=1/60){dt=clamp(finite(dt),0,.1);if(transition){const t=transition;t.t=Math.min(1,t.t+dt/t.duration);const s=t.t*t.t*(3-2*t.t);const target=t.from.map((v,i)=>v+(t.to[i]-v)*s); // Height transitions retain world coordinates and heading.
    const p=target.slice();const c=profile(mode);p[1]=Math.max(p[1],floorAt(world,p[0],p[2])+c.near*2);const delta=sub(p,position),samples=Math.max(1,Math.ceil(length(delta)/Math.max(c.radius*.5,.003)));let obstructed=false;for(let i=1;i<=samples;i++){if(blocked(world,add(position,delta.map(v=>v*i/samples)),c.radius,mode,t.departureSupport)){obstructed=true;break;}}if(!obstructed)position=p;else {position=t.from;mode=t.fromMode;transition=null;return pose();}if(t.t===1){position=t.to.slice();transition=null;}return pose();}
   const c=profile(mode),f=clamp(finite(input.forward),-1,1),r=clamp(finite(input.right),-1,1),u=mode==='bird'?clamp(finite(input.up),-1,1):0;let d=[Math.sin(yaw)*f+Math.cos(yaw)*r,u,-Math.cos(yaw)*f+Math.sin(yaw)*r];const support=surfaceAt(world,position,mode);if(support&&Math.abs(position[1]-c.eye-support.position[1])<1e-7){const frame=supportFrame(support,yaw,0),right=cross(frame.forward,frame.up);d=frame.forward.map((v,i)=>v*f+right[i]*r);}if(length(d)>1)d=unit(d);moveTo(add(position,d.map(v=>v*c.speed*dt)));return pose();},
  restore(saved){profile(saved.mode);if(!vec(saved.position)||![saved.yaw,saved.pitch].every(Number.isFinite))throw new TypeError('Invalid viewpoint');const p=constrain(world,saved.position,saved.mode);if(saved.surfaceContact&&surfaceAt(world,p,saved.mode)?.anchorId!==saved.surfaceContact.anchorId)return {ok:false,reason:'support-removed'};if(blocked(world,p,profile(saved.mode).radius,saved.mode))return {ok:false,reason:'viewpoint-obstructed'};mode=saved.mode;position=p;yaw=saved.yaw;pitch=clamp(saved.pitch,-1.35,1.35);transition=null;return {ok:true,pose:pose(),adjusted:length(sub(p,saved.position))>1e-6};},
  setWorld(next){const previous=pose(),oldWorld=world,oldTransition=transition,oldPosition=position.slice();let accepted=false;try{world=next;const p=constrain(world,position,mode);if(previous.surfaceContact&&surfaceAt(world,p,mode)?.anchorId!==previous.surfaceContact.anchorId)return {ok:false,reason:'support-removed'};if(blocked(world,p,profile(mode).radius,mode))return {ok:false,reason:'viewpoint-obstructed'};position=p;transition=null;const current=pose();accepted=true;return {ok:true,pose:current};}finally{if(!accepted){world=oldWorld;transition=oldTransition;position=oldPosition;}}}
 };
}

/** AABB corner fitting adapted from HAMON Engine camera.rs; see docs/VISITS.md. */
export function fitOverview({min,max},aspect=1,direction=[.8,.65,1],fov=58,margin=1.12){
 if(!vec(min)||!vec(max)||min.some((v,i)=>v>max[i]))throw new TypeError('Invalid bounds');
 if(!vec(direction)||length(direction)<1e-9||!Number.isFinite(fov)||fov<=1||fov>=179||!Number.isFinite(margin)||margin<1)throw new TypeError('Invalid camera fit');
 const center=min.map((v,i)=>(v+max[i])/2),dir=unit(direction);const upSeed=Math.abs(dir[1])>.99?[0,0,1]:[0,1,0],right=unit(cross(upSeed,dir)),up=cross(dir,right);const ty=Math.tan(fov*Math.PI/360),tx=ty*clamp(finite(aspect,1),.05,20);let distance=.01,zmin=Infinity,zmax=-Infinity;
 for(let i=0;i<8;i++){const p=min.map((v,k)=>(i&(1<<k)?max[k]:v)-center[k]),z=dot(p,dir);zmin=Math.min(zmin,z);zmax=Math.max(zmax,z);distance=Math.max(distance,z+margin*Math.max(Math.abs(dot(p,right))/tx,Math.abs(dot(p,up))/ty));}
 distance=Math.max(distance,zmax+.05);return {position:add(center,dir.map(v=>v*distance)),target:center,up,near:Math.max(.001,(distance-zmax)*.5),far:Math.max(1,(distance-zmin)*1.1),fov};
}

const anchors=(place)=>Array.isArray(place.anchors)?place.anchors:Object.values(place.anchors||{});
const anchorPosition=a=>a.position||a.transform?.position;
const supportId=value=>typeof value==='string'&&/^[a-zA-Z0-9:_-]{1,180}$/.test(value);
/** Snapshot of personal visit intent, never an animal observation. Caller persists it with the place. */
export function captureVisit(place,pose,{id,anchorId,label='A quiet moment',at=null}={}){
 const anchor=anchors(place).find(a=>a.id===anchorId&&!a.deleted);if(!anchor||!vec(anchorPosition(anchor)))throw new Error('A surviving landmark is required');
 const underwater=pose.mode==='underwater';
 if(underwater){if(anchor.kind!=='water'||pose.waterId!==`${anchorId}:water`||Math.abs(pose.pitch)>1.35)throw new TypeError('A matching water landmark is required');}
 else profile(pose.mode);
 if(!id||!vec(pose.position)||![pose.yaw,pose.pitch].every(Number.isFinite))throw new TypeError('Invalid visit');
 let support=null;
 if(Object.hasOwn(pose,'surfaceContact')){
  if(pose.mode!=='insect'||!supportId(pose.surfaceContact?.anchorId))throw new TypeError('Invalid visit support');
  support=anchors(place).find(a=>a.id===pose.surfaceContact.anchorId&&!a.deleted);
  if(!support||!vec(anchorPosition(support))||!Array.isArray(support.sourceIds)||!support.sourceIds.length)
   throw new Error('A surviving support landmark and its sources are required');
 }
 // Keep the chosen personal landmark and the surface beneath the visitor as
 // separate identities. Only stable anchor/source IDs survive mesh rebuilds.
 const sourceIds=support?[...new Set([...(anchor.sourceIds||[]),...support.sourceIds])]:[...(anchor.sourceIds||[])];
 return {id,kind:'personal-visit',label,at,placeId:place.id,revision:place.revision,epoch:place.epoch??0,anchorId,offset:sub(pose.position,anchorPosition(anchor)),mode:pose.mode,yaw:pose.yaw,pitch:pose.pitch,...(underwater?{waterId:pose.waterId}:{}),...(support?{supportAnchorId:support.id}:{}),sourceIds,provenance:'personal-recollection'};
}
export function resolveVisit(place,visit){
 const fail=reason=>({ok:false,reason});if(visit.placeId!==place.id)return fail('different-place');if((place.epoch??0)!==visit.epoch)return fail('history-invalidated');
 const anchor=anchors(place).find(a=>a.id===visit.anchorId&&!a.deleted);if(!anchor||!vec(anchorPosition(anchor)))return fail('landmark-removed');
 const sources=place.observations?.map(o=>o.source)||(Array.isArray(place.sources)?place.sources:Object.values(place.sources||{}));if(!Array.isArray(visit.sourceIds)||visit.sourceIds.some(id=>(place.revokedSources||[]).includes(id)||!sources.some(s=>s.id===id&&!['deleted','revoked'].includes(s.status))))return fail('source-removed');
 const underwater=visit.mode==='underwater';
 if(!vec(visit.offset)||![visit.yaw,visit.pitch].every(Number.isFinite)||(underwater?(visit.waterId!==`${visit.anchorId}:water`||Math.abs(visit.pitch)>1.35):!Object.hasOwn(MODES,visit.mode)))return fail('invalid-visit');
 const supported=Object.hasOwn(visit,'supportAnchorId');
 if(supported&&(visit.mode!=='insect'||!supportId(visit.supportAnchorId)))return fail('invalid-visit');
 // A changed water shape may make today's viewpoint unavailable while its
 // retained revision is still meaningful. Geometry admission belongs to the
 // receiving controller, so this structural check does not erase that memory.
 // The same applies to insect support: retain its identity for restore(), but
 // do not require today's surface to exist before the old revision can load.
 return {ok:true,revised:place.revision!==visit.revision,pose:{position:add(anchorPosition(anchor),visit.offset),mode:visit.mode,yaw:visit.yaw,pitch:visit.pitch,...(underwater?{waterId:visit.waterId}:{}),...(supported?{surfaceContact:{anchorId:visit.supportAnchorId}}:{})},sourceIds:visit.sourceIds.slice(),capturedRevision:visit.revision,currentRevision:place.revision};
}


/** Admit the last presented camera as an ordinary personal viewpoint. No live
 * navigator or animal state is changed; unsupported clamping or roll is refused. */
export function admitCameraViewpoint(world, camera, preferredMode = 'human') {
 const positionTolerance=1e-6,directionTolerance=1e-7;
 const isVector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
 const normalized=value=>{
  if(!isVector(value))return null;
  const size=Math.hypot(...value);
  return Number.isFinite(size)&&size>1e-12?value.map(component=>component/size):null;
 };
 const orthogonalUp=(up,forward)=>{
  const n=normalized(up);if(!n||!forward)return null;
  const projection=n.reduce((sum,component,index)=>sum+component*forward[index],0);
  return normalized(n.map((component,index)=>component-projection*forward[index]));
 };
 const targetPosition=isVector(camera?.position)?camera.position.slice():null;
 const targetForward=normalized(camera?.forward),targetUp=orthogonalUp(camera?.up,targetForward);
 if(!targetPosition||!targetForward||!targetUp)return {ok:false,reason:'camera-unavailable',failures:[]};
 const yaw=Math.atan2(targetForward[0],-targetForward[2]);
 const pitch=Math.atan2(targetForward[1],Math.hypot(targetForward[0],targetForward[2]));
 const initialMode=Object.hasOwn(MODES,preferredMode)?preferredMode:'human';
 const failures=[];
 const mismatch=pose=>{
  if(!isVector(pose?.position)||distance(pose.position,targetPosition)>positionTolerance)return 'position-adjusted';
  const forward=normalized(pose.forward),up=orthogonalUp(pose.up,forward);
  if(!forward||!up||distance(forward,targetForward)>directionTolerance||distance(up,targetUp)>directionTolerance)return 'orientation-adjusted';
  return null;
 };
 for(const mode of new Set([initialMode,'bird'])){
  try{
   const trial=createNavigator(world),restored=trial.restore({mode,position:targetPosition.slice(),yaw,pitch});
   if(!restored.ok){failures.push({mode,reason:restored.reason||'viewpoint-unavailable'});continue;}
   const firstMismatch=restored.adjusted?'position-adjusted':mismatch(restored.pose);
   if(firstMismatch){failures.push({mode,reason:firstMismatch});continue;}
   // Replay the persisted ordinary pose and optional stable support anchor.
   // Runtime mesh/contact metadata is reconstructed by the receiving navigator.
   const saved={mode:restored.pose.mode,position:restored.pose.position.slice(),yaw:restored.pose.yaw,pitch:restored.pose.pitch};
   if(restored.pose.surfaceContact)saved.surfaceContact={anchorId:restored.pose.surfaceContact.anchorId};
   const replayed=createNavigator(world).restore(saved);
   const replayMismatch=!replayed.ok?(replayed.reason||'viewpoint-unavailable'):replayed.adjusted?'position-adjusted':mismatch(replayed.pose);
   if(replayMismatch){failures.push({mode,reason:replayMismatch});continue;}
   return {ok:true,pose:replayed.pose};
  }catch{failures.push({mode,reason:'viewpoint-unavailable'});}
 }
 return {ok:false,reason:'viewpoint-not-representable',failures};
}
