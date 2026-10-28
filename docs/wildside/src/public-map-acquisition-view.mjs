import {parseTransfer} from './transfer.mjs';
/** Existing server + transfer + onCreate caller; no independent persistence. */
export function mountPublicMapAcquisition(container,{onCreate,existingPlace=null}){
 let disposed=false,generation=0,request=null,ready=null,opening=false;
 const node=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const section=node('section');section.id='public-map-acquisition';section.setAttribute('aria-labelledby','public-map-acquisition-heading');
 const heading=node('h3','Acquire a nearby public map');heading.id='public-map-acquisition-heading';
 const note=node('p','Use an approximate public location, not an address or your device location. This downloads historical Kyoto 2025 buildings and streets from MLIT PLATEAU. Coverage and supported geometry are limited; no terrain or current wildlife presence is inferred.');
 const retained=existingPlace?.observations?.find(o=>o.mapContext)?.mapContext;
 const origin=retained?.origin??[34.956,135.7904];
 const field=(id,title,value,min,max,step)=>{const label=node('label',title),input=node('input');input.id=id;input.type='number';input.value=String(value);input.min=String(min);input.max=String(max);input.step=String(step);label.append(input);return {label,input};};
 const lat=field('public-map-latitude','Public latitude',origin[0],33.4,36.33,'any'),lon=field('public-map-longitude','Public longitude',origin[1],134.86,136.99,'any'),radius=field('public-map-radius','Neighborhood radius (metres)',retained?.radiusMeters??80,10,250,1);
 const provenance=node('p',retained?'Starting from this place’s retained public map origin. Opening the same place again keeps its later observations and source removals.':'Starting from the bundled public Kyoto area; change the approximate coordinates to explore another supported neighborhood.');
 const acquire=node('button','Acquire this public map'),cancel=node('button','Cancel acquisition'),explore=node('button','Explore acquired neighborhood'),status=node('p'),preview=node('div');
 acquire.id='public-map-acquire';cancel.id='public-map-cancel';explore.id='public-map-explore';status.id='public-map-status';preview.id='public-map-preview';status.setAttribute('role','status');status.setAttribute('aria-live','polite');for(const b of [acquire,cancel,explore])b.type='button';cancel.hidden=true;explore.hidden=true;
 function invalidate(message='Location changed. Acquire this public map to continue.'){
  generation++;request?.abort();request=null;ready=null;preview.replaceChildren();explore.hidden=true;acquire.disabled=false;cancel.hidden=true;status.textContent=message;
 }
 for(const f of [lat,lon,radius])f.input.addEventListener('input',()=>invalidate());
 cancel.onclick=()=>invalidate('Acquisition canceled. Existing places are unchanged.');
 acquire.onclick=async()=>{
  if(disposed||opening||request)return;
  invalidate('Acquiring original public map sources…');const current=generation;
  const origin=[lat.input.valueAsNumber,lon.input.valueAsNumber],radiusMeters=radius.input.valueAsNumber;
  if(!origin.every(Number.isFinite)||!Number.isFinite(radiusMeters)||![lat,lon,radius].every(f=>f.input.checkValidity())){status.textContent='Enter valid public coordinates and a radius from 10 to 250 metres.';return;}
  request=new AbortController();const signal=request.signal;acquire.disabled=true;cancel.hidden=false;
  try{
   const response=await fetch('/api/public-map/acquire',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({origin,radiusMeters}),signal});
   if(Number(response.headers.get('content-length'))>16_100_000)throw Error('The acquired response exceeds the supported transfer size.');
   const reader=response.body.getReader(),chunks=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16_100_000)throw Error('The acquired response exceeds the supported transfer size.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
   const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}let result;
   try{result=JSON.parse(new TextDecoder().decode(bytes));}catch{throw Error('The local public-map service returned an unreadable response.');}
   if(!response.ok||result.status!=='acquired')throw Error(`${result.code??'acquisition-failed'}: ${result.message??'The map could not be acquired.'}`);
   const parsed=await parseTransfer(JSON.stringify(result.transfer));
   if(parsed.data.places.length!==1)throw Error('The acquired map has an unsupported layout.');
   const place=parsed.data.places[0],contexts=place.observations.map(o=>o.mapContext);
   if(!contexts.length||contexts.some(c=>!c||c.origin[0]!==origin[0]||c.origin[1]!==origin[1]||c.radiusMeters!==radiusMeters||c.cityCode!=='26100'||c.year!==2025))throw Error('The acquired map does not match the requested public location.');
   if(disposed||current!==generation||signal.aborted)return;
   ready=place;preview.append(node('p',`${place.anchors.length} interpreted map features from ${place.observations.length} original sources. Buildings and streets are historical model geometry, not a current survey.`));
   for(const c of contexts)preview.append(node('p',`${c.attribution} · ${c.year} · ${c.tile}`));
   if(result.receipt?.catalogue){const details=node('details'),summary=node('summary','Acquisition source receipt'),line=node('p');for(const part of (`Catalogue ${result.receipt.catalogue.url} · SHA-256 ${result.receipt.catalogue.sha256}`).match(/.{1,24}/g)??[]){line.append(document.createTextNode(part),node('wbr'));}details.append(summary,line);preview.append(details);} const refused=result.receipt?.sources?.reduce((sum,s)=>sum+(s.refused??0),0)??0;if(refused)preview.append(node('p',`${refused} source features were refused by the existing importer. This place includes only supported geometry.`));
   status.textContent='Public map verified. Explore to keep it as a persistent place. Existing places are unchanged until then.';explore.hidden=false;
  }catch(error){if(!disposed&&current===generation&&!signal.aborted)status.textContent=error.message;}
  finally{if(!disposed&&current===generation){request=null;acquire.disabled=false;cancel.hidden=true;}}
 };
 explore.onclick=async()=>{if(disposed||opening||!ready)return;opening=true;explore.disabled=true;try{await onCreate(ready);}catch(error){if(!disposed)status.textContent=error.message;}finally{opening=false;if(!disposed)explore.disabled=false;}};
 section.append(heading,note,provenance,lat.label,lon.label,radius.label,acquire,cancel,status,preview,explore);container.append(section);
 return {dispose(){disposed=true;generation++;request?.abort();ready=null;acquire.onclick=cancel.onclick=explore.onclick=null;}};
}
