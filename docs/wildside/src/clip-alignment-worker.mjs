import '../vendor/opencv.cjs';
import {GroundPatchTracker} from './clip-alignment-core.mjs';
let tracker;
self.addEventListener('message',async event=>{
  const {id,type,frame,corners}=event.data??{};
  try{
    const cv=await globalThis.cv;
    if(!cv?.Mat)throw Error('The local tracking library did not initialize.');
    let result;
    if(type==='start'){tracker?.dispose();tracker=new GroundPatchTracker(cv,frame,corners);result={ok:true};}
    else if(type==='step'&&tracker)result=tracker.advance(frame);
    else throw Error('Start from a reviewed ground reference first.');
    self.postMessage({id,result});
  }catch(error){tracker?.dispose();tracker=null;self.postMessage({id,error:typeof error?.message==='string'?error.message:'This ground patch could not be tracked. Mark the corners yourself.'});}
});
