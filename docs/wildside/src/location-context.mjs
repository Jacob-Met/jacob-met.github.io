/** Curated public habitat-scale evidence, not a point survey or live hydrology feed. */
import {INTERTIDAL_PROFILE,composeIntertidal} from './intertidal-context.mjs';
const CONTEXTS=Object.freeze([
 INTERTIDAL_PROFILE,
 {id:'london-urban-courtyard',label:'London · planted urban courtyard',aliases:['london courtyard','london urban courtyard','london planted courtyard'],habitat:'urban-courtyard',region:'Representative planted courtyard in London, England',resolution:'urban garden habitat; no address or point classification',sources:[{id:'rhs-garden-habitats',publisher:'Royal Horticultural Society',url:'https://www.rhs.org.uk/wildlife/in-gardens',retrieved:'2026-10-26',updated:null,claim:'Garden vegetation, including climbers on walls and mixed living boundaries, can provide shelter and habitat for wildlife.'},{id:'lwt-hedge-habitat',publisher:'London Wildlife Trust',url:'https://www.wildlondon.org.uk/actions/how-make-hedge-wildlife',retrieved:'2026-10-26',updated:null,claim:'Hedges provide shelter and allow wildlife to move between gardens and other spaces.'}],facts:{vegetation:'mixed-hedge-and-wall-climbers',water:'not-established',season:'not-resolved'}},
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
 if(!['freshwater-marsh','rocky-intertidal'].includes(known.habitat)&&value.waterScenario!=='illustrative-dry')fail('Water is not established for this context');
 // Transfers canonically reorder object keys. Compare the exact receipt fields
 // and values, keeping record order and rejecting missing/extra claims.
 const sameSources=Array.isArray(value.sources)&&value.sources.length===known.sources.length&&value.sources.every((source,i)=>{
  const expected=known.sources[i],keys=Object.keys(expected);
  return source&&typeof source==='object'&&!Array.isArray(source)&&Object.keys(source).length===keys.length&&keys.every(key=>Object.hasOwn(source,key)&&source[key]===expected[key]);
 });
 if(!sameSources)fail('Context source receipt differs from the acquired catalogue');
 if(value.composition!==undefined&&(value.composition!=='support-bound-detail'||known.habitat!=='urban-courtyard'))fail('Unsupported habitat enrichment');
 return {version:1,profileId:known.id,region:known.region,resolution:known.resolution,scale:'habitat-interpretation',geometry:'procedural-not-surveyed',waterScenario:value.waterScenario,sources:clone(known.sources),...(value.composition?{composition:value.composition}:{})};
}
export function synthesizeContextObservation({query,observationId,sourceId,waterScenario}){
 const resolved=resolvePublicContext(query);if(resolved.status!=='resolved')return resolved;
 const c=resolved.context,wet=c.habitat==='freshwater-marsh';waterScenario??=(wet||c.habitat==='rocky-intertidal')?'illustrative-wet':'illustrative-dry';
 const geographicContext=normalizeGeographicContext({version:1,profileId:c.id,scale:'habitat-interpretation',geometry:'procedural-not-surveyed',waterScenario,sources:c.sources});
 const features=[],feature=(suffix,kind,label,position,size,contextForm)=>features.push({anchorId:`${sourceId}:${suffix}`,kind,label,position,size,confidence:.5,...(contextForm?{contextForm}:{})});
 if(c.habitat==='rocky-intertidal'){
  composeIntertidal(feature,waterScenario==='illustrative-wet');
 }else if(c.habitat==='urban-courtyard'){
  composeCourtyard(feature);
 }else{
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
 }
 return {status:'proposed',observation:{id:observationId,authorized:true,source:{id:sourceId,kind:'map',label:c.label,capturedAt:null},notes:'Public habitat knowledge supplies a procedural interpretation. Positions, dimensions, density and seasonal water state are illustrative, not surveyed or current observations. Add local observations to refine this same place.',geographicContext,features}};
}

/** Built fabric stays dominant; vegetation occupies bounded edges and pockets.
 * Dimensions and arrangement are authored interpretation, not retrieved geometry.
 * Stable suffixes let later observations refine the same continuing anchors.
 */
function composeCourtyard(feature){
 feature('ground','ground','Illustrative courtyard foundation',[0,-.14,0],[12,.12,10],'courtyard-foundation');
 feature('paving','path','Illustrative courtyard paving',[0,-.02,0],[10.8,.04,8.8]);
 feature('back-wall','wall','Illustrative courtyard wall',[0,0,-4.5],[11.2,2.5,.28]);
 feature('side-wall','wall','Illustrative courtyard boundary',[-5.4,0,0],[.28,1.8,9]);
 feature('bench','bench','Illustrative courtyard seat',[3.5,0,2.8],[1.6,.48,.5]);
 // A connected low hedge follows the boundary without sealing the walking route.
 for(let i=0;i<5;i++)feature('hedge-'+i,'plant','Interpreted mixed hedge',[-4.7,0,-3.15+i*1.45],[.85,1.05+(i%2)*.15,2.2],'garden-hedge');
 // Plants are set on the visitor side of the wall, never behind its solid face.
 for(let i=0;i<3;i++)feature('climber-'+i,'plant','Interpreted wall vegetation',[-2.7+i*2.35,0,-4.28],[1.45,1.8+(i%2)*.25,.16],'wall-climber');
 for(const [i,x,z] of [[0,3.4,-1.8],[1,3.4,.0]]){
  feature('planter-'+i,'planter','Illustrative planted container',[x,0,z],[1.25,.35,1.1]);
  feature('planting-'+i,'plant','Interpreted container planting',[x,.35,z],[.9,.55,.75]);
 }
 feature('tree','tree','Interpreted small garden tree',[2.95,0,-3.0],[1.4,2.45,1.4]);
}

/** Attach reusable public habitat knowledge, without replacing local geometry. */
export function synthesizeContextEnrichment({query,observationId,sourceId}){
 const result=synthesizeContextObservation({query,observationId,sourceId});
 if(result.status!=='proposed')return result;
 if(result.observation.geographicContext.profileId!=='london-urban-courtyard')return {status:'unavailable',reason:'Support-bound planting currently supports the London courtyard context.'};
 return {status:'proposed',observation:{...result.observation,features:[],
  geographicContext:{...result.observation.geographicContext,composition:'support-bound-detail'},
  notes:'Public urban habitat knowledge informs temporary planting on surviving supported walls and containers. Plants, positions and density are illustrative; no planting or species was observed. Existing landmarks are unchanged.'}};
}
