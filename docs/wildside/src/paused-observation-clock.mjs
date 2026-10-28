/** Low-frequency attention accounting, separate from simulation and rendering.
 * `enabled` owns paused/outside/visible state; `target` is a stable attention
 * identity, or null while a panel/preview obscures the animal. */
export function createPausedObservationClock({
 enabled,target,observe,now=()=>performance.now(),
 setTimer=(fn,delay)=>setTimeout(fn,delay),clearTimer=id=>clearTimeout(id),
 intervalMs=250,maxGapMs=1000,
}={}){
 if(![enabled,target,observe,now,setTimer,clearTimer].every(f=>typeof f==='function')||
    !Number.isFinite(intervalMs)||intervalMs<=0||!Number.isFinite(maxGapMs)||
    maxGapMs<intervalMs||maxGapMs>1000)throw new TypeError('Invalid observation clock');
 let pending=null,running=false,disposed=false,epoch=0,identity=null,previous=null;
 function clear(){
  epoch++;if(pending!==null)clearTimer(pending);
  pending=null;running=false;identity=null;previous=null;
 }
 function align(stamp){
  const next=target()??null;
  if(next===null||next!==identity){identity=next;previous=next===null?null:stamp;}
  return next;
 }
 function schedule(){
  if(disposed||!running||pending!==null)return;
  const version=epoch;pending=setTimer(()=>tick(version),intervalMs);
 }
 function tick(version){
  if(disposed||version!==epoch||!running)return;
  pending=null;
  if(!enabled()){clear();return;}
  const stamp=now(),before=identity,anchor=previous,current=align(stamp);
  previous=current===null?null:stamp;
  try{
   if(current!==null&&current===before&&anchor!==null){
    const elapsed=stamp-anchor;
    if(Number.isFinite(elapsed)&&elapsed>0&&elapsed<=maxGapMs)observe(elapsed/1000,current);
   }
  }finally{if(version===epoch)schedule();}
 }
 return {
  // Repeated input invalidations do not reset an unchanged attention interval.
  sync(){
   if(disposed)return;
   if(!enabled()){clear();return;}
   running=true;align(now());schedule();
  },
  // Lifecycle callers explicitly sync again after returning to the page.
  reset(){if(!disposed)clear();},
  dispose(){if(disposed)return;clear();disposed=true;},
 };
}
