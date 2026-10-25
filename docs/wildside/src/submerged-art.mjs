import * as THREE from '../vendor/three.module.js';

/** Original smooth, articulated microcrustacean illustration. All anatomy is artistic completion. */
export function createSubmergedArt(){
 const group=new THREE.Group();group.name='simulated-submerged-freshwater-life';
 const sphere=new THREE.SphereGeometry(1,20,14),cylinder=new THREE.CylinderGeometry(1,1,1,6),models=new Map();
 const shell=new THREE.MeshStandardMaterial({color:'#e9c58f',roughness:.32,transparent:true,opacity:.52,side:THREE.DoubleSide,depthWrite:false});
 const rim=new THREE.MeshStandardMaterial({color:'#f2d5a5',roughness:.56});
 const limb=new THREE.MeshStandardMaterial({color:'#d8b481',roughness:.65});
 const tissue=new THREE.MeshStandardMaterial({color:'#b4b984',roughness:.75});
 const gut=new THREE.MeshStandardMaterial({color:'#71885f',roughness:.8});
 const dark=new THREE.MeshStandardMaterial({color:'#272f28',roughness:.2});
 const glint=new THREE.MeshBasicMaterial({color:'#fff6d9'});
 function ball(parent,position,scale,material){const m=new THREE.Mesh(sphere,material);m.position.fromArray(position);m.scale.fromArray(scale);parent.add(m);return m;}
 function rod(parent,a,b,r,material){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av),m=new THREE.Mesh(cylinder,material);m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());m.scale.set(r,delta.length(),r);parent.add(m);return m;}
 function create(id){
  const root=new THREE.Group(),body=new THREE.Group();root.name=id;root.userData.provenance='simulated-original-water-flea-inspired-art';root.add(body);group.add(root);
  ball(body,[0,-.00015,0],[.00082,.00155,.00062],shell);
  ball(body,[0,.00115,.00022],[.00051,.00066,.00049],shell);
  ball(body,[0,.00010,.00004],[.00030,.00114,.00030],tissue);
  ball(body,[0,-.00012,.00023],[.00015,.00093,.00016],gut);
  ball(body,[0,.00132,.00059],[.00031,.00032,.00020],dark);
  ball(body,[-.00009,.00144,.00075],[.000075,.00009,.00004],glint);
  rod(body,[0,-.0014,-.00005],[0,-.00235,-.00048],.000045,rim);
  // Paired branched second antennae, with fine swimming setae.
  const antennae=[];
  for(const side of [-1,1]){
   const arm=new THREE.Group();arm.position.set(side*.00035,.0009,.0002);body.add(arm);antennae.push({arm,side});
   rod(arm,[0,0,0],[side*.00072,.00038,0],.000065,limb);
   for(const branch of [-1,1]){
    const end=[side*(.0015+branch*.00012),.00048+branch*.00033,branch*.00018];
    rod(arm,[side*.00072,.00038,0],end,.00004,limb);
    for(let j=0;j<4;j++){const t=(j+1)/5,a=[side*(.00072+(.00078+branch*.00012)*t),.00038+(.0001+branch*.00033)*t,branch*.00018*t];rod(arm,a,[a[0]+side*.00022,a[1]-.00023-j*.000015,a[2]+.00008],.000012,rim);}
   }
  }
  const feet=[];for(let j=0;j<5;j++)for(const side of [-1,1]){
   const foot=new THREE.Group();foot.position.set(side*.00032,.00035-j*.00022,.00025);body.add(foot);feet.push({foot,j,side});
   rod(foot,[0,0,0],[side*.00030,-.00016,.00021],.000035,limb);
   rod(foot,[side*.00030,-.00016,.00021],[side*.00037,-.00032,.00032],.000022,rim);
  }
  const model={root,body,antennae,feet};models.set(id,model);return model;
 }
 function update(snapshot){
  const ids=new Set(snapshot.swimmers.map(s=>s.id));for(const [id,m] of models)if(!ids.has(id)){group.remove(m.root);models.delete(id);}
  for(const s of snapshot.swimmers){const m=models.get(s.id)||create(s.id);m.root.position.fromArray(s.position);m.root.rotation.y=s.yaw;m.body.rotation.x=-s.pitch;
   const stroke=s.phase<.22?(.7-1.35*s.phase/.22):s.phase<.42?(-.65+1.35*(s.phase-.22)/.20):.7;
   for(const {arm,side} of m.antennae){arm.rotation.z=-side*stroke;arm.rotation.y=side*(s.state==='recovering'?.45:.08);}
   for(const {foot,j,side} of m.feet)foot.rotation.x=Math.sin(snapshot.time*18-j*.9+side*.2)*.32;
  }
  group.visible=ids.size>0;
 }
 return {group,update,dispose(){group.clear();models.clear();sphere.dispose();cylinder.dispose();for(const m of [shell,rim,limb,tissue,gut,dark,glint])m.dispose();}};
}
