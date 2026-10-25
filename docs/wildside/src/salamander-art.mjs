import * as THREE from '../vendor/three.module.js';
/** An illustrative large aquatic salamander, drawn from the simulation's own snapshot (see
 * salamander-motion.mjs): a head, a body and a tail that follow the spine, four jointed legs whose
 * feet stay where the simulation planted them. Simple, matte and honest about being imagined. */
const SPINE_Z=[0,.20,-.18,-.29,-.39,-.49,-.59],RADIUS=[.085,.078,.075,.066,.05,.036,.022];
export function createSalamanderArt(){
 const group=new THREE.Group();group.name='simulated-salamander';
 const skin=new THREE.MeshStandardMaterial({color:'#4c4a3a',roughness:.78,metalness:0}),belly=new THREE.MeshStandardMaterial({color:'#8d8466',roughness:.85}),dark=new THREE.MeshStandardMaterial({color:'#1c1d17',roughness:.5});
 const ball=new THREE.SphereGeometry(1,16,12),bone=new THREE.CylinderGeometry(1,1,1,7);
 const mesh=(geometry,material)=>{const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 const segments=SPINE_Z.map(()=>mesh(ball,skin)),head=mesh(ball,skin),jaw=mesh(ball,belly),eyes=[mesh(ball,dark),mesh(ball,dark)];
 const nostrils=[mesh(ball,dark),mesh(ball,dark)];
 const legs=Array.from({length:4},()=>[mesh(bone,skin),mesh(bone,skin),mesh(ball,skin)]);
 const place=(m,p,s)=>{m.position.fromArray(p);m.scale.fromArray(s);};
 const line=(m,a,b,r)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start),l=d.length()||1e-6;m.position.copy(start).add(end).multiplyScalar(.5);m.scale.set(r,l,r);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());};
 return {group,update(c){
  group.visible=c.state!=='unplaced';if(!group.visible)return;
  const h=c.yaw,cos=Math.cos(h),sin=Math.sin(h),at=(x,y,z)=>[c.position[0]+x*cos+z*sin,c.position[1]+y,c.position[2]-x*sin+z*cos];
  const heading=new THREE.Euler(0,h,0);
  SPINE_Z.forEach((z,i)=>{const y=(c.spineOffsets?.[i]??0)+.012;place(segments[i],at(0,y,z),[RADIUS[i],RADIUS[i]*.62,.1+(i===1?.03:0)]);segments[i].rotation.copy(heading);});
  const hy=(c.spineOffsets?.[1]??0)+.012;
  place(head,at(0,hy,.37),[.072,.04,.105]);head.rotation.copy(heading);
  place(jaw,at(0,hy-.018,.39),[.062,.022,.09]);jaw.rotation.copy(heading);
  for(const [i,side] of [[0,-1],[1,1]]){place(eyes[i],at(side*.045,hy+.028,.34),[.01,.01,.01]);place(nostrils[i],at(side*.018,hy+.022,.46),[.006,.006,.006]);}
  c.feet.forEach((f,i)=>{line(legs[i][0],f.hip,f.knee,.017);line(legs[i][1],f.knee,f.toe,.013);place(legs[i][2],f.toe,[.03,.008,.034]);legs[i][2].rotation.copy(heading);});
 },dispose(){const geometry=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geometry)g.dispose();for(const m of materials)m.dispose();}};
}
