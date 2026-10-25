/** Finite source TIN support shared by rendered roads and walking.
 * Geometry remains in the maintained place; this is a disposable spatial index. */
export const mapFrameKey=c=>c?.verticalPolicy==='source-relative'
  ? JSON.stringify([c.sourceCRS,c.projection,c.cityCode,c.year,c.origin,c.heightOrigin,c.url.split('/udx/')[0]]) : null;
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
const xz=p=>[p[0],p[2]];

export function triangleHeight(vertices,x,z,{inside=true}={}){
 const [a,b,c]=vertices.map(xz),p=[x,z],area=cross(a,b,c);
 if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(area)<1e-10)return null;
 const u=cross(b,c,p)/area,v=cross(c,a,p)/area,w=1-u-v;
 if(inside&&Math.min(u,v,w)<-1e-8)return null;
 return u*vertices[0][1]+v*vertices[1][1]+w*vertices[2][1];
}

export function assertMapFrames(anchors,observations){
 const contexts=new Map((observations??[]).map(o=>[o.id,o.mapContext]));
 const active=anchors.filter(a=>a.mapGeometry);
 const terrain=active.filter(a=>a.mapGeometry.role==='terrain');
 if(!terrain.length)return;
 if(terrain.reduce((sum,a)=>sum+a.mapGeometry.surfaces.length,0)>8192)
  throw new Error('Terrain exceeds the per-place triangle budget');
 const frames=new Set(terrain.flatMap(a=>a.evidenceIds.map(id=>mapFrameKey(contexts.get(id)))));
 if(frames.size!==1||frames.has(null))throw new Error('Terrain source-height frames differ');
 const frame=[...frames][0];
 if(active.some(a=>a.evidenceIds.some(id=>mapFrameKey(contexts.get(id))!==frame)))
  throw new Error('Map geometry and terrain source-height frames differ');
}

export function createMapTerrain(place){
 assertMapFrames(place.anchors??[],place.observations??[]);
 const contexts=new Map((place.observations??[]).map(o=>[o.id,o.mapContext]));
 const cells=new Map(),triangles=[],frames=new Set(),cellSize=16,seenFaces=new Set(),drawableFaces=new Map(),renderCells=new Map(),renderTriangles=[];
 const key=(x,z)=>x+':'+z;
 for(const anchor of place.anchors??[]){
  if(anchor.mapGeometry?.role!=='terrain')continue;
  const context=anchor.evidenceIds.map(id=>contexts.get(id)).find(Boolean),frame=mapFrameKey(context);
  if(!frame)throw new Error('Terrain has no source-relative frame');
  frames.add(frame);
  for(const [faceIndex,face] of anchor.mapGeometry.surfaces.entries()){
   const vertices=face.map(p=>p.map((v,i)=>v+anchor.position[i]));
   // Multiple retained observations may supply the same exact physical triangle.
   // Keep source records, but index and render that coplanar patch just once.
   const faceKey=vertices.map(p=>p.join(',')).sort().join('|');
   if(seenFaces.has(faceKey))continue;
   seenFaces.add(faceKey);
   const min=[0,2].map(i=>Math.min(...vertices.map(p=>p[i]))),max=[0,2].map(i=>Math.max(...vertices.map(p=>p[i])));
   // Disjoint derived fragments keep the admitted original faces intact.
   // Consult only earlier nearby source faces, not the whole place.
   const previous=new Set();
   for(let x=Math.floor(min[0]/cellSize);x<=Math.floor(max[0]/cellSize);x++)
    for(let z=Math.floor(min[1]/cellSize);z<=Math.floor(max[1]/cellSize);z++)
     for(const index of renderCells.get(key(x,z))??[])previous.add(index);
   // A source face with no positive-area coplanar AABB overlap needs no
   // subtraction, retriangulation or interpolation. Preserve its exact XYZ
   // vertices; merely sharing a boundary with another TIN face is not overlap.
   const overlaps=[];
   for(const i of previous){
    const other=renderTriangles[i];
    if(other.max[0]<=min[0]||other.min[0]>=max[0]||other.max[1]<=min[1]||other.min[1]>=max[1])continue;
    // Compare only previously *drawable* fragments, never an earlier source
    // that another source already hid under the same 2 mm envelope.
    // Otherwise a 0/1.9/3.8 mm stack hides the third, incompatible layer.
    const compatible=heightCompatibleRegion(vertices,other);
    if(compatible)overlaps.push(compatible);
   }
   let drawable;
   if(!overlaps.length)drawable=[vertices];
   else{
    let fragments=[vertices.map(xz)];
    for(const other of overlaps){
     fragments=fragments.flatMap(polygon=>subtractCoplanarFace(polygon,other));
     if(!fragments.length)break;
    }
    drawable=fragments.flatMap(polygon=>{
     const faces=[];
     for(let k=1;k+1<polygon.length;k++){
      const tri=[polygon[0],polygon[k],polygon[k+1]];
      // Clipping can leave a sliver smaller than maintained map polygon
      // admission permits even when both original source faces are valid.
      if(!renderableXZTriangle(tri))continue;
      faces.push(tri.map(([x,z])=>[x,triangleHeight(vertices,x,z,{inside:false}),z]));
     }
     return faces;
    });
   }
   const triangle={vertices,min,max,anchorId:anchor.id};
   if(!drawableFaces.has(anchor.id))drawableFaces.set(anchor.id,new Map());
   drawableFaces.get(anchor.id).set(faceIndex,drawable);
   for(const face of drawable){
    const rmin=[0,2].map(i=>Math.min(...face.map(p=>p[i]))),rmax=[0,2].map(i=>Math.max(...face.map(p=>p[i])));
    const render={vertices:face,min:rmin,max:rmax,anchorId:anchor.id,sourceTriangle:triangle};
    const index=renderTriangles.push(render)-1;
    for(let x=Math.floor(rmin[0]/cellSize);x<=Math.floor(rmax[0]/cellSize);x++)
     for(let z=Math.floor(rmin[1]/cellSize);z<=Math.floor(rmax[1]/cellSize);z++){
      const k=key(x,z);if(!renderCells.has(k))renderCells.set(k,[]);renderCells.get(k).push(index);
     }
   }
   const index=triangles.push(triangle)-1;
   for(let x=Math.floor(min[0]/cellSize);x<=Math.floor(max[0]/cellSize);x++)
    for(let z=Math.floor(min[1]/cellSize);z<=Math.floor(max[1]/cellSize);z++){
     const k=key(x,z);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(index);
    }
  }
 }
 if(!triangles.length)return null;
 if(triangles.length>8192||frames.size!==1)throw new Error('Terrain frames or triangle budget differ');
 const frame=[...frames][0];
 for(const anchor of place.anchors??[]){
  if(!anchor.mapGeometry)continue;
  const context=anchor.evidenceIds.map(id=>contexts.get(id)).find(Boolean);
  if(mapFrameKey(context)!==frame)throw new Error('Map geometry and terrain source-height frames differ');
 }
 const candidates=(min,max)=>{
  const found=new Set();
  for(let x=Math.floor(min[0]/cellSize);x<=Math.floor(max[0]/cellSize);x++)
   for(let z=Math.floor(min[1]/cellSize);z<=Math.floor(max[1]/cellSize);z++)
    for(const i of cells.get(key(x,z))??[])found.add(i);
  return [...found].map(i=>triangles[i]).filter(t=>t.max[0]>=min[0]&&t.min[0]<=max[0]&&t.max[1]>=min[1]&&t.min[1]<=max[1]);
 };
 return {frame:[...frames][0],triangleCount:triangles.length,candidates,
  isDrawableSourceFace(anchorId,index){return Boolean(drawableFaces.get(anchorId)?.get(index)?.length);},
  sourceFaceTriangles(anchorId,index){return drawableFaces.get(anchorId)?.get(index)??[];},
  drapingCandidates(min,max){
   const found=new Set();
   for(let x=Math.floor(min[0]/cellSize);x<=Math.floor(max[0]/cellSize);x++)
    for(let z=Math.floor(min[1]/cellSize);z<=Math.floor(max[1]/cellSize);z++)
     for(const i of renderCells.get(key(x,z))??[])found.add(i);
   return [...found].map(i=>renderTriangles[i]).filter(t=>
    t.max[0]>=min[0]&&t.min[0]<=max[0]&&t.max[1]>=min[1]&&t.min[1]<=max[1]);
  },
  heightAt(x,z){
   if(!Number.isFinite(x)||!Number.isFinite(z))return null;
   let height=null,minHeight=Infinity,maxHeight=-Infinity;
   for(const i of cells.get(key(Math.floor(x/cellSize),Math.floor(z/cellSize)))??[]){
    const y=triangleHeight(triangles[i].vertices,x,z);
    if(y===null)continue;
    minHeight=Math.min(minHeight,y);maxHeight=Math.max(maxHeight,y);
    // Pairwise adjacent support readings are not a complete family check:
    // 0, 1.9 and 3.8 mm otherwise appear mutually compatible in sequence.
    if(maxHeight-minHeight>.002)return null;
    // Match the first visible supporting source, not the last duplicated one.
    if(height===null)height=y;
   }
   return height;
  }};
}

/** Split a convex polygon by a directed 2D edge. Boundary points belong to
 * both half-polygons but never contribute shared positive area. */
function partitionByEdge(polygon,a,b,sign){
 const inside=[],outside=[];
 for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],
   dp=sign*cross(a,b,p),dq=sign*cross(a,b,q);
  if(dp>=0)inside.push(p);
  if(dp<=0)outside.push(p);
  if((dp<0&&dq>0)||(dp>0&&dq<0)){
   const u=dp/(dp-dq),intersection=[p[0]+u*(q[0]-p[0]),p[1]+u*(q[1]-p[1])];
   inside.push(intersection);outside.push(intersection);
  }
 }
 return {inside,outside};
}
const polygonArea=polygon=>Math.abs(polygon.reduce((sum,p,i)=>{
 const q=polygon[(i+1)%polygon.length];
 return sum+p[0]*q[1]-p[1]*q[0];
},0))*.5;
// Never simplify original source records. Qualify only derived triangles
// against maintained boundary edge/area thresholds and face normal limits.
function renderableXZTriangle(tri){
 const xs=tri.map(p=>p[0]),zs=tri.map(p=>p[1]);
 const extent=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs));
 if(polygonArea(tri)<=Math.max(5e-9,1e-10*Math.max(1,extent*extent)))return false;
 return tri.every((p,i)=>{
  const q=tri[(i+1)%3];return Math.hypot(q[0]-p[0],q[1]-p[1])>=1e-7;
 });
}
/** Keep only the part of one 2D convex polygon outside an already drawn
 * triangle. The returned pieces have disjoint interiors. */
function subtractCoplanarFace(polygon,clip){
 let orientation=0;
 for(let i=0;i<clip.length&&!orientation;i++)
  orientation=Math.sign(cross(clip[i],clip[(i+1)%clip.length],clip[(i+2)%clip.length]));
 if(!orientation)return [polygon];
 let remaining=polygon;
 const visible=[];
 for(let edge=0;edge<clip.length&&remaining.length;edge++){
  const {inside,outside}=partitionByEdge(remaining,clip[edge],clip[(edge+1)%clip.length],orientation);
  if(outside.length>=3&&polygonArea(outside)>1e-9)visible.push(outside);
  remaining=inside;
 }
 return visible;
}
// A height difference between two finite TIN planes is affine. Clip their
// shared XZ polygon by both +/- 2 mm halfspaces so the drawable union retains
// only *locally* compatible overlap, even if a sloped pair diverges elsewhere.
function compactLoop(polygon){
 const clean=[];
 for(const p of polygon){
  const q=clean.at(-1);
  if(!q||Math.hypot(p[0]-q[0],p[1]-q[1])>1e-10)clean.push(p);
 }
 if(clean.length>1&&Math.hypot(clean[0][0]-clean.at(-1)[0],clean[0][1]-clean.at(-1)[1])<=1e-10)clean.pop();
 return clean;
}
function clipHeightAgreement(polygon,vertices,other,sign){
 if(polygon.length<3)return [];
 const difference=([x,z])=>{
  const a=triangleHeight(vertices,x,z,{inside:false});
  const b=triangleHeight(other,x,z,{inside:false});
  return sign*(a-b)-.002;
 };
 const result=[];
 for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=difference(p),dq=difference(q),pin=dp<=0,qin=dq<=0;
  if(!Number.isFinite(dp)||!Number.isFinite(dq))return [];
  if(pin)result.push(p);
  if(pin!==qin){
   const t=dp/(dp-dq);
   result.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);
  }
 }
 return compactLoop(result);
}
function heightCompatibleRegion(vertices,other){
 let shared=compactLoop(clipToTriangle(vertices.map(xz),other.vertices.map(xz)));
 for(const sign of [1,-1])shared=clipHeightAgreement(shared,vertices,other.vertices,sign);
 return shared.length>=3&&polygonArea(shared)>1e-9?shared:null;
}

function clipToTriangle(polygon,clip){
 const orientation=Math.sign(cross(...clip));
 if(!orientation)return [];
 for(let edge=0;edge<3&&polygon.length;edge++){
  const a=clip[edge],b=clip[(edge+1)%3],output=[];
  for(let i=0;i<polygon.length;i++){
   const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=cross(a,b,p)*orientation,dq=cross(a,b,q)*orientation;
   const pin=dp>=-1e-9,qin=dq>=-1e-9;
   if(pin)output.push(p);
   if(pin!==qin){const t=dp/(dp-dq);output.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
  }
  polygon=output;
 }
 return polygon;
}

/** A conflicting interior patch can evade samples at the original road vertices.
 * Height differences are affine, so all intersection vertices cover their extrema.
 * Withhold the whole affected output face, including disagreeing shared boundaries. */
function compatibleRoadFace(face,target,terrain){
 const min=[0,1].map(i=>Math.min(...face.map(p=>p[i]))),max=[0,1].map(i=>Math.max(...face.map(p=>p[i])));
 for(const other of terrain.candidates(min,max)){
  if(other===target||other===target.sourceTriangle)continue;
  for(const [x,z] of clipToTriangle(face.map(p=>[...p]),other.vertices.map(xz))){
   const y=triangleHeight(target.vertices,x,z,{inside:false}),q=triangleHeight(other.vertices,x,z,{inside:false});
   if(y===null||q===null||!Number.isFinite(y)||!Number.isFinite(q)||Math.abs(y-q)>.002)return false;
  }
 }
 return true;
}

/** Intersect a triangulated source road plan with each finite source TIN face.
 * Clipped vertices use that exact plane; gaps/contradictory overlaps stay unsupported. */
export function drapeTerrainTriangle(plan,terrain){
 const min=[0,1].map(i=>Math.min(...plan.map(p=>p[i]))),max=[0,1].map(i=>Math.max(...plan.map(p=>p[i])));
 const result=[];
 for(const target of (terrain.drapingCandidates?.(min,max)??terrain.candidates(min,max))){
  const polygon=clipToTriangle(plan.map(p=>[...p]),target.vertices.map(xz));
  for(let i=1;i+1<polygon.length;i++){
   const face=[polygon[0],polygon[i],polygon[i+1]];
   if(!renderableXZTriangle(face)||!compatibleRoadFace(face,target,terrain))continue;
   const vertices=face.map(([x,z])=>[x,triangleHeight(target.vertices,x,z,{inside:false}),z]);
   if(cross(...face)>0)vertices.reverse();
   result.push(vertices);
  }
 }
 return result;
}
