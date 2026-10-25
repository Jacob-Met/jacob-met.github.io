import {validatePolygon} from './boundary.mjs';

const fail = message => { throw new Error(message); };
const text = (v, max=200) => typeof v === 'string' && v.length > 0 && v.length <= max ? v : fail('Invalid map source text');
const finite = v => Number.isFinite(v) && Math.abs(v) <= 1000;
const same = (a,b,t=1e-5) => a.length===b.length && a.every((v,i)=>Math.abs(v-b[i])<=t);
export const MAP_SCHEMA = 'wildside.public-map/v1';

/** Only the acquired, bounded CityGML contract is admitted; no live/terrain claim. */
export function normalizeMapContext(input, source) {
  if (!input || input.schema!==MAP_SCHEMA || source?.kind!=='map' ||
      input.provider!=='MLIT PLATEAU' || input.sourceCRS!=='EPSG:6697' ||
      input.projection!=='Japan-VI-GRS80' || !['per-feature-grounded','source-relative'].includes(input.verticalPolicy))
    fail('Unsupported public map interpretation');
  if(input.verticalPolicy==='source-relative'&&
     (!Number.isFinite(input.heightOrigin)||input.heightOrigin< -100||input.heightOrigin>3000))
    fail('A finite source height origin is required');
  if(input.verticalPolicy==='per-feature-grounded'&&input.heightOrigin!==undefined)
    fail('Independent grounding cannot claim a shared source height origin');
  if (!/^[a-f0-9]{64}$/.test(input.sha256) || source.id!=='map-sha256:'+input.sha256)
    fail('Map source fingerprint does not match its observation');
  const url = new URL(input.url);
  if(url.protocol!=='https:' || url.hostname!=='assets.cms.plateau.reearth.io' ||
     !url.pathname.endsWith('.gml') || url.username || url.password || url.search || url.hash)
    fail('Unsupported map source URL');
  if (!Array.isArray(input.origin) || input.origin.length!==2 ||
      !input.origin.every(Number.isFinite) || input.origin[0]<33.4 || input.origin[0]>36.33 ||
      input.origin[1]<134.86 || input.origin[1]>136.99) fail('Map origin is outside the qualified projection');
  if (!Number.isFinite(input.radiusMeters) || input.radiusMeters<10 || input.radiusMeters>250)
    fail('Map neighborhood radius is unsupported');
  if (!Number.isInteger(input.year) || input.year<2000 || input.year>2100 ||
      !/^\d{5}$/.test(input.cityCode) || !/^\d{8}$/.test(input.tile)) fail('Invalid map dataset identity');
  if (input.licenseURL!=='https://www.mlit.go.jp/plateau/site-policy/') fail('Map source terms are missing');
  return {schema:MAP_SCHEMA,provider:input.provider,sourceCRS:input.sourceCRS,
    projection:input.projection,verticalPolicy:input.verticalPolicy,...(input.verticalPolicy==='source-relative'?{heightOrigin:input.heightOrigin}:{}),sha256:input.sha256,
    url:url.href,origin:[...input.origin],radiusMeters:input.radiusMeters,
    year:input.year,cityCode:input.cityCode,tile:input.tile,
    attribution:text(input.attribution,500),licenseURL:input.licenseURL};
}

/** A stable planar basis reuses the maintained simple-polygon admission. */
export function mapSurfaceFrame(points) {
  if (!Array.isArray(points) || points.length<3 || points.length>128 ||
      points.some(p=>!Array.isArray(p)||p.length!==3||!p.every(finite)))
    fail('Map faces need 3–128 finite local vertices');
  const n=[0,0,0];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);
  }
  const length=Math.hypot(...n);
  if(length<1e-8) fail('Map face has no usable area');
  const normal=n.map(v=>v/length),axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  const axes=[0,1,2].filter(i=>i!==axis);
  const projected=validatePolygon(points.map(p=>axes.map(i=>p[i])));
  if(points.some(p=>Math.abs(p.reduce((s,v,i)=>s+(v-points[0][i])*normal[i],0))>.002))
    fail('Nonplanar map face is unsupported');
  return {normal,axes,projected};
}

export function mapGeometryBounds(geometry) {
  const vertices=geometry.surfaces.flat();
  const min=[0,1,2].map(i=>Math.min(...vertices.map(p=>p[i])));
  const max=[0,1,2].map(i=>Math.max(...vertices.map(p=>p[i])));
  return {min,max};
}

/** Retains exact authored map faces. Unsupported holes/solids are never filled. */
export function normalizeMapGeometry(input,{kind,mapContext}={}) {
  if (!mapContext || !input || input.version!==1 ||
      !['building','road','terrain'].includes(input.role) ||
      kind!==({building:'building',road:'path',terrain:'ground'}[input.role])) fail('Map geometry requires its original map context');
  const sourceFeatureId=text(input.sourceFeatureId,160);
  if(!/^[a-zA-Z0-9_.:-]+$/.test(sourceFeatureId)) fail('Invalid map feature identity');
  if(!Array.isArray(input.sourceHeight)||input.sourceHeight.length!==2||
     !input.sourceHeight.every(v=>Number.isFinite(v)&&v>=-100&&v<=3000)||
     input.sourceHeight[0]>input.sourceHeight[1])fail('Invalid source map height');
  if(input.createdAt!==null && (typeof input.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.createdAt)))
    fail('Invalid source feature date');
  const terrain=input.role==='terrain';
  if(terrain&&mapContext.verticalPolicy!=='source-relative')fail('Terrain requires a source-relative vertical frame');
  if(!Array.isArray(input.surfaces)||!input.surfaces.length||input.surfaces.length>(terrain?8192:130))
    fail('Map feature exceeds its face budget');
  const surfaces=input.surfaces.map(face=>{mapSurfaceFrame(face);return face.map(p=>[...p]);});
  if(surfaces.reduce((n,p)=>n+p.length,0)>(terrain?24576:1024))fail('Map feature exceeds its vertex budget');
  const result={version:1,role:input.role,sourceFeatureId,createdAt:input.createdAt,
    sourceHeight:[...input.sourceHeight],surfaces};
  const {min,max}=mapGeometryBounds(result);
  if(Math.abs(min[1])>1e-6 || max.some((v,i)=>v-min[i]>500) ||
     max[0]-min[0]<.01 || max[2]-min[2]<.01)fail('Map feature extent is unsupported');
  if(terrain){
    if(Math.abs(max[1]-(input.sourceHeight[1]-input.sourceHeight[0]))>1e-5||
       surfaces.some(p=>p.length!==3||Math.abs(mapSurfaceFrame(p).normal[1])<.01||
        p.some((v,i)=>Math.hypot(v[0]-p[(i+1)%3][0],v[2]-p[(i+1)%3][2])>50)))
      fail('Terrain requires bounded heightfield triangles with retained source span');
  }else if(input.role==='road'){
    if(max[1]>1e-6 || input.sourceHeight.some(v=>Math.abs(v)>1e-6))
      fail('Only source-zero-height road plans are qualified');
  }else{
    const height=max[1],bases=surfaces.filter(p=>p.every(v=>Math.abs(v[1])<1e-6));
    const roofs=surfaces.filter(p=>p.every(v=>Math.abs(v[1]-height)<1e-6));
    if(height<.1||Math.abs(height-(input.sourceHeight[1]-input.sourceHeight[0]))>1e-5||
       bases.length!==1||roofs.length!==1||surfaces.length!==bases[0].length+2||
       bases[0].length!==roofs[0].length||
       !bases[0].every(p=>roofs[0].some(q=>same([p[0],p[2]],[q[0],q[2]]))))
      fail('Only complete vertical LoD1 prisms are qualified');
    const edges=new Map(), key=p=>p.map(v=>Math.round(v*1e5)).join(',');
    for(const face of surfaces)for(let i=0;i<face.length;i++){
      const a=key(face[i]),b=key(face[(i+1)%face.length]),k=[a,b].sort().join('|');
      edges.set(k,(edges.get(k)||0)+1);
    }
    if([...edges.values()].some(n=>n!==2)||surfaces.some(p=>p.some(v=>Math.abs(v[1])>1e-6&&Math.abs(v[1]-height)>1e-6)))
      fail('Map building is not a closed vertical prism');
    for(const face of surfaces.filter(p=>p!==bases[0]&&p!==roofs[0])){
      const lower=face.filter(p=>Math.abs(p[1])<1e-6),upper=face.filter(p=>Math.abs(p[1]-height)<1e-6);
      if(face.length!==4||lower.length!==2||upper.length!==2||!lower.every(p=>upper.some(q=>same([p[0],p[2]],[q[0],q[2]]))))
        fail('Map building has unsupported side geometry');
    }
  }
  return result;
}

export function mapBuildingFootprint(geometry) {
  if(geometry.role!=='building') return null;
  return geometry.surfaces.find(face=>face.every(p=>Math.abs(p[1])<1e-6)).map(p=>[p[0],p[2]]);
}

/** The importer and admission share a single geometry-to-anchor envelope. */
export function validateMapFeatureEnvelope(geometry,position,size,mapContext) {
  const {min,max}=mapGeometryBounds(geometry);
  if(Math.abs(min[0]+max[0])>1e-5||Math.abs(min[2]+max[2])>1e-5||
     size.some((v,i)=>Math.abs(v-Math.max(.01,max[i]-min[i]))>1e-5)||
     !position.every(Number.isFinite)||Math.abs(position[1]-(mapContext?.verticalPolicy==='source-relative'&&geometry.role!=='road'?geometry.sourceHeight[0]-mapContext.heightOrigin:0))>1e-6)
    fail('Map anchor envelope differs from its retained geometry');
}
