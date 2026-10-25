import * as THREE from '../vendor/three.module.js';

// Original Wildside leaf, unchanged at full detail.
export function createLeafGeometry(){
 const g=new THREE.BufferGeometry(),p=[],n=[],uv=[],idx=[];
 for(let row=0;row<=10;row++){const t=row/10,w=Math.sin(Math.PI*t)*.5;for(let col=0;col<3;col++){const x=(col-1)*w;p.push(x,t,Math.sin(Math.PI*t)*.04-(col===1?0:.012));n.push(0,0,1);uv.push(col/2,t);}}
 for(let row=0;row<10;row++)for(let col=0;col<2;col++){const i=row*3+col;idx.push(i,i+1,i+3,i+1,i+4,i+3);}g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

// Same perimeter, positions, normals and UVs; fewer interior rib samples.
// The common-refinement test bounds vertical surface deviation by 0.0151 leaf
// units (including the original degenerate tip faces). This is geometry error,
// not a bound on changes in lighting or color.
export const LEAF_DETAIL_ERROR=.0151;
export function coarseLeafGeometry(fine){
 const coarse=fine.clone(),indices=[];
 for(const [start,end] of [[0,5],[5,10]])for(const col of [0,2]){
  const add=(a,b,c)=>indices.push(...(col===0?[a,c,b]:[a,b,c]));
  for(let row=start;row<end;row++)add(start*3+1,row*3+col,(row+1)*3+col);
  add(start*3+1,end*3+col,end*3+1);
 }
 return coarse.setIndex(indices);
}

// Gershgorin bound on the largest eigenvalue of A^T A: exact for orthogonal
// scaled axes, conservative for sheared ancestors too.
export function linearScaleBound(matrix){
 const a=matrix.elements,cols=[[a[0],a[1],a[2]],[a[4],a[5],a[6]],[a[8],a[9],a[10]]];
 if(!a.every(Number.isFinite))return Infinity;
 return Math.sqrt(Math.max(...cols.map(x=>cols.reduce((sum,y)=>sum+Math.abs(x.reduce((n,v,i)=>n+v*y[i],0)),0))));
}

/** Conservative perspective displacement bound over a camera-space sphere.
 * Uses nearest depth and off-axis perspective amplification. This extends the
 * maintained HAMON Engine cluster_lod nearest-sphere error policy to this
 * perspective browser consumer; no cluster DAG or second renderer is copied.
 */
export function projectedDetailError({error,center,radius,focalPixels,near=0}){
 if(![error,radius,focalPixels,near,...center].every(Number.isFinite)||error<0||radius<0||focalPixels<=0||near<0)return Infinity;
 const depth=-center[2]-radius;
 if(depth<=near)return Infinity;
 return error*focalPixels/depth*Math.hypot(1,(Math.hypot(center[0],center[1])+radius)/depth);
}
export function chooseCoarse(wasCoarse,cameraError,shadowError){
 const limit=wasCoarse?.85:.60;
 return Number.isFinite(cameraError)&&Number.isFinite(shadowError)&&cameraError>=0&&shadowError>=0&&Math.max(cameraError,shadowError)<=limit;
}

export function createFoliageDetail(root,fine){
 const coarse=coarseLeafGeometry(fine),batches=[];
 fine.computeBoundingSphere();
 const matrix=new THREE.Matrix4(),center=new THREE.Vector3();
 root.traverse(mesh=>{
  if(!mesh.isInstancedMesh||mesh.geometry!==fine)return;
  const sphere=new THREE.Sphere(),part=new THREE.Sphere();sphere.makeEmpty();
  let error=0,valid=true;
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);const scale=linearScaleBound(matrix);
   if(!Number.isFinite(scale)){valid=false;break;}
   part.center.copy(fine.boundingSphere.center).applyMatrix4(matrix);part.radius=fine.boundingSphere.radius*scale;sphere.union(part);
   const e=matrix.elements;error=Math.max(error,LEAF_DETAIL_ERROR*Math.hypot(e[8],e[9],e[10]));
  }
  let owner=mesh;while(owner!==root&&!owner.userData.anchorId)owner=owner.parent;
  batches.push({mesh,anchor:owner.userData.anchorId??mesh.name,sphere,error,valid,coarse:false,cameraError:Infinity,shadowError:Infinity});
 });
 let disposed=false;
 return {
  update(camera,viewportHeight,shadowPixelsPerWorldUnit){
   if(disposed)return;
   root.updateWorldMatrix(true,true);camera?.updateMatrixWorld();
   const valid=!!camera?.isPerspectiveCamera&&Number.isFinite(viewportHeight)&&viewportHeight>0&&Number.isFinite(shadowPixelsPerWorldUnit)&&shadowPixelsPerWorldUnit>=0;
   for(const b of batches){
    const scale=linearScaleBound(b.mesh.matrixWorld),error=b.error*scale;
    let cameraError=Infinity,shadowError=Infinity;
    if(valid&&b.valid&&Number.isFinite(scale)&&!b.sphere.isEmpty()){
     center.copy(b.sphere.center).applyMatrix4(b.mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
     cameraError=projectedDetailError({error,center:center.toArray(),radius:b.sphere.radius*scale,focalPixels:viewportHeight*Math.abs(camera.projectionMatrix.elements[5])*.5,near:camera.near});
     shadowError=error*shadowPixelsPerWorldUnit;
    }
    b.coarse=chooseCoarse(b.coarse,cameraError,shadowError);b.cameraError=cameraError;b.shadowError=shadowError;b.mesh.geometry=b.coarse?coarse:fine;
   }
  },
  snapshot(){return {batches:batches.length,coarseBatches:batches.filter(b=>b.coarse).length,triangleSavings:batches.reduce((n,b)=>n+(b.coarse?16*b.mesh.count:0),0),levels:batches.map(b=>({anchor:b.anchor,coarse:b.coarse,cameraError:Number.isFinite(b.cameraError)?b.cameraError:null,shadowError:Number.isFinite(b.shadowError)?b.shadowError:null}))};},
  dispose(){if(disposed)return;disposed=true;for(const b of batches)b.mesh.geometry=fine;coarse.dispose();if(!batches.length)fine.dispose();},
 };
}
