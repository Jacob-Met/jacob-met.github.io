/**
 * A stable observation offset for the same simulated resident. Geometry and
 * viewpoint admission stay with the maintained world/navigator; this controller
 * never teleports across an obstruction or changes the animal's simulation.
 */
const vec=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const profiles={bird:{minimum:.65,maximum:4.2},insect:{minimum:.035,maximum:.35}};
export function residentView(position,target,mode='bird'){
 if(!vec(position)||!vec(target))return null;
 const profile=Object.hasOwn(profiles,mode)?profiles[mode]:null;if(!profile)return null;
 const d=target.map((v,i)=>v-position[i]),length=Math.hypot(...d);
 if(length<profile.minimum||length>profile.maximum)return null;
 const pitch=Math.asin(d[1]/length);
 if(Math.abs(pitch)>1.35)return null;
 return {mode,position:position.slice(),yaw:Math.atan2(d[0],-d[2]),pitch};
}
export function createResidentFocus(position,target,mode='bird'){
 if(!residentView(position,target,mode))throw new TypeError('Invalid resident focus');
 const offset=position.map((v,i)=>v-target[i]);
 let eye=position.slice(),active=true,status='following';
 const snapshot=()=>({active,status,position:eye.slice(),offset:offset.slice()});
 return {
  snapshot,
  stop(){active=false;status='released';return snapshot();},
  step(target,{admit,visible,clear}){
   if(!active)return {ok:false,reason:'released'};
   if(!vec(target)){active=false;status='unplaced';return {ok:false,reason:status};}
   const desired=target.map((v,i)=>v+offset[i]);
   const accept=position=>{
    const pose=residentView(position,target,mode);
    if(!pose||!clear(eye,position)||!visible(position,target)||!admit(pose))return null;
    return pose;
   };
   let pose=accept(desired);
   if(pose){eye=pose.position.slice();status='following';return {ok:true,status,pose};}
   // Keep a clear safe viewpoint briefly when translation is blocked. Re-aiming
   // does not move through geometry; distance limits prevent near-plane clipping.
   pose=accept(eye);
   if(pose){status='holding';return {ok:true,status,pose};}
   active=false;status='obscured';return {ok:false,reason:status};
  }
 };
}

