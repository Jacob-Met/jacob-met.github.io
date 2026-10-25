import * as THREE from '../vendor/three.module.js';

/** Original rounded visitor, articulated wings/legs and a small silk parcel. */
export function createWebVisitorArt(){
 const group=new THREE.Group();group.name='simulated-web-visitor';group.userData.kind='simulated';
 const sphere=new THREE.SphereGeometry(1,16,12),bone=new THREE.CylinderGeometry(1,1,1,5);
 const coat=new THREE.MeshStandardMaterial({color:'#719b87',roughness:.86,transparent:true});
 const warm=new THREE.MeshStandardMaterial({color:'#bd955d',roughness:.84,transparent:true});
 const dark=new THREE.MeshStandardMaterial({color:'#2c3b31',roughness:.65,transparent:true});
 const wingMaterial=new THREE.MeshStandardMaterial({color:'#eee5bb',roughness:.7,transparent:true,opacity:.68,side:THREE.DoubleSide,depthWrite:false});
 const silkMaterial=new THREE.MeshStandardMaterial({color:'#ede2bd',roughness:.94,transparent:true,opacity:0,depthWrite:false});
 const threadMaterial=new THREE.LineBasicMaterial({color:'#f8eed1',transparent:true,opacity:0});
 const mesh=(geometry,material,p,scale,parent=group)=>{const m=new THREE.Mesh(geometry,material);m.position.fromArray(p);m.scale.fromArray(scale);parent.add(m);return m;};
 mesh(sphere,coat,[0,0,-.002],[.0026,.0024,.0045]);
 mesh(sphere,warm,[0,.0002,.003],[.0028,.0026,.0026]);
 for(const side of [-1,1])mesh(sphere,dark,[side*.0017,.0013,.0045],[.00105,.0012,.0007]);
 const wings=[];
 for(const side of [-1,1]){
  const hinge=new THREE.Group();hinge.position.set(side*.0018,.0015,.001);group.add(hinge);
  const wing=mesh(sphere,wingMaterial,[side*.0048,0,-.001],[.0065,.00028,.0038],hinge);wing.rotation.y=side*.35;wings.push({hinge,side});
 }
 const legs=new THREE.InstancedMesh(bone,dark,12);legs.frustumCulled=false;legs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(legs);
 const parcel=mesh(sphere,silkMaterial,[0,0,0],[.0042,.0038,.007]);
 const points=[];
 for(let band=0;band<9;band++)for(let j=0;j<30;j++)for(const k of [j,j+1]){const t=k/30*Math.PI*2,z=-.005+band*.00125;points.push(Math.cos(t)*.0043,Math.sin(t)*.0039,z+Math.cos(t)*.0007);}
 const threadGeometry=new THREE.BufferGeometry();threadGeometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const threads=new THREE.LineSegments(threadGeometry,threadMaterial);group.add(threads);
 const dummy=new THREE.Object3D(),a=new THREE.Vector3(),b=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),forward=new THREE.Vector3(),right=new THREE.Vector3(),normal=new THREE.Vector3(),basis=new THREE.Matrix4();
 const line=(index,from,to,radius)=>{a.fromArray(from);b.fromArray(to).sub(a);dummy.position.copy(a).addScaledVector(b,.5);dummy.quaternion.setFromUnitVectors(up,b.clone().normalize());dummy.scale.set(radius,b.length(),radius);dummy.updateMatrix();legs.setMatrixAt(index,dummy.matrix);};
 return {group,update(visitor,web){
  group.visible=!!visitor?.visible&&!!web;if(!group.visible)return;
  group.position.fromArray(visitor.position);forward.fromArray(visitor.direction).normalize();normal.fromArray(web.up);
  if(Math.abs(normal.dot(forward))>.94)normal.fromArray(web.normal);
  right.crossVectors(normal,forward).normalize();normal.crossVectors(forward,right).normalize();basis.makeBasis(right,normal,forward);group.quaternion.setFromRotationMatrix(basis);
  const fold=1-visitor.wrapProgress;
  wings.forEach(({hinge,side})=>{hinge.rotation.z=side*visitor.wingAngle;hinge.rotation.y=side*visitor.wrapProgress*.9;});
  for(let side=0;side<2;side++)for(let j=0;j<3;j++){
   const sign=side?1:-1,z=.0025-j*.0024,wiggle=Math.sin(visitor.legPhase+j*1.4+side)*.0009*fold;
   const hip=[sign*.0017,-.001,z],knee=[sign*(.0041*fold+.0017),-.0025,z+wiggle],toe=[sign*(.0056*fold+.0017),-.0038,z-.001+wiggle];
   const i=(side*3+j)*2;line(i,hip,knee,.00022);line(i+1,knee,toe,.00015);
  }
  legs.instanceMatrix.needsUpdate=true;
  coat.opacity=warm.opacity=dark.opacity=visitor.opacity;wingMaterial.opacity=.68*visitor.opacity*(1-visitor.wrapProgress*.8);
  parcel.visible=visitor.wrapProgress>0;silkMaterial.opacity=visitor.wrapProgress*.91*visitor.opacity;threadMaterial.opacity=visitor.opacity;
  threadGeometry.setDrawRange(0,Math.floor(visitor.wrapProgress*9)*30*2);
  parcel.scale.set(.0042,.0038,.007);group.userData.phase=visitor.phase;group.userData.visitorId=visitor.id;
 },inspect(){return {visible:group.visible,position:group.getWorldPosition(new THREE.Vector3()).toArray(),wingAngles:wings.map(w=>w.hinge.rotation.z),parcelVisible:parcel.visible,parcelOpacity:silkMaterial.opacity,wrapThreads:threadGeometry.drawRange.count,phase:group.userData.phase??null,visitorId:group.userData.visitorId??null};},dispose(){legs.dispose();for(const g of [sphere,bone,threadGeometry])g.dispose();for(const m of [coat,warm,dark,wingMaterial,silkMaterial,threadMaterial])m.dispose();group.clear();}};
}
