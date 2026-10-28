import * as THREE from '../vendor/three.module.js';
/** Native scene helper. Artistic forms express retained habitat context, not species identification. */
export function addContextArt(anchor,group,random){
 const form=anchor.contextForm;if(!form)return false;
 const [w,h,d]=anchor.size;
 const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.92,...extra});
 const put=(geometry,mat,position,scale=[1,1,1])=>{const mesh=new THREE.Mesh(geometry,mat);mesh.position.fromArray(position);mesh.scale.fromArray(scale);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
 group.userData.contextForm=form;group.userData.provenance='public-habitat-artistic-completion';
 if(form==='garden-hedge'||form==='wall-climber'||form==='container-foliage'){
  const climbing=form==='wall-climber',container=form==='container-foliage',leaves=[],indices=[];
  const branchMaterial=material('#746047'),leafMaterial=material(climbing?'#52744f':'#65805a',{side:THREE.DoubleSide});
  // Leaves share one mesh. The bounded envelope is also the habitat envelope;
  // the wall climber never protrudes behind its supporting wall.
  const stem=(a,b,r)=>{const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
   const mesh=put(new THREE.CylinderGeometry(r*.6,r,delta.length(),5),branchMaterial,from.add(to).multiplyScalar(.5).toArray());
   mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());};
  const leaf=(x,y,z,length,angle,yaw=0)=>{
   const at=leaves.length/3,dx=Math.cos(angle),dy=Math.sin(angle),cy=Math.cos(yaw),sy=Math.sin(yaw);
   // A tapered outline and raised midrib catch light as the visitor walks past.
   // Rotate hedge leaves through the volume; climbers stay against their wall.
   for(const [t,across,ridge] of [[.5,0,.09],[0,0,0],[.3,.23,.02],[.7,.21,.015],[1,0,0],[.7,-.21,.015],[.3,-.23,.02]]){
    const u=length*(dx*t-dy*across),v=length*(dy*t+dx*across),depth=length*ridge;
    leaves.push(x+u*cy-depth*sy,y+v,z+u*sy+depth*cy);
   }
   for(let j=1;j<=6;j++)indices.push(at,at+j,at+(j===6?1:j+1));
  };
  const stems=container?9:climbing?5:7;
  for(let i=0;i<stems;i++){
   const x=(i/(stems-1)-.5)*w*.65,z=climbing?0:(random()-.5)*d*.6,top=h*(.65+random()*.28);
   // A tilted cylinder projects its radius below its centerline endpoint.
   // Inset the root so the complete solid stays on the supported side of y=0.
   const radius=container?Math.min(Math.min(w,d)*.022,h*.04):Math.min(w,d)*.022;
   stem([x,container?radius+1e-6:h*.01,z],[x+w*.045*Math.sin(i),top,z],radius);
  }
  for(let i=0;i<(container?360:climbing?150:600);i++){
   const x=(random()-.5)*w*.66,y=h*(.15+random()*.72),z=(random()-.5)*d*.68;
   leaf(x,y,z,Math.min(w*.16,h*.12,d*(climbing?.55:.22)),random()*Math.PI*2,climbing?0:random()*Math.PI*2);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(leaves,3));geometry.setIndex(indices);geometry.computeVertexNormals();put(geometry,leafMaterial,[0,0,0]);
  return true;
 }
 if(form==='intertidal-shelf'){
  const shape=new THREE.Shape(),r=Math.min(w,d)*.12;shape.moveTo(-w/2+r,-d/2);shape.lineTo(w/2-r,-d/2);shape.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);shape.lineTo(w/2,d/2-r);shape.quadraticCurveTo(w/2,d/2,w/2-r,d/2);shape.lineTo(-w/2+r,d/2);shape.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);shape.lineTo(-w/2,-d/2+r);shape.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:h*.84,steps:1,bevelEnabled:true,bevelSegments:3,bevelSize:Math.min(w,d)*.025,bevelThickness:h*.08,curveSegments:6});
  const stone=put(geometry,material('#7c8884'),[0,h*.92,0]);stone.rotation.x=Math.PI/2;return true;
 }
 if(form==='intertidal-substrate'||form==='desert-ground'||form==='marsh-substrate'||form==='courtyard-foundation'){
  put(new THREE.BoxGeometry(w,h,d),material(form==='intertidal-substrate'?'#8c9382':form==='desert-ground'?'#bb9b6c':form==='courtyard-foundation'?'#9b9584':'#77745b'),[0,h/2,0]);return true;
 }
 if(form==='columnar-succulent'){
  const mat=material('#6b8765'),radius=Math.min(w,d)*.28;
  put(new THREE.CapsuleGeometry(radius,Math.max(.02,h-2*radius),6,10),mat,[0,h/2,0]);
  const ribMat=material('#9eaa7b');for(let i=0;i<9;i++){const a=i*Math.PI*2/9;put(new THREE.CylinderGeometry(.006,.006,h*.77,4),ribMat,[Math.cos(a)*radius*.99,h/2,Math.sin(a)*radius*.99]);}
  return true;
 }
 if(form==='sedge'||form==='scrub'){
  const count=form==='sedge'?72:90,mat=material(form==='sedge'?'#7b9258':'#8d996b',{side:THREE.DoubleSide});
  const geometry=new THREE.BufferGeometry(),p=[],indices=[];
  for(let i=0;i<count;i++){
   const angle=i*2.399,spread=Math.sqrt(random()),x=Math.cos(angle)*w*.42*spread,z=Math.sin(angle)*d*.42*spread,height=h*(.4+random()*.6),width=(form==='sedge'?.012:.055)*(0.7+random()),lean=(form==='sedge'?.12:.3),at=p.length/3;
   p.push(x-width,0,z,x+width,0,z,x+Math.cos(angle)*lean,height,z+Math.sin(angle)*lean);indices.push(at,at+1,at+2);
  }
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setIndex(indices);geometry.computeVertexNormals();put(geometry,mat,[0,0,0]);return true;
 }
 return false;
}
