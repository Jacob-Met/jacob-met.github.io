import {createCatchingPlan,writeCatchingPositions,sweepCatching} from './catching-silk.mjs';

const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const length=a=>Math.hypot(...a);
const unit=a=>mul(a,1/(length(a)||1));
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{const t=clamp(x);return t*t*(3-2*t);};
export const WEB_VISITOR=Object.freeze({radius:.0035,wrapReach:.033,flightSeconds:3.2,wrapSeconds:2.4,liftSeconds:.65,mealSeconds:5});

/** One authored visitor. Catching is a bounded attachment rule, not fitted adhesion. */
export function createWebEncounter(web,project){
 const plan=createCatchingPlan(web,project),vertices=writeCatchingPositions(plan,null);
 let phase='waiting',age=0,time=0,cycle=0,delay=6,position=[...web.center],direction=[...web.normal],aim=null,contact=null,pulse=0,liftFrom=null,releaseFrom=null,releaseSide=1;
 let captures=0,escapes=0,meals=0;
 let wrapAge=0,mealAge=0,wrappingPaused=false;
 const point=(r,u,n)=>add(web.center,add(mul(web.right,r),add(mul(web.up,u),mul(web.normal,n))));
 const setPhase=next=>{phase=next;age=0;};
 function flightAt(t){
  // This entire path stays within the existing 6cm clear envelope around its silk aim.
  const s=clamp(t),normal=.045*(1-2*s),flutter=Math.sin(2*Math.PI*s)*.006;
  return add(aim,add(mul(web.normal,normal),add(mul(web.right,flutter),mul(web.up,Math.sin(4*Math.PI*s)*.003))));
 }
 function startFlight(){
  cycle++;
  if(cycle%3===0)aim=point(0,0,0); // A genuine pass through the catching spiral's open hub.
  else {const count=web.spiral.length,index=Math.min(count-1,Math.floor(count*.26)+(cycle*19)%Math.max(1,Math.floor(count*.3))),s=web.spiral[index];aim=mix(s.a,s.b,cycle%2?.18:.82);}
  contact=null;position=flightAt(0);direction=mul(web.normal,-1);setPhase('flying');
 }
 function attachedPosition(){
  const i=contact.spiralSegment*6,a=Array.from(vertices.subarray(i,i+3)),b=Array.from(vertices.subarray(i+3,i+6));
  return add(mix(a,b,contact.segmentT),contact.offset);
 }
 function wait(){setPhase('waiting');delay=12+(cycle%3)*3;contact=null;wrapAge=0;mealAge=0;wrappingPaused=false;}
 function release(){
  if(!['flying','caught','wrapping'].includes(phase))return false;
  releaseFrom=[...position];releaseSide=dot(sub(position,web.center),web.normal)>=0?1:-1;wrappingPaused=false;setPhase('escaping');escapes++;return true;
 }
 function snapshot(){
  const visible=phase!=='waiting',wrapProgress=['lifting','carried','feeding'].includes(phase)?1:phase==='wrapping'?clamp(wrapAge/WEB_VISITOR.wrapSeconds):0;
  return {kind:'simulated',id:`web-visitor-${cycle}`,phase,age,time,visible,position:[...position],direction:[...direction],radius:WEB_VISITOR.radius,
   wingAngle:phase==='flying'?.5+Math.sin(time*82)*.7:phase==='caught'?.35+Math.sin(time*46)*.48:Math.max(0,1-wrapProgress)*.18,
   legPhase:time*(phase==='caught'?25:8),wrapProgress,wrappingPaused,mealProgress:clamp(mealAge/WEB_VISITOR.mealSeconds),opacity:phase==='flying'?Math.min(1,age/.3,(WEB_VISITOR.flightSeconds-age)/.3):phase==='escaping'?clamp(1-age/1.8):['carried','feeding'].includes(phase)?clamp((WEB_VISITOR.mealSeconds-mealAge)/.7):1,
   contact:contact?{spiralSegment:contact.spiralSegment,segmentT:contact.segmentT,target:{...contact.target},impulseBindings:contact.impulseBindings.map(b=>({...b}))}:null,
   counts:{captures,escapes,meals}};
 }
 return {snapshot,phase:()=>phase,id:()=>`web-visitor-${cycle}`,
  step(dt,field,{rain=false,carrier=null}={}){
   if(!Number.isFinite(dt)||dt<0||dt>1/120+1e-12)throw new RangeError('Encounter requires a bounded 1/120 second step');
   if(dt===0)return null;
   time+=dt;age+=dt;
   if(phase==='wrapping'&&!wrappingPaused)wrapAge+=dt;
   if(phase==='feeding')mealAge+=dt;
   if(['flying','caught','wrapping'].includes(phase))writeCatchingPositions(plan,field,vertices);
   if(phase==='waiting'){if(!rain&&age>=delay)startFlight();return null;}
   if(phase==='flying'){
    const next=flightAt(age/WEB_VISITOR.flightSeconds),hit=sweepCatching(plan,vertices,position,next,WEB_VISITOR.radius);
    direction=unit(sub(next,position));
    if(hit){
     const target=project(web,hit.point);contact={...hit,target:{edge:target.edge,t:target.t},offset:sub(hit.center,hit.point)};
     position=attachedPosition();direction=[...web.up];captures++;pulse=.38;setPhase('caught');
     return {id:`web-visitor-${cycle}`,target:contact.target,bindings:contact.impulseBindings,strength:.8,first:true};
    }
    position=next;if(age>=WEB_VISITOR.flightSeconds){escapes++;wait();}return null;
   }
   if(phase==='caught'||phase==='wrapping'){
    position=attachedPosition();
    if(rain||age>30){release();return null;}
    if(phase==='caught'&&(pulse-=dt)<=0){pulse=.38;return {id:`web-visitor-${cycle}`,target:contact.target,bindings:contact.impulseBindings,strength:.6*(Math.sin(time*11)>=0?1:-1),first:false};}
   }else if(phase==='lifting'){
    if(!carrier)throw new Error('A lifting parcel needs its actual carrier');position=mix(liftFrom,carrier,ease(age/WEB_VISITOR.liftSeconds));
    if(age>=WEB_VISITOR.liftSeconds)setPhase('carried');
   }else if(phase==='carried'||phase==='feeding'){
    if(!carrier)throw new Error('A carried parcel needs its actual carrier');position=[...carrier];
    if(phase==='feeding'&&mealAge>=WEB_VISITOR.mealSeconds){meals++;wait();}
   }else if(phase==='escaping'){
    const goal=add(releaseFrom,mul(web.normal,releaseSide*.04));position=mix(releaseFrom,goal,ease(age/1.8));direction=mul(web.normal,releaseSide);
    if(age>=1.8)wait();
   }
   return null;
  },
  beginWrap(id,spiderSilkPosition){
   if(!(phase==='caught'||(phase==='wrapping'&&wrappingPaused))||id!==`web-visitor-${cycle}`||length(sub(spiderSilkPosition,position))>WEB_VISITOR.wrapReach)return false;
   if(phase==='caught'){wrapAge=0;setPhase('wrapping');}wrappingPaused=false;return true;
  },
  beginLift(){if(phase!=='wrapping'||wrappingPaused||wrapAge<WEB_VISITOR.wrapSeconds)return false;liftFrom=[...position];setPhase('lifting');return true;},
  beginMeal(){if(phase!=='carried')return false;setPhase('feeding');return true;},
  pauseForNeighbor(){if(phase==='wrapping')wrappingPaused=true;else if(phase==='feeding')setPhase('carried');},
  syncCarrier(carrier){if(phase==='lifting')position=mix(liftFrom,carrier,ease(age/WEB_VISITOR.liftSeconds));else if(phase==='carried'||phase==='feeding')position=[...carrier];},
  setRain(value){if(value){if(phase==='feeding'||(phase==='carried'&&mealAge>0)){mealAge=0;setPhase('carried');}else release();}},
  release
 };
}
