import {createMapTerrain} from './map-terrain.mjs';
import {addMapArt} from './map-art.mjs';
import {addContextArt} from './context-art.mjs';
import {createLeafGeometry,createFoliageDetail} from './foliage-detail.mjs';
import {createPlumageGeometry} from './bird-plumage.mjs';
import {worldBoundary,pointInPolygon,validatePolygon} from './boundary.mjs';
import * as THREE from '../vendor/three.module.js';
import {BIRD_BODY,MIN_BIRD_PERCH_RADIUS} from './habitat.mjs';
const V=p=>new THREE.Vector3(...p);
function rng(key){let s=2166136261;for(const c of key)s=Math.imul(s^c.charCodeAt(0),16777619);return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function disposeGroup(group){const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});for(const g of geometries)g.dispose();const textures=new Set();for(const m of materials){for(const key of ['map','bumpMap','roughnessMap','normalMap'])if(m[key])textures.add(m[key]);m.dispose();}for(const texture of textures)texture.dispose();group.clear();}
const material=(color,roughness=.9)=>new THREE.MeshStandardMaterial({color,roughness});
function mesh(geometry,mat,parent,position=[0,0,0],scale=[1,1,1]){const m=new THREE.Mesh(geometry,mat);m.position.fromArray(position);m.scale.fromArray(scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function rod(a,b,radius,mat,parent,endRadius=radius){const d=V(b).sub(V(a));const m=mesh(new THREE.CylinderGeometry(endRadius,radius,d.length(),9,1),mat,parent,V(a).add(V(b)).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
function curveTube(points,r,mat,parent){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(V)),14,r,8,false),mat,parent);}
function surfaceTexture(kind){
 const size=128,data=new Uint8Array(size*size*4),random=rng(`surface:${kind}`);
 const palettes={ground:[[103,111,77],[145,142,107]],bark:[[79,70,53],[134,111,77]],stone:[[130,129,109],[185,177,148]],clay:[[153,105,76],[199,151,108]],soil:[[72,66,49],[113,100,71]]};
 const [a,b]=palettes[kind];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,coarse=.5+.18*Math.sin(u*18+Math.sin(v*9)*2)+.14*Math.cos(v*23+Math.sin(u*13));
  let t=coarse+(random()-.5)*.25;
  if(kind==='bark'){const groove=Math.pow(Math.abs(Math.sin(u*45+Math.sin(v*7)*1.3+Math.sin(v*31)*.18)),9);t=.22+coarse*.35+groove*.45+(random()-.5)*.15;}
  if(kind==='stone')t=coarse*.6+random()*.4;
  if(kind==='soil')t=coarse*.7+random()*.3;
  if(kind==='clay')t=.45+coarse*.25+Math.sin(v*160)*.04+(random()-.5)*.16;
  t=Math.max(0,Math.min(1,t));const at=(y*size+x)*4;for(let c=0;c<3;c++)data[at+c]=a[c]+(b[c]-a[c])*t;data[at+3]=255;
 }
 const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(kind==='bark'?2:4,kind==='bark'?3:4);texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
function texturedMaterial(kind,bump=.01){const map=surfaceTexture(kind);return new THREE.MeshStandardMaterial({map,color:'#ffffff',roughness:.95,bumpMap:map,bumpScale:bump});}
function leafMaterial(color){const m=material(color);m.side=THREE.DoubleSide;return m;}
function instance(geometry,mat,count,parent){const m=new THREE.InstancedMesh(geometry,mat,count);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const dummy=new THREE.Object3D();
function put(m,index,p,rotation,scale,color){dummy.position.fromArray(p);dummy.rotation.set(rotation[0],rotation[1],rotation[2],rotation[3]??'XYZ');dummy.scale.fromArray(scale);dummy.updateMatrix();m.setMatrixAt(index,dummy.matrix);if(color)m.setColorAt(index,new THREE.Color(color));}

function broadLeafGeometry(){
 const g=new THREE.BufferGeometry(),vertices=[],indices=[];const rows=14,cols=5;
 for(let row=0;row<=rows;row++){const t=row/rows,width=Math.pow(Math.sin(Math.PI*t),.62)*.5;for(let col=0;col<cols;col++){const across=(col/(cols-1)*2-1);vertices.push(across*width,t,Math.sin(Math.PI*t)*(.10-.035*across*across));}}
 for(let row=0;row<rows;row++)for(let col=0;col<cols-1;col++){const i=row*cols+col;indices.push(i,i+1,i+cols,i+1,i+cols+1,i+cols);}g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function appearancePalette(appearance,random,fallback){
 const palette=appearance?.pixels?.palette?.filter(p=>/^#[0-9a-f]{6}$/i.test(p.color)&&Number.isFinite(p.weight)&&p.weight>0)??[];
 const total=palette.reduce((sum,p)=>sum+p.weight,0);if(!total)return new THREE.Color(fallback);
 let target=random()*total;for(const p of palette){target-=p.weight;if(target<=0)return new THREE.Color(p.color);}return new THREE.Color(palette.at(-1).color);
}
function plantForm(a,local,random,leaf){
 const form=a.appearance?.interpretation?.form;if(!['shrub','broadleaf','canopy'].includes(form))return false;
 const [w,h,d]=a.size,colorRandom=rng(`${a.id}:source-colors`),stem=material('#65704b'),foliage=leafMaterial('#ffffff');
 local.userData.appearance={form,paletteBasis:a.appearance?.pixels?.palette?.length?'sampled-source-region':'artistic-default',geometryBasis:'human-selected-procedural-form'};
 if(form==='broadleaf'){
  const count=18,leaves=instance(broadLeafGeometry(),foliage,count,local),ribs=instance(new THREE.CylinderGeometry(1,1,1,5),material('#9da877'),count*11,local);
  for(let i=0;i<count;i++){
   const angle=i*2.399,length=Math.min(h*(.72+random()*.4),Math.min(w,d)*1.05),width=Math.min(w,d)*(.28+random()*.17),tilt=i<7?.30+random()*.3:.85+random()*.42;
   const p=[Math.sin(angle)*w*.045,Math.max(.015,h-length*Math.cos(tilt))*.35,Math.cos(angle)*d*.045],rotation=[tilt,angle,0,'YXZ'];
   put(leaves,i,p,rotation,[width,length,length],appearancePalette(a.appearance,colorRandom,'#608148'));
   const transform=(x,y,z)=>{const point=new THREE.Vector3(x*width,y*length,z*length);return point.applyEuler(new THREE.Euler(...rotation)).add(V(p));};
   const base=transform(0,0,0),end=transform(0,.94,.019);
   const segments=[];for(let k=0;k<5;k++){const t=k*.19,t2=(k+1)*.19;segments.push([transform(0,t,.10*Math.sin(Math.PI*t)+.003),transform(0,t2,.10*Math.sin(Math.PI*t2)+.003)]);}for(let k=1;k<=3;k++)for(const side of [-1,1]){const t=.15+k*.17;segments.push([transform(0,t,.10*Math.sin(Math.PI*t)+.003),transform(side*Math.sin(Math.PI*(t+.12))*.43,t+.12,.085*Math.sin(Math.PI*(t+.12))+.003)]);}
   for(let k=0;k<segments.length;k++){const [a,b]=segments[k],delta=b.clone().sub(a);dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());dummy.scale.set(k<5?.0018:.0009,delta.length(),k<5?.0018:.0009);dummy.updateMatrix();ribs.setMatrixAt(i*11+k,dummy.matrix);}
   rod([0,0,0],base.toArray(),.006,stem,local);
  }
 }else{
  const count=420,leaves=instance(leaf,foliage,count,local);
  for(let i=0;i<9;i++){const angle=i*2.399;curveTube([[0,0,0],[Math.sin(angle)*w*.17,h*.35,Math.cos(angle)*d*.17],[Math.sin(angle)*w*.34,h*(.60+random()*.18),Math.cos(angle)*d*.34]],Math.min(w,d)*.009,stem,local);}
  for(let i=0;i<count;i++){
   const angle=random()*Math.PI*2,r=Math.sqrt(random()),vertical=Math.sqrt(Math.max(0,1-r*r));
   const length=Math.min(.26,h*.25)*(.65+random()*.65),p=[Math.cos(angle)*w*.43*r,h*(.24+vertical*.55)+(random()-.5)*h*.12,Math.sin(angle)*d*.43*r];
   put(leaves,i,p,[-.5+random(),random()*6.28,random()*6.28],[length*.63,length,length],appearancePalette(a.appearance,colorRandom,'#65844c'));
  }
 }
 return true;
}
function convexGroundHull(points){
 const sorted=points.map(p=>p.ground).filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)).map(p=>[...p]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const unique=sorted.filter((p,i)=>!i||p[0]!==sorted[i-1][0]||p[1]!==sorted[i-1][1]);if(unique.length<3)return [];
 const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const lower=[],upper=[];
 for(const p of unique){while(lower.length>=2&&turn(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}for(const p of [...unique].reverse()){while(upper.length>=2&&turn(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
function inGroundPolygon(x,z,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
/** Original anchor-bound procedural scenery. Artistic detail is simulated completion. */
export function buildWorldArt(place,{rain=false}={}){
 const group=new THREE.Group();group.name='interpreted-place-and-artistic-detail';const perches=[],obstacles=[],waters=[],waterSurfaces=[],leafSways=[];
 const box=new THREE.Box3();const grounds=[],surfaces=[],polygonWaters=[];
 const terrain=createMapTerrain(place),mapContexts=new Map((place.observations??[]).map(o=>[o.id,o.mapContext]));
 const bark=texturedMaterial('bark',.018),darkBark=material('#4d5140'),soil=texturedMaterial('soil',.008),stone=texturedMaterial('stone',.012),rim=texturedMaterial('clay',.006);
 const cube=new THREE.BoxGeometry(1,1,1),leaf=createLeafGeometry();
 const addObstacle=(a,half,center)=>obstacles.push({id:a.id,min:center.map((v,i)=>v-half[i]),max:center.map((v,i)=>v+half[i])});
 // A calibrated plane is supported by its surviving control polygon, not invented
 // as an endless lawn and not inserted as a new persisted recognition anchor.
 if(!place.anchors.some(a=>a.kind==='ground'))for(const observation of place.observations??[]){
  const points=convexGroundHull(observation.controlPoints??[]);if(points.length<3)continue;
  const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z))),mat=texturedMaterial('ground',.007);mat.polygonOffset=true;mat.polygonOffsetFactor=1;mat.polygonOffsetUnits=1;
  const patch=mesh(new THREE.ShapeGeometry(shape),mat,group);patch.name=`calibration-support:${observation.id}`;patch.rotation.x=-Math.PI/2;patch.userData={kind:'calibrated-ground-support',observationId:observation.id,sourceIds:[observation.source?.id],provenance:'interpreted-calibration-surface'};patch.castShadow=false;
  grounds.push({polygon:points,y:0});for(const [x,z] of points)box.expandByPoint(V([x,0,z]));
 }

 for(const a of place.anchors){const [x,y,z]=a.position,[w,h,d]=a.size,random=rng(a.id),colorRandom=rng(`${a.id}:source-colors`);const local=new THREE.Group();local.position.set(x,y,z);local.name=a.id;local.userData={anchorId:a.id,kind:a.kind,provenance:'interpreted-geometry-with-artistic-detail'};group.add(local);
  if(addMapArt(a,local,{box,grounds,obstacles,perches,surfaces,terrain,mapContext:a.evidenceIds?.map(id=>mapContexts.get(id)).find(Boolean)}))continue;
  const boundary=worldBoundary(a);
  if(boundary&&['ground','path','planter','water'].includes(a.kind)){
   const points=validatePolygon(a.boundary.localPoints),worldPoints=boundary;if(!worldPoints.every(p=>p.every(Number.isFinite)))throw new TypeError('Translated boundary coordinates must be finite');
   for(const [px,pz] of worldPoints){box.expandByPoint(V([px,y,pz]));box.expandByPoint(V([px,y+h,pz]));}
   const shape=new THREE.Shape(points.map(([px,pz])=>new THREE.Vector2(px,-pz)));
   const isWater=a.kind==='water',top=y+h;
   const surfaceMaterial=isWater?new THREE.MeshStandardMaterial({color:'#709c98',transparent:true,opacity:.70,roughness:.2,metalness:.22,depthWrite:false,side:THREE.DoubleSide}):a.kind==='ground'?texturedMaterial('ground',.009):a.kind==='path'?stone:soil;
   const geometry=isWater?new THREE.ShapeGeometry(shape):new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,steps:1,curveSegments:1});
   const surface=mesh(geometry,isWater?surfaceMaterial:[surfaceMaterial,a.kind==='planter'?rim:surfaceMaterial],local,[0,isWater?h:0,0]);surface.rotation.x=-Math.PI/2;surface.name=`${a.id}:polygon:${a.kind}`;surface.userData={anchorId:a.id,kind:a.kind,surfaceId:`${a.id}:polygon`,boundaryMethod:a.boundary.method};surface.castShadow=!isWater;
   if(isWater){
    waterSurfaces.push({id:`${a.id}:water`,anchorId:a.id,sourceIds:[...(a.sourceIds??[])],y:top,shape:'polygon',points:worldPoints.map(p=>[...p])});
    const clock={value:0};surfaceMaterial.onBeforeCompile=shader=>{shader.uniforms.polygonWaterTime=clock;shader.vertexShader='varying vec2 polygonWaterPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n polygonWaterPosition=position.xy;');shader.fragmentShader='uniform float polygonWaterTime; varying vec2 polygonWaterPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n float wave=sin(length(polygonWaterPosition-vec2(.27,.11))*24.0-polygonWaterTime*1.7)+sin(length(polygonWaterPosition+vec2(.43,.31))*18.0-polygonWaterTime*1.2); diffuseColor.rgb*=1.0+wave*.025;');};surfaceMaterial.customProgramCacheKey=()=> 'wildside-polygon-water-v1';polygonWaters.push(clock);
   }
   if(a.kind==='ground'||a.kind==='path'){grounds.push({polygon:worldPoints,y:top,annotated:true});surfaces.push({id:`${a.id}:polygon`,anchorId:a.id,kind:a.kind,polygonXZ:worldPoints,y:top,meshName:surface.name});}
   if(a.kind==='planter'||isWater){const xs=worldPoints.map(p=>p[0]),zs=worldPoints.map(p=>p[1]);obstacles.push({id:isWater?`${a.id}:insect-water-boundary`:a.id,min:[Math.min(...xs),isWater?y-.02:y,Math.min(...zs)],max:[Math.max(...xs),top+(isWater?.025:0),Math.max(...zs)],polygonXZ:worldPoints,...(isWater?{modes:['insect']}:{})});}
   if(a.kind==='planter'){
    let edge=0;for(let i=1;i<points.length;i++)if(V([points[i][0]-points[(i+1)%points.length][0],0,points[i][1]-points[(i+1)%points.length][1]]).length()>V([points[edge][0]-points[(edge+1)%points.length][0],0,points[edge][1]-points[(edge+1)%points.length][1]]).length())edge=i;
    const p=points[edge],q=points[(edge+1)%points.length],edgeLength=Math.hypot(q[0]-p[0],q[1]-p[1]),tangent=V([q[0]-p[0],0,q[1]-p[1]]).normalize().toArray();if(edgeLength>=.08)perches.push({id:`${a.id}:rim`,position:[x+(p[0]+q[0])/2,top,z+(p[1]+q[1])/2],radius:.035,tangent,shelter:.05});
   }
   continue;
  }
  box.expandByPoint(V([x-w/2,y,z-d/2]));box.expandByPoint(V([x+w/2,y+h,z+d/2]));
  if(a.kind==='ground'&&addContextArt(a,local,random)){grounds.push({x,z,w,d,y:y+h});continue;}
  if(a.kind==='plant'&&addContextArt(a,local,random))continue;
  if(a.kind==='ground'){
   mesh(cube,texturedMaterial('ground',.009),local,[0,h/2,0],[w,h,d]);grounds.push({x,z,w,d,y:y+h});
   const grass=instance(leaf,leafMaterial('#829365'),250,local);
   for(let i=0;i<250;i++){let px,pz;for(let attempt=0;attempt<40;attempt++){px=(random()-.5)*w;pz=(random()-.5)*d;if(!place.anchors.some(other=>['path','water','planter','wall','bench','rock'].includes(other.kind)&&Math.abs(x+px-other.position[0])<other.size[0]/2+.04&&Math.abs(z+pz-other.position[2])<other.size[2]/2+.04))break;}put(grass,i,[px,h+.001,pz],[random()*.4,random()*6.28,random()*.3-.15],[.035+random()*.035,.05+random()*.1,.08],new THREE.Color().setHSL(.20+random()*.035,.20+random()*.15,.30+random()*.12));}
  }else if(a.kind==='tree'){
   const trunkRadius=Math.min(w,d)*.068,lean=w*.10;
   curveTube([[0,0,0],[-lean*.15,h*.22,0],[lean*.3,h*.47,.05],[lean,h*.72,0]],trunkRadius,bark,local);
   for(let j=0;j<7;j++){const angle=j*2.399;curveTube([[0,.12,0],[Math.cos(angle)*trunkRadius*1.7,.05,Math.sin(angle)*trunkRadius*1.7],[Math.cos(angle)*trunkRadius*3,0,Math.sin(angle)*trunkRadius*3]],trunkRadius*.23,darkBark,local);}
   addObstacle(a,[trunkRadius*1.35,h*.35,trunkRadius*1.35],[x+lean*.25,y+h*.35,z]);
   const branchTips=[];
   for(let j=0;j<9;j++){
    const angle=j*2.399+.4,level=h*(.42+.047*j),start=[lean*level/h,level,0],tip=[Math.cos(angle)*w*(.34+random()*.12),level+h*.15,Math.sin(angle)*d*(.34+random()*.12)],mid=[(start[0]+tip[0])*.55,level+h*.06,tip[2]*.5];
    const curve=new THREE.CatmullRomCurve3([V(start),V(mid),V(tip)]),radius=trunkRadius*(.42-j*.023);
    mesh(new THREE.TubeGeometry(curve,12,radius,7,false),bark,local);branchTips.push(tip);
    if(j%3===0){const support=curve.getPoint(.68);perches.push({id:`${a.id}:branch:${j}`,position:[x+support.x,y+support.y+radius,z+support.z],radius:Math.max(.035,radius),tangent:curve.getTangent(.68).toArray(),shelter:.65+j*.025});}
    for(let k=0;k<2;k++){const p=curve.getPoint(.64+k*.14);curveTube([p.toArray(),[p.x+.1*Math.cos(angle+1),p.y+h*.07,p.z+.1*Math.sin(angle+1)],[p.x+.22*Math.cos(angle+1),p.y+h*.12,p.z+.22*Math.sin(angle+1)]],radius*.38,bark,local);}
   }
   const canopy=new THREE.Group();local.add(canopy);const leaves=instance(leaf,leafMaterial(a.appearance?.pixels?.palette?.length?'#ffffff':'#768f54'),1600,canopy);const veins=instance(new THREE.CylinderGeometry(.001,.001,1,3),material('#a8b879'),1600,canopy);
   for(let i=0;i<1600;i++){const tip=branchTips[i%branchTips.length],theta=random()*Math.PI*2,r=Math.sqrt(random());const p=[tip[0]+Math.cos(theta)*w*.17*r,tip[1]+(random()-.35)*h*.17,tip[2]+Math.sin(theta)*d*.17*r],rot=[-.8+random()*1.6,random()*6.28,random()*6.28],s=.20+random()*.19;
    const clear=perches.filter(perch=>perch.id.startsWith(`${a.id}:`)).every(perch=>Math.hypot(p[0]+x-perch.position[0],p[1]+y-perch.position[1]-.16,p[2]+z-perch.position[2])>.48);
    const defaultColor=new THREE.Color().setHSL(.20+random()*.06,.25+random()*.22,.24+random()*.24);
    put(leaves,i,p,rot,clear?[s*.64,s,s]:[0,0,0],a.appearance?appearancePalette(a.appearance,colorRandom,'#768f54'):defaultColor);
    dummy.position.fromArray(p);dummy.rotation.set(...rot);const center=new THREE.Vector3(0,s*.5,.008).applyEuler(dummy.rotation).add(dummy.position);put(veins,i,center.toArray(),rot,clear?[1,s*.86,1]:[0,0,0]);
   }leafSways.push({group:canopy,phase:random()*6.28});
  }else if(a.kind==='planter'){
   mesh(cube,rim,local,[0,h/2,0],[w,h,d]);mesh(cube,soil,local,[0,h+.002,0],[w*.88,.015,d*.8]);
   for(const side of [-1,1]){mesh(cube,material('#c49b72'),local,[0,h,side*d*.46],[w*1.035,.09,d*.12]);mesh(cube,rim,local,[side*w*.46,h,0],[w*.09,.09,d]);}
   const marks=instance(cube,material('#976b51'),20,local);for(let i=0;i<20;i++)put(marks,i,[(random()-.5)*w,h*(.15+random()*.65),d*.501],[0,0,.05],[.02+random()*.09,.006, .002]);
   perches.push({id:`${a.id}:rim`,position:[x+w*.35,y+h+.045,z+d*.46],radius:.06,shelter:.05});addObstacle(a,[w/2,h/2,d/2],[x,y+h/2,z]);
  }else if(a.kind==='rock'){
   // Smooth nonuniform river stone, with a flattened supported top for contact.
   const geo=new THREE.SphereGeometry(1,24,16),p=geo.attributes.position;for(let i=0;i<p.count;i++){const px=p.getX(i),py=p.getY(i),pz=p.getZ(i);p.setXYZ(i,px*(1+.06*Math.sin(pz*7)),Math.min(py,.86),pz*(1+.04*Math.cos(px*8)));}geo.computeVertexNormals();
   mesh(geo,stone,local,[0,h*.5,0],[w*.5,h*.5/.93,d*.5]);
   const top=h*.5+h*.5/.93*.86,radius=Math.min(w,d)*.13;
   // Retain every rock and collision envelope, but offer only usable bird support.
   if(radius>=MIN_BIRD_PERCH_RADIUS)perches.push({id:`${a.id}:top`,position:[x,y+top,z],radius,shelter:0});
   addObstacle(a,[w*.44,top*.5,d*.44],[x,y+top*.5,z]);
  }else if(a.kind==='water'){
   waterSurfaces.push({id:`${a.id}:water`,anchorId:a.id,sourceIds:[...(a.sourceIds??[])],y:y+h,shape:'ellipse',center:[x,z],radii:[w/2,d/2]});
   obstacles.push({id:`${a.id}:insect-water-boundary`,min:[x-w*.46,y-.02,z-d*.46],max:[x+w*.46,y+h+.025,z+d*.46],modes:['insect']});
   const water=mesh(new THREE.CircleGeometry(1,64),new THREE.MeshStandardMaterial({color:'#709c98',transparent:true,opacity:.70,roughness:.2,metalness:.22,depthWrite:false,side:THREE.DoubleSide}),local,[0,h,0],[w/2,d/2,1]);water.rotation.x=-Math.PI/2;water.castShadow=false;
   const rings=[];for(let i=0;i<5;i++){const ring=mesh(new THREE.RingGeometry(.97,1,64),new THREE.MeshBasicMaterial({color:'#c4dbbb',transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false}),local,[0,h+.002+i*.0002,0]);ring.rotation.x=-Math.PI/2;ring.castShadow=false;rings.push(ring);}waters.push({rings,w,d,phase:random()});
  }else if(a.kind==='wall'){
   mesh(cube,material('#a7a18a'),local,[0,h/2,0],[w,h,d]);addObstacle(a,[w/2,h/2,d/2],[x,y+h/2,z]);
   const blocks=instance(cube,material('#b5ae96'),Math.ceil(w/.62)*Math.ceil(h/.28),local);let k=0;for(let row=0;row<Math.ceil(h/.28);row++)for(let col=0;col<Math.ceil(w/.62);col++){put(blocks,k++,[-w/2+.3+col*.62+(row%2)*.035,Math.min(h-.1,.14+row*.28),d*.505],[0,0,0],[.59,.25,.016],new THREE.Color().setHSL(.12,.12,.55+random()*.13));}
  }else if(a.kind==='path'){
   const count=Math.max(1,Math.ceil(d/.65));for(let j=0;j<count;j++){const px=(random()-.5)*.045,pz=-d*.5+(j+.5)*d/count,sw=w*(.92+random()*.05),sd=d/count*.94;mesh(cube,stone,local,[px,h*.5,pz],[sw,h,sd]);grounds.push({x:x+px,z:z+pz,w:sw,d:sd,y:y+h});}
  }else if(a.kind==='bench'){
   const wood=material('#807d5c');for(let j=0;j<4;j++)mesh(cube,wood,local,[0,h*.53,-d*.42+j*d*.28],[w,.065,d*.22]);for(const side of [-1,1]){mesh(cube,darkBark,local,[side*w*.36,h*.25,0],[.07,h*.5,d*.72]);rod([side*w*.36,h*.5,-d*.4],[side*w*.36,h,-d*.48],.027,darkBark,local);}for(let j=0;j<2;j++)mesh(cube,wood,local,[0,h*(.78+j*.16),-d*.46],[w,.09,.045]);addObstacle(a,[w/2,h/2,d/2],[x,y+h/2,z]);
  }else if(a.kind==='plant'){
   if(plantForm(a,local,random,leaf))continue;
   const leafMat=leafMaterial(a.appearance?.pixels?.palette?.length?'#ffffff':'#647c43'),stemMat=material('#788650');const count=28,leaves=instance(leaf,leafMat,count*4,local),petals=instance(new THREE.SphereGeometry(1,10,6),material('#e8c899'),count*5,local),centers=instance(new THREE.SphereGeometry(1,8,6),material('#b58d44'),count,local);
   for(let j=0;j<count;j++){const px=(random()-.5)*w,pz=(random()-.5)*d,height=h*(.45+random()*.5);rod([px,0,pz],[px+.02,height,pz],.004,stemMat,local);for(let k=0;k<4;k++)put(leaves,j*4+k,[px,height*(.2+k*.14),pz],[.65,k*2.4,Math.PI*.35],[.085,.16,.16],a.appearance?appearancePalette(a.appearance,colorRandom,'#647c43'):undefined);for(let k=0;k<5;k++){const angle=k*6.28/5;put(petals,j*5+k,[px+.02+Math.cos(angle)*.024,height,pz+Math.sin(angle)*.024],[0,angle,0],[.026,.008,.014]);}put(centers,j,[px+.02,height+.006,pz],[0,0,0],[.014,.008,.014]);}
  }
 }
 if(box.isEmpty())box.set(V([-6,0,-5]),V([6,5,5]));
 const bounds={min:[box.min.x-.6,Math.min(0,box.min.y),box.min.z-.6],max:[box.max.x+.6,Math.max(6,box.max.y+1),box.max.z+.6]};
 const surfaceAt=(x,z)=>{let height=terrain?.heightAt(x,z)??null;for(const g of grounds)if(g.polygon?(g.annotated?pointInPolygon([x,z],g.polygon):inGroundPolygon(x,z,g.polygon)):Math.abs(x-g.x)<=g.w/2&&Math.abs(z-g.z)<=g.d/2)height=height===null?g.y:Math.max(height,g.y);return height;};
 const groundAt=(x,z)=>surfaceAt(x,z)??0;
 // Exact rendered support planes, including their finite footprint. Submerged consumers
 // must not interpret groundAt's compatibility fallback as an unseen underwater bottom.
 const groundSupports=grounds.map((g,i)=>({id:`ground-support-${i}`,y:g.y,points:g.polygon?g.polygon.map(p=>[...p]):[[g.x-g.w/2,g.z-g.d/2],[g.x+g.w/2,g.z-g.d/2],[g.x+g.w/2,g.z+g.d/2],[g.x-g.w/2,g.z+g.d/2]]}));
 const detail=createFoliageDetail(group,leaf);
 return {group,perches,obstacles,bounds,groundAt,surfaceAt,groundCoverageRequired:(place.observations??[]).some(o=>o.mapContext?.verticalPolicy==='source-relative'),terrainTriangleCount:terrain?.triangleCount??0,surfaces,waterSurfaces,groundSupports,updateDetail:detail.update,detailSnapshot:detail.snapshot,update(time,{rain:wet=rain}={}){for(const clock of polygonWaters)clock.value=time*(wet?2:1);for(const item of leafSways){item.group.rotation.z=Math.sin(time*.7+item.phase)*(wet?.006:.002);item.group.rotation.x=Math.sin(time*.45+item.phase)*.002;}for(const water of waters)water.rings.forEach((ring,i)=>{const t=(time*(wet?.35:.10)+i/5+water.phase)%1;ring.scale.set(water.w*.5*t,water.d*.5*t,1);ring.material.opacity=(1-t)*(wet?.25:.10);});},dispose(){detail.dispose();disposeGroup(group);}};
}

/** Smooth original bird silhouette, independently articulated feathers and locked world toes. */
export function createBirdArt(){
 const group=new THREE.Group();group.name='simulated-garden-bird';const body=new THREE.Group();group.add(body);
 const c=BIRD_BODY.colors,back=material(c.back),breast=material(c.breast),belly=material(c.belly),wingMat=material(c.wings),tip=material(c.featherTips),dark=material(c.beak),legMat=material(c.legs);
 const smoothSphere=new THREE.SphereGeometry(1,20,14);
 const plumage=[back,breast,belly];
 mesh(createPlumageGeometry('body'),plumage,body);
 const head=new THREE.Group();head.position.fromArray(BIRD_BODY.headOffset);body.add(head);mesh(createPlumageGeometry('head'),plumage,head);
 const beak=mesh(new THREE.ConeGeometry(.017,.06,12),dark,head,[0,-.005,.087]);beak.rotation.x=Math.PI/2;
 for(const side of [-1,1]){mesh(smoothSphere,material('#202d28'),head,[side*.051,.014,.037],[.011,.012,.010]);mesh(smoothSphere,material('#f4e8c9'),head,[side*.057,.018,.042],[.003,.003,.003]);}
 const wings=[];
 for(const side of [-1,1]){const hinge=new THREE.Group();hinge.position.set(side*.065,.025,-.005);body.add(hinge);mesh(smoothSphere,wingMat,hinge,[side*.032,-.002,-.04],[.038,.035,.095]);
  for(let j=0;j<7;j++){const feather=mesh(smoothSphere,j%3===0?tip:wingMat,hinge,[side*(.035+j*.009),-.008-j*.003,-.07-j*.012],[.012,.009,.074+j*.003]);feather.rotation.y=side*(.10+j*.08);}wings.push(hinge);}
 const tail=new THREE.Group();tail.position.set(0,.006,-.112);body.add(tail);for(let j=0;j<5;j++){const f=mesh(smoothSphere,j%2?tip:wingMat,tail,[(j-2)*.016,0,-.065],[.016,.009,.082]);f.rotation.y=(j-2)*-.10;}
 const segments=[],toes=[];const boneGeo=new THREE.CylinderGeometry(1,1,1,7,1);
 for(let f=0;f<2;f++){segments.push([mesh(boneGeo,legMat,group),mesh(boneGeo,legMat,group)]);toes.push(Array.from({length:3},()=>mesh(boneGeo,legMat,group)));}
 function line(m,a,b,r){const start=V(a),end=V(b),delta=end.sub(start);m.position.copy(start.add(V(b)).multiplyScalar(.5));m.scale.set(r,delta.length(),r);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());}
 return {group,update(b){group.visible=b.state!=='unplaced';body.position.fromArray(b.position);body.rotation.set(-b.pitch,b.yaw,0,'YXZ');head.rotation.y=b.headYaw;wings[0].rotation.z=b.wingLeft;wings[1].rotation.z=b.wingRight;tail.rotation.x=b.tail;
  b.feet.forEach((f,i)=>{line(segments[i][0],f.hip,f.knee,.005);line(segments[i][1],f.knee,f.toe,.004);for(let j=0;j<3;j++){const angle=b.yaw+(j-1)*.55;const end=[f.toe[0]+Math.sin(angle)*.028,f.toe[1]-(f.contact?.008:0),f.toe[2]+Math.cos(angle)*.028];line(toes[i][j],f.toe,end,.0025);}});
 },dispose(){disposeGroup(group);}};
}

