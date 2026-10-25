import {admitFlightFootprint,flightPointBlocked,flightSegmentClear,planFlightRoute} from './flight-path.mjs';
export const BIRD_ROUTE_CLEARANCE=Object.freeze({horizontal:.30,vertical:.13});
const inside=(p,b)=>flightPointBlocked(p,b,BIRD_ROUTE_CLEARANCE.horizontal,BIRD_ROUTE_CLEARANCE.vertical);
const segmentClear=(a,b,boxes)=>flightSegmentClear(a,b,boxes,BIRD_ROUTE_CLEARANCE.horizontal,BIRD_ROUTE_CLEARANCE.vertical);
const planRoute=(a,b,boxes)=>planFlightRoute(a,b,boxes,BIRD_ROUTE_CLEARANCE.horizontal,BIRD_ROUTE_CLEARANCE.vertical);
/** Habitat-conditioned illustrative bird motion. No observations are written. */
const add=(a,b)=>a.map((v,i)=>v+b[i]), sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const length=a=>Math.hypot(...a), unit=a=>length(a)>1e-12?mul(a,1/length(a)):[0,1,0];
const mix=(a,b,t)=>add(a,mul(sub(b,a),t));
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=t=>t*t*(3-2*t);
const finite3=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const clone=v=>JSON.parse(JSON.stringify(v));
export const MIN_BIRD_PERCH_RADIUS=0.025;
export const BIRD_BODY=Object.freeze({kind:'illustrative-garden-bird',length:0.34,bodyRadii:[0.085,0.10,0.14],headRadius:0.067,headOffset:[0,0.075,0.10],beakLength:0.06,wingSpan:0.57,tailLength:0.15,legUpper:0.074,legLower:0.082,colors:{back:'#53666a',breast:'#d38c59',belly:'#e8cc9c',wings:'#40565d',featherTips:'#a4b2a3',beak:'#393b32',legs:'#75584a'}});

/** Endpoint form of the Engine two-bone contract, with explicit reach status.
 * See docs/HABITAT.md for the inspected Rust source and bounded adaptation. */
export function solveLeg(hip,toe,pole,a=BIRD_BODY.legUpper,b=BIRD_BODY.legLower){
  if(![hip,toe,pole].every(finite3)||!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0)throw new TypeError('Invalid leg geometry');
  const delta=sub(toe,hip), d=length(delta), near=Math.abs(a-b), far=a+b;
  const reach=d<near?'clamped-near':d>far?'clamped-far':'reachable';
  const dist=clamp(d,near,far), axis=d>1e-12?mul(delta,1/d):[0,-1,0];
  let bend=sub(sub(pole,hip),mul(axis,dot(sub(pole,hip),axis)));
  if(length(bend)<1e-10){const basis=Math.abs(axis[0])<0.8?[1,0,0]:[0,0,1];bend=sub(basis,mul(axis,dot(basis,axis)));}
  bend=unit(bend);
  const along=dist>1e-12?(dist*dist+(a-b)*(a+b))/(2*dist):0;
  const height=Math.sqrt(Math.max(0,a*a-along*along));
  return {hip:[...hip],knee:add(hip,add(mul(axis,along),mul(bend,height))),toe:add(hip,mul(axis,dist)),requestedToe:[...toe],reach};
}
function validateHabitat(h){
  if(!h||!Array.isArray(h.perches)||!Array.isArray(h.obstacles??[]))throw new TypeError('Expected perches and obstacles');
  const ids=new Set();
  if(h.foragingSites!==undefined&&(!Array.isArray(h.foragingSites)||h.foragingSites.length>8||h.foragingSites.some(p=>p.foraging!==true||!h.perches.some(q=>q.id===p.returnPerchId))))throw new TypeError('Invalid foraging supports');
  const perches=[...h.perches,...(h.foragingSites??[])].map(p=>{
    if(p.hopIds!==undefined&&!Array.isArray(p.hopIds))throw new TypeError('Invalid supported hop links');
    if(typeof p.id!=='string'||!p.id||ids.has(p.id)||!finite3(p.position)||!Number.isFinite(p.radius)||p.radius<MIN_BIRD_PERCH_RADIUS||!Number.isFinite(p.shelter??0)||(p.tangent!==undefined&&(!finite3(p.tangent)||length(p.tangent)<1e-6)))throw new TypeError('Invalid or duplicate perch');
    ids.add(p.id);return {...p,position:[...p.position],hopIds:p.hopIds===undefined?[]:[...p.hopIds],shelter:clamp(p.shelter??0)};
  });
  for(const p of perches){if(p.hopIds.length>2||p.hopIds.some(id=>{const q=perches.find(q=>q.id===id);return !p.foraging||!q?.foraging||q.id===p.id||typeof p.supportId!=='string'||q.supportId!==p.supportId||q.returnPerchId!==p.returnPerchId||Math.abs(q.position[1]-p.position[1])>1e-8||length(sub(q.position,p.position))>.3;}))throw new TypeError('Invalid supported hop links');}
  const obstacles=(h.obstacles??[]).map(b=>{
    if(!finite3(b.min)||!finite3(b.max)||!b.min.every((v,i)=>v<b.max[i]))throw new TypeError('Invalid obstacle');
    if(b.modes!==undefined&&(!Array.isArray(b.modes)||b.modes.some(mode=>!['human','bird','insect'].includes(mode))))throw new TypeError('Invalid obstacle modes');
    return b.modes&&!b.modes.includes('bird')?null:{id:b.id,min:[...b.min],max:[...b.max],...(b.polygonXZ===undefined?{}:{polygonXZ:admitFlightFootprint(b)})};
  }).filter(Boolean);
  if(!Number.isFinite(h.groundY??0))throw new TypeError('Invalid ground');
  return {perches,obstacles,groundY:h.groundY??0};
}
const restPosition=p=>add(p.position,[0,0.16,0]);
export function createHabitatSimulation(input,{seed=1}={}){
  let habitat=validateHabitat(input),rain=0,time=0,elapsed=0,state='perched',perchId=null,targetId=null,route=null,routeIndex=0,segmentTime=0,duration=0,yaw=0,pitch=0,wing=0,tail=0;
  let randomState=seed>>>0||1;
  let visitor=null,quietTime=0,attention='unaware',forageAmount=0,gazeYaw=0,lastForageOrigin=null,observerStill=0,observerAnchor=null;
  let groundHop=false,hopSourceId=null,hopSourcePosition=null,visitedPatches=new Set();
  const visitorDistance=p=>visitor?length(sub(p,visitor.position)):Infinity;
  const visibleVisitor=()=>visitor&&flightSegmentClear(position,visitor.position,habitat.obstacles);
  const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
  let position=[0,habitat.groundY+0.16,0],feetLocks=null,wait=2.3+random()*2,reason='resting',everPlaced=false;
  const available=()=>habitat.perches.filter(p=>!habitat.obstacles.some(b=>inside(restPosition(p),b)));
  const first=available().find(p=>!p.foraging);if(first){perchId=first.id;position=restPosition(first);everPlaced=true;}else state='unplaced';
  function lockFeet(){const support=habitat.perches.find(p=>p.id===perchId);const halfWidth=Math.min(.032,(support?.radius??.06)*.6);const tangent=support?.tangent?unit(support.tangent):[Math.cos(yaw),0,-Math.sin(yaw)];feetLocks=[-1,1].map(s=>add(add(position,[0,-.16,0]),mul(tangent,s*halfWidth))); }
  if(first)lockFeet();
  function transition(next){state=next;elapsed=0;}
  function choose(exclude,force=false,withdraw=false){
    const currentDistance=visitorDistance(position);
    const options=available().filter(p=>!p.foraging&&p.id!==exclude&&(!withdraw||(visitorDistance(restPosition(p))>currentDistance+.25&&(rain<=.4||p.shelter>=(habitat.perches.find(q=>q.id===exclude)?.shelter??0))))).map(p=>({p,score:p.shelter*rain*10+random()*0.6-length(sub(restPosition(p),position))*0.06+(withdraw?Math.min(4,visitorDistance(restPosition(p))):0)})).sort((a,b)=>b.score-a.score);
    for(const {p} of options){const next=planRoute(position,restPosition(p),habitat.obstacles);if(next&&(!withdraw||next.slice(1).every((b,i)=>{const a=next[i],d=sub(b,a),t=clamp(dot(sub(visitor.position,a),d)/Math.max(1e-12,dot(d,d)));return visitorDistance(add(a,mul(d,t)))>=currentDistance-.02;}))){groundHop=false;targetId=p.id;route=next;routeIndex=0;segmentTime=0;duration=0;reason=withdraw?'making room for a visitor':rain>0.3?'seeking shelter':force?'disturbed':'exploring perches';transition(feetLocks?'crouch':'flight');return true;}}
    reason=options.length?'route obstructed':'no alternate perch';return false;
  }
  function visitSite(p,why,hop=false){
    const end=restPosition(p),next=hop?[position,add(mix(position,end,.5),[0,.065,0]),end]:planRoute(position,end,habitat.obstacles);
    if(!next||next.slice(1).some((b,i)=>!segmentClear(next[i],b,habitat.obstacles)))return false;
    groundHop=hop;hopSourceId=hop?perchId:null;hopSourcePosition=hop?[...habitat.perches.find(p=>p.id===perchId).position]:null;if(hop)visitedPatches.add(p.id);
    targetId=p.id;route=next;routeIndex=0;segmentTime=0;duration=0;reason=why;transition(feetLocks?'crouch':'flight');return true;
  }
  function beginFlight(){feetLocks=null;perchId=null;transition('flight');}
  function tick(dt){
    time+=dt;elapsed+=dt;
    const support=habitat.perches.find(p=>p.id===perchId);
    const feeding=state==='perched'&&support?.foraging&&attention==='unaware'&&rain<.4&&elapsed>.5&&elapsed<2.5;
    const desiredForage=feeding?Math.sin(Math.PI*clamp((elapsed-.5)/2))**2:0;
    forageAmount+=(desiredForage-forageAmount)*(1-Math.exp(-dt*14));
    const desired=visitor&&attention==='watching'?Math.atan2(visitor.position[0]-position[0],visitor.position[2]-position[2])-yaw:null;
    const gazeTarget=desired===null?Math.sin(time*.9)*.34:clamp(Math.atan2(Math.sin(desired),Math.cos(desired)),-.65,.65);
    gazeYaw+=(gazeTarget-gazeYaw)*(1-Math.exp(-dt*8));
    if(state==='unplaced')return; // Missing safe geometry never causes automatic teleport/re-spawn.
    if(state==='perched'){
      wing*=Math.exp(-dt*9);pitch=0;tail=Math.sin(time*1.2)*0.035;
      const perch=habitat.perches.find(p=>p.id===perchId);
      const noticed=visibleVisitor()&&visitorDistance(position)<visitor.radius*2;
      // Authored scene pacing, not a biological habituation model. Measure
      // displacement from an anchor so slow cumulative approaches count too.
      if(noticed&&visitorDistance(position)>=visitor.radius){
        if(!observerAnchor||length(sub(visitor.position,observerAnchor))>visitor.radius*.12){observerAnchor=[...visitor.position];observerStill=0;}
        else observerStill+=dt;
      }else {observerStill=0;observerAnchor=null;}
      const quietObserver=noticed&&visitorDistance(position)>=visitor.radius&&observerStill>=3;
      if(noticed&&!quietObserver){quietTime=0;attention='watching';
        if(visitorDistance(position)<visitor.radius&&elapsed>.35){
          if(choose(perchId,true,true)){attention='withdrawing';return;}
          // With no safe refuge, hold the supported perch. Never jump through a
          // wall or select a closer perch merely to keep the animation moving.
          reason='watching; no quieter reachable perch';
          // A failed retreat must not reset the rain shelter timer: shelter
          // seeking retains priority when this perch remains exposed.
          if(!(rain>.4&&perch?.shelter<.6))elapsed=0;
        }
        if(!(rain>.4&&perch?.shelter<.6))return;
      }else if(quietObserver){if(attention!=='unaware')reason='resting';attention='unaware';quietTime=0;}else if(attention!=='unaware'){
        quietTime+=dt;attention='settling';
        if(quietTime<2&&!(rain>.4&&perch?.shelter<.6))return;
        attention='unaware';quietTime=0;reason='resting';elapsed=0;
      }
      if(perch?.foraging){
        reason='searching the supported ground';
        if(elapsed>3&&rain<.4&&visitedPatches.size<3){
          const next=available().find(p=>perch.hopIds.includes(p.id)&&!visitedPatches.has(p.id));
          if(next&&visitSite(next,'hopping to another search patch',true))return;
        }
        if(elapsed>3||rain>.4){const home=available().find(p=>p.id===perch.returnPerchId&&!p.foraging);
          if(rain<=.4&&home&&visitSite(home,'returning from a search'))return;
          if(choose(perchId))return;
        }
        return;
      }
      if(rain<.4&&elapsed>wait&&perchId!==lastForageOrigin){
        const sites=available().filter(p=>p.foraging&&p.returnPerchId===perchId);
        if(sites.length&&visitSite(sites[Math.floor(random()*sites.length)],'looking for food on the ground')){visitedPatches=new Set([targetId]);lastForageOrigin=perchId;return;}
      }
      if((elapsed>wait&&!(rain>0.4&&perch?.shelter>=0.6))||(rain>0.4&&perch?.shelter<0.6&&elapsed>0.5)){if(!choose(perchId)){elapsed=0;wait=3;lastForageOrigin=null;}}
    } else if(state==='crouch'){
      pitch=-0.2*Math.sin(clamp(elapsed/0.25)*Math.PI);wing=0.35*smooth(clamp(elapsed/0.25));
      if(groundHop)wing*=.25;
      if(elapsed>=0.25)beginFlight();
    } else if(state==='flight'){
      const a=route[routeIndex],b=route[routeIndex+1];
      if(!duration)duration=groundHop?.14:Math.max(0.35,length(sub(b,a))/1.5);
      segmentTime+=dt;const t=clamp(segmentTime/duration),u=smooth(t),prior=position;position=mix(a,b,u);
      const direction=sub(b,a),horizontal=Math.hypot(direction[0],direction[2]);
      if(horizontal>1e-6){const targetYaw=Math.atan2(direction[0],direction[2]);yaw=groundHop?yaw+Math.atan2(Math.sin(targetYaw-yaw),Math.cos(targetYaw-yaw))*(1-Math.exp(-dt*14)):targetYaw;}
      const final=routeIndex===route.length-2;
      pitch=clamp(Math.atan2(direction[1],horizontal),-0.55,0.55)*(final?1-t:1);
      wing=(0.85+0.7*Math.sin(time*2*Math.PI*6.5))*(final&&t>0.7?1-(t-0.7)*1.7:1);tail=final?0.3*t:0.08;
      if(groundHop){pitch*=.2;wing=.10+.08*Math.sin(Math.PI*t);tail=.12;}
      if(length(sub(position,prior))>0&&habitat.obstacles.some(b=>inside(position,b)))throw new Error('Flight route violated clearance');
      if(t>=1){routeIndex++;segmentTime=0;duration=0;if(routeIndex>=route.length-1){perchId=targetId;targetId=null;lockFeet();transition('landing');}}
    }else if(state==='landing'){
      wing*=Math.exp(-dt*8);pitch=0.14*Math.sin(Math.PI*clamp(elapsed/0.55));tail*=Math.exp(-dt*3);
      if(elapsed>0.55){transition('perched');wait=3.2+random()*3;reason='resting';}
    }
  }
  function snapshot(){
    const planted=!!feetLocks;
    const compression=state==='crouch'?0.025*Math.sin(Math.PI*clamp(elapsed/0.25)):state==='landing'?0.018*Math.sin(Math.PI*clamp(elapsed/0.55)):0;
    const posePitch=pitch-.85*forageAmount;
    const body=add(position,[0,-.018*forageAmount-compression+(planted?0.003*Math.sin(time*2.1):0),0]);
    const transform=p=>{const py=p[1]*Math.cos(posePitch)+p[2]*Math.sin(posePitch),pz=-p[1]*Math.sin(posePitch)+p[2]*Math.cos(posePitch);return add(body,[p[0]*Math.cos(yaw)+pz*Math.sin(yaw),py,pz*Math.cos(yaw)-p[0]*Math.sin(yaw)]);};
    const feet=[-1,1].map((side,i)=>{
      const hip=transform([side*0.032,-0.04,0]);
      const toe=planted?feetLocks[i]:transform([side*0.032,-0.09,-0.04]);
      return {...solveLeg(hip,toe,transform([side*0.032,-0.075,0.12])),contact:planted,grip:planted?1:0};
    });
    return {kind:'simulated',time,weather:{rain},bird:{id:'simulated-garden-bird',kind:'simulated',position:body,yaw,pitch:posePitch,state,activity:groundHop&&state!=='perched'?'hopping':forageAmount>.05?'foraging':'resting',forageAmount,perchId,targetId,reason,attention,wingLeft:wing,wingRight:-wing,tail,headYaw:planted?gazeYaw*(1-forageAmount):0,feet,bodySpec:BIRD_BODY},route:route?clone(route):[],habitatStatus:state==='unplaced'?'No usable perch':'ready'};
  }
  return {
    step(dt){if(!Number.isFinite(dt)||dt<0||dt>10)throw new RangeError('step requires 0–10 seconds');let remaining=dt;while(remaining>1e-9){const delta=Math.min(remaining,1/120);tick(delta);remaining-=delta;}return snapshot();},
    snapshot,
    setVisitor(value){
      if(value===null){visitor=null;observerAnchor=null;observerStill=0;return;}
      if(!value||!finite3(value.position)||!Number.isFinite(value.radius)||value.radius<=0||value.radius>3)throw new TypeError('Expected a bounded visitor position and radius');
      if(visitor?.radius!==value.radius){observerAnchor=null;observerStill=0;}
      visitor={position:[...value.position],radius:value.radius};
    },
    setWeather(weather){if(!Number.isFinite(weather.rain)||weather.rain<0||weather.rain>1)throw new RangeError('rain requires 0–1');rain=weather.rain;},
    setHabitat(next){
      const admitted=validateHabitat(next);habitat=admitted;
      if(state==='unplaced'){const support=available()[0];if(support){if(!everPlaced){position=restPosition(support);perchId=support.id;targetId=null;route=null;everPlaced=true;lockFeet();transition('perched');reason='resting';return;}const next=planRoute(position,restPosition(support),habitat.obstacles);if(next){targetId=support.id;route=next;routeIndex=0;segmentTime=0;duration=0;feetLocks=null;perchId=null;transition('flight');reason='habitat restored';}}return;}
      const current=habitat.perches.find(p=>p.id===perchId);
      const target=habitat.perches.find(p=>p.id===targetId);
      const moved=current&&length(sub(restPosition(current),position))>0.001;
      const invalidCurrent=perchId&&(!current||moved||habitat.obstacles.some(b=>inside(position,b)));
      const invalidRoute=route&&state==='flight'&&(!target||length(sub(restPosition(target),route.at(-1)))>0.001||!segmentClear(position,route[routeIndex+1],habitat.obstacles)||route.slice(routeIndex+1,-1).some((p,i)=>!segmentClear(p,route[routeIndex+i+2],habitat.obstacles)));
      const hopSource=habitat.perches.find(p=>p.id===hopSourceId);
      const invalidHop=groundHop&&state==='flight'&&(!hopSource?.hopIds.includes(targetId)||length(sub(hopSource.position,hopSourcePosition))>1e-8);
      if(invalidCurrent||invalidRoute||invalidHop||state==='crouch'){
        // A landing pose may be temporarily compressed below its flight center.
        // Release contact at the *visible* body position before re-routing.
        if(feetLocks&&state==='landing'){
          const compression=0.018*Math.sin(Math.PI*clamp(elapsed/0.55));
          position=add(position,[0,-compression+0.003*Math.sin(time*2.1),0]);
        }
        feetLocks=null;perchId=null;route=null;targetId=null;
        if(!choose(null)){transition('unplaced');reason='habitat changed; no safe route';}
      }
    },
    disturb(point,radius=1.5){if(!finite3(point)||!Number.isFinite(radius)||radius<=0)throw new TypeError('Invalid disturbance');if(length(sub(point,position))<=radius&&['perched','landing'].includes(state))return choose(perchId,true);return false;}
  };
}

