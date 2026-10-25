/** A modeled silk habitat and one simulated resident. Never writes observations. */
import {solveLeg} from './habitat.mjs';
import {createSilkDynamics} from './silk-dynamics.mjs';
import {createWebEncounter} from './web-encounter.mjs';
import {createBirdAwareness} from './web-awareness.mjs';

const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const unit=a=>mul(a,1/norm(a));
const mix=(a,b,t)=>add(a,mul(sub(b,a),t));
const clamp=(v,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));
const finite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const copy=v=>structuredClone(v);
const SPOKES=18;
export const ORB_WEAVER_BODY=Object.freeze({clearance:.008,upperLeg:.024,lowerLeg:.025,speed:.035});

// The body and articulated knees extend beyond the silk itself.
function segmentHitsBox(a,b,box,pad=.06){
 let low=0,high=1;
 for(let axis=0;axis<3;axis++){
  const delta=b[axis]-a[axis],lo=box.min[axis]-pad,hi=box.max[axis]+pad;
  if(Math.abs(delta)<1e-12){if(a[axis]<lo||a[axis]>hi)return false;}
  else {const t1=(lo-a[axis])/delta,t2=(hi-a[axis])/delta;low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));if(low>high)return false;}
 }
 return low<=high;
}

function validateHabitat(input){
 if(!input||!Array.isArray(input.perches)||!Array.isArray(input.obstacles??[])||input.perches.length>384||(input.obstacles?.length??0)>512)throw new TypeError('Expected a bounded branch habitat');
 const seen=new Set();
 const supports=input.perches.map(p=>{
  if(!p||typeof p.id!=='string'||!p.id||seen.has(p.id)||!finite3(p.position)||!Number.isFinite(p.shelter??0))throw new TypeError('Invalid or duplicate branch support');
  seen.add(p.id);return {id:p.id,position:[...p.position],shelter:clamp(p.shelter??0)};
 });
 const boxes=(input.obstacles??[]).map(b=>{
  if(!b||!finite3(b.min)||!finite3(b.max)||!b.min.every((v,i)=>v<b.max[i]))throw new TypeError('Invalid solid envelope');
  return {min:[...b.min],max:[...b.max]};
 });
 return {supports,boxes};
}

function frame(supports,boxes){
 const [a,b,c]=supports.map(s=>s.position),ab=norm(sub(a,b)),bc=norm(sub(b,c)),ca=norm(sub(c,a));
 const areaVector=cross(sub(b,a),sub(c,a)),twiceArea=norm(areaVector),perimeter=ab+bc+ca;
 if(!Number.isFinite(perimeter)||Math.max(ab,bc,ca)>4||Math.min(ab,bc,ca)<.15||twiceArea<1e-5)return null;
 const inradius=twiceArea/perimeter;
 if(inradius<.07)return null;
 let normal=unit(areaVector);
 if(Math.abs(normal[1])>.82)return null; // This inhabitant requires an upright or sloping frame.
 // The maintained branch supports are top points: keep the body on their upper side.
 if(normal[1]<-1e-10||(Math.abs(normal[1])<1e-10&&(normal[2]<0||(Math.abs(normal[2])<1e-10&&normal[0]<0))))normal=mul(normal,-1);
 const right=unit(cross([0,1,0],normal)),up=unit(cross(normal,right));
 const center=mul(add(add(mul(a,bc),mul(b,ca)),mul(c,ab)),1/perimeter);
 const radius=Math.min(.36,inradius*.82);
 const point=(x,y)=>add(center,add(mul(right,x),mul(up,y)));
 const nodes=[{id:'hub',position:center}],edges=[];
 const edge=(from,to,kind='radial')=>edges.push({id:`silk-${edges.length}`,from,to,kind,a:nodes[from].position,b:nodes[to].position});
 for(let i=0;i<SPOKES;i++){
  const angle=2*Math.PI*i/SPOKES;
  nodes.push({id:`rest-${i}`,position:point(Math.cos(angle)*radius*.67,Math.sin(angle)*radius*.67)});
  nodes.push({id:`rim-${i}`,position:point(Math.cos(angle)*radius,Math.sin(angle)*radius)});
  edge(0,1+i*2);edge(1+i*2,2+i*2);
 }
 for(let i=0;i<SPOKES;i++)edge(2+i*2,2+((i+1)%SPOKES)*2,'frame');
 const anchors=[];
 for(const s of supports){
  const direction=sub(s.position,center),angle=Math.atan2(dot(direction,up),dot(direction,right));
  const spoke=((Math.round(angle*SPOKES/(2*Math.PI))%SPOKES)+SPOKES)%SPOKES;
  const node=nodes.length;nodes.push({id:s.id,position:[...s.position]});edge(2+spoke*2,node,'attachment');anchors.push({...s,node});
 }
 for(let i=0;i<anchors.length;i++)edge(anchors[i].node,anchors[(i+1)%anchors.length].node,'frame');
 // The catching spiral is drawn separately. Locomotion uses the structural graph.
 const spiral=[],turns=Math.max(4,Math.min(16,Math.floor(radius/.012)));
 for(let i=0;i<turns*SPOKES;i++){
  const at=k=>{const t=k/(turns*SPOKES),r=radius*(.18+.76*t),angle=k*2*Math.PI/SPOKES;return point(Math.cos(angle)*r,Math.sin(angle)*r);};
  spiral.push({a:at(i),b:at(i+1)});
 }
 if([...edges,...spiral].some(e=>boxes.some(b=>segmentHitsBox(e.a,e.b,b))))return null;
 const adjacency=nodes.map(()=>[]);
 edges.forEach((e,i)=>{const length=norm(sub(e.a,e.b));adjacency[e.from].push({node:e.to,edge:i,length});adjacency[e.to].push({node:e.from,edge:i,length});});
 const anchorId=supports[0].id.slice(0,supports[0].id.lastIndexOf(':branch:'));
 const key=JSON.stringify(supports.map(s=>[s.id,s.position,s.shelter]));
 return {kind:'simulated',id:`orb-web:${anchorId}`,anchorId,key,center,normal,right,up,radius,anchors,nodes,edges,spiral,adjacency};
}

/** Stable bounded selection from existing rendered same-tree branch supports. */
export function selectOrbWeb(input){
 const {supports,boxes}=validateHabitat(input),groups=new Map();
 for(const s of supports.sort((a,b)=>a.id.localeCompare(b.id))){
  const match=/^(.*):branch:\d+$/.exec(s.id);if(!match)continue;
  if(!groups.has(match[1]))groups.set(match[1],[]);
  const group=groups.get(match[1]);if(group.length<8)group.push(s);
 }
 let attempts=0;
 for(const group of groups.values())for(let i=0;i<group.length-2;i++)for(let j=i+1;j<group.length-1;j++)for(let k=j+1;k<group.length;k++){
  if(++attempts>64)return null;
  const web=frame([group[i],group[j],group[k]],boxes);if(web)return web;
 }
 return null;
}

function project(point,edge){const delta=sub(edge.b,edge.a),t=clamp(dot(sub(point,edge.a),delta)/dot(delta,delta));return {position:add(edge.a,mul(delta,t)),t};}
/** Exact projection onto structural silk; the sticky catching spiral is excluded. */
export function nearestSilkPoint(web,point,maxDistance=Infinity){
 if(!web||!finite3(point)||typeof maxDistance!=='number'||maxDistance<0||Number.isNaN(maxDistance))return null;
 let best=null;
 for(let edge=0;edge<web.edges.length;edge++){
  const p=project(point,web.edges[edge]),distance=norm(sub(point,p.position));
  if(distance<=maxDistance&&(!best||distance<best.distance-1e-12))best={...p,edge,distance};
 }
 return best;
}

function shortest(web,from,to){
 const distance=web.nodes.map(()=>Infinity),previous=web.nodes.map(()=>null),done=new Set();distance[from]=0;
 while(done.size<web.nodes.length){
  let current=-1;for(let i=0;i<distance.length;i++)if(!done.has(i)&&(current<0||distance[i]<distance[current]))current=i;
  if(current<0||!Number.isFinite(distance[current]))return null;if(current===to)break;done.add(current);
  for(const next of web.adjacency[current])if(distance[current]+next.length<distance[next.node]){distance[next.node]=distance[current]+next.length;previous[next.node]={node:current,edge:next.edge};}
 }
 const result=[];for(let node=to;node!==from;node=previous[node].node){const p=previous[node];if(!p)return null;result.unshift({from:p.node,to:node,edge:p.edge});}
 return {segments:result,distance:distance[to]};
}

export function createOrbWeaver(input,{encounters=false}={}){
  if(typeof encounters!=='boolean')throw new TypeError('Encounter choice must be boolean');
 let web=selectOrbWeb(input),time=0,rain=0,position,heading=-Math.PI/2,state='unplaced',reason='No clear branch frame',route=[],wait=1.4,location=null,feet=[],activeGroup=-1,nextGroup=0,stepDistance=0,patrol=0,destination='hub';
 let silk=null,silkGeometry=null,pendingDisturbance=null,encounter=null,pursuitId=null,steerDir=null;
 const awareness=createBirdAwareness();let nearbyBird=null,respondingToBird=false,withdrawal=null;
 const body=()=>add(position,mul(web.normal,ORB_WEAVER_BODY.clearance+.00015*Math.sin(time*2.2)));
 const forward=()=>add(mul(web.right,Math.cos(heading)),mul(web.up,Math.sin(heading)));
 const side=()=>cross(web.normal,forward());
  const materialPosition=()=>add(position,mul(web.normal,silk.sample(location.edge,location.t).offset));
  const carrier=()=>add(body(),add(mul(web.normal,silk.sample(location.edge,location.t).offset-.002),mul(forward(),.013)));
 const hip=(i,p=body())=>add(p,add(mul(side(),i<4?-.0045:.0045),mul(forward(),[.006,.002,-.002,-.006][i%4])));
 function desired(i){
  const along=[.031,.017,-.014,-.029][i%4]+(i<4?-.002:.002),across=(i<4?-1:1)*.025;
  const target=add(position,add(mul(side(),across),mul(forward(),along+.005)));
  let contact=nearestSilkPoint(web,target);
  if(!contact||norm(sub(hip(i),contact.position))>.045)contact=nearestSilkPoint(web,add(position,mul(forward(),along*.7)));
  return contact;
 }
 function reset(){
  awareness.reset();nearbyBird=null;respondingToBird=false;withdrawal=null;
  route=[];feet=[];activeGroup=-1;nextGroup=0;stepDistance=0;location=null;heading=-Math.PI/2;wait=1.4;destination='hub';
  silk=web?createSilkDynamics(web):null;silkGeometry=silk?.geometry()??null;pendingDisturbance=null;pursuitId=null;
   encounter=web&&encounters?createWebEncounter({...web,silkGeometry},nearestSilkPoint):null;
  if(!web){position=[0,0,0];state='unplaced';reason='No clear branch frame';return;}
  position=[...web.center];state='resting';reason='Waiting at the hub';location={edge:0,t:0};
  feet=Array.from({length:8},(_,i)=>({...desired(i),contact:true,swing:null}));
 }
 function routeOptions(node){
  const currentEdge=web.edges[location.edge],choices=[];
  for(const end of [currentEdge.from,currentEdge.to]){
   const path=shortest(web,end,node);if(!path)continue;
   const first={a:[...position],b:web.nodes[end].position,edge:location.edge};
   choices.push({cost:norm(sub(first.a,first.b))+path.distance,segments:[first,...path.segments.map(s=>({a:web.nodes[s.from].position,b:web.nodes[s.to].position,edge:s.edge}))].filter(s=>norm(sub(s.a,s.b))>1e-10)});
  }
  return choices.sort((a,b)=>a.cost-b.cost);
 }
 function followRoute(choice,arrival){
  route=choice?.segments??[];destination=arrival;
  state=route.length?(arrival==='shelter'?'retreating':arrival==='quiet'?'withdrawing':arrival==='hub'?'returning':'exploring'):(arrival==='shelter'?'sheltering':arrival==='quiet'?'still':arrival==='hub'?'resting':'checking');
  reason=arrival==='shelter'?'Taking cover at an attached branch':arrival==='quiet'?(route.length?'Moving along the silk away from a nearby bird':'Keeping still while a bird is nearby'):arrival==='hub'?'Returning along the silk':'Checking a radial strand';wait=arrival==='quiet'?Infinity:arrival==='hub'?2.8:.8;
 }
 function routeTo(node,arrival){followRoute(routeOptions(node)[0],arrival);}
 function retractWorkingFeet(){
  if(state!=='wrapping')return;
  const posed=snapshot().spider.feet;
  for(const i of [0,4]){const foot=feet[i],offset=silk.sample(foot.edge,foot.t).offset,from=sub(posed[i].toe,mul(web.normal,offset));foot.position=from;foot.contact=false;foot.swing={from:[...from],to:desired(i),elapsed:0};}
  activeGroup=0;stepDistance=0;
 }
 function withdrawFromBird(observation){
  retractWorkingFeet();encounter?.pauseForNeighbor();respondingToBird=true;
  const bird=observation.position,center=add(body(),mul(web.normal,silk.sample(location.edge,location.t).offset)),startDistance=norm(sub(center,bird)),options=[];
  const raised=p=>add(p,mul(web.normal,ORB_WEAVER_BODY.clearance));
  for(let i=0;i<SPOKES;i++)for(const choice of routeOptions(1+i*2)){
   if(!choice.segments.length||choice.cost>Math.min(.25,web.radius*1.7))continue;
   const targetDistance=norm(sub(raised(web.nodes[1+i*2].position),bird));
   const minimumDistance=Math.min(...choice.segments.map(segment=>norm(sub(project(bird,{a:raised(segment.a),b:raised(segment.b)}).position,bird))));
   if(targetDistance<startDistance+.006||minimumDistance<startDistance-.003)continue;
   options.push({...choice,node:1+i*2,targetDistance,minimumDistance,score:targetDistance-.12*choice.cost});
  }
  options.sort((a,b)=>b.score-a.score||a.cost-b.cost||a.node-b.node);const chosen=options[0];
  withdrawal={birdId:observation.birdId,startedAt:time,nodeId:chosen?web.nodes[chosen.node].id:null,startDistance,targetDistance:chosen?.targetDistance??startDistance,minimumPlannedDistance:chosen?.minimumDistance??startDistance,routeLength:chosen?.cost??0};
  followRoute(chosen,'quiet');
 }
 function resumeAfterBird(){
  respondingToBird=false;
  const visitor=encounter?.snapshot();
  if(visitor&&['caught','wrapping'].includes(visitor.phase)&&pursuitId===visitor.id&&visitor.contact){investigate({...captureApproach(visitor.contact.target),encounterId:visitor.id});return;}
  if(pendingDisturbance?.heardAt!==null&&pendingDisturbance){state='listening';reason='Returning to a remembered ripple in the silk';wait=.32;return;}
  selectDestination();
 }
 function selectDestination(){
  if(rain>.4){const shelter=[...web.anchors].sort((a,b)=>b.shelter-a.shelter||a.id.localeCompare(b.id))[0];routeTo(shelter.node,'shelter');}
  else routeTo(0,'hub');
 }
 function investigate(target){
  const current=web.edges[location.edge],goal=web.edges[target.edge],choices=[];
  const endPoint=mix(goal.a,goal.b,target.t);
  if(target.edge===location.edge)choices.push({cost:norm(sub(position,endPoint)),segments:[{a:[...position],b:endPoint,edge:target.edge}]});
  for(const from of [current.from,current.to])for(const to of [goal.from,goal.to]){
   const path=shortest(web,from,to);if(!path)continue;
   const first={a:[...position],b:web.nodes[from].position,edge:location.edge},last={a:web.nodes[to].position,b:endPoint,edge:target.edge};
   choices.push({cost:norm(sub(first.a,first.b))+path.distance+norm(sub(last.a,last.b)),segments:[first,...path.segments.map(s=>({a:web.nodes[s.from].position,b:web.nodes[s.to].position,edge:s.edge})),last]});
  }
  choices.sort((a,b)=>a.cost-b.cost);route=choices[0].segments.filter(s=>norm(sub(s.a,s.b))>1e-10);destination=target.encounterId?'encounter':'disturbance';pursuitId=target.encounterId??null;
  state=route.length?'investigating':'checking';reason='Following a ripple through the silk';wait=.8;
 }
 function captureApproach(target){
  const edge=web.edges[target.edge],length=norm(sub(edge.b,edge.a)),gap=.018/length;
  const choices=[clamp(target.t-gap),clamp(target.t+gap)].map(t=>({edge:target.edge,t,point:mix(edge.a,edge.b,t)}));
  // Put the body behind its working front legs instead of over the caught visitor.
  choices.sort((a,b)=>norm(sub(a.point,position))-norm(sub(b.point,position)));
  return {edge:target.edge,t:(choices.find(c=>Math.abs(c.t-target.t)*length>=.012)??choices[0]).t};
 }
 /** Driven (src/embody.mjs): walk the silk where a visitor who has become the weaver points, one strand at a time.
  * dir is [right, up] in the web plane. Autonomy waits; the legs, silk and routes are the weaver's own. */
 function steerStep(){
  wait=Infinity;
  const length=Math.hypot(steerDir[0],steerDir[1]);if(length<.2){if(!route.length&&state!=='resting'){state='checking';reason='holding still on the silk';}return;}
  const want=[steerDir[0]/length,steerDir[1]/length],planar=v=>[dot(v,web.right),dot(v,web.up)];
  const score=v=>{const l=Math.hypot(...v);return l<1e-9?-2:(v[0]*want[0]+v[1]*want[1])/l;};
  if(route.length){const next=route[0],d=planar(sub(next.b,position));if(score(d)>-.2)return;}
  const edge=web.edges[location.edge],options=[];
  for(const end of [edge.from,edge.to]){
   const node=web.nodes[end].position,d=sub(node,position);
   if(norm(d)>1e-6)options.push({score:score(planar(d)),segment:{a:[...position],b:[...node],edge:location.edge}});
   else for(const n of web.adjacency[end]){const to=web.nodes[n.node].position;options.push({score:score(planar(sub(to,node))),segment:{a:[...node],b:[...to],edge:n.edge}});}
  }
  options.sort((a,b)=>b.score-a.score);
  if(options[0]&&options[0].score>.2){route=[options[0].segment];destination='steered';state='exploring';reason='moving along the silk where it is steered';}
 }
 function startStep(group){
  const indices=feet.map((_,i)=>i).filter(i=>(i%2+(i>=4?1:0))%2===group);
  const targets=indices.map(i=>desired(i));if(targets.some((p,k)=>!p||norm(sub(hip(indices[k]),p.position))>.046))return false;
  indices.forEach((i,k)=>{feet[i].contact=false;feet[i].swing={from:[...feet[i].position],to:targets[k],elapsed:0};});activeGroup=group;return true;
 }
 function tick(dt){
  time+=dt;if(!web)return;
  silk.step(dt);
  const observed=awareness.step(dt,add(body(),mul(web.normal,silk.sample(location.edge,location.t).offset)),nearbyBird);
  if(rain<=.4&&observed.alert&&!respondingToBird)withdrawFromBird(observed);
  else if(rain<=.4&&!observed.alert&&respondingToBird)resumeAfterBird();
  const signal=encounter?.step(dt,silk.snapshot(),{rain:rain>.4,carrier:carrier()});
  if(signal){
   for(const binding of signal.bindings)if(binding.weight>0)silk.pluck(binding.edge,binding.t,signal.strength*binding.weight);
   // Repeated struggling excites the field without resetting a heard source or route.
   if(!pendingDisturbance&&pursuitId!==signal.id)pendingDisturbance={...captureApproach(signal.target),encounterId:signal.id,age:0,heardAt:null};
  }
  if(encounter?.phase()==='escaping'){
   const pendingCatch=Boolean(pendingDisturbance?.encounterId),followingCatch=Boolean(pursuitId)||(pendingCatch&&state==='listening');
   if(pendingCatch)pendingDisturbance=null;
   pursuitId=null;
   if(rain<=.4&&!respondingToBird&&followingCatch)routeTo(0,'hub');
  }
  if(pendingDisturbance&&rain<=.4){
   const pending=pendingDisturbance;pending.age+=dt;
   if(pending.heardAt===null&&feet.some(f=>f.contact&&Math.abs(silk.sample(f.edge,f.t).velocity)>.000018)){
    pending.heardAt=time;if(!respondingToBird){route=[];state='listening';reason='Feeling a ripple through the silk';wait=.32;}
   }
   if(!respondingToBird&&pending.heardAt!==null&&time-pending.heardAt>=.32){investigate(pending);pendingDisturbance=null;}
   else if(pending.age>4&&pending.heardAt===null)pendingDisturbance=null;
  }
  if(!respondingToBird&&['caught','wrapping'].includes(encounter?.phase())&&pursuitId===encounter.id()&&destination==='encounter'&&!route.length&&state==='checking'&&rain<=.4){
   state='orienting';reason='Turning toward a catch in the silk';wait=Infinity;
  }
  if(!respondingToBird&&encounter?.phase()==='wrapping'&&encounter.beginLift()){state='lifting';reason='Taking the wrapped catch gently from the silk';}
  if(!respondingToBird&&encounter?.phase()==='carried'&&state==='lifting'){selectDestination();reason=rain>.4?'Carrying the catch toward shelter':'Carrying the catch back to the hub';}
  if(!respondingToBird&&encounter?.phase()==='carried'&&rain<=.4&&destination==='hub'&&!route.length&&state==='resting'){
   encounter.beginMeal();state='feeding';reason='Resting with the catch at the hub';wait=Infinity;
  }
  if(encounter?.phase()==='waiting'&&state==='feeding'){state='resting';reason='A quiet pause after the encounter';wait=5;pursuitId=null;}
  if(steerDir&&!respondingToBird&&!['wrapping','lifting','feeding'].includes(state))steerStep();
  wait-=dt;
  if(!route.length&&wait<=0){
   if(state==='resting'&&rain<=.4){const spoke=(2+patrol++*7)%SPOKES;routeTo(1+spoke*2,'check');}
   else if(state==='checking')routeTo(0,'hub');
  }
  let moved=0,rotationBlocked=false;
  const reachableAt=center=>feet.every((foot,i)=>norm(sub(hip(i,center),foot.position))<.046&&(!foot.swing||norm(sub(hip(i,center),foot.swing.to.position))<.046));
  function turnToward(wanted,rate){
   const prior=heading,turn=Math.atan2(Math.sin(wanted-heading),Math.cos(wanted-heading));heading+=clamp(turn,-rate*dt,rate*dt);
   if(!reachableAt(body())){heading=prior;rotationBlocked=true;}
  }
  if(route.length){
   const next=route[0],direction=sub(next.b,position),distance=norm(direction);
   if(distance>1e-10){
    const wanted=Math.atan2(dot(direction,web.up),dot(direction,web.right));turnToward(wanted,4);
    const advance=Math.min(distance,ORB_WEAVER_BODY.speed*dt*(rain>.4?.7:1));const candidate=add(position,mul(direction,advance/distance)),center=add(candidate,mul(web.normal,ORB_WEAVER_BODY.clearance));
    // Pause the body if any planted leg needs to release before advancing.
    if(reachableAt(center)){
     moved=advance;position=candidate;const at=project(position,web.edges[next.edge]);location={edge:next.edge,t:at.t};
     if(advance>=distance-1e-10){position=[...next.b];route.shift();if(!route.length){state=destination==='shelter'?'sheltering':destination==='quiet'?'still':destination==='hub'?'resting':'checking';reason=state==='sheltering'?'Resting by an attached branch':state==='still'?'Keeping still while a bird is nearby':state==='resting'?'Waiting at the hub':'Feeling the silk';wait=state==='still'?Infinity:state==='resting'?2.8:.8;}}
    }
   }
  }else if(state==='orienting'){
   const toward=sub(encounter.snapshot().position,position);turnToward(Math.atan2(dot(toward,web.up),dot(toward,web.right)),2);
  }else if(state==='resting'){
   turnToward(-Math.PI/2,1.5);
  }
  stepDistance+=moved;
  for(const foot of feet)if(foot.swing){const swing=foot.swing;swing.elapsed+=dt;const t=clamp(swing.elapsed/.13),e=t*t*(3-2*t);foot.position=add(mix(swing.from,swing.to.position,e),mul(web.normal,Math.sin(t*Math.PI)*.004));if(t>=1){Object.assign(foot,swing.to);foot.contact=true;foot.swing=null;}}
  if(activeGroup>=0&&!feet.some(f=>f.swing)){activeGroup=-1;nextGroup=1-nextGroup;stepDistance=0;}
  if(activeGroup<0&&!['wrapping','lifting','feeding'].includes(state)){
   const errors=feet.map((f,i)=>norm(sub(f.position,desired(i).position)));
   const urgent=errors.indexOf(Math.max(...errors));
   if(stepDistance>.0055||(route.length&&moved===0)||rotationBlocked||errors[urgent]>.018)startStep(errors[urgent]>.018?(urgent%2+(urgent>=4?1:0))%2:nextGroup);
  }
  if(!respondingToBird&&state==='orienting'&&['caught','wrapping'].includes(encounter?.phase())&&pursuitId===encounter.id()&&feet.every(f=>f.contact)){
   const toward=sub(encounter.snapshot().position,position),wanted=Math.atan2(dot(toward,web.up),dot(toward,web.right)),turn=Math.atan2(Math.sin(wanted-heading),Math.cos(wanted-heading));
   if(Math.abs(turn)<.06&&encounter.beginWrap(pursuitId,materialPosition())){state='wrapping';reason='Turning silk around a small catch';wait=Infinity;stepDistance=0;}
  }
  encounter?.syncCarrier(carrier());
 }
 reset();
 function snapshot(){
  if(!web)return {kind:'simulated',time,web:null,silk:null,encounter:null,awareness:{...awareness.snapshot(),responding:false,withdrawal:null},spider:{kind:'simulated',state:'unplaced',reason,position:[...position],feet:[]}};
  const shift=mul(web.normal,silk.sample(location.edge,location.t).offset),center=add(body(),shift),f=forward(),r=side();
  return {kind:'simulated',time,silk:silk.snapshot(),encounter:encounter?.snapshot()??null,awareness:{...awareness.snapshot(),responding:respondingToBird,withdrawal:copy(withdrawal)},web:{id:web.id,anchorId:web.anchorId,center:[...web.center],normal:[...web.normal],radius:web.radius,supportIds:web.anchors.map(a=>a.id)},spider:{kind:'simulated',id:'simulated-orb-weaver',state,reason,position:center,silkPosition:add(position,shift),silkEdge:location.edge,silkT:location.t,heading,basis:{right:r,up:[...web.normal],forward:f},feet:feet.map((foot,i)=>{
   const h=hip(i,center),pole=add(h,add(mul(web.normal,.025),mul(r,i<4?-.018:.018)));
   let offset=silk.sample(foot.edge,foot.t).offset;
   if(foot.swing){const p=clamp(foot.swing.elapsed/.13),blend=p*p*(3-2*p);offset=offset*(1-blend)+silk.sample(foot.swing.to.edge,foot.swing.to.t).offset*blend;}
   let toe=add(foot.position,mul(web.normal,offset)),contact=foot.contact;
   if(state==='wrapping'&&(i===0||i===4)){
    const visitor=encounter.snapshot(),t=visitor.wrapProgress,blend=Math.min(1,t/.16,(1-t)/.18),phase=visitor.age*7+(i===0?0:Math.PI);
    const target=add(visitor.position,add(mul(r,Math.cos(phase)*.003),mul(web.normal,Math.sin(phase)*.002)));
    toe=mix(toe,target,blend*blend*(3-2*blend));contact=false;
   }
   return {...solveLeg(h,toe,pole,ORB_WEAVER_BODY.upperLeg,ORB_WEAVER_BODY.lowerLeg),contact,silkEdge:contact?foot.edge:null,silkT:contact?foot.t:null};
  })}};
 }
 return {snapshot,getWeb:()=>web?{...copy(web),silkGeometry:copy(silkGeometry)}:null,step(dt){if(!Number.isFinite(dt)||dt<0||dt>10)throw new RangeError('Step requires 0–10 seconds');for(let left=dt;left>1e-10;){const part=Math.min(left,1/120);tick(part);left-=part;}return snapshot();},
  steer(dir){steerDir=dir&&Number.isFinite(dir[0])&&Number.isFinite(dir[1])?[dir[0],dir[1]]:null;if(!steerDir&&web&&state!=='unplaced'){route=[];state='checking';reason='Feeling the silk';wait=.8;}},
  setNearbyBird(value){if(value!==null&&(!value||typeof value.id!=='string'||typeof value.state!=='string'||!finite3(value.position)))throw new TypeError('Expected an actual positioned bird snapshot or null');nearbyBird=value===null?null:{id:value.id,state:value.state,position:[...value.position]};},
  pluck(edge,t,strength=1){if(!silk)return false;const changed=silk.pluck(edge,t,strength);if(changed&&rain<=.4&&!['caught','wrapping','lifting','carried','feeding'].includes(encounter?.phase()))pendingDisturbance={edge,t,age:0,heardAt:null};return changed;},
  setWeather(weather){
   if(!weather||!Number.isFinite(weather.rain)||weather.rain<0||weather.rain>1)throw new RangeError('Rain requires 0–1');
   const changed=(rain>.4)!==(weather.rain>.4);if(weather.rain>.4)retractWorkingFeet();
   rain=weather.rain;encounter?.setRain(rain>.4);
   if(rain>.4){pendingDisturbance=null;pursuitId=null;respondingToBird=false;}
   if(changed&&web)selectDestination();
  },
  setHabitat(next){const candidate=selectOrbWeb(next);if(candidate?.key===web?.key)return false;web=candidate;reset();if(web&&rain>.4)selectDestination();return true;}
 };
}
