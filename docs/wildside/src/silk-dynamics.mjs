/** A small transverse wave field on the existing silk graph. Artistic, not a silk material fit. */
const finite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const clone=x=>structuredClone(x);
export const SILK_LIMITS=Object.freeze({nodes:128,edges:256,particles:2048,stepsPerCall:480,maxAmplitude:.0012,maxEnergy:.00002});

export function createSilkDynamics(web,{spacing=.024,waveSpeed=.65,damping=3,maxAmplitude=SILK_LIMITS.maxAmplitude,maxEnergy=SILK_LIMITS.maxEnergy}={}){
 for(const [name,value,lo,hi] of [['spacing',spacing,.005,.1],['waveSpeed',waveSpeed,.05,5],['damping',damping,0,30],['maxAmplitude',maxAmplitude,.00001,.003],['maxEnergy',maxEnergy,1e-12,.01]])if(!Number.isFinite(value)||value<lo||value>hi)throw new RangeError(`Invalid silk ${name}`);
 if(!web||!Array.isArray(web.nodes)||web.nodes.length<2||web.nodes.length>SILK_LIMITS.nodes||!Array.isArray(web.edges)||!web.edges.length||web.edges.length>SILK_LIMITS.edges||!Array.isArray(web.anchors)||!web.anchors.length)throw new TypeError('Expected a bounded anchored silk graph');
 const positions=web.nodes.map(n=>{if(!finite3(n?.position))throw new TypeError('Invalid silk node');return [...n.position];});
 const fixed=new Set(web.anchors.map(a=>{if(!Number.isInteger(a?.node)||a.node<0||a.node>=positions.length)throw new TypeError('Invalid silk anchor');return a.node;}));
 const connections=positions.map(()=>[]),paths=[],segments=[];
 for(const edge of web.edges){
  if(!Number.isInteger(edge?.from)||!Number.isInteger(edge.to)||edge.from<0||edge.to<0||edge.from>=web.nodes.length||edge.to>=web.nodes.length||edge.from===edge.to)throw new TypeError('Invalid silk edge');
  const a=positions[edge.from],b=positions[edge.to],length=distance(a,b);
  if(!Number.isFinite(length)||length<.001||length>8)throw new RangeError('Silk edge is outside the resolved length range');
  const count=Math.max(1,Math.ceil(length/spacing)),path=[edge.from];
  if(positions.length+count-1>SILK_LIMITS.particles)throw new RangeError('Silk particle budget exceeded');
  for(let j=1;j<count;j++){path.push(positions.length);positions.push(a.map((x,k)=>x+(b[k]-x)*j/count));connections.push([]);}
  path.push(edge.to);paths.push(path);
  for(let j=1;j<path.length;j++){
   const from=path[j-1],to=path[j],span=length/count,stiffness=waveSpeed*waveSpeed/span;
   segments.push({from,to,length:span,stiffness});connections[from].push(to);connections[to].push(from);
  }
 }
 const seen=new Set(fixed),queue=[...fixed];for(let j=0;j<queue.length;j++)for(const to of connections[queue[j]])if(!seen.has(to)){seen.add(to);queue.push(to);}
 if(seen.size!==positions.length)throw new TypeError('Every silk component must reach an anchor');
 const size=positions.length,mass=new Float64Array(size),diagonal=new Float64Array(size),y=new Float64Array(size),v=new Float64Array(size),force=new Float64Array(size);
 for(const s of segments){mass[s.from]+=s.length/2;mass[s.to]+=s.length/2;diagonal[s.from]+=s.stiffness;diagonal[s.to]+=s.stiffness;}
 let bound=0;for(let i=0;i<size;i++)if(!fixed.has(i))bound=Math.max(bound,2*diagonal[i]/mass[i]);
 // Gershgorin bound on M^-1 K; velocity Verlet is stable below 2/sqrt(lambda_max).
 const stepNs=Math.floor(Math.min(1/480,1.5/Math.sqrt(bound||1))*1e9);
 if(stepNs<100000)throw new RangeError('Silk stiffness exceeds the bounded step budget');
 const dt=stepNs/1e9,decay=Math.exp(-damping*dt/2),free=Array.from({length:size},(_,i)=>i).filter(i=>!fixed.has(i));
 let remainderNs=0,fractionalNs=0,steps=0,droppedNs=0,impulses=0,awake=false;
 const geometry={positions,paths,segments:segments.map(({from,to})=>({from,to})),fixed:[...fixed],stepSeconds:dt,waveSpeed,damping};
 function energy(){let total=0;for(const i of free)total+=.5*mass[i]*v[i]*v[i];for(const s of segments)total+=.5*s.stiffness*(y[s.to]-y[s.from])**2;return total;}
 function constrain(){
  let peak=0;for(const i of free)peak=Math.max(peak,Math.abs(y[i]));
  const e=energy(),scale=Math.min(1,peak?maxAmplitude/peak:1,e?Math.sqrt(maxEnergy/e):1);
  if(scale<1)for(const i of free){y[i]*=scale;v[i]*=scale;}
 }
 function forces(){force.fill(0);for(const s of segments){const f=s.stiffness*(y[s.to]-y[s.from]);force[s.from]+=f;force[s.to]-=f;}}
 function tick(){
  forces();for(const i of free){v[i]=v[i]*decay+force[i]/mass[i]*dt/2;y[i]+=v[i]*dt;}
  forces();for(const i of free)v[i]=(v[i]+force[i]/mass[i]*dt/2)*decay;
  constrain();steps++;
 }
 function where(edge,t){
  if(!Number.isInteger(edge)||edge<0||edge>=paths.length||!Number.isFinite(t)||t<0||t>1)throw new RangeError('Expected a silk edge and material coordinate 0–1');
  const path=paths[edge],at=t*(path.length-1),index=Math.min(path.length-2,Math.floor(at));return {a:path[index],b:path[index+1],t:at-index};
 }
 function sample(edge,t){const p=where(edge,t);return {offset:y[p.a]*(1-p.t)+y[p.b]*p.t,velocity:v[p.a]*(1-p.t)+v[p.b]*p.t};}
 function snapshot(){return {active:awake,energy:energy(),displacements:Array.from(y),velocities:Array.from(v),steps,droppedSeconds:droppedNs/1e9,impulses};}
 return {
  geometry:()=>clone(geometry),snapshot,sample,
  pluck(edge,t,strength=1){
   if(!Number.isFinite(strength)||Math.abs(strength)>1)throw new RangeError('Silk impulse strength requires −1 to 1');
   const p=where(edge,t);let changed=false;
   for(const [node,weight] of [[p.a,1-p.t],[p.b,p.t]])if(!fixed.has(node)&&weight>0&&strength!==0){v[node]+=.035*strength*weight;changed=true;}
   if(changed){constrain();awake=true;impulses++;}return changed;
  },
  step(elapsed){
   if(!Number.isFinite(elapsed)||elapsed<0||elapsed>10)throw new RangeError('Silk step requires 0–10 seconds');
   if(elapsed===0)return;
   // Integer-nanosecond accumulator/cap follows HAMON Engine FixedStepper's bounded catch-up contract.
   fractionalNs+=elapsed*1e9;const incoming=Math.floor(fractionalNs+1e-6);fractionalNs-=incoming;remainderNs+=incoming;
   const due=Math.floor(remainderNs/stepNs),count=Math.min(due,SILK_LIMITS.stepsPerCall);
   remainderNs-=due*stepNs;droppedNs+=(due-count)*stepNs;
   if(awake){for(let i=0;i<count;i++)tick();if(energy()<1e-18){y.fill(0);v.fill(0);awake=false;}}
  }
 };
}
