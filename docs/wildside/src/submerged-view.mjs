const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(x)=>Number.isFinite(x)?x:0;
export const WATER_VIEW=Object.freeze({radius:.0009,speed:.018,near:.00015,fov:48});
/** Inspection controller in the same coordinates; saved intent is owned by visits/session. */
export function createSubmergedView(column){
 let position=null,waterId=null,yaw=0,pitch=0;
 const pose=()=>position?{mode:'underwater',position:position.slice(),yaw,pitch,waterId,forward:[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)],up:[0,1,0],near:WATER_VIEW.near,fov:WATER_VIEW.fov,transitioning:false}:null;
 return {pose,
  focus(swimmer){
   if(!swimmer)return false;
   for(const radius of [.013,.009,.020])for(const turn of [.8,-.8,1.8,-1.8,Math.PI]){
    const angle=swimmer.yaw+turn,target=swimmer.position,p=[target[0]+Math.sin(angle)*radius,target[1]+.001,target[2]+Math.cos(angle)*radius];
    if(!column.at(p,WATER_VIEW.radius,swimmer.waterId)||!column.travel(p,target,WATER_VIEW.radius,swimmer.waterId))continue;
    const d=target.map((v,i)=>v-p[i]),length=Math.hypot(...d);position=p;waterId=swimmer.waterId;yaw=Math.atan2(d[0],-d[2]);pitch=Math.asin(d[1]/length);return true;
   }
   return false;
  },
  look(dx,dy){yaw+=finite(dx);pitch=clamp(pitch+finite(dy),-1.35,1.35);return pose();},
  restore(saved){
   if(saved?.mode!=='underwater'||!Array.isArray(saved.position)||saved.position.length!==3||!saved.position.every(Number.isFinite)||![saved.yaw,saved.pitch].every(Number.isFinite)||Math.abs(saved.pitch)>1.35||typeof saved.waterId!=='string'||!saved.waterId)
    throw new TypeError('Invalid underwater viewpoint');
   // Require the same surviving water volume; never find a substitute or clamp
   // an unavailable memory onto a different surface. Refusal preserves this view.
   if(!column.at(saved.position,WATER_VIEW.radius,saved.waterId))return {ok:false,reason:'water-viewpoint-unavailable'};
   position=saved.position.slice();waterId=saved.waterId;yaw=saved.yaw;pitch=saved.pitch;
   return {ok:true,pose:pose(),adjusted:false};
  },
  step(input={},dt=1/60){
   if(!position)return null;dt=clamp(finite(dt),0,.1);
   const f=clamp(finite(input.forward),-1,1),r=clamp(finite(input.right),-1,1),u=clamp(finite(input.up),-1,1);
   let d=[Math.sin(yaw)*f+Math.cos(yaw)*r,u,-Math.cos(yaw)*f+Math.sin(yaw)*r],length=Math.hypot(...d);if(length>1)d=d.map(x=>x/length);
   const target=position.map((v,i)=>v+d[i]*WATER_VIEW.speed*dt);
   if(column.travel(position,target,WATER_VIEW.radius,waterId))position=target;
   else for(const axis of [0,2,1]){const p=position.slice();p[axis]=target[axis];if(column.travel(position,p,WATER_VIEW.radius,waterId))position=p;}
   return pose();
  },
  setColumn(next){column=next;if(position&&!column.at(position,WATER_VIEW.radius,waterId)){position=null;waterId=null;return false;}return true;},
  clear(){position=null;waterId=null;}
 };
}
