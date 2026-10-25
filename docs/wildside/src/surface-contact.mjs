/** Bounded geometric supports, in the same metre/Y-up world as rendered meshes.
 * This is a surface attachment query, not a physics backend or creature policy. */
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const finite3=v=>Array.isArray(v)&&v.length===3&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<=1e6);
const EPS=1e-10;
export function createSurfaceContact(input){
 if(!Array.isArray(input)||input.length>4096)throw Error('Use at most 4096 explicit support triangles');
 const ids=new Set();const faces=input.map(f=>{
  if(!f||typeof f.id!=='string'||!f.id||ids.has(f.id)||typeof f.anchorId!=='string'||!Array.isArray(f.vertices)||f.vertices.length!==3||!f.vertices.every(finite3))throw Error('Invalid or duplicate support face');ids.add(f.id);
  const [a,b,c]=f.vertices.map(v=>v.slice()),n=cross(sub(b,a),sub(c,a)),length=Math.hypot(...n);
  if(length<1e-12)throw Error('Degenerate support triangle');
  const normal=n.map(v=>v/length); // Preserve outward winding; ceilings are not support.
  const determinant=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  return {id:f.id,anchorId:f.anchorId,vertices:[a,b,c],normal,determinant};
 });
 function barycentric(f,x,z){const[a,b,c]=f.vertices,d=f.determinant;if(Math.abs(d)<1e-12)return null;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;return[u,v,1-u-v];}
 function at(x,z,{minimumY=-Infinity,maximumY=Infinity,minUp=.17364817766693041}={}){
  if(!Number.isFinite(x)||Math.abs(x)>1e6||!Number.isFinite(z)||Math.abs(z)>1e6||!Number.isFinite(minUp)||minUp<=0||minUp>1||typeof minimumY!=='number'||typeof maximumY!=='number'||Number.isNaN(minimumY)||Number.isNaN(maximumY)||minimumY>maximumY)throw Error('Invalid support query');
  let best=null;
  for(const f of faces){if(f.normal[1]<minUp)continue;const weights=barycentric(f,x,z);if(!weights||weights.some(v=>v < -EPS))continue;
   const y=weights.reduce((s,v,i)=>s+v*f.vertices[i][1],0);if(y<minimumY-EPS||y>maximumY+EPS)continue;
   if(!best||y>best.position[1]+EPS)best={surfaceId:f.id,anchorId:f.anchorId,position:[x,y,z],normal:f.normal.slice()};
  }return best;
 }
 // Exact projected edge events let consumers inspect narrow unsupported gaps;
 // they need not assume that a regular grid or frame samples covers a face.
 function breaks(from,to){if(!finite3(from)||!finite3(to))throw Error('Invalid support segment');const times=[0,1];
  for(const f of faces){const a=barycentric(f,from[0],from[2]),b=barycentric(f,to[0],to[2]);if(!a||!b)continue;let lo=0,hi=1;
   for(let i=0;i<3;i++){const d=b[i]-a[i];if(Math.abs(d)<EPS){if(a[i]<-EPS){lo=2;break;}}else{const t=-a[i]/d;if(d>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);}}
   if(lo<=hi&&lo<=1&&hi>=0)times.push(Math.max(0,lo),Math.min(1,hi));
  }return [...new Set(times)].sort((a,b)=>a-b);
 }
 return {at,breaks,faceCount:faces.length};
}
export function supportFrame(contact,yaw,pitch=0){
 if(!contact||!finite3(contact.position)||!finite3(contact.normal)||![yaw,pitch].every(Number.isFinite))throw Error('Invalid attached view');
 const up=contact.normal,heading=[Math.sin(yaw),0,-Math.cos(yaw)],projected=sub(heading,up.map(v=>v*dot(heading,up))),length=Math.hypot(...projected);
 if(length<1e-9)throw Error('Heading is normal to surface');const forward=projected.map((v,i)=>v/length*Math.cos(pitch)+up[i]*Math.sin(pitch));
 return {up:up.slice(),forward};
}
