/** One full-quality frame when a paused world changes; continuous frames while active.
 * The owner supplies state predicates. No simulation or rendering policy lives here. */
export function createFrameLoop({
  draw, continuous=()=>false, hidden=()=>false,
  requestFrame=globalThis.requestAnimationFrame?.bind(globalThis),
  cancelFrame=globalThis.cancelAnimationFrame?.bind(globalThis),
  maxDelta=.05, advance=null, maxCatchUpSteps=3,
  minInterval=()=>0,
}={}) {
  if (![draw,continuous,hidden,requestFrame,cancelFrame,minInterval].every(f=>typeof f==='function') ||
      !Number.isFinite(maxDelta) || maxDelta<=0 ||
      (advance!==null&&typeof advance!=='function') ||
      !Number.isInteger(maxCatchUpSteps) || maxCatchUpSteps<1 || maxCatchUpSteps>8)
    throw new TypeError('Invalid frame loop');
  let pending=null, previous=null, lastDraw=-Infinity, drawing=false, dirty=false, disposed=false, epoch=0;
  function cancelPending() {
    if(pending!==null) cancelFrame(pending);
    pending=null; epoch++; previous=null;
  }
  function schedule() {
    if(disposed || hidden() || pending!==null) return;
    const version=++epoch;
    pending=requestFrame(timestamp=>frame(timestamp,version));
  }
  function frame(timestamp,version) {
    if(disposed || version!==epoch) return;
    pending=null;
    if(hidden()) { previous=null; return; }
    // optional frame-rate cap (phones draw at 30): wait for a later display refresh instead of drawing early;
    // `previous` is untouched, so simulation time keeps accumulating and motion speed is unchanged
    const gap=minInterval();
    if(gap>0 && timestamp-lastDraw < gap-2) { schedule(); return; }
    lastDraw=timestamp;
    const elapsed=previous===null?0:Math.max(0,(timestamp-previous)/1000);
    // Separate simulation from presentation only for explicitly opted-in consumers.
    // A long visible stall has a finite catch-up budget, never an unbounded loop.
    const dt=Math.min(elapsed,maxDelta*(advance?maxCatchUpSteps:1));
    previous=previous===null?timestamp:Math.max(previous,timestamp);
    dirty=false; drawing=true;
    try {
      if(advance) {
        if(dt===0) advance(0,timestamp);
        else {
          const steps=Math.min(maxCatchUpSteps,Math.ceil(dt/maxDelta));
          for(let i=0;i<steps;i++) advance(Math.min(maxDelta,Math.max(0,dt-i*maxDelta)),timestamp);
        }
      }
      draw(dt,timestamp);
    } finally { drawing=false; }
    if(disposed || hidden()) { previous=null; return; }
    if(dirty || continuous()) schedule();
    else previous=null; // Idle wall time is not simulation or held-input time.
  }
  function invalidate() {
    if(disposed) return;
    dirty=true;
    if(!drawing) schedule();
  }
  return {
    invalidate,
    visibilityChanged() {
      if(disposed) return;
      if(hidden()) { cancelPending(); dirty=false; }
      else invalidate();
    },
    dispose() { disposed=true; dirty=false; cancelPending(); },
  };
}
