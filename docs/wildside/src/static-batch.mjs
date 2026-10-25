import * as THREE from '../vendor/three.module.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';
/** Batch only immutable, direct-child, opaque single-material world meshes.
 * Only tree/plant groups are eligible. Rock/path face identity, other anchors,
 * instanced/swaying foliage, transparent water and creatures stay intact.
 * Geometry is transformed, not simplified; materials and UVs are retained. */
export function batchStaticWorld(root){
 const groups=[];root.traverse(o=>{if(o.isGroup&&['tree','plant'].includes(o.userData.kind))groups.push(o);});const removed=new Set();let before=0,after=0;
 for(const group of groups){const buckets=new Map();for(const child of group.children){
  if(!child.isMesh||child.isInstancedMesh||child.isSkinnedMesh||child.children.length||!child.visible||Array.isArray(child.material)||child.material.transparent||child.morphTargetInfluences?.length||Object.keys(child.userData).length)continue;
  child.updateMatrix();if(child.matrix.determinant()<=0)continue;
  const attributes=Object.entries(child.geometry.attributes).map(([k,v])=>`${k}:${v.itemSize}:${v.normalized}:${v.array.constructor.name}`).sort().join('|');
  const key=[child.material.uuid,child.castShadow,child.receiveShadow,child.renderOrder,child.layers.mask,!!child.geometry.index,attributes].join(';');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(child);
 }
 for(const meshes of buckets.values()){if(meshes.length<2)continue;const inputs=meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrix)),merged=mergeGeometries(inputs,false);for(const g of inputs)g.dispose();if(!merged)continue;
  const first=meshes[0],batch=new THREE.Mesh(merged,first.material);batch.name='static-material-batch';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.renderOrder=first.renderOrder;batch.layers.mask=first.layers.mask;batch.userData={staticBatchParts:meshes.length};
  for(const m of meshes){group.remove(m);removed.add(m.geometry);}group.add(batch);before+=meshes.length;after++;
 }}
 const retained=new Set();root.traverse(o=>{if(o.geometry)retained.add(o.geometry);});for(const geometry of removed)if(!retained.has(geometry))geometry.dispose();return {mergedMeshes:before,batches:after,drawObjectsSaved:before-after};
}
