/** Original, authored giant-salamander movement. Not an observed individual or a measured wild gait.
 * Metres, +Y up, +Z forward. Fixed 120 Hz integration; stance toes retain world positions.
 * Four front / five rear digits are rendered by salamander-rig.mjs. No external gills,
 * mammalian breathing cycle, feeding lure, chase interaction or respiratory countdown.
 */
import {solveLeg} from './habitat.mjs';
export const SALAMANDER_BODY=Object.freeze({length:1.03,width:.29,height:.125,clearance:.052,legUpper:.09,legLower:.095,stride:.12,speed:.028,footLift:.018});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>t*t*(3-2*t),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const finite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const footOffsets=[[-.173,.14],[.173,.14],[-.162,-.19],[.162,-.19]];
// A slow lateral-sequence crawl: one short swing at a time, rather than a bounding trot.
const phaseOffsets=[0,.5,.75,.25],stance=.78;
// The articulated tail bends away from the root centerline during crawl and turns.
const tailEnvelope=[-.12,-.06,0,.06,.12].flatMap(x=>[-.62,-.52,-.42,-.32].map(z=>[x,z]));
const spineZ=[0,.20,-.18,-.29,-.39,-.49,-.59],spineWindows=[[-.12,.12],[.10,.44],[-.28,-.08],[-.35,-.23],[-.45,-.33],[-.55,-.43],[-.62,-.50]],spineClearance=[.052,.052,.052,.052,.052,.044,.024];
const bodySupportSamples=[...[-.11,0,.11].flatMap(x=>[-.24,-.18,-.12,-.06,0,.06,.12,.18,.24,.30,.36].map(z=>[x,z])),...[-.14,.14].flatMap(x=>[.20,.30].map(z=>[x,z])),[-.07,.40],[.07,.40],...[0,-.035,.035].flatMap(x=>[-.30,-.40,-.50,-.60].map(z=>[x,z]))];
function admit(input){
 if(!input||typeof input.surfaceAt!=='function'||!finite3(input.bounds?.min)||!finite3(input.bounds?.max)||!input.bounds.min.every((v,i)=>v<input.bounds.max[i]))throw new TypeError('Salamander requires a supported surface and finite bounds');
 const obstacles=(input.obstacles??[]).map(o=>{if(!finite3(o.min)||!finite3(o.max)||!o.min.every((v,i)=>v<o.max[i]))throw new TypeError('Invalid salamander obstacle');return {min:[...o.min],max:[...o.max]};});
 const routeXZ=(input.routeXZ??[]).map(p=>{if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))throw new TypeError('Invalid authored salamander route');return [...p];});
 return {surfaceAt:input.surfaceAt,surfaceNormalAt:input.surfaceNormalAt,supportAt:input.supportAt,bounds:{min:[...input.bounds.min],max:[...input.bounds.max]},obstacles,routeXZ};
}
export function createSalamanderSimulation(input,{position,yaw=0,seed=17,initialRest=4}={}){
 let world=admit(input);
 if(!finite3(position)||!Number.isFinite(yaw)||!Number.isFinite(initialRest)||initialRest<0||initialRest>60)throw new TypeError('Provide a finite salamander starting pose');
 let center=[...position],heading=yaw,time=0,phase=0,accumulator=0,state='sheltering',reason='quiet at a supported refuge',turn=0,routeIndex=0,avoidanceRemaining=0,everPlaced=false,lastBodySupport=null,spineWorldY=[],axial=0,legPoses=[];
 let steering=null,randomState=seed>>>0||1;const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 let restUntil=initialRest,nextRest=initialRest+16+random()*8,turnSign=1,feet=[];
 const height=(x,z)=>{const h=world.surfaceAt(x,z);return Number.isFinite(h)?h:null;};
 const normalAt=(x,z)=>{const n=world.surfaceNormalAt?.(x,z)??world.supportAt?.(x,z)?.normal;if(!finite3(n)||n[1]<=0)return [0,1,0];const length=Math.hypot(...n);return n.map(v=>v/length);};
 const toWorld=(x,y,z)=>[center[0]+x*Math.cos(heading)+z*Math.sin(heading),center[1]+y,center[2]-x*Math.sin(heading)+z*Math.cos(heading)];
 function spineTargets(p,atYaw=heading){
  const samples=bodySupportSamples.map(([x,z])=>({z,h:height(p[0]+x*Math.cos(atYaw)+z*Math.sin(atYaw),p[2]-x*Math.sin(atYaw)+z*Math.cos(atYaw))}));
  return spineZ.map((z,i)=>{let floor=height(p[0]+z*Math.sin(atYaw),p[2]+z*Math.cos(atYaw));if(floor===null)return p[1]-SALAMANDER_BODY.clearance+spineClearance[i];if(world.supportAt)for(const sample of samples)if(sample.h!==null&&sample.z>=spineWindows[i][0]&&sample.z<=spineWindows[i][1])floor=Math.max(floor,sample.h);return floor+spineClearance[i]+(world.supportAt?.004:0);});
 }
 function bodySupport(p,atYaw=heading){if(height(p[0],p[2])===null)return null;return spineTargets(p,atYaw)[0]-SALAMANDER_BODY.clearance;}
 function spineOffsetAt(z,ys=spineWorldY){if(!ys.length)return 0;if(z>=0)return (ys[1]-ys[0])*clamp(z/.20,0,1);return (ys[2]-ys[0])*clamp(-z/.18,0,1);}
 function supported(p,previous=null,atYaw=heading){
  const h=height(p[0],p[2]),b=world.bounds;if(h===null||p[0]-.25<b.min[0]||p[0]+.25>b.max[0]||p[2]-.25<b.min[2]||p[2]+.25>b.max[2])return false;
  if(previous!==null&&Math.abs(h-previous)>.045)return false;
  if(world.obstacles.some(o=>p[0]+.16>o.min[0]&&p[0]-.16<o.max[0]&&p[2]+.16>o.min[2]&&p[2]-.16<o.max[2]&&h+.14>o.min[1]&&h<o.max[1]))return false;
  // A supported center does not prove support under the head, tail and four limbs.
  for(const [x,z] of [[-.23,.20],[.23,.20],[-.23,-.24],[.23,-.24],[-.15,.30],[.15,.30],[0,.44],[0,-.61],[-.05,-.4],[.05,-.4]]){const q=[p[0]+x*Math.cos(atYaw)+z*Math.sin(atYaw),p[2]-x*Math.sin(atYaw)+z*Math.cos(atYaw)],y=height(...q);if(y===null||Math.abs(y-h)>.060||q[0]<b.min[0]||q[0]>b.max[0]||q[1]<b.min[2]||q[1]>b.max[2]||world.obstacles.some(o=>q[0]>o.min[0]&&q[0]<o.max[0]&&q[1]>o.min[2]&&q[1]<o.max[2]&&h+.14>o.min[1]&&h<o.max[1]))return false;}
  for(const [x,z] of tailEnvelope){const q=[p[0]+x*Math.cos(atYaw)+z*Math.sin(atYaw),p[2]-x*Math.sin(atYaw)+z*Math.cos(atYaw)];if(q[0]<b.min[0]||q[0]>b.max[0]||q[1]<b.min[2]||q[1]>b.max[2]||world.obstacles.some(o=>q[0]>o.min[0]&&q[0]<o.max[0]&&q[1]>o.min[2]&&q[1]<o.max[2]&&h+.14>o.min[1]&&h<o.max[1]))return false;}
  return true;
 }
 function target(i,lead=0){const [x,z]=footOffsets[i],p=toWorld(x,0,z+lead),h=height(p[0],p[2]);if(h===null)return null;p[1]=h+.004;return p;}
 function plant(){feet=footOffsets.map((_,i)=>({toe:target(i,.024),contact:true,from:null,progress:0}));if(feet.some(f=>!f.toe)){state='unplaced';reason='no supported foot contact';feet=feet.map(f=>({...f,toe:f.toe??[...center],contact:false}));}}
 if(supported(center)){spineWorldY=spineTargets(center);center[1]=spineWorldY[0];lastBodySupport=center[1]-SALAMANDER_BODY.clearance;plant();everPlaced=state!=='unplaced';}
 else {state='unplaced';reason='no supported starting bed';feet=footOffsets.map(()=>({toe:[...center],contact:false,from:null}));}
 function hipAt(i,p=center,atYaw=heading,ys=spineWorldY){const side=i%2===0?-1:1,x=side*.078,z=i<2?.145:-.18;return [p[0]+x*Math.cos(atYaw)+z*Math.sin(atYaw),p[1]-.018+spineOffsetAt(z,ys),p[2]-x*Math.sin(atYaw)+z*Math.cos(atYaw)];}
 function distanceToHip(i,p=center,atYaw=heading,ys=spineWorldY){const h=hipAt(i,p,atYaw,ys);return Math.hypot(...feet[i].toe.map((v,k)=>v-h[k]));}
 function advanceFeet(delta,dt){
  const old=phase;phase=(phase+delta)%1;
  let swinging=feet.findIndex(f=>!f.contact);
  if(swinging<0){
   const threatened=feet.map((f,i)=>({i,d:distanceToHip(i)})).sort((a,b)=>b.d-a.d).find(f=>f.d>.145);
   let chosen=threatened?.i??-1;
   if(chosen<0)for(let i=0;i<4;i++){const before=(old+phaseOffsets[i])%1,after=(phase+phaseOffsets[i])%1;if(before<stance&&after>=stance){chosen=i;break;}}
   if(chosen>=0){const f=feet[chosen];f.contact=false;f.from=[...f.toe];f.progress=0;swinging=chosen;}
  }
  if(swinging>=0){const f=feet[swinging],to=target(swinging,.045);if(!to){state='unplaced';reason='foot support removed';feet.forEach(f=>f.contact=false);return;}
   f.progress=Math.min(1,f.progress+dt/.65);const u=smooth(f.progress);f.toe=f.from.map((v,k)=>v+(to[k]-v)*u);f.toe[1]+=Math.sin(Math.PI*f.progress)*SALAMANDER_BODY.footLift;const under=height(f.toe[0],f.toe[2]);if(under!==null)f.toe[1]=Math.max(f.toe[1],under+.004+Math.sin(Math.PI*f.progress)*.008);
   if(f.progress>=1){f.toe=to;f.contact=true;f.from=null;}
  }
 }
 function tick(dt){
  time+=dt;if(state==='unplaced')return;
  if(!supported(center)){state='unplaced';reason='habitat no longer supports this body';feet.forEach(f=>f.contact=false);return;}
  // Driven (src/embody.mjs): the same body, legs, support rules and 120 Hz ticks, steered by a visitor who has become it.
  if(steering&&(state==='sheltering'||state==='resting')){state='crawling';reason='moving where it is steered';}
  if(state==='sheltering'||state==='resting'){if(time<restUntil)return;state='crawling';reason='slow exploration of supported bed';}
  if(!steering&&time>=nextRest&&feet.every(f=>f.contact)){state='resting';reason='quiet pause on the streambed';restUntil=time+3+random()*3;nextRest=restUntil+16+random()*8;turn=0;return;}
  let requested=heading;
  if(steering)requested=heading+steering.turn*1.2;
  else if(world.routeXZ.length){const goal=world.routeXZ[routeIndex],dx=goal[0]-center[0],dz=goal[1]-center[2];if(Math.hypot(dx,dz)<.12)routeIndex=(routeIndex+1)%world.routeXZ.length;else requested=Math.atan2(dx,dz);}
  const angle=wrap(requested-heading),delta=clamp(angle,-(steering?1.1:.18)*dt,(steering?1.1:.18)*dt);
  let nextHeading=heading+delta,rate=steering?SALAMANDER_BODY.speed*8*Math.max(0,steering.forward):SALAMANDER_BODY.speed*(Math.abs(angle)>1.2?.4:1),nextState=steering&&steering.forward<=.01&&Math.abs(steering.turn)<=.01?'resting':'crawling';
  const oldHeading=heading,oldCenter=[...center],ground=height(center[0],center[2]);
  let candidate=[center[0]+Math.sin(nextHeading)*rate*dt,center[1],center[2]+Math.cos(nextHeading)*rate*dt],ahead=[center[0]+Math.sin(nextHeading)*.26,center[1],center[2]+Math.cos(nextHeading)*.26];
  if(steering){
   // a bank, stone or edge ahead stops it; it never turns itself away
   if(rate>0&&(!supported(ahead,ground,nextHeading)||!supported(candidate,ground,nextHeading))){rate=0;candidate=[...center];nextState='turning';}
   if(!supported(candidate,ground,nextHeading))nextHeading=heading;
  }else if(avoidanceRemaining>0||!supported(ahead,ground,nextHeading)||!supported(candidate,ground,nextHeading)){
   if(avoidanceRemaining<=0){turnSign=random()>.5?1:-1;avoidanceRemaining=1.9+random()*.35;}
   nextState='turning';rate=0;candidate=[...center];nextHeading=heading+turnSign*.18*dt;
   // A turn sweeps the long head/tail through space too; reverse before crossing a bank.
   if(!supported(candidate,ground,nextHeading)){turnSign*=-1;nextHeading=heading+turnSign*.18*dt;if(!supported(candidate,ground,nextHeading))nextHeading=heading;}
  }
  // Existing head/trunk/pelvis/tail bones conform locally; a rear stone must not
  // lift the entire animal like a rigid board. All vertical changes remain bounded.
  const desiredSpine=spineTargets(candidate,nextHeading);let nextSpine=spineWorldY.map((y,i)=>y+clamp(desiredSpine[i]-y,-.08*dt,.08*dt));
  candidate[1]=nextSpine[0];
  if(desiredSpine.some((y,i)=>y>nextSpine[i]+.0001)){candidate[0]=center[0];candidate[2]=center[2];nextHeading=heading;}
  if(feet.some((f,i)=>f.contact&&distanceToHip(i,candidate,nextHeading,nextSpine)>.162)){candidate=[...center];nextHeading=heading;nextSpine=[...spineWorldY];}
  avoidanceRemaining=Math.max(0,avoidanceRemaining-Math.abs(nextHeading-heading));
  center=candidate;heading=nextHeading;spineWorldY=nextSpine;lastBodySupport=desiredSpine[0]-SALAMANDER_BODY.clearance;turn=(heading-oldHeading)/dt;
  state=nextState;reason=state==='turning'?'turning from unsupported bed or stone':'slow exploration of supported bed';
  const distance=Math.hypot(center[0]-oldCenter[0],center[2]-oldCenter[2]);
  advanceFeet(distance/SALAMANDER_BODY.stride+Math.abs(heading-oldHeading)*.7+(steering&&heading===oldHeading?Math.abs(delta)*.7:0),dt);

 }
 // Track bend planes at simulation rate, never at render/snapshot rate.
 function updateLegPoses(dt){
  const desiredAxial=['crawling','turning'].includes(state)?Math.sin(phase*Math.PI*2)*.018:0;
  axial+=clamp(desiredAxial-axial,-.06*dt,.06*dt);
  legPoses=feet.map((f,i)=>{
   const side=i%2===0?-1:1,front=i<2,hip=toWorld(side*.078+axial*(front?1:-1),-.018+spineOffsetAt(front?.145:-.18),front?.145:-.18),pole=toWorld(side*.23,-.047+spineOffsetAt(front?.145:-.18),front?.06:-.25);
   const desired=solveLeg(hip,f.toe,pole,SALAMANDER_BODY.legUpper,SALAMANDER_BODY.legLower),previous=legPoses[i];
   if(!previous||!dt)return desired;
   const delta=desired.toe.map((v,k)=>v-hip[k]),distance=Math.hypot(...delta);
   if(distance<1e-10)return desired;
   const axis=delta.map(v=>v/distance);
   const project=v=>{const dot=v.reduce((n,x,k)=>n+x*axis[k],0);return v.map((x,k)=>x-dot*axis[k]);};
   const normalize=v=>{const length=Math.hypot(...v);return length>1e-10?v.map(x=>x/length):null;};
   const prior=normalize(project(previous.knee.map((v,k)=>v-previous.hip[k])));
   const wanted=normalize(project(desired.knee.map((v,k)=>v-hip[k])));
   if(!prior||!wanted)return desired;
   const cosine=clamp(prior.reduce((n,v,k)=>n+v*wanted[k],0),-1,1),angle=Math.acos(cosine),limit=4*dt;
   if(angle<=limit)return desired;
   let tangent=normalize(wanted.map((v,k)=>v-prior[k]*cosine));
   // At an exact antipode both arcs are equivalent; choose deterministically.
   if(!tangent)tangent=[axis[1]*prior[2]-axis[2]*prior[1],axis[2]*prior[0]-axis[0]*prior[2],axis[0]*prior[1]-axis[1]*prior[0]];
   const bend=prior.map((v,k)=>v*Math.cos(limit)+tangent[k]*Math.sin(limit));
   return solveLeg(hip,f.toe,hip.map((v,k)=>v+bend[k]),SALAMANDER_BODY.legUpper,SALAMANDER_BODY.legLower);
  });
 }
 updateLegPoses(0);
 function snapshot(){
  return {kind:'simulated',time,salamander:{id:'simulated-kyoto-giant-salamander',kind:'simulated',state,activity:state,reason,time,position:[...center],yaw:heading,phase,turn,axial,settling:Math.sin(time*.45)*.001,breath:0,bodySpec:SALAMANDER_BODY,routeIndex,spineOffsets:spineWorldY.map(y=>y-center[1]),feet:feet.map((f,i)=>{
   const pose=legPoses[i];
   return {...pose,hip:[...pose.hip],knee:[...pose.knee],toe:[...pose.toe],requestedToe:[...pose.requestedToe],contact:f.contact&&state!=='unplaced',groundHeight:height(f.toe[0],f.toe[2]),normal:normalAt(f.toe[0],f.toe[2]),digits:i<2?4:5,front:i<2,side:i%2===0?-1:1};
  })}};
 }
 return {snapshot,steer(input){steering=input?{forward:clamp(Number(input.forward)||0,-1,1),turn:clamp(Number(input.turn)||0,-1,1)}:null;if(!steering&&state!=='unplaced'){state='resting';restUntil=time+1;reason='quiet pause after being steered';}},step(dt){if(!Number.isFinite(dt)||dt<0||dt>10)throw new RangeError('step requires 0–10 seconds');accumulator+=dt;while(accumulator+1e-12>=1/120){tick(1/120);updateLegPoses(1/120);accumulator-=1/120;}return snapshot();},setWorld(next){const previousSupport=bodySupport(center,heading)??lastBodySupport;world=admit(next);const h=bodySupport(center,heading),displaced=h===null||previousSupport===null||Math.abs(previousSupport-h)>1e-6||feet.some(f=>f.contact&&(height(f.toe[0],f.toe[2])===null||Math.abs(f.toe[1]-.004-height(f.toe[0],f.toe[2]))>1e-6));
  if(state==='unplaced'&&everPlaced&&!displaced&&supported(center)){plant();updateLegPoses(0);state='resting';reason='support restored at original pose';restUntil=time+2;nextRest=time+18;return;}
  if(displaced||!supported(center)){state='unplaced';reason='support removed or revised';feet.forEach(f=>f.contact=false);}
 }};
}
