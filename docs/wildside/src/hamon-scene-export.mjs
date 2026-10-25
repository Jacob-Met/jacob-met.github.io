/** Export Wildside's interpreted place and simulated creatures for the HAMON receiver.
 * Serialization only: the three.js scene graph stays the source of truth for geometry,
 * collision, picking and creature poses. Static art is baked to world space once per rebuild and
 * grouped by anchor, role and colour; creature parts stay in their local space and are streamed
 * as world matrices every frame (`createDynamicStream`). Tree anchors become the Engine's
 * lobe-crown library trees, sized from the anchor and toned from its sampled palette.
 */
import * as THREE from '../vendor/three.module.js';

const FLOATS=8; // position3 normal3 uv2
const roleOfKind={ground:'ground',path:'path',wall:'stone',rock:'stone',bench:'wood',planter:'wood',plant:'plant',water:'water',building:'building',tree:'bark'};
const colorKey=c=>c.map(v=>Math.round(Math.min(4,Math.max(0,v))*24)).join(',');
const linearHex=hex=>{const c=new THREE.Color(hex);return [c.r,c.g,c.b];};

function anchorOf(object,root){let o=object;while(o&&o!==root){if(o.userData?.kind&&o.userData?.anchorId)return o.userData;o=o.parent;}return null;}
function visibleInTree(object){for(let o=object;o;o=o.parent)if(!o.visible)return false;return true;}
function isLeafLike(mesh,material){return material.side===THREE.DoubleSide&&!material.transparent;}

function roleFor(kind,mesh,material){
 if(material.transparent&&(material.isMeshBasicMaterial||material.opacity<.35))return null; // ripple rings, contact shadows, decals
 if(material.transparent)return 'water';
 if(kind==='water')return 'water';
 if(kind==='ground'||kind==='planter'||kind==='plant')return mesh.isInstancedMesh||isLeafLike(mesh,material)?'plant':(kind==='plant'?'plant':roleOfKind[kind]);
 if(kind==='tree')return isLeafLike(mesh,material)||mesh.isInstancedMesh?'foliage':'bark';
 if(kind==='building')return 'building';
 return roleOfKind[kind]??(isLeafLike(mesh,material)?'plant':'other');
}

/** Collects parts into shared float / index / texel streams. */
function createWriter(){
 const parts=[],floats=[],indices=[],textures=[],texels=[],textureIds=new Map();let vertexCount=0,texelBytes=0;
 function textureId(texture){
  if(!texture?.isDataTexture)return null;const img=texture.image;
  if(!img?.data||img.data.BYTES_PER_ELEMENT!==1||img.data.length!==img.width*img.height*4)return null;
  if(textureIds.has(texture))return textureIds.get(texture);
  const id=textures.length;textures.push({w:img.width,h:img.height,o:texelBytes});texels.push(img.data);texelBytes+=img.data.length;textureIds.set(texture,id);return id;
 }
 function add(part,positions,normals,uvs,tris){
  const v0=vertexCount,i0=indices.length;
  for(let i=0;i<positions.length/3;i++){floats.push(positions[i*3],positions[i*3+1],positions[i*3+2],normals[i*3],normals[i*3+1],normals[i*3+2],uvs[i*2],uvs[i*2+1]);}
  for(const t of tris)indices.push(t);
  vertexCount+=positions.length/3;
  parts.push({...part,v:[v0,positions.length/3],i:[i0,tris.length]});return parts.length-1;
 }
 function finish(extra){
  const t=new Uint8Array(texelBytes);let o=0;for(const d of texels){t.set(d,o);o+=d.length;}
  return {desc:{parts,textures,...extra},verts:new Float32Array(floats),indices:new Uint32Array(indices),texels:t};
 }
 return {add,textureId,finish};
}

/** Append one mesh's triangles (optionally one instance) transformed by `matrix` into `bucket`. */
function appendGeometry(bucket,mesh,matrix,range,material){
 const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,index=g.index;if(!p)return;
 const normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),mirrored=matrix.determinant()<0,v=new THREE.Vector3(),nn=new THREE.Vector3(),t=new THREE.Vector2();
 const map=material.map;if(map)map.updateMatrix();
 const doubled=material.side===THREE.DoubleSide;
 const remap=new Map();
 const vertex=(src,flip)=>{
  const key=flip?-1-src:src;if(remap.has(key))return remap.get(key);
  v.fromBufferAttribute(p,src).applyMatrix4(matrix);
  if(n)nn.fromBufferAttribute(n,src).applyMatrix3(normalMatrix).normalize();else nn.set(0,1,0);
  if(flip)nn.negate();
  if(uv){t.fromBufferAttribute(uv,src);if(map)t.applyMatrix3(map.matrix);}else t.set(0,0);
  const at=bucket.positions.length/3;bucket.positions.push(v.x,v.y,v.z);bucket.normals.push(nn.x,nn.y,nn.z);bucket.uvs.push(t.x,t.y);remap.set(key,at);return at;
 };
 for(let i=range.start;i<range.end;i+=3){
  const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
  if(mirrored)bucket.tris.push(vertex(a),vertex(c),vertex(b));else bucket.tris.push(vertex(a),vertex(b),vertex(c));
  if(doubled){if(mirrored)bucket.tris.push(vertex(a,true),vertex(b,true),vertex(c,true));else bucket.tris.push(vertex(a,true),vertex(c,true),vertex(b,true));}
 }
}

function materialRanges(mesh){
 const g=mesh.geometry,count=g.index?g.index.count:g.attributes.position.count,start=Math.max(0,g.drawRange.start),end=Math.min(count,start+(Number.isFinite(g.drawRange.count)?g.drawRange.count:count));
 if(!Array.isArray(mesh.material))return [{material:mesh.material,start,end}];
 return g.groups.map(gr=>({material:mesh.material[gr.materialIndex],start:Math.max(start,gr.start),end:Math.min(end,gr.start+gr.count)})).filter(r=>r.material&&r.end>r.start);
}

const treePalette=anchor=>(anchor?.appearance?.pixels?.palette??[]).filter(p=>/^#[0-9a-f]{6}$/i.test(p.color)).map(p=>linearHex(p.color));

/** Static world: `art` from buildWorldArt, the `place` it was built from. */
export function exportStaticWorld(art,place,writer=createWriter()){
 art.group.updateMatrixWorld(true);
 const trees=[],treeAnchors=new Set();
 for(const a of place.anchors??[])if(a.kind==='tree'||['canopy'].includes(a.appearance?.interpretation?.form)){
  const [x,y,z]=a.position,[w,h,d]=a.size;treeAnchors.add(a.id);
  trees.push({pos:[x,y,z],radius:Math.max(.5,Math.max(w,d)*.55),height:Math.max(1,h*.55),palette:treePalette(a),seed:[...a.id].reduce((s,c)=>(s*31+c.charCodeAt(0))>>>0,7)});
 }
 // Plants become the Engine's flora: flower beds (flora_flowers) and library shrubs; the
 // courtyard floor gets a painted meadow with sparse meadow drifts instead of instanced leaves.
 const beds=[],shrubs=[],clear=[],engineFlora=new Set(),seedOf=id=>[...id].reduce((s,c)=>(s*31+c.charCodeAt(0))>>>0,7);
 for(const a of place.anchors??[]){
  const [x,y,z]=a.position,[w,h,d]=a.size,form=a.appearance?.interpretation?.form;
  if(['path','water','wall','bench','rock','planter','building'].includes(a.kind))clear.push([x-w/2-.08,z-d/2-.08,x+w/2+.08,z+d/2+.08]);
  if(a.kind==='tree')clear.push([x-.35,z-.35,x+.35,z+.35]);
  if(a.kind==='ground'&&w*d<=900)beds.push({center:[x,z],size:[w,d],y:y+h,mix:'meadow',density:.3,seed:seedOf(a.id),avoid:true});
  if(a.kind==='plant'&&!treeAnchors.has(a.id)){
   engineFlora.add(a.id);
   if(form==='shrub'||form==='broadleaf')shrubs.push({pos:[x,y,z],radius:Math.max(.15,Math.max(w,d)/2),height:Math.max(.2,h),seed:seedOf(a.id)});
   else beds.push({center:[x,z],size:[Math.max(.3,w),Math.max(.3,d)],y,mix:'bed',density:1.4,seed:seedOf(a.id)});
  }
 }
 const buckets=new Map();
 art.group.traverse(mesh=>{
  if(!mesh.isMesh||!visibleInTree(mesh))return;
  const anchor=anchorOf(mesh,art.group),kind=anchor?.kind??'ground',anchorId=anchor?.anchorId??mesh.name;
  if(treeAnchors.has(anchorId))return; // replaced by the Engine's lobe-crown tree
  for(const range of materialRanges(mesh)){
   const material=range.material;if(!material.visible)continue;
   const role=roleFor(kind,mesh,material);if(!role)continue;
   if(engineFlora.has(anchorId)||(kind==='ground'&&role==='plant'&&beds.length))continue;
   const tex=writer.textureId(material.map);
   const count=mesh.isInstancedMesh?mesh.count:1,local=new THREE.Matrix4(),tint=new THREE.Color();
   for(let k=0;k<count;k++){
    const matrix=mesh.matrixWorld.clone();let color=material.color?material.color.clone():new THREE.Color(1,1,1);
    if(mesh.isInstancedMesh){mesh.getMatrixAt(k,local);if(Math.abs(local.determinant())<1e-12)continue;matrix.multiply(local);if(mesh.instanceColor){mesh.getColorAt(k,tint);color.multiply(tint);}}
    const bucketFor=rgb=>{const key=[anchorId,role,tex,colorKey(rgb),material.opacity<1?material.opacity:1].join('|');
     if(!buckets.has(key))buckets.set(key,{role,tex,color:rgb,opacity:material.transparent?material.opacity:1,shadow:mesh.castShadow!==false&&role!=='water',positions:[],normals:[],uvs:[],tris:[]});return buckets.get(key);};
    const vc=material.vertexColors&&mesh.geometry.attributes.color,index=mesh.geometry.index;
    if(vc){
     // per-vertex colours (public map buildings, terrain): one bucket per triangle colour
     for(let i=range.start;i<range.end;i+=3){
      const rgb=[0,0,0];for(let k2=0;k2<3;k2++){const v=index?index.getX(i+k2):i+k2;rgb[0]+=vc.getX(v)/3;rgb[1]+=vc.getY(v)/3;rgb[2]+=vc.getZ(v)/3;}
      appendGeometry(bucketFor([rgb[0]*color.r,rgb[1]*color.g,rgb[2]*color.b]),mesh,matrix,{start:i,end:i+3},material);
     }
    }else appendGeometry(bucketFor([color.r,color.g,color.b]),mesh,matrix,range,material);
   }
  }
 });
 for(const b of buckets.values())if(b.tris.length)writer.add({role:b.role,color:b.color,opacity:b.opacity,tex:b.tex,shadow:b.shadow},b.positions,b.normals,b.uvs,b.tris);
 return {writer,trees,beds,shrubs,clear};
}

/** Creature parts: every visible-or-not mesh (and instance) under `roots`, streamed per frame. */
export function exportDynamicParts(roots,writer){
 const entries=[];
 for(const {group,role:defaultRole} of roots){
  if(!group)continue;group.updateMatrixWorld(true);
  group.traverse(mesh=>{
   if(!mesh.isMesh)return;
   for(const range of materialRanges(mesh)){
    const material=range.material;if(material.transparent&&material.opacity<.35)continue;
    const role=material.transparent?'silk':defaultRole;
    const count=mesh.isInstancedMesh?mesh.count:1;
    for(let k=0;k<count;k++){
     const b={positions:[],normals:[],uvs:[],tris:[]};appendGeometry(b,mesh,new THREE.Matrix4(),range,material);if(!b.tris.length)continue;
     const c=material.color??new THREE.Color(1,1,1);let rgb=[c.r,c.g,c.b];
     if(mesh.isInstancedMesh&&mesh.instanceColor){const t=new THREE.Color();mesh.getColorAt(k,t);rgb=[rgb[0]*t.r,rgb[1]*t.g,rgb[2]*t.b];}
     writer.add({role,color:rgb,opacity:1,tex:writer.textureId(material.map),dynamic:true,shadow:mesh.castShadow!==false},b.positions,b.normals,b.uvs,b.tris);
     entries.push({root:group,mesh,instance:mesh.isInstancedMesh?k:-1});
    }
   }
  });
 }
 return entries;
}

/** Matrices + visibility for the dynamic entries, reusing one buffer pair. */
export function createDynamicStream(entries){
 const matrices=new Float32Array(entries.length*16),visible=new Uint8Array(entries.length),m=new THREE.Matrix4(),local=new THREE.Matrix4();
 const roots=[...new Set(entries.map(({root,mesh})=>root??mesh))];
 return {count:entries.length,capture(){
  // The Engine path does not call WebGLRenderer.render(), which normally
  // refreshes these matrices. Update each dynamic subtree and its parents
  // once, without traversing the rest of the static scene.
  for(const root of roots)root.updateWorldMatrix(true,true);
  entries.forEach(({mesh,instance},i)=>{
   const shown=visibleInTree(mesh)&&(instance<0||instance<mesh.count);visible[i]=shown?1:0;
   if(!shown)return;
   m.copy(mesh.matrixWorld);if(instance>=0){mesh.getMatrixAt(instance,local);m.multiply(local);if(Math.abs(local.determinant())<1e-12)visible[i]=0;}
   matrices.set(m.elements,i*16);
  });
  return {matrices,visible};
 }};
}

/** Everything the receiver needs for one rebuild. `places` / `inhabitants` are extension
 * descriptors ({kind, params}) from src/hamon-extensions.mjs. */
export function exportPlaceForHamon(art,place,dynamicRoots,{places=[],inhabitants=[]}={}){
 const {writer,trees,beds,shrubs,clear}=exportStaticWorld(art,place);
 const entries=exportDynamicParts(dynamicRoots,writer);
 const packet=writer.finish({trees,beds,shrubs,clear,places,inhabitants,bounds:[art.bounds.min,art.bounds.max]});
 return {...packet,stream:createDynamicStream(entries)};
}
