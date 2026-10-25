import * as THREE from '../vendor/three.module.js';
/** Original rounded arthropod art. Coordinates and every contact come from the shared simulation. */
export function createPondSkaterArt(){
 const group=new THREE.Group();group.name='simulated-water-strider';group.userData.kind='simulated';
 const body=new THREE.Group();group.add(body);
 const sphere=new THREE.SphereGeometry(1,18,12),cylinder=new THREE.CylinderGeometry(1,1,1,7),ring=new THREE.RingGeometry(.72,1,32);
 const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.52});
 const bronze=mat('#686144'),shell=mat('#4b5140'),gold=mat('#b5a67c'),leg=mat('#35453c'),eye=mat('#122a26'),gleam=mat('#f0e5bd');
 const add=(geo,m,parent,p=[0,0,0],scale=[1,1,1])=>{const mesh=new THREE.Mesh(geo,m);mesh.position.fromArray(p);mesh.scale.fromArray(scale);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 add(sphere,shell,body,[0,0,-.004],[.0048,.0042,.012]);add(sphere,bronze,body,[0,.001,.005],[.0052,.0046,.006]);
 for(const side of [-1,1]){const seam=add(sphere,gold,body,[side*.0029,.0032,-.005],[.00065,.0007,.010]);seam.rotation.y=side*.08;}
 const head=new THREE.Group();head.position.set(0,.001,.012);body.add(head);add(sphere,bronze,head,[0,0,0],[.0044,.0036,.0048]);
 for(const side of [-1,1]){add(sphere,eye,head,[side*.0035,.0015,.002],[.002,.0023,.0022]);add(sphere,gleam,head,[side*.0042,.0022,.0033],[.00055,.00055,.00055]);}
 function line(mesh,a,b,width){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.scale.set(width,delta.length(),width);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());}
 for(const side of [-1,1]){line(add(cylinder,leg,head),[side*.002,0,.003],[side*.006,.002,.013],.00036);line(add(cylinder,leg,head),[side*.006,.002,.013],[side*.009,0,.019],.00024);}
 const limbs=Array.from({length:6},()=>[add(cylinder,leg,group),add(cylinder,leg,group),add(sphere,gold,group)]);
 const dimpleMat=new THREE.MeshBasicMaterial({color:'#d9eac9',transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false});
 const dimples=Array.from({length:6},()=>{const m=add(ring,dimpleMat,group);m.rotation.x=-Math.PI/2;m.castShadow=false;return m;});
 const ripples=Array.from({length:12},()=>{const m=add(ring,new THREE.MeshBasicMaterial({color:'#d5e9d8',transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false}),group);m.rotation.x=-Math.PI/2;m.castShadow=false;return m;});
 return {group,
  update(snapshot){const s=snapshot.skater;group.visible=s.state!=='unplaced';if(!group.visible)return;body.position.fromArray(s.position);body.rotation.set(0,s.yaw,0);head.rotation.y=s.headYaw;
   s.feet.forEach((f,i)=>{line(limbs[i][0],f.hip,f.knee,.0006);line(limbs[i][1],f.knee,f.toe,.00038);limbs[i][2].position.fromArray(f.toe);limbs[i][2].scale.set(.00065,.00045,.0025);limbs[i][2].rotation.y=s.yaw;
    const d=dimples[i];d.visible=f.contact;d.position.fromArray(f.toe);d.position.y+=.0003;d.scale.set(f.pair===1?.0045:.003,.0018,1);d.rotation.z=-s.yaw;
   });
   ripples.forEach((m,i)=>{const r=snapshot.ripples[i];m.visible=!!r;if(!r)return;m.position.fromArray(r.position);m.position.y+=.0004;const radius=.003+r.age*.024;m.scale.set(radius,radius,1);m.material.opacity=.21*Math.max(0,1-r.age/1.4);});
  },
  dispose(){const geos=new Set(),materials=new Set();group.traverse(m=>{if(m.geometry)geos.add(m.geometry);if(m.material)materials.add(m.material);});geos.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();}
 };
}
