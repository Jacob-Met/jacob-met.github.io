import {fitGroundPlane, projectGroundPoint} from './place.mjs';

// Reconstruct one *conditional* perspective view from calibrated ground correspondences.
// Camera intrinsics are explicitly assumed, not read from EXIF or inferred from a photo.
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const length=a=>Math.hypot(...a);
const unit=a=>a.map(v=>v/length(a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const finiteVector=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(v=>Number.isFinite(v)&&Math.abs(v)<1e6);
const fail=message=>{throw new Error(message);};

import {validateCameraAssumption} from './camera-params.mjs';
export {validateCameraAssumption} from './camera-params.mjs';

/** Ground pairs must be source-normalized (u,v) and metric world (x,z).
 * Returns world-space position/directions usable by a perspective camera.
 * Residuals are image-height fractions; they measure fit, NOT 3D accuracy.
 */
export function recoverSourceCamera(controlPoints, input, {maxRms=.025,maxError=.055}={}) {
 const assumed=validateCameraAssumption(input);
 if(!Array.isArray(controlPoints)||controlPoints.length<4||controlPoints.length>64||
    !controlPoints.every(p=>finiteVector(p?.image,2)&&finiteVector(p?.ground,2)))
   fail('Camera needs 4–64 bounded planar ground correspondences');
 if(!(Number.isFinite(maxRms)&&maxRms>0&&Number.isFinite(maxError)&&maxError>0))
   fail('Invalid reprojection acceptance limits');
 // Re-use the maintained homography solver, transposed into world-to-image space.
 const h=fitGroundPlane(controlPoints.map(p=>({image:p.ground,ground:p.image}))).matrix;
 const fy=1/(2*Math.tan(assumed.verticalFovDegrees*Math.PI/360));
 const fx=fy/assumed.imageAspect;
 const invK=column=>[(column[0]-.5*column[2])/fx,(column[1]-.5*column[2])/fy,column[2]];
 const a=invK([h[0],h[3],h[6]]),b=invK([h[1],h[4],h[7]]),c=invK([h[2],h[5],h[8]]);
 const na=length(a),nb=length(b);
 if(!(na>1e-10&&nb>1e-10))fail('Camera pose is degenerate');
 const parity=Math.abs(na-nb)/Math.max(na,nb);
 const orthogonality=Math.abs(dot(a,b)/(na*nb));
 const x=unit(a);
 const perpendicular=sub(b,scale(x,dot(b,x)));
 if(length(perpendicular)<1e-8)fail('Camera axes are degenerate');
 const z=unit(perpendicular),y=unit(cross(z,x));
 // Homographies have a global sign ambiguity; all supplied planar points
 // must be in front of the reconstructed camera.
 const sampleDepth=controlPoints.reduce((s,p)=>s+x[2]*p.ground[0]+z[2]*p.ground[1],0)/controlPoints.length;
 const signedC=scale(c,2/(na+nb));
 const sign=sampleDepth+signedC[2]>=0?1:-1;
 const rx=scale(x,sign),rz=scale(z,sign),ry=y,t=scale(signedC,sign);
 const position=[-dot(rx,t),-dot(ry,t),-dot(rz,t)];
 const right=[rx[0],ry[0],rz[0]],up=[-rx[1],-ry[1],-rz[1]],forward=[rx[2],ry[2],rz[2]];
 let sum=0,peak=0,allAhead=true;
 for(const p of controlPoints) {
   const [wx,wz]=p.ground;
   const pc=[rx[0]*wx+rz[0]*wz+t[0],rx[1]*wx+rz[1]*wz+t[1],rx[2]*wx+rz[2]*wz+t[2]];
   if(!(pc[2]>1e-7)){allAhead=false;continue;}
   const u=.5+fx*pc[0]/pc[2],v=.5+fy*pc[1]/pc[2];
   const error=Math.hypot((u-p.image[0])*assumed.imageAspect,v-p.image[1]);
   sum+=error*error;peak=Math.max(peak,error);
 }
 const rms=allAhead?Math.sqrt(sum/controlPoints.length):Infinity;
 // Large orthogonality/scale errors mean an assumed focal length cannot
 // explain the homography. A low fitted planar error alone is insufficient.
 const qualified=allAhead&&position.every(Number.isFinite)&&position[1]>.05&&
   parity<=.15&&orthogonality<=.15&&rms<=maxRms&&peak<=maxError;
 return {qualified,position,right,up,forward,verticalFovDegrees:assumed.verticalFovDegrees,
   imageAspect:assumed.imageAspect,rmsImageHeightFraction:rms,maxImageHeightFraction:peak,
   axisLengthMismatch:parity,axisOrthogonalityError:orthogonality,
   controlCount:controlPoints.length,
   status:qualified?'conditional-source-view':'unqualified-camera-fit',
   provenance:'declared-camera-intrinsics-plus-human-ground-correspondences'};
}

/** Independent reprojection helper for known-camera and withheld-point controls. */
export function projectSourceWorld(camera, worldPoint) {
 if(!finiteVector(worldPoint,3)||!finiteVector(camera?.position,3)||
    !finiteVector(camera?.right,3)||!finiteVector(camera?.up,3)||!finiteVector(camera?.forward,3))
   fail('Invalid camera projection');
 const relative=sub(worldPoint,camera.position),depth=dot(relative,camera.forward);
 if(depth<=1e-7)fail('Point is behind the source camera');
 const fy=1/(2*Math.tan(camera.verticalFovDegrees*Math.PI/360)),fx=fy/camera.imageAspect;
 return [.5+fx*dot(relative,camera.right)/depth,.5-fy*dot(relative,camera.up)/depth];
}
