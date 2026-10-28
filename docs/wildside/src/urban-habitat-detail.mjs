/** Temporary habitat interpretation fitted to surviving source geometry.
 * This never writes observations or infers species, light, current moisture or
 * exact location. The renderer supplies its actual finite support query.
 */
export function deriveUrbanHabitatDetail(place,{surfaceAt,maxPlants=12}={}){
 if(typeof surfaceAt!=='function')throw new TypeError('Finite surface support is required');
 if(!Number.isInteger(maxPlants)||maxPlants<0||maxPlants>24)throw new RangeError('Urban detail budget must be 0–24');
 const contexts=(place.observations??[]).filter(o=>o.geographicContext?.profileId==='london-urban-courtyard'&&o.geographicContext?.composition==='support-bound-detail'&&o.geographicContext?.waterScenario==='illustrative-dry');
 if(!contexts.length||!maxPlants)return [];
 // A repeated context does not multiply decorative populations.
 const context=contexts.at(-1),anchors=place.anchors??[],result=[];
 const grounds=anchors.filter(a=>a.kind==='ground'),center=[0,0];
 if(grounds.length)for(const a of grounds){center[0]+=a.position[0]/grounds.length;center[1]+=a.position[2]/grounds.length;}
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const support=(x,z)=>{try{const y=surfaceAt(x,z);return finite(y)?y:null;}catch{return null;}};
 const occupied=(point,half,wall)=>anchors.some(a=>{
  if(a.id===wall.id||!['wall','plant','tree','planter','bench','rock','water','building'].includes(a.kind))return false;
  return Math.abs(point[0]-a.position[0])<half[0]+a.size[0]/2+.025&&
   Math.abs(point[2]-a.position[2])<half[2]+a.size[2]/2+.025&&
   point[1]<a.position[1]+a.size[1]&&point[1]+half[1]*2>a.position[1];
 });
 // Existing rectangular containers expose a known authored soil top. No pot,
 // soil, flowers or measured plant is added as a recognition anchor.
 for(const pot of anchors.filter(a=>a.kind==='planter')){
  if(result.length>=maxPlants)break;
  if(pot.boundary)continue; // Polygon soil needs its own exact inset contract.
  const [x,y,z]=pot.position,[w,h,d]=pot.size;
  if(Math.min(w,d)<.25||h<.1)continue;
  const samples=[];for(const dx of [-.5,0,.5])for(const dz of [-.5,0,.5])samples.push(support(x+dx*w,z+dz*d));
  if(samples.some(v=>v===null)||Math.max(...samples)-Math.min(...samples)>.02||Math.abs(Math.max(...samples)-y)>.02)continue;
  const position=[x,y+h+.0095,z],size=[w*.7,Math.min(.65,Math.min(w,d)*.6),d*.65];
  if(occupied(position,size.map(v=>v/2),pot))continue;
  if(result.some(a=>Math.abs(x-a.position[0])<(size[0]+a.size[0])/2+.025&&Math.abs(z-a.position[2])<(size[2]+a.size[2])/2+.025&&position[1]<a.position[1]+a.size[1]&&position[1]+size[1]>a.position[1]))continue;
  result.push({id:`urban-detail:${context.source.id}:${pot.id}:container`,kind:'plant',contextForm:'container-foliage',position,size,rotationY:0,
   sourceIds:[...new Set([context.source.id,...(pot.sourceIds??[])])],supportAnchorId:pot.id,contextObservationId:context.id,provenance:'temporary-public-habitat-interpretation'});
 }
 for(const wall of anchors.filter(a=>a.kind==='wall')){
  if(result.length>=maxPlants)break;
  const alongX=wall.size[0]>=wall.size[2],long=alongX?0:2,normal=alongX?2:0,length=wall.size[long],thickness=wall.size[normal];
  if(length<.5||wall.size[1]<.45)continue;
  const count=Math.min(6,Math.max(1,Math.floor(length/1.65))),width=Math.min(1.3,length/count-.2),depth=.12;
  const preferred=Math.sign(center[normal===0?0:1]-wall.position[normal])||1;
  for(let i=0;i<count&&result.length<maxPlants;i++){
   const along=wall.position[long]+(i-(count-1)/2)*(length/count);
   for(const side of [preferred,-preferred]){
    const position=[...wall.position];position[long]=along;position[normal]+=side*(thickness/2+depth/2+.015);
    const footprint=alongX?[width,depth]:[depth,width],samples=[];
    for(const dx of [-.5,0,.5])for(const dz of [-.5,0,.5])samples.push(support(position[0]+dx*footprint[0],position[2]+dz*footprint[1]));
    if(samples.some(y=>y===null)||Math.max(...samples)-Math.min(...samples)>.02)continue;
    const base=Math.max(...samples),height=Math.min(1.8,wall.position[1]+wall.size[1]-base-.1);
    if(Math.abs(base-wall.position[1])>.15||height<.3)continue;
    position[1]=base;
    if(occupied(position,[footprint[0]/2,height/2,footprint[1]/2],wall))continue;
    // Nearby walls can both offer supported space. Do not stack their inferred
    // planting into the same volume; retain the first compatible bounded fit.
    if(result.some(a=>{
     const span=a.rotationY?[a.size[2],a.size[0]]:[a.size[0],a.size[2]];
     return Math.abs(position[0]-a.position[0])<(footprint[0]+span[0])/2+.025&&
      Math.abs(position[2]-a.position[2])<(footprint[1]+span[1])/2+.025&&
      position[1]<a.position[1]+a.size[1]&&position[1]+height>a.position[1];
    }))continue;
    const sourceIds=[...new Set([context.source.id,...(wall.sourceIds??[])])];
    result.push({id:`urban-detail:${context.source.id}:${wall.id}:${i}`,kind:'plant',contextForm:'wall-climber',
     position,size:[width,height,depth],rotationY:alongX?0:Math.PI/2,sourceIds,
     supportAnchorId:wall.id,contextObservationId:context.id,provenance:'temporary-public-habitat-interpretation'});
    break;
   }
  }
 }
 return result;
}
