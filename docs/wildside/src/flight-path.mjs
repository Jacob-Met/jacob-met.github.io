/**
 * Clearance for the maintained bird planner. Obstacles are admitted vertical
 * prisms. The default 7.5 cm margin remains available for centerline callers;
 * the bird planner supplies separate horizontal and vertical route margins.
 * These authored envelopes are not a guarantee for every moving feather. No observations or world state are added.
 */
import {circleIntersectsPolygon,pointInPolygon,validatePolygon} from './boundary.mjs';
export const FLIGHT_MARGIN=.075;
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function inBox(p,b,pad,verticalPad){return p.every((v,i)=>{const reach=i===1?verticalPad:pad;return v>b.min[i]-reach&&v<b.max[i]+reach;});}

/** Keep footprint admission atomic with the enclosing habitat update. */
export function admitFlightFootprint(box){
 if(box.polygonXZ===undefined)return undefined;
 const points=validatePolygon(box.polygonXZ);
 if(points.some(p=>p[0]<box.min[0]-1e-8||p[0]>box.max[0]+1e-8||p[1]<box.min[2]-1e-8||p[1]>box.max[2]+1e-8))
  throw new TypeError('Flight footprint lies outside its obstacle bounds');
 return points;
}
export function flightPointBlocked(p,box,pad=FLIGHT_MARGIN,verticalPad=pad){
 return inBox(p,box,pad,verticalPad)&&(!box.polygonXZ||circleIntersectsPolygon([p[0],p[2]],pad,box.polygonXZ));
}
/** Parameter interval where a segment meets the expanded broadphase box. */
function boxInterval(a,b,box,pad,verticalPad){
 let low=0,high=1;
 for(let i=0;i<3;i++){
  const d=b[i]-a[i],reach=i===1?verticalPad:pad,min=box.min[i]-reach,max=box.max[i]+reach;
  if(Math.abs(d)<1e-12){if(a[i]<=min||a[i]>=max)return null;}
  else{const p=(min-a[i])/d,q=(max-a[i])/d;low=Math.max(low,Math.min(p,q));high=Math.min(high,Math.max(p,q));}
 }
 return low<=high&&low<1&&high>0?[low,high]:null;
}
function pointSegmentDistance2(p,a,b){
 const dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;
 const t=length2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/length2)):0;
 return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dz)**2;
}
function segmentsDistance2(a,b,c,d){
 const u=[b[0]-a[0],b[1]-a[1]],v=[d[0]-c[0],d[1]-c[1]],w=[c[0]-a[0],c[1]-a[1]];
 const cross=(p,q)=>p[0]*q[1]-p[1]*q[0],den=cross(u,v);
 if(den!==0){const s=cross(w,v)/den,t=cross(w,u)/den;if(s>=0&&s<=1&&t>=0&&t<=1)return 0;}
 return Math.min(pointSegmentDistance2(a,c,d),pointSegmentDistance2(b,c,d),pointSegmentDistance2(c,a,b),pointSegmentDistance2(d,a,b));
}
function segmentBlocked(a,b,box,pad,verticalPad=pad){
 const interval=boxInterval(a,b,box,pad,verticalPad);if(!interval)return false;
 if(!box.polygonXZ)return true;
 // Clip in 3D first: a footprint crossing above/below the solid is not a hit.
 const begin=mix(a,b,interval[0]),end=mix(a,b,interval[1]),p=[begin[0],begin[2]],q=[end[0],end[2]],points=box.polygonXZ;
 if(pointInPolygon(p,points)||pointInPolygon(q,points))return true;
 return points.some((c,i)=>segmentsDistance2(p,q,c,points[(i+1)%points.length])<=pad*pad);
}
export function flightSegmentClear(a,b,boxes,pad=FLIGHT_MARGIN,verticalPad=pad){
 return !boxes.some(box=>segmentBlocked(a,b,box,pad,verticalPad));
}
function directRoute(start,end,boxes,pad,verticalPad){
 const mid=mix(start,end,.5);mid[1]+=Math.min(.8,distance(start,end)*.25+.18);
 return flightSegmentClear(start,mid,boxes,pad,verticalPad)&&flightSegmentClear(mid,end,boxes,pad,verticalPad)?[[...start],mid,[...end]]:[[...start],[...end]];
}
/** Existing visibility graph, at a specified candidate height. Every edge is
 * continuously checked against all obstacles, including omitted node donors. */
function graphRoute(start,end,boxes,top,pad,verticalPad){
 const nodes=[start,end],floor=Math.min(start[1],end[1]);
 const add=p=>{if(!boxes.some(b=>flightPointBlocked(p,b,pad,verticalPad)))nodes.push(p);};
 add([start[0],top,start[2]]);add([end[0],top,end[2]]);
 for(const b of boxes){
  if(b.max[1]+verticalPad<=floor||b.min[1]-verticalPad>=top)continue;
  const cornerPad=Math.max(.3,pad+.05);
  for(const x of [b.min[0]-cornerPad,b.max[0]+cornerPad])for(const z of [b.min[2]-cornerPad,b.max[2]+cornerPad])add([x,top,z]);
 }
 const dist=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),seen=new Set();dist[0]=0;
 while(seen.size<nodes.length){
  let u=-1;for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&(u<0||dist[i]<dist[u]))u=i;
  if(u<0||!Number.isFinite(dist[u]))return null;if(u===1)break;seen.add(u);
  for(let v=0;v<nodes.length;v++)if(!seen.has(v)){
   const cost=dist[u]+distance(nodes[u],nodes[v]);
   if(cost<dist[v]&&flightSegmentClear(nodes[u],nodes[v],boxes,pad,verticalPad)){dist[v]=cost;prev[v]=u;}
  }
 }
 const path=[];for(let i=1;i>=0;i=prev[i]){path.unshift([...nodes[i]]);if(i===0)break;}
 return path;
}
/** Prefer a clear direct flight, then a route above its actual blockers.
 * The original global-height graph remains a fallback. A null result means
 * this finite candidate graph found no route, not proof of physical isolation. */
export function planFlightRoute(start,end,boxes,pad=FLIGHT_MARGIN,verticalPad=pad){
 if(boxes.some(b=>flightPointBlocked(start,b,pad,verticalPad)||flightPointBlocked(end,b,pad,verticalPad)))return null;
 if(flightSegmentClear(start,end,boxes,pad,verticalPad))return directRoute(start,end,boxes,pad,verticalPad);
 const blockers=boxes.filter(b=>segmentBlocked(start,end,b,pad,verticalPad));
 const localTop=Math.max(start[1],end[1],...blockers.map(b=>b.max[1]))+Math.max(.55,verticalPad+.05);
 const local=graphRoute(start,end,boxes,localTop,pad,verticalPad);if(local)return local;
 const globalTop=Math.max(start[1],end[1],...boxes.map(b=>b.max[1]))+Math.max(.55,verticalPad+.05);
 return globalTop>localTop?graphRoute(start,end,boxes,globalTop,pad,verticalPad):null;
}
