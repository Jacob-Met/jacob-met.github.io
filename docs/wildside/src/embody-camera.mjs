/** Camera placement for watching an animal from outside and for seeing as it. Pure maths, metres,
 * +Y up. Yaw/pitch use the navigator convention: yaw 0 looks along -Z, positive pitch looks up.
 * Wildside's simulations use a different yaw (0 faces +Z): see simYawToView / viewYawToSim. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const len=a=>Math.hypot(...a);
export const simYawToView=yaw=>Math.PI-yaw;
export const viewYawToSim=yaw=>Math.PI-yaw;
/** Unit direction a navigator-convention yaw/pitch looks along. */
export function lookDirection(yaw,pitch=0){return [Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];}
export function rightOf(yaw){return [Math.cos(yaw),0,Math.sin(yaw)];}

/** Pull a camera toward its target until nothing stands between them. `hit(from,to)` returns the
 * distance along from->to to the first obstruction, or null when the line is clear. */
export function clearOf(target,wanted,hit,margin=.06){
  const d=sub(wanted,target),dist=len(d);
  if(dist<1e-9||typeof hit!=='function')return wanted.slice();
  margin=Math.min(margin,dist*.08);
  const h=hit(target,wanted);
  if(h===null||h===undefined||h>=dist)return wanted.slice();
  const keep=Math.max(.0,h-margin);
  return add(target,mul(d,keep/dist));
}

/** Free orbit around a target: the third-person view of an animal that goes about its life. */
export function orbitPose({target,yaw,pitch,distance,minDistance=.4},hit){
  const p=clamp(pitch,-1.3,.25),dir=lookDirection(yaw,p);
  const wanted=sub(target,mul(dir,distance));
  // Never lose the animal behind something, and never sit inside it.
  let position=clearOf(target,wanted,hit);
  const d=len(sub(position,target));
  if(d<minDistance)position=sub(target,mul(dir,minDistance));
  return {position,target:target.slice(),up:[0,1,0]};
}

/** Close third person behind and a little above the animal, looking where it looks. */
export function shoulderPose({body,yaw,pitch,back,height,side=0},hit){
  const fwd=lookDirection(yaw,0),aim=lookDirection(yaw,pitch);
  const anchor=add(body,[0,height*.4,0]);
  const wanted=add(add(sub(body,mul(fwd,back)),[0,height,0]),mul(rightOf(yaw),side));
  const position=clearOf(anchor,wanted,hit);
  const target=add(add(body,[0,height*.3,0]),mul(aim,back*2.2));
  return {position,target,up:[0,1,0]};
}

/** The animal's own eyes: just ahead of the body centre, looking along its gaze. */
export function eyesPose({body,yaw,pitch,ahead,height,bob=0}){
  const aim=lookDirection(yaw,pitch);
  const position=add(add(body,mul(lookDirection(yaw,0),ahead)),[0,height+bob,0]);
  return {position,target:add(position,aim),up:[0,1,0]};
}

