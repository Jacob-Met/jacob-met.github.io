/** Explicit calibrated support polygons. A traced edge is an interpretation, never automatic segmentation. */
const fail=message=>{throw new Error(message);};
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function polygonArea(points){return points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2;}
export function validatePolygon(input,{normalized=false}={}){
 if(!Array.isArray(input)||input.length<3||input.length>128)fail('A boundary needs 3–128 ordered vertices');
 const points=input.map(p=>{if(!Array.isArray(p)||p.length!==2||!p.every(v=>Number.isFinite(v)&&Math.abs(v)<=10000)||(normalized&&p.some(v=>v<0||v>1)))fail('Boundary coordinates are invalid');return [...p];});
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),extent=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
 const epsilon=1e-10*Math.max(1,extent*extent);
 const onSegment=(a,b,p)=>Math.abs(cross(a,b,p))<=epsilon&&p[0]>=Math.min(a[0],b[0])-epsilon&&p[0]<=Math.max(a[0],b[0])+epsilon&&p[1]>=Math.min(a[1],b[1])-epsilon&&p[1]<=Math.max(a[1],b[1])+epsilon;
 const intersects=(a,b,c,d)=>{const aa=cross(a,b,c),bb=cross(a,b,d),cc=cross(c,d,a),dd=cross(c,d,b);return aa*bb<0&&cc*dd<0||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);};
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];if(Math.hypot(b[0]-a[0],b[1]-a[1])<1e-7)fail('Boundary has a repeated vertex or zero-length edge');
  const previous=points[(i+points.length-1)%points.length];if(Math.abs(cross(previous,a,b))<=epsilon&&(a[0]-previous[0])*(b[0]-a[0])+(a[1]-previous[1])*(b[1]-a[1])<0)fail('Boundary doubles back over an edge');
  for(let j=i+1;j<points.length;j++){if(j===i+1||i===0&&j===points.length-1)continue;if(intersects(a,b,points[j],points[(j+1)%points.length]))fail('Boundary edges cross or touch; trace one simple outline');}
 }
 if(Math.abs(polygonArea(points))<=epsilon)fail('Boundary has no usable area');
 if(!normalized&&extent>1000)fail('Boundary exceeds the supported local extent');
 return points;
}
export function normalizeBoundary(input,{position,project,matrix}){
 if(!input||input.version!==1||typeof project!=='function'||!Array.isArray(matrix)||matrix.length!==9)fail('A source boundary requires ground-plane calibration');
 const imagePoints=validatePolygon(input.imagePoints,{normalized:true});
 const denominators=imagePoints.map(([u,v])=>matrix[6]*u+matrix[7]*v+matrix[8]);
 if(denominators.some(d=>!Number.isFinite(d)||Math.abs(d)<1e-8)||!(denominators.every(d=>d>0)||denominators.every(d=>d<0)))fail('Boundary crosses the projection horizon');
 const localPoints=validatePolygon(imagePoints.map(p=>{const [x,z]=project(p);return [x-position[0],z-position[2]];}));
 return {version:1,method:'annotated-ground-plane',imagePoints,localPoints};
}
/** Includes the edge. Renderer and contact consumers may share this same footprint test. */
export function pointInPolygon(point,points,tolerance=1e-8){
 const [x,y]=point;let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[j],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy,t=length2?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length2)):0;
  if(Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<=tolerance)return true;
  if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
/** Circle against an already admitted footprint; keeps concave recesses open while
 * retaining body clearance at every edge and vertex. Heights/broadphase belong to the caller. */
export function circleIntersectsPolygon(point,radius,points){
 if(pointInPolygon(point,points))return true;
 const radius2=radius*radius;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;
  const t=length2?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/length2)):0;
  if((point[0]-a[0]-t*dx)**2+(point[1]-a[1]-t*dz)**2<=radius2)return true;
 }
 return false;
}
/** World-space XZ vertices; height remains the explicit anchor base/height interpretation. */
export function worldBoundary(anchor){return anchor.boundary?.localPoints?.map(([x,z])=>[x+anchor.position[0],z+anchor.position[2]])??null;}
/** Ear clipping of an already validated simple polygon. Collinear subdivisions do not alter its area. */
function triangles(points){
 const p=points.map(v=>[...v]);if(polygonArea(p)<0)p.reverse();
 const eps=1e-10*Math.max(1,Math.abs(polygonArea(p)));
 let removed=true;while(removed&&p.length>3){removed=false;for(let i=0;i<p.length;i++)if(Math.abs(cross(p[(i+p.length-1)%p.length],p[i],p[(i+1)%p.length]))<=eps){p.splice(i,1);removed=true;break;}}
 const result=[],contains=(q,a,b,c)=>cross(a,b,q)>=-eps&&cross(b,c,q)>=-eps&&cross(c,a,q)>=-eps;
 while(p.length>3){let found=false;for(let i=0;i<p.length;i++){const before=(i+p.length-1)%p.length,after=(i+1)%p.length,a=p[before],b=p[i],c=p[after];if(cross(a,b,c)<=eps)continue;if(p.some((q,j)=>j!==before&&j!==i&&j!==after&&contains(q,a,b,c)))continue;result.push([a,b,c]);p.splice(i,1);found=true;break;}if(!found)fail('Boundary could not be triangulated stably');}
 result.push(p);return result;
}
function triangleIntersectionArea(a,b){
 if(Math.max(...a.map(p=>p[0]))<Math.min(...b.map(p=>p[0]))||Math.max(...b.map(p=>p[0]))<Math.min(...a.map(p=>p[0]))||Math.max(...a.map(p=>p[1]))<Math.min(...b.map(p=>p[1]))||Math.max(...b.map(p=>p[1]))<Math.min(...a.map(p=>p[1])))return 0;
 let polygon=a;
 for(let edge=0;edge<3&&polygon.length;edge++){
  const first=b[edge],second=b[(edge+1)%3],next=[];
  for(let i=0;i<polygon.length;i++){const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=cross(first,second,p),dq=cross(first,second,q),pin=dp>=0,qin=dq>=0;
   if(pin)next.push(p);if(pin!==qin){const t=dp/(dp-dq);next.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
  }polygon=next;
 }
 return polygon.length<3?0:Math.abs(polygonArea(polygon));
}
/** Shape discrepancy in meters: max(vertex-to-edge distance, sqrt(symmetric-difference area)).
 * Area intersection tests edge interiors, including changed concavities with the same vertex set.
 * This is a refinement heuristic, not an exact Hausdorff distance or measurement uncertainty.
 */
export function boundaryDifference(a,b){
 a=validatePolygon(a);b=validatePolygon(b);
 const directed=(points,target)=>Math.max(...points.map(p=>Math.min(...target.map((v,i)=>{const w=target[(i+1)%target.length],dx=w[0]-v[0],dy=w[1]-v[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p[0]-v[0])*dx+(p[1]-v[1])*dy)/l)):0;return Math.hypot(p[0]-v[0]-t*dx,p[1]-v[1]-t*dy);}))));
 const ta=triangles(a),tb=triangles(b),aa=Math.abs(polygonArea(a)),ab=Math.abs(polygonArea(b));let intersection=0;
 for(const x of ta)for(const y of tb)intersection+=triangleIntersectionArea(x,y);
 const area=Math.max(0,aa+ab-2*intersection),epsilon=1e-9*Math.max(1,aa,ab),areaDistance=area<=epsilon?0:Math.sqrt(area);
 const vertexDistance=Math.max(directed(a,b),directed(b,a));return Math.max(vertexDistance<1e-9?0:vertexDistance,areaDistance);
}
