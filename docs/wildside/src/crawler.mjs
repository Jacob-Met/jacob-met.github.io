/** Simulated ground beetle; does not identify an observed animal or record activity. */
import {solveLeg} from './habitat.mjs';
import {circleIntersectsPolygon} from './boundary.mjs';
const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const length=a=>Math.hypot(...a),unit=a=>mul(a,1/(length(a)||1)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),smooth=t=>t*t*(3-2*t);
const finite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const clone=x=>JSON.parse(JSON.stringify(x));
export const CRAWLER_BODY=Object.freeze({length:.019,width:.010,height:.008,clearance:.006,legUpper:.006,legLower:.007,stride:.018,speed:.018});
const footOffsets=[[-.009,0,.006],[.009,0,.006],[-.010,0,0],[.010,0,0],[-.009,0,-.006],[.009,0,-.006]];
const tripod=[0,.5,.5,0,0,.5];
function admitWorld(w){
 if(!w||typeof w.surfaceAt!=='function')throw new TypeError('Crawler requires explicit supported surfaceAt(x,z), returning height or null');
 if(!w.bounds||!finite3(w.bounds.min)||!finite3(w.bounds.max)||!w.bounds.min.every((v,i)=>v<w.bounds.max[i]))throw new TypeError('Invalid crawler bounds');
 const obstacles=(w.obstacles??[]).map(o=>{if(!finite3(o.min)||!finite3(o.max)||!o.min.every((v,i)=>v<o.max[i]))throw new TypeError('Invalid crawler obstacle');return clone(o);}).filter(o=>!o.modes||o.modes.includes('insect'));
 return {surfaceAt:w.surfaceAt,bounds:clone(w.bounds),obstacles};
}
export function createCrawlerSimulation(input,{position,yaw=0,seed=1}={}){
 let world=admitWorld(input);if(!finite3(position)||!Number.isFinite(yaw))throw new TypeError('Crawler requires a finite starting position and yaw');
 let center=[...position],time=0,phase=0,state='walking',reason='exploring supported ground',heading=yaw,restUntil=0,turnSign=1,forcedTurnUntil=0,everPlaced=false;
 let randomState=seed>>>0||1;const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 let nextRest=8+random()*5,feet=[];
 const height=(x,z)=>{const y=world.surfaceAt(x,z);return typeof y==='number'&&Number.isFinite(y)?y:null;};
 function blocked(p){const r=.007;return world.obstacles.some(o=>p[0]+r>o.min[0]&&p[0]-r<o.max[0]&&p[2]+r>o.min[2]&&p[2]-r<o.max[2]&&p[1]+.004>o.min[1]&&p[1]-.006<o.max[1]&&(!o.polygonXZ||circleIntersectsPolygon([p[0],p[2]],r,o.polygonXZ)));}
 function valid(p,previousHeight=null){
  const y=height(p[0],p[2]);if(y===null)return false;const b=world.bounds,r=.014;
  if(p[0]-r<b.min[0]||p[0]+r>b.max[0]||p[2]-r<b.min[2]||p[2]+r>b.max[2]||blocked([p[0],y+CRAWLER_BODY.clearance,p[2]]))return false;
  if(previousHeight!==null&&Math.abs(y-previousHeight)>.0025)return false;
  for(const [dx,dz] of [[-.012,0],[.012,0],[0,-.012],[0,.012]]){const edge=height(p[0]+dx,p[2]+dz);if(edge===null||Math.abs(edge-y)>.004)return false;}
  return true;
 }
 function frame(){
  const y=height(center[0],center[2])??center[1]-CRAWLER_BODY.clearance;
  const hx=height(center[0]+.004,center[2]),hz=height(center[0],center[2]+.004);
  const normal=unit([hx===null?0:clamp((y-hx)/.004,-.7,.7),1,hz===null?0:clamp((y-hz)/.004,-.7,.7)]);
  const forward0=[Math.sin(heading),0,Math.cos(heading)],right=unit(cross(normal,forward0)),forward=unit(cross(right,normal));
  return {right,up:normal,forward};
 }
 const point=(p,basis=frame())=>add(center,add(mul(basis.right,p[0]),add(mul(basis.up,p[1]),mul(basis.forward,p[2]))));
 function target(index,lead=0){const o=[...footOffsets[index]];o[2]+=lead;const p=point(o);const y=height(p[0],p[2]);if(y===null)return null;p[1]=y+.0003;return p;}
 function plant(){feet=footOffsets.map((_,i)=>({toe:target(i,.004),planted:true,from:null}));if(feet.some(f=>!f.toe)){state='unplaced';reason='no supported foot contact';feet=feet.map(f=>({...f,toe:f.toe??[...center],planted:false}));}}
 if(valid(center)){center[1]=height(center[0],center[2])+CRAWLER_BODY.clearance;plant();everPlaced=state!=='unplaced';}else{state='unplaced';reason='no supported starting surface';feet=footOffsets.map(()=>({toe:[...center],planted:false,from:null}));}
 function updateFeet(deltaPhase){
  const old=phase;phase=(phase+deltaPhase)%1;
  for(let i=0;i<6;i++){
   const before=(old+tripod[i])%1,after=(phase+tripod[i])%1,wrapped=after<before,foot=feet[i],to=target(i,.004);
   if(!to){state='unplaced';reason='foot support removed';return;}
   if(foot.planted&&((before<.55&&after>=.55)||(wrapped&&after>=.55))){foot.planted=false;foot.from=[...foot.toe];}
   if(!foot.planted){if(wrapped&&after<.55){foot.toe=to;foot.planted=true;foot.from=null;}else{const t=clamp((after-.55)/.45,0,1),u=smooth(t);foot.toe=add(foot.from,mul(sub(to,foot.from),u));foot.toe[1]+=Math.sin(Math.PI*t)*.003;}}
  }
 }
 function tick(dt){
  time+=dt;if(state==='unplaced')return;
  if(!valid(center)){state='unplaced';reason='habitat no longer supports this body';for(const f of feet)f.planted=false;return;}
  if(state==='resting'){if(time<restUntil)return;state='walking';reason='exploring supported ground';nextRest=time+8+random()*5;}
  if(time>nextRest&&state==='walking'&&feet.every(f=>f.planted)){state='resting';reason='quiet pause';restUntil=time+1+random();return;}
  const y=height(center[0],center[2]),forward=[Math.sin(heading),0,Math.cos(heading)];
  const lookDistance=Math.max(state==='turning'?.06:.022,CRAWLER_BODY.speed*dt),candidate=add(center,mul(forward,CRAWLER_BODY.speed*dt));
  let aheadClear=true,previousHeight=y;const samples=Math.ceil(lookDistance/.004);for(let i=1;i<=samples;i++){const probe=add(center,mul(forward,lookDistance*i/samples));if(!valid(probe,previousHeight)){aheadClear=false;break;}previousHeight=height(probe[0],probe[2]);}
  if(time<forcedTurnUntil||!aheadClear||!valid(candidate,y)){
   if(state!=='turning'){turnSign=random()>.5?1:-1;state='turning';reason='avoiding an edge, solid or water boundary';}
   heading+=turnSign*1.65*dt;updateFeet(dt*1.6);return;
  }
  state='walking';reason='exploring supported ground';const previous=[...center];center=candidate;center[1]=height(center[0],center[2])+CRAWLER_BODY.clearance;
  updateFeet(length(sub(center,previous))/CRAWLER_BODY.stride);
 }
 function snapshot(){const basis=frame();return {kind:'simulated',time,crawler:{id:'simulated-ground-beetle',kind:'simulated',state,reason,position:[...center],yaw:heading,basis,phase,antennaAngle:Math.sin(time*3)*.18,bodySpec:CRAWLER_BODY,feet:feet.map((foot,i)=>{
   const hip=point([Math.sign(footOffsets[i][0])*.003,-.002,footOffsets[i][2]*.6],basis),pole=point([Math.sign(footOffsets[i][0])*.012,.003,footOffsets[i][2]],basis);
   return {...solveLeg(hip,foot.toe,pole,CRAWLER_BODY.legUpper,CRAWLER_BODY.legLower),contact:foot.planted&&state!=='unplaced'};
  })}};}
 return {snapshot,step(dt){if(!Number.isFinite(dt)||dt<0||dt>10)throw new RangeError('step requires 0–10 seconds');let left=dt;while(left>1e-9){const substep=Math.min(left,1/120);tick(substep);left-=substep;}return snapshot();},setWorld(next){world=admitWorld(next);const ground=height(center[0],center[2]);
      // Only an explicit habitat revision can restore contact at the same body pose.
      // An unsupported or changed-height surface does not justify a teleport.
      if(state==='unplaced'&&everPlaced&&ground!==null&&Math.abs(center[1]-CRAWLER_BODY.clearance-ground)<=1e-6&&valid(center)){
        plant();
        if(feet.every(f=>f.planted)){phase=0;state='walking';reason='support restored at original position';nextRest=time+8+random()*5;}
        return;
      }
      const displaced=ground===null||Math.abs(center[1]-CRAWLER_BODY.clearance-ground)>1e-6||feet.some(f=>f.planted&&(height(f.toe[0],f.toe[2])===null||Math.abs(f.toe[1]-.0003-height(f.toe[0],f.toe[2]))>1e-6));if(state!=='unplaced'&&(!valid(center)||displaced)){state='unplaced';reason='support removed or revised by habitat revision';for(const f of feet)f.planted=false;}},disturb(){if(state==='unplaced')return;state='turning';turnSign=random()>.5?1:-1;forcedTurnUntil=time+.65;nextRest=time+4;}};
}
