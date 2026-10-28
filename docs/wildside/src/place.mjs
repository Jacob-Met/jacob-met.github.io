import {assertMapFrames} from './map-terrain.mjs';
import {normalizeMapContext,normalizeMapGeometry,validateMapFeatureEnvelope} from './map-geometry.mjs';
import {normalizeGeographicContext} from './location-context.mjs';
import {normalizeRegionProposals} from './region-proposals.mjs';
import { timestamp } from './review/draft.mjs';
import { validateAppearance } from './appearance.mjs';
import { normalizeBoundary,boundaryDifference } from './boundary.mjs';
import {validateCameraAssumption} from './camera-params.mjs';
/** Observation-grounded place core. Coordinates are meters, Y up. No raw media is stored. */
const clone = value => JSON.parse(JSON.stringify(value));
const fail = message => { throw new Error(message); };
const id = (value, field='ID') => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,180}$/.test(value) ? value : fail(`${field} is invalid`);
const text = (value, max=200) => typeof value === 'string' && value.length <= max ? value : fail('Text is invalid');
const vector = (v, n=3) => Array.isArray(v) && v.length===n && v.every(x=>Number.isFinite(x)&&Math.abs(x)<=1e6) ? [...v] : fail('Coordinates must be finite and bounded');
export const PLACE_VERSION = 2;
export function createPlace({id: placeId, name}) {
  return {version:PLACE_VERSION,id:id(placeId),name:text(name),revision:0,anchors:[],observations:[],history:[],revokedSources:[],conflicts:[]};
}
// Normalize both image and metric coordinates before solving. Raw normal
// equations square the condition number and can move a source-ground landmark
// tens of metres when the scene uses a translated local metric frame.
function normalizedPoints(points) {
  const center=[0,0];
  for(const p of points){center[0]+=p[0];center[1]+=p[1];}
  center[0]/=points.length;center[1]/=points.length;
  const rms=Math.sqrt(points.reduce((sum,p)=>sum+(p[0]-center[0])**2+(p[1]-center[1])**2,0)/points.length);
  if(!Number.isFinite(rms)||rms<1e-11)fail('Calibration is degenerate; use spread-out control points');
  const scale=Math.SQRT2/rms;
  return {center,scale,points:points.map(p=>[(p[0]-center[0])*scale,(p[1]-center[1])*scale])};
}

// Householder least-squares QR on the direct 2N x 8 homography system. This
// avoids forming A^T A, and rejects near-rank-deficient source configurations.
function leastSquares(rows,rhs) {
  const a=rows.map(r=>[...r]),b=[...rhs],n=8,m=a.length;
  for(let c=0;c<n;c++){
    let length=0;
    for(let r=c;r<m;r++)length=Math.hypot(length,a[r][c]);
    if(!Number.isFinite(length)||length<1e-11)fail('Calibration is degenerate; use spread-out control points');
    const alpha=a[c][c]>=0?-length:length;
    const v=Array.from({length:m-c},(_,i)=>a[c+i][c]);
    v[0]-=alpha;
    const norm=v.reduce((sum,x)=>sum+x*x,0);
    if(!Number.isFinite(norm)||norm<1e-24)fail('Calibration is degenerate; use spread-out control points');
    for(let j=c;j<n;j++){
      let dot=0;for(let i=0;i<v.length;i++)dot+=v[i]*a[c+i][j];
      const factor=2*dot/norm;
      for(let i=0;i<v.length;i++)a[c+i][j]-=factor*v[i];
    }
    let dot=0;for(let i=0;i<v.length;i++)dot+=v[i]*b[c+i];
    const factor=2*dot/norm;
    for(let i=0;i<v.length;i++)b[c+i]-=factor*v[i];
  }
  const result=Array(n).fill(0);
  for(let c=n-1;c>=0;c--){
    if(Math.abs(a[c][c])<1e-11)fail('Calibration is degenerate; use spread-out control points');
    let value=b[c];
    for(let j=c+1;j<n;j++)value-=a[c][j]*result[j];
    result[c]=value/a[c][c];
    if(!Number.isFinite(result[c]))fail('Calibration is degenerate; use spread-out control points');
  }
  return result;
}
function multiply3(a,b) {
  return Array.from({length:9},(_,i)=>{
    const row=Math.floor(i/3),col=i%3;
    return a[row*3]*b[col]+a[row*3+1]*b[col+3]+a[row*3+2]*b[col+6];
  });
}
/** Four or more manually identified planar correspondences; image coords normalized 0..1. */
export function fitGroundPlane(pairs) {
  if(!Array.isArray(pairs)||pairs.length<4||pairs.length>64)fail('Use 4–64 ground-plane control points');
  const images=[],grounds=[];
  for(const pair of pairs){images.push(vector(pair.image,2));grounds.push(vector(pair.ground,2));}
  const source=normalizedPoints(images),target=normalizedPoints(grounds);
  const rows=[],rhs=[];
  source.points.forEach(([u,v],i)=>{
    const [x,z]=target.points[i];
    rows.push([u,v,1,0,0,0,-x*u,-x*v],[0,0,0,u,v,1,-z*u,-z*v]);
    rhs.push(x,z);
  });
  const h=[...leastSquares(rows,rhs),1];
  const [u,v]=source.center,[x,z]=target.center;
  const imageNorm=[source.scale,0,-u*source.scale,0,source.scale,-v*source.scale,0,0,1];
  const groundDenorm=[1/target.scale,0,x,0,1/target.scale,z,0,0,1];
  const raw=multiply3(multiply3(groundDenorm,h),imageNorm);
  if(!Number.isFinite(raw[8])||Math.abs(raw[8])<1e-11)fail('Calibration is degenerate; use spread-out control points');
  const matrix=raw.map(n=>n/raw[8]);
  if(!matrix.every(Number.isFinite))fail('Calibration is degenerate; use spread-out control points');
  const residual=Math.sqrt(pairs.reduce((sum,p,i)=>{
    const q=projectGroundPoint(matrix,images[i]),actual=grounds[i];
    return sum+(q[0]-actual[0])**2+(q[1]-actual[1])**2;
  },0)/pairs.length);
  return {matrix,rmsMeters:residual,method:'annotated-planar-homography'};
}
export function projectGroundPoint(matrix, point) {
  if(!Array.isArray(matrix)||matrix.length!==9||!matrix.every(Number.isFinite))fail('Invalid ground calibration');
  const [u,v]=vector(point,2),d=matrix[6]*u+matrix[7]*v+matrix[8];
  if(Math.abs(d)<1e-8)fail('Point is on the projection horizon');
  return vector([(matrix[0]*u+matrix[1]*v+matrix[2])/d,(matrix[3]*u+matrix[4]*v+matrix[5])/d],2);
}
function normalizeObservation(input) {
  if(!input || input.authorized!==true)fail('Observation requires authorized input');
  const source=input.source;
  if(!source||!['photo','video','note','map','imagined'].includes(source.kind))fail('Unsupported observation source');
  const capturedAt=timestamp(source.capturedAt??null);
  const hasMoment=Object.hasOwn(source,'offsetSeconds');
  if(source.kind==='video'&&hasMoment&&(!Number.isFinite(source.offsetSeconds)||source.offsetSeconds<0))
    fail('Video moments require a finite, nonnegative clip offset');
  if(source.kind!=='video'&&hasMoment&&source.offsetSeconds!==null)
    fail('Only a video may declare a clip offset');
  if(!Array.isArray(input.features)||input.features.length>256)fail('Observation requires at most 256 features');
  const geographicContext=input.geographicContext===undefined?null:normalizeGeographicContext(input.geographicContext);
  if(geographicContext&&source.kind!=='map')fail('Public context requires a map source');
  const mapContext=input.mapContext===undefined?null:normalizeMapContext(input.mapContext,source);
  if(mapContext&&(geographicContext||input.controlPoints||input.cameraAssumption||input.regionProposals))fail('Map geometry cannot be mixed with a different observation method');
  const calibration=input.controlPoints?fitGroundPlane(input.controlPoints):null;
  const cameraAssumption=input.cameraAssumption===undefined?null:validateCameraAssumption(input.cameraAssumption);
  if(cameraAssumption&&(!calibration||!['photo','video'].includes(source.kind)))fail('A source camera needs a calibrated photo or video');
  const seen=new Set();
  const features=input.features.map(f=>{
    const anchorId=id(f.anchorId,'Anchor ID');if(seen.has(anchorId))fail('Duplicate anchor in observation');seen.add(anchorId);
    let position;
    if(f.imagePoint){if(!calibration)fail('Image points require ground-plane control points');const [x,z]=projectGroundPoint(calibration.matrix,f.imagePoint);position=vector([x,f.height??0,z]);}
    else position=vector(f.position);
    if(f.contextForm!==undefined){
      const allowed=geographicContext?.profileId==='redwood-rocky-intertidal'?{ground:['intertidal-substrate'],rock:['intertidal-shelf']}:geographicContext?.profileId==='saguaro-desert-scrub'?{ground:['desert-ground'],plant:['columnar-succulent','scrub']}:geographicContext?.profileId==='everglades-sawgrass-marsh'?{ground:['marsh-substrate'],plant:['sedge']}:geographicContext?.profileId==='london-urban-courtyard'?{ground:['courtyard-foundation'],plant:['garden-hedge','wall-climber']}:{};
      if(!allowed[f.kind]?.includes(f.contextForm))fail('Unsupported contextual form for this habitat and feature');
    }
    const size=vector(f.size);if(size.some(v=>v<=0||v>1000))fail('Feature size must be positive');
    const confidence=f.confidence??0.7;if(!Number.isFinite(confidence)||confidence<=0||confidence>1)fail('Confidence must be between zero and one');
    if(!['tree','planter','water','wall','path','rock','plant','ground','bench','building'].includes(f.kind))fail('Unsupported feature kind');
    if(f.boundary!==undefined&&!['ground','path','planter','water'].includes(f.kind))fail('Boundaries currently support ground, path, planter and water');
    const mapGeometry=f.mapGeometry===undefined?null:normalizeMapGeometry(f.mapGeometry,{kind:f.kind,mapContext});
    if((f.kind==='building'||mapContext)&&!mapGeometry)fail('Public map features require source geometry');
    if(mapGeometry){if(f.boundary||f.imagePoint||f.contextForm||f.appearance)fail('Map geometry cannot carry unrelated feature methods');validateMapFeatureEnvelope(mapGeometry,position,size,mapContext);}
    const boundary=f.boundary===undefined?null:normalizeBoundary(f.boundary,{position,project:p=>projectGroundPoint(calibration?.matrix,p),matrix:calibration?.matrix});
    return {anchorId,kind:f.kind,label:text(f.label??f.kind),position,size,confidence,...(mapGeometry?{mapGeometry}:{}),...(f.contextForm?{contextForm:f.contextForm}:{}),...(boundary?{boundary}:{}),...(f.appearance!==undefined?{appearance:validateAppearance(f.appearance)}:{}),...(f.imagePoint?{imagePoint:vector(f.imagePoint,2),height:f.height??0}:{})};
  });
  const regionProposals=input.regionProposals===undefined?null:normalizeRegionProposals(input.regionProposals,{sourceId:source.id,sourceKind:source.kind});
  const mode=input.mode??'refine';if(!['refine','change','correct'].includes(mode))fail('Unknown revision mode');
  return {id:id(input.id),authorized:true,source:{id:id(source.id,'Source ID'),kind:source.kind,capturedAt,label:text(source.label??'Local observation'),...(source.kind==='video'&&hasMoment?{offsetSeconds:source.offsetSeconds}:{})},mode,features,controlPoints:input.controlPoints?clone(input.controlPoints):null,calibration,...(cameraAssumption?{cameraAssumption}:{}),notes:text(input.notes??'',4000),...(regionProposals?{regionProposals}:{}),...(geographicContext?{geographicContext}:{}),...(mapContext?{mapContext}:{})};
}
function reconstruct(observations) {
  const anchors=new Map(),conflicts=[];
  for(const observation of observations)for(const f of observation.features){
    const previous=anchors.get(f.anchorId);
    const next={id:f.anchorId,kind:f.kind,label:previous?.label??f.label,position:[...f.position],size:[...f.size],confidence:f.confidence,evidenceIds:[observation.id],sourceIds:[observation.source.id],status:'interpreted',method:observation.mapContext?'public-map-grounded-interpretation':observation.geographicContext?'public-habitat-procedural-interpretation':observation.calibration?'annotated-ground-plane':'human-spatial-note',...(f.mapGeometry?{mapGeometry:clone(f.mapGeometry)}:{}),...(f.contextForm?{contextForm:f.contextForm}:{}),...(f.boundary?{boundary:{...clone(f.boundary),sourceObservationId:observation.id}}:{}),...(f.appearance?{appearance:clone(f.appearance)}:{})};
    if(previous && observation.mode==='refine') {
      if(previous.mapGeometry||f.mapGeometry){
        const identical=JSON.stringify(previous.mapGeometry)===JSON.stringify(f.mapGeometry)&&JSON.stringify(previous.position)===JSON.stringify(f.position)&&JSON.stringify(previous.size)===JSON.stringify(f.size);
        if(!identical){conflicts.push({anchorId:f.anchorId,observationId:observation.id,distanceMeters:Math.hypot(...f.position.map((v,i)=>v-previous.position[i])),reason:'map-geometry-conflict'});continue;}
      }
      const distance=Math.hypot(...f.position.map((v,i)=>v-previous.position[i]));
      const tolerance=Math.max(0.5,Math.hypot(previous.size[0],previous.size[2])*0.5);
      if(previous.kind!==f.kind||distance>tolerance){conflicts.push({anchorId:f.anchorId,observationId:observation.id,distanceMeters:distance,reason:previous.kind!==f.kind?'kind-conflict':'position-conflict'});continue;}
      if(f.boundary&&previous.boundary){const distance=boundaryDifference(previous.boundary.localPoints,f.boundary.localPoints);if(distance>Math.max(.25,Math.hypot(previous.size[0],previous.size[2])*.2)){conflicts.push({anchorId:f.anchorId,observationId:observation.id,distanceMeters:distance,reason:'boundary-conflict'});continue;}}
      const weight=f.confidence/(previous.weight+f.confidence);
      if(!f.boundary&&previous.boundary)next.boundary=clone(previous.boundary);
      if(!f.appearance&&previous.appearance)next.appearance=clone(previous.appearance);
      if(!f.contextForm&&previous.contextForm)next.contextForm=previous.contextForm;
      next.position=previous.position.map((v,i)=>v+(f.position[i]-v)*weight);
      next.size=previous.size.map((v,i)=>v+(f.size[i]-v)*weight);
      next.confidence=Math.max(previous.confidence,f.confidence);
      next.evidenceIds=[...previous.evidenceIds,observation.id];next.sourceIds=[...new Set([...previous.sourceIds,observation.source.id])];
      next.weight=previous.weight+f.confidence;
    }else next.weight=f.confidence;
    anchors.set(f.anchorId,next);
  }
  const result=[...anchors.values()];assertMapFrames(result,observations);
  return {anchors:result,conflicts};
}
export function admitObservation(place, input) {
  const observation=normalizeObservation(input);
  if(place.revokedSources.includes(observation.source.id))fail('This source was removed; it cannot be silently restored');
  const old=place.observations.find(o=>o.id===observation.id);
  if(old){if(JSON.stringify(old)!==JSON.stringify(observation))fail('Observation ID conflicts with an existing record');return clone(place);}
  if(place.observations.length>=500)fail('Place observation capacity reached');
  const next=clone(place);next.version=PLACE_VERSION;next.revision++;next.observations.push(observation);
  Object.assign(next,reconstruct(next.observations));
  next.history.push({revision:next.revision,observationIds:next.observations.map(o=>o.id),reason:observation.mode});
  return next;
}
/** Rebuild every historical view from remaining sources; no hidden geometry snapshots survive. */
export function removeSource(place, sourceId) {
  id(sourceId);if(place.revokedSources.includes(sourceId))return clone(place);
  const next=clone(place);next.revision++;next.revokedSources.push(sourceId);
  next.observations=next.observations.filter(o=>o.source.id!==sourceId);
  const kept=new Set(next.observations.map(o=>o.id));
  next.history=next.history.map(h=>({...h,observationIds:h.observationIds.filter(x=>kept.has(x))}));
  Object.assign(next,reconstruct(next.observations));
  next.history.push({revision:next.revision,observationIds:[...kept],reason:'source-removal'});
  return next;
}
export function placeAtRevision(place, revision) {
  if(revision===0)return {...clone(place),revision:0,anchors:[],observations:[],conflicts:[],history:[]};
  const h=place.history.find(h=>h.revision===revision);if(!h)fail('Revision is unavailable');
  const observations=place.observations.filter(o=>h.observationIds.includes(o.id));
  return {...clone(place),revision,observations,...reconstruct(observations),history:place.history.filter(h=>h.revision<=revision)};
}
export function resolveAttachment(place, {anchorId,offset=[0,0,0]}) {
  vector(offset);const anchor=place.anchors.find(a=>a.id===anchorId);
  return anchor?{status:'attached',anchorId,position:anchor.position.map((v,i)=>v+offset[i])}:{status:'unavailable',anchorId,position:null};
}
export function serializePlace(place){return JSON.stringify(place);}
export function restorePlace(serialized) {
  if(typeof serialized!=='string'||serialized.length>8e6)fail('Saved place exceeds the supported size');
  const p=JSON.parse(serialized);if(![1,PLACE_VERSION].includes(p.version)||!Array.isArray(p.observations)||!Array.isArray(p.history)||!Array.isArray(p.revokedSources)||p.observations.length>500)fail('Unsupported or damaged saved place');
  const base=createPlace(p);if(!Number.isSafeInteger(p.revision)||p.revision<0)fail('Invalid saved revision');
  base.revision=p.revision;base.revokedSources=p.revokedSources.map(v=>id(v));
  base.observations=p.observations.map(normalizeObservation);
  if(new Set(base.observations.map(o=>o.id)).size!==base.observations.length || base.observations.some(o=>base.revokedSources.includes(o.source.id)))fail('Saved observations conflict');
  const known=new Set(base.observations.map(o=>o.id));
  let previousRevision=0;
  base.history=p.history.map(h=>{if(!Number.isSafeInteger(h.revision)||h.revision<=previousRevision||h.revision>p.revision||!Array.isArray(h.observationIds)||new Set(h.observationIds).size!==h.observationIds.length||h.observationIds.some(x=>!known.has(x)))fail('Damaged revision history');previousRevision=h.revision;return {revision:h.revision,observationIds:[...h.observationIds],reason:text(h.reason)};});
  Object.assign(base,reconstruct(base.observations));return base;
}
/** Single localStorage write is atomic. Caller keeps old state until save succeeds. No media persistence. */
export function createPlaceStore(storage, key='wildside.place.v1') {
  return {
    load(){const raw=storage.getItem(key);return raw===null?null:restorePlace(raw);},
    save(place,{expectedRevision}={}){const raw=storage.getItem(key);const current=raw===null?null:restorePlace(raw);if(expectedRevision!==undefined&&(current?.revision??0)!==expectedRevision)fail('The place changed in another visit; reload before saving');const serialized=serializePlace(place);restorePlace(serialized);storage.setItem(key,serialized);return place.revision;},
    clear(){storage.removeItem(key);}
  };
}
