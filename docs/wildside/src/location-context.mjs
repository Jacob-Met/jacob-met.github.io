/** Curated public habitat-scale evidence, not a point survey or live hydrology feed. */
const CONTEXTS=Object.freeze([
 {id:'saguaro-desert-scrub',label:'Saguaro · Sonoran desert scrub',aliases:['saguaro','saguaro national park','sonoran desert scrub'],habitat:'desert-scrub',region:'Low-elevation desert scrub, Saguaro National Park, Arizona',resolution:'habitat within park; no point classification',sources:[{id:'usgs-saguaro-ecology',publisher:'US Geological Survey',url:'https://www.usgs.gov/geology-and-ecology-of-national-parks/ecology-saguaro-national-park',retrieved:'2026-10-24',updated:null,claim:'Low-elevation desert scrub is characterized by shrubs and succulents; higher elevations support different communities.'}],facts:{vegetation:'shrubs-and-succulents',water:'not-established',season:'not-resolved'}},
 {id:'everglades-sawgrass-marsh',label:'Everglades · freshwater sawgrass marsh',aliases:['everglades','everglades national park','everglades sawgrass marsh'],habitat:'freshwater-marsh',region:'Sawgrass marsh habitat, Everglades National Park, Florida',resolution:'habitat within park; no point classification',sources:[{id:'nps-ever-sawgrass',publisher:'National Park Service',url:'https://www.nps.gov/ever/learn/kidsyouth/sawgrass-prairie.htm',retrieved:'2026-10-24',updated:'2018-02-01',claim:'Sawgrass is a sedge. This marsh stays wet much of the year and water levels drop in the dry season.'}],facts:{vegetation:'emergent-sedges',water:'seasonally-inundated-freshwater',season:'not-resolved'}}
]);
const clone=x=>structuredClone(x),fail=m=>{throw Error(m);};
export function resolvePublicContext(query){
 if(typeof query!=='string'||query.length>180)fail('Supply a bounded public region name');
 const key=query.trim().toLowerCase();const found=CONTEXTS.filter(c=>c.id===key||c.aliases.includes(key));
 return found.length===1?{status:'resolved',context:clone(found[0])}:{status:'unavailable',reason:'No qualified public habitat context for this name. Your existing place is unchanged.'};
}
export function normalizeGeographicContext(value){
 const known=CONTEXTS.find(c=>c.id===value?.profileId);if(!known)fail('Unknown public habitat context');
 if(value.version!==1||value.scale!=='habitat-interpretation'||value.geometry!=='procedural-not-surveyed'||!['illustrative-wet','illustrative-dry'].includes(value.waterScenario))fail('Unsupported location interpretation');
 if(known.habitat!=='freshwater-marsh'&&value.waterScenario!=='illustrative-dry')fail('Water is not established for this context');
 // Transfers canonically reorder object keys. Compare the exact receipt fields
 // and values, keeping record order and rejecting missing/extra claims.
 const sameSources=Array.isArray(value.sources)&&value.sources.length===known.sources.length&&value.sources.every((source,i)=>{
  const expected=known.sources[i],keys=Object.keys(expected);
  return source&&typeof source==='object'&&!Array.isArray(source)&&Object.keys(source).length===keys.length&&keys.every(key=>Object.hasOwn(source,key)&&source[key]===expected[key]);
 });
 if(!sameSources)fail('Context source receipt differs from the acquired catalogue');
 return {version:1,profileId:known.id,region:known.region,resolution:known.resolution,scale:'habitat-interpretation',geometry:'procedural-not-surveyed',waterScenario:value.waterScenario,sources:clone(known.sources)};
}
export function synthesizeContextObservation({query,observationId,sourceId,waterScenario}){
 const resolved=resolvePublicContext(query);if(resolved.status!=='resolved')return resolved;
 const c=resolved.context,wet=c.habitat==='freshwater-marsh';waterScenario??=wet?'illustrative-wet':'illustrative-dry';
 const geographicContext=normalizeGeographicContext({version:1,profileId:c.id,scale:'habitat-interpretation',geometry:'procedural-not-surveyed',waterScenario,sources:c.sources});
 const features=[],feature=(suffix,kind,label,position,size,contextForm)=>features.push({anchorId:`${sourceId}:${suffix}`,kind,label,position,size,confidence:.5,...(contextForm?{contextForm}:{})});
 feature('ground','ground',wet?'Illustrative marsh substrate':'Illustrative desert ground',[0,-.12,0],[14,.12,12],wet?'marsh-substrate':'desert-ground');
 if(wet){
  if(waterScenario==='illustrative-wet')feature('water','water','Illustrative shallow freshwater',[.8,.006,0],[9,.035,8]);
  for(let i=0;i<18;i++){const theta=i*2.399,r=2.4+(i%4)*.55;feature('sedge-'+i,'plant','Interpreted emergent sedge',[Math.cos(theta)*r,.03,Math.sin(theta)*r],[.65,.7+(i%3)*.2,.65],'sedge');}
  feature('bank','rock','Illustrative exposed substrate',[-4.5,0,2],[1,.25,.8]);
 }else{
  for(let i=0;i<8;i++){const theta=i*2.399,r=2.4+(i%3)*.85;feature('succulent-'+i,'plant','Interpreted columnar succulent',[Math.cos(theta)*r,0,Math.sin(theta)*r],[.5,.8+(i%4)*.55,.5],'columnar-succulent');}
  for(let i=0;i<5;i++)feature('scrub-'+i,'plant','Interpreted desert scrub',[-4+i*1.8,0,-3.8],[1.1,.65,1.1],'scrub');
  feature('rock','rock','Illustrative exposed stone',[-3,0,2],[1.4,.65,1]);
 }
 return {status:'proposed',observation:{id:observationId,authorized:true,source:{id:sourceId,kind:'map',label:c.label,capturedAt:null},notes:'Public habitat knowledge supplies a procedural interpretation. Positions, dimensions, density and seasonal water state are illustrative, not surveyed or current observations. Add local observations to refine this same place.',geographicContext,features}};
}
