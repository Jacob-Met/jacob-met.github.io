import {pointInPolygon,validatePolygon} from './boundary.mjs';
import {solveLeg} from './habitat.mjs';

/** An illustrative water-surface inhabitant. Never creates or changes observations. */
export const SKATER_BODY=Object.freeze({length:.028,clearance:.008,supportRadius:.053,legs:Object.freeze([[.012,.018],[.027,.030],[.021,.027]])});
const clone=x=>JSON.parse(JSON.stringify(x));
const finite2=p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e6);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function segmentDistance(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l,0,1):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);}
function segmentsDistance(a,b,c,d){
 const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
 if(abC*abD<0&&cdA*cdB<0)return 0;
 return Math.min(segmentDistance(a,c,d),segmentDistance(b,c,d),segmentDistance(c,a,b),segmentDistance(d,a,b));
}

/** The ellipse uses exactly the 64 segments of the maintained rendered CircleGeometry. */
export function admitWaterSurfaces(input){
 if(!Array.isArray(input)||input.length>64)throw new TypeError('Expected at most 64 modeled water surfaces');
 const ids=new Set();
 return input.map(s=>{
  if(!s||typeof s.id!=='string'||!s.id||s.id.length>240||ids.has(s.id)||!Number.isFinite(s.y)||Math.abs(s.y)>1e6||(s.eligible!==undefined&&typeof s.eligible!=='boolean'))throw new TypeError('Invalid water surface');
  ids.add(s.id);let points;
  if(s.shape==='ellipse'){
   if(!finite2(s.center)||!finite2(s.radii)||s.radii.some(r=>r<=0||r>500))throw new TypeError('Invalid water ellipse');
   points=Array.from({length:64},(_,i)=>[s.center[0]+Math.cos(i*Math.PI/32)*s.radii[0],s.center[1]-Math.sin(i*Math.PI/32)*s.radii[1]]);
  }else if(s.shape==='polygon'){
   if(!Array.isArray(s.points)||s.points.length<3||s.points.length>128||!s.points.every(finite2))throw new TypeError('Invalid water outline');
   const center=[0,1].map(i=>(Math.min(...s.points.map(p=>p[i]))+Math.max(...s.points.map(p=>p[i])))/2);
   validatePolygon(s.points.map(p=>p.map((v,i)=>v-center[i])));
   points=s.points.map(p=>[...p]);
  }else throw new TypeError('Unknown water surface shape');
  const min=[0,1].map(i=>Math.min(...points.map(p=>p[i]))),max=[0,1].map(i=>Math.max(...points.map(p=>p[i])));
  return {id:s.id,anchorId:typeof s.anchorId==='string'?s.anchorId:s.id,y:s.y,points,min,max,eligible:s.eligible!==false};
 });
}
export function waterClearance(surface,point){
 if(!finite2(point)||!pointInPolygon(point,surface.points,0))return -1;
 return Math.min(...surface.points.map((a,i)=>segmentDistance(point,a,surface.points[(i+1)%surface.points.length])));
}
/** The whole swept support disk must fit; endpoint-only tests miss concave banks. */
export function waterTravelClear(surface,a,b,radius=SKATER_BODY.supportRadius){
 if(!finite2(a)||!finite2(b)||!Number.isFinite(radius)||radius<=0)return false;
 if(waterClearance(surface,a)<radius||waterClearance(surface,b)<radius)return false;
 return surface.points.every((p,i)=>segmentsDistance(a,b,p,surface.points[(i+1)%surface.points.length])>=radius);
}

export function createPondSkater(input,{seed=51}={}){
 if(!Number.isSafeInteger(seed))throw new TypeError('Seed must be an integer');
 let steering=null,surfaces=admitWaterSurfaces(input),water=null,waterId=null,position=[0,SKATER_BODY.clearance,0],yaw=0,time=0,carry=0,age=0,speed=0,state='unplaced',reason='no usable water surface',goal=null,rain=0,wait=.8,everPlaced=false,lastDisturbance=-Infinity,randomState=seed>>>0||1,ripples=[];
 const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 const xz=()=>[position[0],position[2]];
 const center=s=>s.min.map((v,i)=>(v+s.max[i])/2);
 function firstPosition(s){
  const points=[center(s)];for(let z=0;z<9;z++)for(let x=0;x<9;x++)points.push([s.min[0]+(s.max[0]-s.min[0])*(x+.5)/9,s.min[1]+(s.max[1]-s.min[1])*(z+.5)/9]);
  return points.find(p=>waterClearance(s,p)>=SKATER_BODY.supportRadius+.002)??null;
 }
 function placeFirst(){for(const s of surfaces.filter(s=>s.eligible).sort((a,b)=>a.id.localeCompare(b.id))){const p=firstPosition(s);if(p){water=s;waterId=s.id;position=[p[0],s.y+SKATER_BODY.clearance,p[1]];state='resting';reason='on a modeled water surface';everPlaced=true;return true;}}return false;}
 placeFirst();
 const setState=next=>{state=next;age=0;};
 function localPoint(x,y,z){const c=Math.cos(yaw),s=Math.sin(yaw);return [position[0]+x*c+z*s,position[1]+y,position[2]-x*s+z*c];}
 function legTargets(){
  const stroke=state==='rowing'?clamp(age/.22,0,1):state==='recovering'?1-clamp(age/.28,0,1):0;
  const lift=state==='recovering'?.010*Math.sin(Math.PI*clamp(age/.28,0,1)):0;
  const feet=[];
  for(const side of [-1,1])for(let pair=0;pair<3;pair++){
   const hip=localPoint(side*(pair===1?.004:.003),-.001,pair===0?.007:pair===2?-.007:0);
   const offset=pair===0?[side*.014,-SKATER_BODY.clearance,.023]:pair===1?[side*.038,-SKATER_BODY.clearance+lift,.024-.048*stroke]:[side*.028,-SKATER_BODY.clearance,-.031];
   const toe=localPoint(...offset),pole=localPoint(side*(pair===1?.024:.016),.008,pair===0?.015:pair===2?-.019:0);
   feet.push({pair,side,hip,toe,pole,contact:!(pair===1&&state==='recovering')});
  }return feet;
 }
 function selectGoal(away=null){
  if(!water)return null;const from=xz(),candidates=[];
  for(let i=0;i<48;i++){
   const p=water.min.map((v,k)=>v+(water.max[k]-v)*random()),d=distance(p,from),clearance=waterClearance(water,p);
   if(d<.06||d>.65||clearance<SKATER_BODY.supportRadius+.003||!waterTravelClear(water,from,p))continue;
   const direction=away?[(from[0]-away[0]),(from[1]-away[1])]:null;
   const awayScore=direction?((p[0]-from[0])*direction[0]+(p[1]-from[1])*direction[1])/d:0;
   if(away&&awayScore<0)continue;
   candidates.push({p,score:rain>.4?clearance+d*.02:away?-awayScore+d*.02:Math.abs(d-.24)+random()*.08});
  }
  candidates.sort((a,b)=>a.score-b.score);return candidates[0]?.p??null;
 }
 function beginRoute(away=null){goal=selectGoal(away);if(!goal){wait=1.2;reason='resting within this water outline';return false;}speed=0;setState('turning');reason=away?'responding to a gentle ripple':rain>.4?'seeking a quiet margin':'exploring the surface';return true;}
 function emitStroke(){for(const f of legTargets().filter(f=>f.pair===1))ripples.push({position:[...f.toe],age:0});ripples=ripples.slice(-12);}
 function arrive(){speed=0;goal=null;setState('resting');wait=rain>.4?Infinity:.65+random()*.8;reason=rain>.4?'resting by the margin':'resting on the surface';}
 /** Driven (src/embody.mjs): the same rowing cycle, ripples and bank rules, steered by a visitor who has become the strider. */
 function steerTick(dt){
  yaw=wrap(yaw+steering.turn*1.9*dt);goal=null;
  const f=steering.forward;
  if(f>.01){
   if(state==='resting'||state==='turning'){setState('rowing');emitStroke();}
   if(state==='rowing')speed=Math.min(.14*f,speed+.5*dt);else speed*=Math.exp(-.8*dt);
   reason='skating where it is steered';
  }else{
   speed*=Math.exp(-2.4*dt);
   if(speed<.004){speed=0;if(state!=='resting')setState('resting');reason='resting on the surface';}
   else if(state==='rowing'||state==='turning')setState('gliding');
  }
  const from=xz(),travel=speed*dt;
  if(travel>0){
   const next=[from[0]+Math.sin(yaw)*travel,from[1]+Math.cos(yaw)*travel];
   if(waterTravelClear(water,from,next)){position[0]=next[0];position[2]=next[1];}
   else{speed=0;setState('resting');reason='the bank is ahead';return;}
  }
  if(f>.01){
   if(state==='rowing'&&age>=.22)setState('recovering');
   else if(state==='recovering'&&age>=.28)setState('gliding');
   else if(state==='gliding'&&age>=.35){setState('rowing');emitStroke();}
  }
 }
 function tick(dt){
  time+=dt;age+=dt;ripples=ripples.map(r=>({...r,age:r.age+dt})).filter(r=>r.age<1.4);
  if(state==='unplaced')return;
  if(steering){steerTick(dt);return;}
  if(state==='resting'){if(age>=wait)beginRoute();return;}
  if(!goal){arrive();return;}
  const from=xz(),delta=[goal[0]-from[0],goal[1]-from[1]],d=Math.hypot(...delta);
  if(d<1e-7){arrive();return;}
  const heading=Math.atan2(delta[0],delta[1]);
  if(state==='turning'){
   const change=wrap(heading-yaw);yaw+=clamp(change,-1.9*dt,1.9*dt);
   if(Math.abs(change)<=1.9*dt+.0001){yaw=heading;setState('rowing');emitStroke();}return;
  }
  if(state==='rowing')speed=Math.min(.14,speed+.50*dt);
  else speed*=Math.exp(-1.65*dt);
  const travel=Math.min(d,speed*dt),next=from.map((v,i)=>v+delta[i]*travel/d);
  if(!waterTravelClear(water,from,next)){speed=0;goal=null;setState('resting');wait=.8;reason='bank interrupts this route';return;}
  position[0]=next[0];position[2]=next[1];yaw=heading;
  if(travel>=d-1e-10){arrive();return;}
  if(state==='rowing'&&age>=.22)setState('recovering');
  else if(state==='recovering'&&age>=.28)setState('gliding');
  else if(state==='gliding'&&age>=.65){setState('rowing');emitStroke();}
 }
 function snapshot(){
  const feet=state==='unplaced'?[]:legTargets().map(f=>({...solveLeg(f.hip,f.toe,f.pole,...SKATER_BODY.legs[f.pair]),pair:f.pair,side:f.side,contact:f.contact}));
  return {kind:'simulated',time,skater:{id:'simulated-water-strider',kind:'simulated',position:[...position],yaw,state,reason,speed,waterId,anchorId:water?.anchorId??null,feet,headYaw:Math.sin(time*.8)*.08,bodySpec:SKATER_BODY},surface:water?{id:water.id,anchorId:water.anchorId,y:water.y,points:water.points.map(p=>[...p])}:null,ripples:clone(ripples),weather:{rain}};
 }
 return {
  snapshot,
  steer(input){steering=input?{forward:clamp(Number(input.forward)||0,-1,1),turn:clamp(Number(input.turn)||0,-1,1)}:null;if(!steering&&state!=='unplaced'){goal=null;setState('resting');wait=.8;}},
  step(seconds){if(!Number.isFinite(seconds)||seconds<0||seconds>2)throw new RangeError('Skater step requires 0–2 seconds');carry+=seconds;let n=0;while(carry+1e-12>=1/120&&n++<241){tick(1/120);carry=Math.max(0,carry-1/120);}return snapshot();},
  setHabitat(input){
   const admitted=admitWaterSurfaces(input),next=admitted.find(s=>s.id===waterId&&s.eligible);surfaces=admitted;
   if(!everPlaced){placeFirst();return;}
   if(!next||Math.abs(position[1]-SKATER_BODY.clearance-next.y)>1e-7||waterClearance(next,xz())<SKATER_BODY.supportRadius){water=null;goal=null;speed=0;ripples=[];setState('unplaced');reason='water support changed or was removed';return;}
   water=next;
   if(state==='unplaced'){setState('resting');wait=.8;reason='water support restored at the same position';}
   if(goal&&!waterTravelClear(water,xz(),goal)){goal=null;speed=0;setState('resting');wait=.6;reason='the revised bank interrupts this route';}
  },
  setWeather({rain:value}){if(!Number.isFinite(value)||value<0||value>1)throw new TypeError('Rain requires 0–1');const changed=(rain>.4)!==(value>.4);rain=value;if(changed&&state!=='unplaced'){goal=null;speed=0;setState('resting');wait=.25;reason=rain>.4?'an imagined rain reaches the surface':'the surface is calm again';}},
  disturb(point,radius=.3){
   if(!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite)||!Number.isFinite(radius)||radius<=0||radius>10)throw new TypeError('Invalid surface disturbance');
   if(state==='unplaced'||time-lastDisturbance<.5||Math.hypot(...point.map((v,i)=>v-position[i]))>radius)return false;
   lastDisturbance=time;const accepted=beginRoute([point[0],point[2]]);if(accepted){ripples.push({position:[point[0],water.y,point[2]],age:0});ripples=ripples.slice(-12);}return accepted;
  }
 };
}
