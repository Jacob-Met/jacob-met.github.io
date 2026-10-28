/** The Engine's simulated residents as animals you can watch and become: squirrel, rabbit, songbird,
 * butterfly and gull. Their behaviour runs inside the Engine (hamon_sculpt::residents, in wasm); the
 * view exposes their live poses and lets one of them be steered (hamon-view.mjs: residentPoses,
 * possessResident, driveResident). While you are inside one it moves by your input with its own gait,
 * flight, skin and keep-out rules; when you leave, it carries on where it is. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/** Engine heading (0 faces +X, positive turns left) -> simulation yaw (0 faces +Z) -> view yaw (0 faces -Z). */
const simYawOf=e=>e+Math.PI/2;
const viewYawOf=e=>Math.PI/2-e;
// A replacement acquires native control before the previous driver is disposed.
const residentDriverOwners=new WeakMap();

function engineDriver({hamon,index}){
  let headYaw=0,headPitch=0,pose=hamon.residentPoses()[index],last=pose?.pos?.slice();
  const read=()=>hamon.residentPoses()[index]??pose;
  const owner={};residentDriverOwners.set(hamon,owner);
  return {
    look(dx,dy){headYaw=clamp(headYaw+dx,-2.2,2.2);headPitch=clamp(headPitch+dy,-1.2,1.2);},
    step(input,dt){
      hamon.driveResident(index,{forward:input.forward,turn:-input.right,up:input.up,run:!!input.run,act:!!input.act});
      pose=read();if(!pose)return {ground:0,air:0};
      const moved=last?Math.hypot(pose.pos[0]-last[0],pose.pos[1]-last[1],pose.pos[2]-last[2]):0;last=pose.pos.slice();
      headYaw*=Math.exp(-dt*(Math.abs(input.forward)+Math.abs(input.right)>0?2.2:.3));
      return pose.airborne?{ground:0,air:moved}:{ground:moved,air:0};
    },
    body:()=>null,
    gaze(){
      const p=read()??pose;
      return {body:p.pos.slice(),yaw:viewYawOf(p.yaw)+headYaw,pitch:clamp(headPitch,-1.2,1.2),bob:0};
    },
    dispose(){
      if(residentDriverOwners.get(hamon)!==owner)return;
      residentDriverOwners.delete(hamon);hamon.possessResident(-1);
    },
  };
}

const spec=(id,label,name,kind,camera,controls)=>({
  id,name,article:`the ${name.toLowerCase()}`,kind,camera,controls,
  locate({hamon}){
    const poses=hamon?.residentPoses?.()??[];const i=poses.findIndex(p=>p.kind===label);if(i<0)return null;
    const p=poses[i];return {position:p.pos.slice(),yaw:simYawOf(p.yaw),activity:p.activity,state:p.airborne?'flight':'ground',index:i};
  },
  blocked:({hamon})=>hamon?.canSteerResidents?null:'This build of the Engine cannot steer residents yet.',
  canBecome:true,
  become({hamon},found){
    if(!hamon?.canSteerResidents||!hamon.possessResident(found.index))return null;
    return engineDriver({hamon,index:found.index});
  },
});

export const ENGINE_RESIDENT_CREATURES=[
  spec('squirrel','squirrel','Squirrel','mammal',
   {outside:{distance:.95,min:.35,max:6,pitch:.22,height:.1,near:.03},shoulder:{back:.5,height:.22,side:.06,fov:62,near:.02},eyes:{ahead:.25,height:.12,fov:92,near:.008}},
   'W / S run · A / D turn · Shift bound · F climb your tree · drag to look · V change view · Esc leave'),
  spec('rabbit','rabbit','Rabbit','mammal',
   {outside:{distance:1.2,min:.4,max:6,pitch:.22,height:.14,near:.03},shoulder:{back:.6,height:.28,side:.06,fov:62,near:.02},eyes:{ahead:.4,height:.19,fov:100,near:.008}},
   'W / S hop · A / D turn · Shift bolt · drag to look · V change view · Esc leave'),
  spec('songbird','songbird','Songbird','bird',
   {outside:{distance:.85,min:.35,max:6,pitch:.18,height:.06,near:.02},shoulder:{back:.45,height:.16,side:.04,fov:62,near:.015},eyes:{ahead:.07,height:.05,fov:100,near:.006}},
   'W fly · A / D turn · Space rise · Q sink · F land · drag to look · V change view · Esc leave'),
  spec('butterfly','butterfly','Butterfly','insect',
   {outside:{distance:.5,min:.2,max:3,pitch:.2,height:.02,near:.01},shoulder:{back:.25,height:.08,side:.02,fov:62,near:.008},eyes:{ahead:.03,height:.012,fov:104,near:.003}},
   'W flutter · A / D turn · Space rise · Q sink · drag to look · V change view · Esc leave'),
  spec('gull','gull','Gull','bird',
   {outside:{distance:1.8,min:.7,max:10,pitch:.18,height:.12,near:.04},shoulder:{back:.9,height:.3,side:.08,fov:62,near:.03},eyes:{ahead:.3,height:.1,fov:100,near:.012}},
   'W fly · A / D turn · Space rise · Q sink · F land · drag to look · V change view · Esc leave'),
];
