import {createNavigator,MODES} from './visits.mjs';

/** Following is ordinary supported insect travel, checked on a separate probe.
 * It never moves the actual visitor until the whole requested segment succeeds.
 */
export function createCrawlerFocusRules(world,{visible=()=>true,clearSight=()=>true}={}){
 const probe=createNavigator(world,{mode:'insect'}),speed=MODES.insect.speed;
 return {
  visible,
  admit(pose){if(pose.mode!=='insect')return false;const r=probe.restore(pose);return r.ok&&!r.adjusted;},
  clear(a,b){
   const delta=b.map((v,i)=>v-a[i]),length=Math.hypot(...delta);
   if(length<1e-9)return true;
   const steps=Math.ceil(length/(speed*.1));if(steps>128||!clearSight(a,b))return false;
   const start=probe.restore({mode:'insect',position:a,yaw:Math.atan2(delta[0],-delta[2]),pitch:0});
   if(!start.ok||start.adjusted)return false;
   for(let i=0;i<steps;i++)probe.step({forward:1},length/(speed*steps));
   return Math.hypot(...probe.pose().position.map((v,i)=>v-b[i]))<1e-6;
  }
 };
}
