import * as THREE from '../vendor/three.module.js';
import {nearestSilkPoint} from './orb-web.mjs';
import {createWebVisitorArt} from './web-visitor-art.mjs';
import {createCatchingPlan,writeCatchingPositions} from './catching-silk.mjs';

/** Original procedural orb-weaver and silk; all coordinates belong to the shared place. */
export function createOrbWebArt(web){
 const group=new THREE.Group();group.name='simulated-branch-orb-web';group.visible=!!web;group.userData={kind:'simulated',anchorId:web?.anchorId??null};
 const body=new THREE.Group();group.add(body);
  const visitor=createWebVisitorArt();group.add(visitor.group);
 const sphere=new THREE.SphereGeometry(1,20,14),bone=new THREE.CylinderGeometry(1,1,1,7,1);
 const coat=new THREE.MeshStandardMaterial({color:'#a4774e',roughness:.86});
 const dark=new THREE.MeshStandardMaterial({color:'#493829',roughness:.8});
 const cream=new THREE.MeshStandardMaterial({color:'#e8cda0',roughness:.83});
 const eye=new THREE.MeshStandardMaterial({color:'#171a14',roughness:.15});
 const glint=new THREE.MeshBasicMaterial({color:'#fff8e1'});
 const silk=new THREE.LineBasicMaterial({color:'#eee5ca',transparent:true,opacity:.66,depthWrite:false});
 const catchingSilk=new THREE.LineBasicMaterial({color:'#e2dfc7',transparent:true,opacity:.38,depthWrite:false});
 const shape=(mat,p,size)=>{const mesh=new THREE.Mesh(sphere,mat);mesh.position.fromArray(p);mesh.scale.fromArray(size);body.add(mesh);return mesh;};
 shape(coat,[0,.001,-.010],[.0095,.009,.0125]);
 shape(dark,[0,0,.005],[.0058,.0046,.006]);
 // Small paired markings keep a rounded abdomen legible when approached.
 for(let i=0;i<4;i++)for(const side of [-1,1])shape(cream,[side*(.0038-i*.00045),.0084,-.005-i*.004],[.0018-i*.0002,.0007,.0016]);
 for(const side of [-1,1]){
  shape(coat,[side*.0044,.0003,.0092],[.0013,.0015,.0031]);
  for(let i=0;i<4;i++){
   const p=[side*(.0012+(i%2)*.002),.0023+Math.floor(i/2)*.0018,.0095-Math.floor(i/2)*.0007];
   const size=i===0?.00105:.00068;shape(eye,p,[size,size,size*.7]);
   if(i===0)shape(glint,[p[0]-.00025,p[1]+.0003,p[2]+.00065],[.00025,.00025,.00013]);
  }
 }
 // All body pieces share one sphere; retain their materials in five static batches.
 const bodyParts=new Map();for(const mesh of body.children){if(!bodyParts.has(mesh.material))bodyParts.set(mesh.material,[]);bodyParts.get(mesh.material).push(mesh);}
 for(const [material,parts] of bodyParts){const batch=new THREE.InstancedMesh(sphere,material,parts.length);parts.forEach((part,i)=>{part.updateMatrix();batch.setMatrixAt(i,part.matrix);body.remove(part);});batch.computeBoundingSphere();body.add(batch);}
 const limbs=new THREE.InstancedMesh(bone,dark,16),knees=new THREE.InstancedMesh(sphere,coat,8);group.add(limbs,knees);
 limbs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);knees.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 limbs.frustumCulled=false;knees.frustumCulled=false;
 const matrix=new THREE.Matrix4(),dummy=new THREE.Object3D(),start=new THREE.Vector3(),end=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0),basis=new THREE.Matrix4();
 let currentWeb=null,structural=null,spiral=null,catchingPlan=null,lastSteps=-1;
 function lines(edges,material){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(edges.flatMap(e=>[...e.a,...e.b]),3));const mesh=new THREE.LineSegments(geometry,material);mesh.userData.kind='simulated-silk';group.add(mesh);return mesh;}
 function setWeb(next){
  if(currentWeb?.key===next?.key)return;
  for(const item of [structural,spiral])if(item){group.remove(item);item.geometry.dispose();}
  currentWeb=next;
  const mesh=next?.silkGeometry;
  structural=next?lines(mesh?mesh.segments.map(s=>({a:mesh.positions[s.from],b:mesh.positions[s.to]})):next.edges,silk):null;spiral=next?lines(next.spiral,catchingSilk):null;
  catchingPlan=next?createCatchingPlan(next,nearestSilkPoint):null;lastSteps=-1;
  for(const item of [structural,spiral])if(item){item.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);item.frustumCulled=false;}
  group.userData.anchorId=next?.anchorId??null;group.visible=!!next;
 }
 setWeb(web);
 function line(index,a,b,r){start.fromArray(a);end.fromArray(b).sub(start);dummy.position.copy(start).addScaledVector(end,.5);dummy.quaternion.setFromUnitVectors(axis,end.clone().normalize());dummy.scale.set(r,end.length(),r);dummy.updateMatrix();limbs.setMatrixAt(index,dummy.matrix);}
  return {group,setWeb,residentInspection(){return group.visible?{visible:body.visible,position:body.position.toArray(),quaternion:body.quaternion.toArray()}:{visible:false,position:null,quaternion:null};},visitorInspection(){const v=visitor.inspect();return {...v,visible:group.visible&&v.visible};},update(snapshot,{rain=false}={}){
  const spider=snapshot?.spider;group.visible=!!currentWeb&&spider?.state!=='unplaced';if(!group.visible)return;
   visitor.update(snapshot.encounter,currentWeb);
  const mesh=currentWeb.silkGeometry,field=snapshot.silk;
  if(mesh&&field&&lastSteps!==field.steps){
   const normal=currentWeb.normal,vertices=structural.geometry.attributes.position.array;let at=0;
   for(const segment of mesh.segments)for(const index of [segment.from,segment.to])for(let axis=0;axis<3;axis++)vertices[at++]=mesh.positions[index][axis]+normal[axis]*field.displacements[index];
   const curve=spiral.geometry.attributes.position.array;
   writeCatchingPositions(catchingPlan,field,curve);
   structural.geometry.attributes.position.needsUpdate=true;spiral.geometry.attributes.position.needsUpdate=true;lastSteps=field.steps;
  }
  body.position.fromArray(spider.position);basis.makeBasis(new THREE.Vector3(...spider.basis.right),new THREE.Vector3(...spider.basis.up),new THREE.Vector3(...spider.basis.forward));body.quaternion.setFromRotationMatrix(basis);
  spider.feet.forEach((f,i)=>{line(i*2,f.hip,f.knee,.0008);line(i*2+1,f.knee,f.toe,.0005);matrix.makeScale(.00105,.00105,.00105);matrix.setPosition(...f.knee);knees.setMatrixAt(i,matrix);});
  limbs.instanceMatrix.needsUpdate=true;knees.instanceMatrix.needsUpdate=true;silk.opacity=rain?.76:.66;catchingSilk.opacity=rain?.49:.38;
  },dispose(){visitor.dispose();const geometries=new Set([sphere,bone]),materials=new Set([coat,dark,cream,eye,glint,silk,catchingSilk]);group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.clear();currentWeb=null;}};
}
