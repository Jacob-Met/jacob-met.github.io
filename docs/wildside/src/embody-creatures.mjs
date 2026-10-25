/** The animals you can watch and become. Each adapter finds the simulated individual (so it can be
 * watched from outside, wherever its own life has taken it) and, where it can be inhabited, builds a
 * driver: the animal moved by your input with species-appropriate controls. Wildside's simulations
 * stay authoritative for the autonomous animal; a driver only replaces its body while you are inside.
 *
 * ctx = {sim, nav}; adapters never touch the DOM. */
import {simYawToView,viewYawToSim} from './embody-camera.mjs';
import {RESIDENT_CREATURES} from './embody-residents.mjs';
import {ENGINE_RESIDENT_CREATURES} from './embody-engine-residents.mjs';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

/** Robin: hops on the ground and flies, using the navigator's bird body for collision. */
const ROBIN={
  bodyHeight:.16,        // body centre above its feet
  hopSpeed:.32,          // fraction of flight speed while grounded: about a metre per second
  turnRate:2.6,          // radians per second on A / D
  hopRate:6.5,           // hops per second at a steady pace
  hopHeight:.045,
  eyeAhead:.2, eyeHeight:.09,
};
function robinDriver(ctx,start){
  const {nav}=ctx;
  const result=nav.restore({mode:'bird',position:start.position.slice(),yaw:simYawToView(start.yaw),pitch:-.05});
  if(!result.ok)return null;
  const heightAbove=pose=>pose.position[1]-pose.eye-(ctx.groundAt?ctx.groundAt(pose.position[0],pose.position[2]):0);
  // In the air only when the wild robin was mid-flight. Perched on a branch or standing, it stands.
  let phase=0,speed=0,flying=!!start.flying,sinceLift=1;
  return {
    id:'robin',
    look(dx,dy){nav.look(dx,dy);},
    step(input,dt){
      const before=nav.pose(),above0=heightAbove(before);
      const lift=input.up>0?1:input.up<0?-1:0,wants=Math.abs(input.forward)>.01;
      // Taking off is a deliberate spring from the ground. From a perch, any push launches the bird.
      if(!flying&&(lift>0||(above0>.06&&(wants||lift!==0)))){flying=true;sinceLift=above0>.06?1:0;}
      sinceLift+=dt;
      const turn=clamp(input.right,-1,1)*ROBIN.turnRate*dt;
      if(turn)nav.look(turn,0);
      const forward=clamp(input.forward,-1,1)*(flying?1:ROBIN.hopSpeed);
      const up=flying?(sinceLift<.35?1:lift):0;
      nav.step({forward,right:0,up},dt);
      const after=nav.pose(),above=heightAbove(after);
      const moved=Math.hypot(after.position[0]-before.position[0],after.position[1]-before.position[1],after.position[2]-before.position[2]);
      // Back on the earth the bird stands: the navigator holds it a body-height above the ground.
      if(flying&&sinceLift>.5&&above<=.02&&lift<=0)flying=false;
      speed=moved/Math.max(dt,1e-6);
      if(!flying&&moved>1e-5)phase+=dt*ROBIN.hopRate*Math.PI;
      else if(flying)phase+=dt*Math.PI*13;
      else phase*=Math.exp(-dt*8);
      return {ground:flying?0:moved,air:flying?moved:0};
    },
    /** Body for the Engine robin: simulation yaw (0 faces +Z) and a hop arc when moving on the ground. */
    body(){
      const pose=nav.pose(),hopping=!flying&&speed>.05;
      const hop=hopping?ROBIN.hopHeight*Math.abs(Math.sin(phase)):0;
      return {position:[pose.position[0],pose.position[1]+hop,pose.position[2]],yaw:viewYawToSim(pose.yaw),flying,hop};
    },
    /** Where the animal's eyes look from, in view yaw/pitch, for the camera module. */
    gaze(){const pose=nav.pose();return {body:pose.position.slice(),yaw:pose.yaw,pitch:pose.pitch,bob:!flying&&speed>.05?ROBIN.hopHeight*.6*Math.abs(Math.sin(phase)):0};},
    dispose(){},
  };
}

export const CREATURES=Object.freeze([
  {
    id:'robin',name:'Robin',article:'the robin',kind:'bird',
    camera:{
      outside:{distance:1.25,min:.45,max:5,pitch:.16,height:.07},
      shoulder:{back:.62,height:.2,side:.08,fov:62},
      eyes:{ahead:ROBIN.eyeAhead,height:ROBIN.eyeHeight,fov:84,near:.01},
    },
    controls:'W / S hop or fly · A / D turn · Space take off · Q land · drag to look · V change view · Esc leave',
    /** The wild individual. Null when it has no safe place yet. */
    locate({sim}){
      const b=sim?.snapshot().bird;
      if(!b||b.state==='unplaced')return null;
      return {position:b.position.slice(),yaw:b.yaw,activity:b.activity,state:b.state,grounded:b.state!=='flight'};
    },
    canBecome:true,
    become(ctx,found){return robinDriver(ctx,{position:found.position,yaw:found.yaw,flying:found.state==='flight'});},
  },
  ...RESIDENT_CREATURES,
  ...ENGINE_RESIDENT_CREATURES,
]);

export function creatureById(id){return CREATURES.find(c=>c.id===id)??null;}
