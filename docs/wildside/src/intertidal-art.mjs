import * as THREE from '../vendor/three.module.js';
/** Snapshot exact rendered, transformed shelf faces; never synthesize a support plane. */
export function intertidalFaces(group){
 group.updateMatrixWorld(true);const faces=[];let overflow=false;
 for(const anchor of group.children){if(anchor.userData?.contextForm!=='intertidal-shelf')continue;let part=0;
  anchor.traverse(mesh=>{if(!mesh.isMesh||mesh.isInstancedMesh)return;const p=mesh.geometry?.attributes.position,index=mesh.geometry?.index;if(!p)return;const id=part++;
   for(let i=0;i<(index?.count??p.count);i+=3){if(faces.length>=4096){overflow=true;return;}const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld).toArray());faces.push({id:`${anchor.userData.anchorId}:${id}:${i/3}`,anchorId:anchor.userData.anchorId,vertices});}
  });
 }return overflow?[]:faces;
}
export function createIntertidalArt(){
 const group=new THREE.Group();group.name='illustrative-attached-anemones';const rigs=new Map(),geometries=new Set(),materials=new Set();
 const mat=color=>{const m=new THREE.MeshStandardMaterial({color,roughness:.6});materials.add(m);return m;};
 const columnMat=mat('#657b59'),rimMat=mat('#b9ce83'),tipMat=mat('#bea6c8'),mouthMat=mat('#694f63');
 const put=(g,m,parent)=>{geometries.add(g);const mesh=new THREE.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 function make(id){const root=new THREE.Group();root.name=id;group.add(root);const column=new THREE.Group();root.add(column);
  const profile=[[.038,0],[.046,.007],[.051,.024],[.048,.043],[.045,.052],[.049,.06]].map(p=>new THREE.Vector2(...p));
  put(new THREE.LatheGeometry(profile,32),columnMat,column);
  const closure=put(new THREE.SphereGeometry(1,32,16),columnMat,column);closure.position.y=.058;
  const crown=new THREE.Group();column.add(crown);crown.position.y=.059;
  const disk=put(new THREE.SphereGeometry(1,32,16),rimMat,crown);disk.scale.set(.049,.007,.049);
  const mouth=put(new THREE.SphereGeometry(1,20,12),mouthMat,crown);mouth.scale.set(.009,.0025,.006);mouth.position.y=.007;
  const tentacles=[];
  // Tapered original curved meshes rotate as complete parts. The same rig works
  // through HAMON's existing geometry + per-object transform stream.
  for(let i=0;i<48;i++){const angle=i*Math.PI*2/48,pivot=new THREE.Group();pivot.rotation.y=angle;crown.add(pivot);
   const inner=i%2===0,reach=inner?.82:1,height=inner?1.25:1;
   const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(.030,0,0),new THREE.Vector3(.046*reach,.023*height,.002),new THREE.Vector3(.069*reach,.035*height,.003),new THREE.Vector3(.086*reach,.023*height,0)]);
   const geometry=new THREE.TubeGeometry(curve,12,.0035,7,false),p=geometry.attributes.position;
   for(let j=0;j<p.count;j++){const row=Math.floor(j/8),t=row/12,center=curve.getPointAt(t);p.setXYZ(j,center.x+(p.getX(j)-center.x)*(1-.8*t),center.y+(p.getY(j)-center.y)*(1-.8*t),center.z+(p.getZ(j)-center.z)*(1-.8*t));}geometry.computeVertexNormals();
   put(geometry,i%4?rimMat:tipMat,pivot);tentacles.push(pivot);
  }
  return {root,column,crown,closure,tentacles};
 }
 return {group,update(snapshot){const ids=new Set(snapshot.residents.map(r=>r.id));for(const [id,rig]of rigs)rig.root.visible=ids.has(id);
  for(const r of snapshot.residents){let rig=rigs.get(r.id);if(!rig){rig=make(r.id);rigs.set(r.id,rig);}rig.root.visible=true;rig.root.position.fromArray(r.position);rig.root.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...r.normal));
   rig.column.scale.set(1-.18*(1-r.openness),.32+.68*r.openness,1-.18*(1-r.openness));rig.crown.scale.setScalar(.18+.82*r.openness);rig.crown.visible=r.openness>.03;const closed=1-r.openness;rig.closure.scale.set(.049*closed,.015*closed,.049*closed);rig.closure.visible=closed>.01;
   rig.tentacles.forEach((p,i)=>{p.rotation.z=r.sway*Math.sin(i*.8+snapshot.time*.3);});
  }
 },dispose(){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.clear();rigs.clear();}};
}
