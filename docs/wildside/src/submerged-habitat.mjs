import {admitWaterSurfaces,waterClearance,waterTravelClear} from './pond-skater.mjs';
import {circleIntersectsPolygon} from './boundary.mjs';

/** Source-bound artistic freshwater eligibility. A habitat is not a species sighting. */
export function freshwaterWaterSurfaces(place,surfaces){
 const sources=new Set((place.observations??[]).filter(o=>o.geographicContext?.profileId==='everglades-sawgrass-marsh'&&o.geographicContext.waterScenario==='illustrative-wet').map(o=>o.source.id));
 return surfaces.map(s=>({...s,eligible:s.eligible!==false&&(s.sourceIds??[]).some(id=>sources.has(id))}));
}
export const FLEA_BODY=Object.freeze({length:.004,radius:.0032});
const finite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const xz=p=>[p[0],p[2]],distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function segmentDistance(a,b,c,d){
 const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;
 const point=(p,q,r)=>{const dx=r[0]-q[0],dz=r[1]-q[1],l=dx*dx+dz*dz,t=l?clamp(((p[0]-q[0])*dx+(p[1]-q[1])*dz)/l,0,1):0;return Math.hypot(p[0]-q[0]-t*dx,p[1]-q[1]-t*dz);};
 return Math.min(point(a,c,d),point(b,c,d),point(c,a,b),point(d,a,b));
}
function intersectsSweep(a,b,r,points){
 if(circleIntersectsPolygon(a,r,points)||circleIntersectsPolygon(b,r,points))return true;
 return points.some((p,i)=>segmentDistance(a,b,p,points[(i+1)%points.length])<=r);
}
function segmentBox(a,b,r,box){
 let low=0,high=1;
 for(let i=0;i<3;i++){const delta=b[i]-a[i],min=box.min[i]-r,max=box.max[i]+r;if(Math.abs(delta)<1e-15){if(a[i]<=min||a[i]>=max)return false;continue;}let t0=(min-a[i])/delta,t1=(max-a[i])/delta;if(t0>t1)[t0,t1]=[t1,t0];low=Math.max(low,t0);high=Math.min(high,t1);if(low>=high)return false;}
 return true;
}

// Signed clearance is continuous across the existing admitted polygon edge. Its
// 1-Lipschitz bound lets a cell rule out missing interior space without tracing
// new terrain or depending on a water-wide sample spacing.
function signedClearance(surface,p){
 const inside=waterClearance(surface,p);
 return inside>=0?inside:-Math.min(...surface.points.map((a,i)=>segmentDistance(p,p,a,surface.points[(i+1)%surface.points.length])));
}
function cellQueue(){
 const heap=[];
 return {
  push(cell){let i=heap.length;heap.push(cell);while(i){const parent=(i-1)>>1;if(heap[parent].bound>=cell.bound)break;heap[i]=heap[parent];i=parent;}heap[i]=cell;},
  pop(){if(!heap.length)return null;const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].bound>heap[child].bound)child++;if(heap[child].bound<=last.bound)break;heap[i]=heap[child];i=child;}heap[i]=last;}return first;}
 };
}

/** Finite water above actual rendered support planes. No inferred bottom or global ground fallback.
 * Crossing support seams is conservative: the swept disk must fit one supporting plane. */
export function createWaterColumn({waterSurfaces=[],groundSupports=[],obstacles=[]}={}){
 const waters=admitWaterSurfaces(waterSurfaces);
 if(!waters.some(w=>w.eligible))return {at:()=>null,travel:()=>false,seed:()=>null,waterCount:0};
 const supports=groundSupports.map((g,i)=>admitWaterSurfaces([{id:g.id??`ground-${i}`,shape:'polygon',points:g.points,y:g.y}])[0]);
 const solids=obstacles.filter(o=>!o.modes&&finite3(o.min)&&finite3(o.max));
 function at(position,radius=FLEA_BODY.radius,waterId=null){
  if(!finite3(position)||!Number.isFinite(radius)||radius<=0)return null;
  const p=xz(position);
  for(const water of waters){
   if(!water.eligible||(waterId&&water.id!==waterId)||position[1]+radius>water.y+1e-12||waterClearance(water,p)<radius)continue;
   const support=supports.filter(s=>s.y+radius<=position[1]+1e-12&&waterClearance(s,p)>=radius).sort((a,b)=>b.y-a.y)[0];
   if(!support||supports.some(s=>s.y+radius>position[1]+1e-12&&circleIntersectsPolygon(p,radius,s.points))||solids.some(o=>segmentBox(position,position,radius,o)))continue;
   return {waterId:water.id,anchorId:water.anchorId,supportId:support.id,bottom:support.y,top:water.y,depth:water.y-support.y};
  }
  return null;
 }
 function travel(a,b,radius=FLEA_BODY.radius,waterId=null){
  const start=at(a,radius,waterId),end=at(b,radius,start?.waterId);if(!start||!end||start.waterId!==end.waterId)return false;
  const water=waters.find(w=>w.id===start.waterId);
  if(!waterTravelClear(water,xz(a),xz(b),radius))return false;
  const low=Math.min(a[1],b[1]);
  if(!supports.some(s=>s.y+radius<=low+1e-12&&waterTravelClear(s,xz(a),xz(b),radius)))return false;
  if(supports.some(s=>s.y+radius>low+1e-12&&intersectsSweep(xz(a),xz(b),radius,s.points)))return false;
  return !solids.some(o=>segmentBox(a,b,radius,o));
 }
 function seed(radius=FLEA_BODY.radius){
  if(!Number.isFinite(radius)||radius<=0)return null;
  const margin=Math.max(radius,.025),queue=cellQueue();let evaluations=0;
  const verticalCandidates=[];
  const orderedSupports=supports.slice().sort((a,b)=>b.y-a.y||a.id.localeCompare(b.id));
  function candidate(water,p){
   if(waterClearance(water,p)<margin)return null;
   const floor=orderedSupports.find(s=>waterClearance(s,p)>=margin);
   if(!floor||water.y-floor.y<radius*3)return null;
   const position=[p[0],(floor.y+water.y)/2,p[1]],column=at(position,radius,water.id);
   if(column)return {position,...column};
   if(verticalCandidates.length<4096)verticalCandidates.push({water,floor,p});
   return null;
  }
  function visit(water,floor,min,max){
   if(++evaluations>4096)return null;
   const p=min.map((v,i)=>(v+max[i])/2),half=min.map((v,i)=>(max[i]-v)/2);
   const clearance=Math.min(signedClearance(water,p),signedClearance(floor,p));
   const found=clearance>=margin?candidate(water,p):null;if(found)return found;
   const bound=clearance+Math.hypot(...half);
   if(bound>=margin&&Math.hypot(...half)>.0005)queue.push({water,floor,min,max,half,bound});
   return null;
  }
  for(const water of waters.filter(w=>w.eligible).sort((a,b)=>a.id.localeCompare(b.id))){
   const central=candidate(water,water.min.map((v,i)=>(v+water.max[i])/2));if(central)return central;
   for(const floor of orderedSupports){
    if(water.y-floor.y<radius*3)continue;
    const min=water.min.map((v,i)=>Math.max(v,floor.min[i])),max=water.max.map((v,i)=>Math.min(v,floor.max[i]));
    if(min.some((v,i)=>max[i]-v<margin*2))continue;
    const found=visit(water,floor,min,max);if(found)return found;
   }
  }
  // Work is bounded independently of physical footprint size. A refusal means
  // no suitable point was found in this search, not proof that none exists.
  for(let cell;(cell=queue.pop())&&evaluations<4096;){
   const axis=cell.half[0]>=cell.half[1]?0:1,middle=(cell.min[axis]+cell.max[axis])/2;
   const leftMax=cell.max.slice(),rightMin=cell.min.slice();leftMax[axis]=middle;rightMin[axis]=middle;
   for(const [min,max] of [[cell.min,leftMax],[rightMin,cell.max]]){const found=visit(cell.water,cell.floor,min,max);if(found)return found;}
  }
  // Finish the original search before trying other depths, preserving every
  // previously successful seed. A rock can block the midpoint of a usable column.
  let verticalEvaluations=0;
  for(const {water,floor,p} of verticalCandidates){
   const low=floor.y+radius,high=water.y-radius,cuts=[low,high];
   const cut=y=>{if(y>low&&y<high)cuts.push(y);};
   for(const solid of solids){
    // Match segmentBox's strict overlap for a stationary X/Z coordinate.
    if(p[0]<=solid.min[0]-radius||p[0]>=solid.max[0]+radius||
       p[1]<=solid.min[2]-radius||p[1]>=solid.max[2]+radius)continue;
    cut(solid.min[1]-radius);cut(solid.max[1]+radius);
   }
   for(const support of supports){
    if(circleIntersectsPolygon(p,radius,support.points))cut(support.y+radius);
   }
   cuts.sort((a,b)=>a-b);
   for(let i=cuts.length-1;i>0;i--){
    if(cuts[i]<=cuts[i-1])continue;
    if(verticalEvaluations>=4096)return null;
    verticalEvaluations++;
    const position=[p[0],(cuts[i-1]+cuts[i])/2,p[1]],column=at(position,radius,water.id);
    if(column)return {position,...column};
   }
  }
  return null;
 }
 return {at,travel,seed,waterCount:waters.filter(w=>w.eligible).length};
}

/** Original illustrative hop/recover/settle motion, inspired by paired antennal propulsion.
 * Fixed 120 Hz updates, bounded local excursion and the shared water/support collision seam. */
export function createSubmergedLife(initialColumn,{seed=55,count=6}={}){
 if(!Number.isSafeInteger(seed)||!Number.isInteger(count)||count<1||count>12)throw new TypeError('Bounded swimmer seed/count required');
 let column=initialColumn,time=0,carry=0,randomState=seed>>>0||1,swimmers=[],steering=null;
 const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 function populate(){
  const home=column.seed();if(!home)return;
  for(let i=0;i<count;i++){
   const angle=i*2.399,r=i===0?0:.011+random()*.012,position=home.position.map((v,k)=>v+(k===0?Math.cos(angle)*r:k===2?Math.sin(angle)*r:(random()-.5)*Math.min(.008,home.depth*.2)));
   if(!column.at(position,FLEA_BODY.radius,home.waterId))continue;
   swimmers.push({id:`${home.anchorId}:water-flea-${i}`,waterId:home.waterId,anchorId:home.anchorId,position,home:position.slice(),yaw:random()*Math.PI*2,phase:random(),rate:1.1+random()*.35,velocity:[0,0,0],state:'settling',turn:random()*6.28});
  }
 }
 populate();
 function tick(dt){
  time+=dt;
  for(const [index,s] of swimmers.entries()){
   // Driven (src/embody.mjs): the first swimmer, steered by a visitor who has become it. Same strokes, drag and water rules.
   const driven=index===0&&steering,push=driven?Math.max(0,steering.forward)*3:1;
   s.phase=(s.phase+dt*s.rate*(driven?(push>.01?1.8:.35):1))%1;s.state=s.phase<.22?'power-stroke':s.phase<.42?'recovering':'settling';
   const homeDistance=Math.hypot(s.position[0]-s.home[0],s.position[2]-s.home[2]);
   let desired=driven?s.yaw:homeDistance>.035?Math.atan2(s.home[0]-s.position[0],s.home[2]-s.position[2]):s.yaw+Math.sin(time*.45+s.turn)*.05;
   if(driven)s.yaw+=steering.turn*1.8*dt;else s.yaw+=clamp(Math.atan2(Math.sin(desired-s.yaw),Math.cos(desired-s.yaw)),-dt*1.4,dt*1.4);
   const stroke=s.phase<.22?Math.sin(Math.PI*s.phase/.22):0,drag=Math.exp(-7*dt);
   s.velocity[0]=(s.velocity[0]+Math.sin(s.yaw)*.040*stroke*push*dt)*drag;
   s.velocity[2]=(s.velocity[2]+Math.cos(s.yaw)*.040*stroke*push*dt)*drag;
   s.velocity[1]=(s.velocity[1]+((driven?.040*stroke*push+steering.up*.035-(steering.up===0?.006:0):.070*stroke)-(driven?0:.010))*dt)*drag;
   const next=s.position.map((v,k)=>v+s.velocity[k]*dt);
   if(column.travel(s.position,next,FLEA_BODY.radius,s.waterId))s.position=next;
   else{
    // No endpoint clamp/teleport: blocked motion is stopped, then the next stroke turns inward.
    const horizontal=[next[0],s.position[1],next[2]];
    if(column.travel(s.position,horizontal,FLEA_BODY.radius,s.waterId))s.position=horizontal;
    else if(!driven)s.yaw+=Math.PI*.65;
    s.velocity=[0,0,0];const c=column.at(s.position,FLEA_BODY.radius,s.waterId);
    if(c&&s.position[1]>c.top-FLEA_BODY.radius-.0008)s.phase=.45;
    if(c&&s.position[1]<c.bottom+FLEA_BODY.radius+.0008)s.phase=0;
   }
  }
 }
 function snapshot(){return {kind:'simulated',time,body:FLEA_BODY,swimmers:swimmers.map(s=>({id:s.id,waterId:s.waterId,anchorId:s.anchorId,position:s.position.slice(),yaw:s.yaw,pitch:Math.atan2(s.velocity[1],.004)*.12,phase:s.phase,state:s.state,velocity:s.velocity.slice(),column:column.at(s.position,FLEA_BODY.radius,s.waterId)}))};}
 return {snapshot,steer(input){steering=input?{forward:clamp(Number(input.forward)||0,-1,1),turn:clamp(Number(input.turn)||0,-1,1),up:clamp(Number(input.up)||0,-1,1)}:null;},step(seconds){if(!Number.isFinite(seconds)||seconds<0||seconds>2)throw new RangeError('Submerged step requires 0–2 seconds');carry+=seconds;while(carry+1e-12>=1/120){tick(1/120);carry=Math.max(0,carry-1/120);}return snapshot();},setColumn(next){column=next;swimmers=swimmers.filter(s=>column.at(s.position,FLEA_BODY.radius,s.waterId));if(!swimmers.length)populate();return snapshot();}};
}
