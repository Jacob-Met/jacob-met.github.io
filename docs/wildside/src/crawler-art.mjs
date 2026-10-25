import * as THREE from '../vendor/three.module.js';
/** Original illustrative beetle, rendered at actual centimeter scale. */
export function createCrawlerArt(){
 const group=new THREE.Group(),body=new THREE.Group();group.name='simulated-ground-beetle';group.add(body);
 const shell=new THREE.MeshStandardMaterial({color:'#405f48',roughness:.38,metalness:.22}),dark=new THREE.MeshStandardMaterial({color:'#26352b',roughness:.65}),stripe=new THREE.MeshStandardMaterial({color:'#a6a16c',roughness:.55});
 const ellipsoid=new THREE.SphereGeometry(1,18,12),bone=new THREE.CylinderGeometry(1,1,1,6);
 const sphere=(mat,p,s,parent=body)=>{const m=new THREE.Mesh(ellipsoid,mat);m.position.fromArray(p);m.scale.fromArray(s);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 sphere(dark,[0,-.001,-.001],[.005,.003,.008]);
 for(const side of [-1,1]){sphere(shell,[side*.0022,.0007,-.0025],[.0027,.0036,.0068]);const points=Array.from({length:7},(_,i)=>{const z=-.0046+i*.0092/6;return new THREE.Vector3(side*.0031,.0008+.0036*Math.sqrt(Math.max(0,1-(z/.0068)**2-(.0009/.0027)**2)),-.0025+z);});const rib=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,.00016,4,false),stripe);body.add(rib);}
 sphere(shell,[0,.0005,.0046],[.0037,.0033,.003]);sphere(dark,[0,.0001,.0085],[.0027,.0025,.0026]);
 for(const side of [-1,1])sphere(dark,[side*.0021,.001,.0094],[.0007,.0008,.0006]);
 const makeLine=parent=>{const m=new THREE.Mesh(bone,dark);m.castShadow=true;parent.add(m);return m;};
 const lines=Array.from({length:6},()=>[makeLine(group),makeLine(group)]),antennae=Array.from({length:2},()=>[makeLine(body),makeLine(body)]);
 const contactMaterial=new THREE.MeshBasicMaterial({color:'#20251b',transparent:true,opacity:.14,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),shadow=new THREE.Mesh(new THREE.CircleGeometry(1,24),contactMaterial);shadow.scale.set(.006,.010,1);group.add(shadow);
 function line(mesh,a,b,r){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.scale.set(r,direction.length(),r);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());}
 return {group,update(c){group.visible=c.state!=='unplaced';body.position.fromArray(c.position);const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(...c.basis.right),new THREE.Vector3(...c.basis.up),new THREE.Vector3(...c.basis.forward));body.quaternion.setFromRotationMatrix(basis);const contacts=c.feet.filter(f=>f.contact);shadow.visible=contacts.length>0;if(contacts.length){const up=new THREE.Vector3(...c.basis.up),surface=contacts.reduce((sum,f)=>sum.add(new THREE.Vector3(...f.toe)),new THREE.Vector3()).multiplyScalar(1/contacts.length),position=new THREE.Vector3(...c.position);shadow.position.copy(position).addScaledVector(up,-position.clone().sub(surface).dot(up)+.00008);shadow.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...c.basis.right),new THREE.Vector3(...c.basis.forward).negate(),up));}
  c.feet.forEach((f,i)=>{line(lines[i][0],f.hip,f.knee,.00045);line(lines[i][1],f.knee,f.toe,.00030);});
  for(let i=0;i<2;i++){const side=i===0?-1:1,base=[side*.0018,.0005,.010],middle=[side*(.004+c.antennaAngle*.002),.002,.013],tip=[side*(.006+c.antennaAngle*.003),.0015,.016];line(antennae[i][0],base,middle,.00025);line(antennae[i][1],middle,tip,.00018);}
 },dispose(){const geometry=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geometry)g.dispose();for(const m of materials)m.dispose();group.clear();}};
}
