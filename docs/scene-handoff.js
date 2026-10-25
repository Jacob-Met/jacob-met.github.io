/* Keep the last valid scene until the requested still is ready. No rendering/network. */
function createSceneHandoff(options) {
  'use strict';
  const {prepare,commit}=options;
  let revision=0,disposed=false;
  function warm(id) {
    if(disposed)return;
    try {const value=prepare(id);if(value&&typeof value.then==='function')value.catch(()=>{});}catch{}
  }
  function arrive(id) {
    if(disposed)return;
    const token=++revision;
    const ready=frame=>{if(!disposed&&token===revision&&frame)commit(frame,id);};
    try {const value=prepare(id);if(value&&typeof value.then==='function')value.then(ready,()=>{});else ready(value);}catch{}
  }
  function invalidate(){revision++;}
  function destroy(){disposed=true;revision++;}
  return {warm,arrive,invalidate,destroy};
}
