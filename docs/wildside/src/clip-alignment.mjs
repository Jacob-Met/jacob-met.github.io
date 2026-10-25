import {captureClipFrame,validateClipMoment} from './clip-frame.mjs';

export const GROUND_CARRY_SECONDS=8;
/** Only a reviewed rectangle in the same exact clip can supply dimensions. */
export function groundReferences(place,sourceId,targetOffset) {
  if(!Number.isFinite(targetOffset)||place?.revokedSources?.includes(sourceId))return [];
  return (place?.observations??[]).flatMap(observation=>{
    const source=observation.source,points=observation.controlPoints;
    if(source?.kind!=='video'||source.id!==sourceId||!Number.isFinite(source.offsetSeconds)||source.offsetSeconds<0||!Array.isArray(points)||points.length!==4)return [];
    const gap=Math.abs(source.offsetSeconds-targetOffset);
    if(gap<.05||gap>GROUND_CARRY_SECONDS)return [];
    const width=points[1]?.ground?.[0],depth=points[2]?.ground?.[1];
    if(!(width>0&&width<=1000&&depth>0&&depth<=1000))return [];
    const expected=[[0,0],[width,0],[width,depth],[0,depth]];
    if(!points.every((p,i)=>Array.isArray(p.image)&&p.image.length===2&&p.image.every(v=>Number.isFinite(v)&&v>=0&&v<=1)&&Array.isArray(p.ground)&&p.ground.length===2&&p.ground.every((v,j)=>v===expected[i][j])))return [];
    return [{id:observation.id,sourceId,offsetSeconds:source.offsetSeconds,corners:points.map(p=>[...p.image]),width,depth,verticalFovDegrees:observation.cameraAssumption?.verticalFovDegrees}];
  }).sort((a,b)=>Math.abs(a.offsetSeconds-targetOffset)-Math.abs(b.offsetSeconds-targetOffset)||a.id.localeCompare(b.id));
}

export function groundFrameTimes(referenceOffset,targetOffset) {
  const gap=targetOffset-referenceOffset;
  if(!Number.isFinite(referenceOffset)||!Number.isFinite(targetOffset)||referenceOffset<0||targetOffset<0||Math.abs(gap)<.05||Math.abs(gap)>GROUND_CARRY_SECONDS)
    throw Error('Choose a different clip moment within eight seconds of the reviewed ground reference.');
  const steps=Math.min(40,Math.ceil(Math.abs(gap)/.2));
  return Array.from({length:steps},(_,i)=>referenceOffset+gap*(i+1)/steps);
}

const refusalMessages={
  'too-few-consistent-tracks':'Too few ground details stayed visible.',
  'too-many-original-details-lost':'Too many details from the reviewed patch disappeared.',
  'conflicting-patch-motion':'The patch does not move as one surface.',
  'held-out-tracks-disagree':'Other visible details disagree with the proposed patch.',
  'patch-support-too-concentrated':'The remaining details do not support all four corners.',
  'ground-corners-leave-view':'Some ground corners leave the frame.',
  'ground-patch-motion-too-large':'The ground patch moves or changes size too far.',
};
function raster(image) {
  const w=image.naturalWidth??image.width,h=image.naturalHeight??image.height,scale=Math.min(1,640/Math.max(w,h));
  const canvas=image.ownerDocument.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  try{const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error('This browser cannot read the selected clip frame.');context.drawImage(image,0,0,canvas.width,canvas.height);return context.getImageData(0,0,canvas.width,canvas.height);}finally{canvas.width=0;canvas.height=0;}
}

/** Decode bounded intermediate frames; keep selected pixels and draft untouched.
 * The local worker is created only on request and terminated on every exit. */
export async function carryGroundReference(video,{reference,sourceId,targetImage,targetOffset,signal,onProgress=()=>{},timeoutMs=20000}) {
  if(reference?.sourceId!==sourceId)throw Error('Reopen the exact clip that supplied this ground reference.');
  validateClipMoment(reference.offsetSeconds,video.duration);validateClipMoment(targetOffset,video.duration);
  const times=groundFrameTimes(reference.offsetSeconds,targetOffset);
  if(!Number.isFinite(timeoutMs)||timeoutMs<100||timeoutMs>20000)throw Error('Ground tracking needs a time budget of at most twenty seconds.');
  const controller=new AbortController(),deadline=performance.now()+timeoutMs;
  const cancelled=()=>controller.abort(signal?.reason??new DOMException('Ground tracking cancelled.','AbortError'));
  const timer=setTimeout(()=>controller.abort(new DOMException('Ground tracking reached its time limit. Choose a closer moment or mark the corners yourself.','TimeoutError')),timeoutMs);
  signal?.addEventListener('abort',cancelled,{once:true});if(signal?.aborted)cancelled();
  let worker,sequence=0;
  function request(type,frame,corners) {
    if(controller.signal.aborted)return Promise.reject(controller.signal.reason);
    return new Promise((resolve,reject)=>{
      const id=++sequence;
      const cleanup=()=>{worker.removeEventListener('message',message);worker.removeEventListener('error',failed);worker.removeEventListener('messageerror',failed);controller.signal.removeEventListener('abort',aborted);};
      const finish=(error,result)=>{cleanup();error?reject(error):resolve(result);};
      const message=event=>{if(event.data?.id===id)event.data.error?finish(Error(event.data.error)):finish(null,event.data.result);};
      const failed=()=>finish(Error('Local ground tracking could not start. You can still mark the corners yourself.'));
      const aborted=()=>finish(controller.signal.reason);
      worker.addEventListener('message',message);worker.addEventListener('error',failed);worker.addEventListener('messageerror',failed);controller.signal.addEventListener('abort',aborted,{once:true});
      try{worker.postMessage({id,type,frame:{width:frame.width,height:frame.height,data:frame.data},corners},[frame.data.buffer]);}catch(error){finish(error);}
    });
  }
  async function decode(seconds) {
    if(controller.signal.aborted)throw controller.signal.reason;
    const decoded=await captureClipFrame(video,seconds,{signal:controller.signal,maxDimension:640,timeoutMs:Math.max(1,Math.min(15000,deadline-performance.now()))});
    try{return raster(decoded.image);}finally{decoded.image.width=0;decoded.image.height=0;}
  }
  try {
    if(controller.signal.aborted)throw controller.signal.reason;
    worker=new Worker(new URL('./clip-alignment-worker.mjs',import.meta.url),{type:'module',name:'wildside-ground-patch'});
    await request('start',await decode(reference.offsetSeconds),reference.corners);
    onProgress(0,times.length);let result;
    for(let i=0;i<times.length;i++) {
      // The final fit uses the already selected, frozen frame, not another seek.
      const image=i===times.length-1?raster(targetImage):await decode(times[i]);
      result=await request('step',image);
      if(!result.ok)throw Error((refusalMessages[result.reason]??'This patch has no reliable image correspondence.')+' Choose a closer frame or mark its corners yourself.');
      onProgress(i+1,times.length);
    }
    return {...result,sourceId,referenceId:reference.id,referenceOffset:reference.offsetSeconds,targetOffset,width:reference.width,depth:reference.depth,verticalFovDegrees:reference.verticalFovDegrees};
  } catch(error) {throw controller.signal.aborted?controller.signal.reason:error;}
  finally {clearTimeout(timer);signal?.removeEventListener('abort',cancelled);worker?.terminate();}
}
