import {admitWaterSurfaces,waterClearance} from './pond-skater.mjs';
import {circleIntersectsPolygon} from './boundary.mjs';

/** Bounded illustrative search opportunities on existing rendered support.
 * A patch is neither evidence of food nor a real wildlife observation. */
export function birdForagingSites({perches=[],groundSupports=[],obstacles=[],waterSurfaces=[]}={}){
 if(![perches,groundSupports,obstacles,waterSurfaces].every(Array.isArray))throw new TypeError('Expected maintained habitat arrays');
 if(perches.length>64||groundSupports.length>256||obstacles.length>256||waterSurfaces.length>64)return [];
 const grounds=groundSupports.map(g=>admitWaterSurfaces([{...g,shape:'polygon'}])[0]);
 // Includes the authored bill/tail, with room above a short hop's body.
 const waters=admitWaterSurfaces(waterSurfaces),sites=[],margin=.28;
 const solids=obstacles.filter(b=>!b.modes||b.modes.includes('bird'));
 function clear(ground,p,padding=margin){
  return waterClearance(ground,p)>=padding
   &&!grounds.some(g=>g.y>ground.y&&circleIntersectsPolygon(p,padding,g.points))
   &&!waters.some(w=>w.y>=ground.y-.01&&circleIntersectsPolygon(p,padding,w.points))
   &&!solids.some(b=>b.max[1]>ground.y+.025&&b.min[1]<ground.y+.50&&p[0]>b.min[0]-padding&&p[0]<b.max[0]+padding&&p[1]>b.min[2]-padding&&p[1]<b.max[2]+padding);
 }
 function corridor(ground,a,b){
  const distance=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(distance/.04);
  // The enlarged sample disks cover the complete swept footprint, including
  // arbitrarily thin water/solid strips between samples.
  for(let i=0;i<=steps;i++){const t=i/steps;if(!clear(ground,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],margin+distance/steps/2))return false;}
  return true;
 }
 for(const perch of perches){
  if(!Array.isArray(perch.position)||perch.position.length!==3||!perch.position.every(Number.isFinite))throw new TypeError('Invalid source perch');
  for(const radius of [.55,.9,1.3])for(let turn=0;turn<8;turn++){
   const angle=turn*Math.PI/4,p=[perch.position[0]+Math.cos(angle)*radius,perch.position[2]+Math.sin(angle)*radius];
   const ground=grounds.filter(g=>waterClearance(g,p)>=margin).sort((a,b)=>b.y-a.y||a.id.localeCompare(b.id))[0];
   if(!ground||perch.position[1]-ground.y<.2||perch.position[1]-ground.y>2.8||!clear(ground,p))continue;
   if(sites.some(s=>Math.hypot(s.position[0]-p[0],s.position[2]-p[1])<.6))continue;
   const id=`${perch.id}:forage:${turn}:${radius}`;
   const addSite=(point,suffix)=>{const site={id:id+suffix,position:[point[0],ground.y,point[1]],radius:.08,shelter:0,foraging:true,returnPerchId:perch.id,supportId:ground.id,hopIds:[]};sites.push(site);return site;};
   let prior=addSite(p,'');
   for(let step=1;step<=2&&sites.length<8;step++){
    const q=[p[0]+Math.cos(angle)*.24*step,p[1]+Math.sin(angle)*.24*step];
    if(!corridor(ground,[prior.position[0],prior.position[2]],q))break;
    const next=addSite(q,`:hop:${step}`);prior.hopIds.push(next.id);next.hopIds.push(prior.id);prior=next;
   }
   if(sites.length===8)return sites;
   break;
  }
 }
 return sites;
}
