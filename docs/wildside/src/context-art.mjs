import * as THREE from '../vendor/three.module.js';
/** Native scene helper. Artistic forms express retained habitat context, not species identification. */
export function addContextArt(anchor,group,random){
 const form=anchor.contextForm;if(!form)return false;
 const [w,h,d]=anchor.size;
 const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.92,...extra});
 const put=(geometry,mat,position,scale=[1,1,1])=>{const mesh=new THREE.Mesh(geometry,mat);mesh.position.fromArray(position);mesh.scale.fromArray(scale);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
 group.userData.contextForm=form;group.userData.provenance='public-habitat-artistic-completion';
 if(form==='desert-ground'||form==='marsh-substrate'){
  put(new THREE.BoxGeometry(w,h,d),material(form==='desert-ground'?'#bb9b6c':'#77745b'),[0,h/2,0]);return true;
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
