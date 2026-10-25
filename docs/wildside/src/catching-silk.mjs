/** Finite catching-segment contact against the same field snapshot rendered by web art. */
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),at=(a,d,t)=>a.map((v,i)=>v+d[i]*t),clamp=x=>Math.max(0,Math.min(1,x));
const valid=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
function roots(a,b,c){
 if(a===0)return b===0?[]:[-c/b];
 const discriminant=b*b-4*a*c;if(discriminant<0)return [];
 const s=Math.sqrt(discriminant),q=-.5*(b+(b>=0?s:-s));
 return q===0?[-b/(2*a)]:[q/a,c/q].sort((x,y)=>x-y);
}
/** Earliest swept sphere versus one finite capsule, with endpoint spheres. */
export function sweepSegment(from,to,a,b,radius){
 if(![from,to,a,b].every(valid)||!Number.isFinite(radius)||radius<0||radius>.05)throw Error('Finite points and capture radius0–.05m required');
 const v=sub(to,from),d=sub(b,a),p=sub(from,a),dd=dot(d,d),vv=dot(v,v),r2=radius*radius;
 const nearest=t=>{const center=at(from,v,t),u=dd?clamp(dot(sub(center,a),d)/dd):0;return {flightT:t,segmentT:u,center,point:at(a,d,u)};};
 const start=nearest(0);if(dot(sub(start.center,start.point),sub(start.center,start.point))<=r2)return start;
 if(vv===0)return null;
 const candidates=[];
 for(const end of [a,b]){const delta=sub(from,end);for(const t of roots(vv,2*dot(delta,v),dot(delta,delta)-r2))if(t>=0&&t<=1)candidates.push(t);}
 if(dd>0){const pv=dot(p,d)/dd,dv=dot(v,d)/dd,perpP=p.map((x,i)=>x-d[i]*pv),perpV=v.map((x,i)=>x-d[i]*dv);
  for(const t of roots(dot(perpV,perpV),2*dot(perpP,perpV),dot(perpP,perpP)-r2)){const u=pv+t*dv;if(t>=0&&t<=1&&u>=0&&u<=1)candidates.push(t);}
 }
 candidates.sort((x,y)=>x-y);return candidates.length?nearest(candidates[0]):null;
}
/** Cache the maintained structural projection once per web; no solver dependency. */
export function createCatchingPlan(web,nearestSilkPoint){
 if(!web||!Array.isArray(web.spiral)||web.spiral.length>1024||typeof nearestSilkPoint!=='function')throw Error('Bounded rendered spiral and projection required');
 return {web,bindings:web.spiral.flatMap(s=>[nearestSilkPoint(web,s.a),nearestSilkPoint(web,s.b)])};
}
/** Shared Float32 vertices for both rendering and fixed-current-field collision. */
export function writeCatchingPositions(plan,field,vertices=new Float32Array(plan.bindings.length*3)){
 if(!(vertices instanceof Float32Array)||vertices.length!==plan.bindings.length*3)throw Error('Matching Float32 catching buffer required');
 const web=plan.web,mesh=web.silkGeometry;
 plan.bindings.forEach((binding,i)=>{
  let offset=0;
  if(mesh&&field){const path=mesh.paths[binding.edge],coordinate=binding.t*(path.length-1),j=Math.min(path.length-2,Math.floor(coordinate)),t=coordinate-j;offset=field.displacements[path[j]]*(1-t)+field.displacements[path[j+1]]*t;}
  const point=web.spiral[Math.floor(i/2)][i%2?'b':'a'];
  for(let axis=0;axis<3;axis++)vertices[i*3+axis]=point[axis]+web.normal[axis]*offset;
 });
 return vertices;
}
/** Earliest finite catching segment; geometry is frozen over this bounded substep. */
export function sweepCatching(plan,vertices,from,to,radius){
 if(!(vertices instanceof Float32Array)||vertices.length!==plan.bindings.length*3)throw Error('Matching Float32 catching buffer required');
 if(![from,to].every(valid)||!Number.isFinite(radius)||radius<0||radius>.05)throw Error('Finite points and capture radius0–.05m required');
 const low=from.map((v,i)=>Math.min(v,to[i])-radius),high=from.map((v,i)=>Math.max(v,to[i])+radius);
 let best=null;
 for(let i=0;i<plan.web.spiral.length;i++){
  // Conservative swept AABB avoids capsule allocations for distant catching wires.
  let separated=false;for(let axis=0;axis<3;axis++){const a=vertices[i*6+axis],b=vertices[i*6+3+axis];if(Math.max(a,b)<low[axis]||Math.min(a,b)>high[axis]){separated=true;break;}}
  if(separated)continue;
  const a=Array.from(vertices.subarray(i*6,i*6+3)),b=Array.from(vertices.subarray(i*6+3,i*6+6)),hit=sweepSegment(from,to,a,b,radius);
  if(hit&&(!best||hit.flightT<best.flightT))best={...hit,spiralSegment:i,impulseBindings:plan.bindings.slice(i*2,i*2+2).map((binding,j)=>({edge:binding.edge,t:binding.t,weight:j?hit.segmentT:1-hit.segmentT}))};
 }
 return best;
}
