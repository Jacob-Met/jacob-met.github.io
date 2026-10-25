/** One full-quality frame when a paused world changes; continuous frames while active.
 * The owner supplies state predicates. No simulation or rendering policy lives here. */
export function createFrameLoop({
  draw, continuous=()=>false, hidden=()=>false,
  requestFrame=globalThis.requestAnimationFrame?.bind(globalThis),
  cancelFrame=globalThis.cancelAnimationFrame?.bind(globalThis),
  maxDelta=.05,
}={}) {
  if (![draw,continuous,hidden,requestFrame,cancelFrame].every(f=>typeof f==='function') ||
      !Number.isFinite(maxDelta) || maxDelta<=0) throw new TypeError('Invalid frame loop');
  let pending=null, previous=null, drawing=false, dirty=false, disposed=false, epoch=0;
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
    const dt=previous===null?0:Math.max(0,Math.min(maxDelta,(timestamp-previous)/1000));
    previous=previous===null?timestamp:Math.max(previous,timestamp);
    dirty=false; drawing=true;
    try { draw(dt,timestamp); } finally { drawing=false; }
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
