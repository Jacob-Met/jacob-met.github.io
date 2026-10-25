import {createSurfaceContact} from './surface-contact.mjs';
/** Snapshot only explicitly supported static anchor meshes; no second shape model.
 * Preserve mesh winding and transform the exact rendered vertex positions. */
export function contactFromWorldArt(group){
 group.updateMatrixWorld(true);const triangles=[];
 for(const anchor of group.children){
  if(!['rock','path'].includes(anchor.userData?.kind))continue;
  const anchorId=anchor.userData.anchorId;if(typeof anchorId!=='string')continue;
  let meshIndex=0;
  anchor.traverse(mesh=>{
   if(!mesh.isMesh||mesh.isInstancedMesh||!mesh.geometry?.attributes?.position)return;
   const p=mesh.geometry.attributes.position,index=mesh.geometry.index,m=mesh.matrixWorld.elements,current=meshIndex++;
   const vertex=i=>{const x=p.getX(i),y=p.getY(i),z=p.getZ(i);return[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];};
   const count=index?.count??p.count;
   for(let i=0;i+2<count;i+=3){const vertices=[0,1,2].map(j=>vertex(index?index.getX(i+j):i+j)),[a,b,c]=vertices;
    const u=b.map((v,k)=>v-a[k]),v=c.map((x,k)=>x-a[k]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    // Bottom/vertical and zero-area cap faces cannot support this bounded mode.
    if(normal[1]<=1e-12||Math.hypot(...normal)<1e-12)continue;
    if(triangles.length>=4096){const error=new Error('Raised-surface visits are unavailable: this place exceeds the 4096-face contact budget. Ground exploration remains available.');error.code='SURFACE_CONTACT_CAPACITY';throw error;}
    triangles.push({id:`${anchorId}:mesh:${current}:face:${i/3}`,anchorId,vertices});
   }
  });
 }
 return createSurfaceContact(triangles);
}

/** Capacity affects optional raised contact, never admission of the whole place. */
export function prepareWorldContact(group){
 try{return {surfaceContact:contactFromWorldArt(group),contactNotice:null};}
 catch(error){if(error.code!=='SURFACE_CONTACT_CAPACITY')throw error;return {surfaceContact:null,contactNotice:error.message};}
}
