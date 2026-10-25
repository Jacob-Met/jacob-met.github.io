import {resolvePublicContext,synthesizeContextObservation} from './location-context.mjs';
import {createPlace,admitObservation} from './place.mjs';
/** Uses the maintained place/session caller; does not create a store or renderer. */
export function mountLocationContext(container,{onCreate,onPhoto,imagined=null}){
 let disposed=false,busy=false;const abort=new AbortController();
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;},heading=el('h2','Begin with a place'),intro=el('p','Explore a public map or habitat interpretation, then add your own views as this place grows.'),label=el('label','Public region'),input=el('input');input.id='location-context-query';input.placeholder='Saguaro or Everglades';input.maxLength=180;label.append(input);
 const details=el('div'),status=el('p'),start=el('button','Explore this landscape'),photo=el('button','Begin with my own photo or video');start.type=photo.type='button';start.id='location-context-create';photo.id='location-context-source';status.setAttribute('role','status');
 const choice=el('select');choice.id='location-context-water';for(const [value,text] of [['illustrative-wet','Wet-season interpretation'],['illustrative-dry','Dry-season interpretation']]){const o=el('option',text);o.value=value;choice.append(o);}
 function refresh(){details.replaceChildren();const found=resolvePublicContext(input.value);if(found.status!=='resolved'){start.disabled=true;choice.hidden=true;status.textContent=input.value?found.reason:'Available first contexts: Saguaro desert scrub and Everglades sawgrass marsh.';return;}
  start.disabled=busy;const c=found.context;choice.hidden=c.habitat!=='freshwater-marsh';details.append(el('h3',c.label),el('p','Habitat-scale interpretation. Layout and dimensions are composed for exploration; this is not a survey of a particular point.'));
  for(const s of c.sources){const a=el('a',s.publisher+' · habitat source');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';details.append(a,el('p',s.claim),el('small',`Retrieved ${s.retrieved}; source updated ${s.updated??'date not supplied'}. ${c.resolution}.`));}
  status.textContent=c.habitat==='freshwater-marsh'?'Choose an illustrative water state. This source does not report current water levels.':'Water presence is not established for this broad desert context.';
 }
 input.addEventListener('input',refresh);refresh();
 start.onclick=async()=>{if(busy||disposed)return;busy=true;start.disabled=true;try{
  const id=crypto.randomUUID(),result=synthesizeContextObservation({query:input.value,observationId:'context-'+id,sourceId:'public:'+id,waterScenario:choice.hidden?'illustrative-dry':choice.value});
  if(result.status!=='proposed')throw Error(result.reason);const place=admitObservation(createPlace({id:'place-'+id,name:resolvePublicContext(input.value).context.label}),result.observation);
  if(!disposed)await onCreate(place);
 }catch(error){if(!disposed)status.textContent=error.message;}finally{busy=false;if(!disposed)start.disabled=false;}};
 const mapHeading=el('h3','An ordinary Kyoto neighborhood'),mapIntro=el('p','Explore a Kyoto hillside with mapped buildings, streets and terrain, and imagined life. This is a historical city model.'),mapButton=el('button','Explore the Kyoto block');mapButton.id='location-context-map';mapButton.type='button';
 mapButton.onclick=async()=>{if(busy||disposed)return;busy=true;mapButton.disabled=true;start.disabled=true;status.textContent='Opening the public map…';try{const response=await fetch('data/kyoto-public-block.json',{signal:abort.signal});if(!response.ok)throw Error('The bundled public map is unavailable. Your existing places are unchanged.');const {parseTransfer}=await import('./transfer.mjs');const parsed=await parseTransfer(await response.text());if(parsed.data.places.length!==1)throw Error('The bundled map has an unsupported layout.');if(!disposed)await onCreate(parsed.data.places[0]);}catch(error){if(!disposed)status.textContent=error.message;}finally{busy=false;if(!disposed){mapButton.disabled=false;start.disabled=resolvePublicContext(input.value).status!=='resolved';}}};
 const liveNodes=[];
 if(imagined){const ok=imagined.available();liveNodes.push(el('h3','Imagined places from the HAMON Engine'),el('p',ok?'Composed, not real: authored scenes with simulated wildlife. Walk them at Human, Bird or Insect scale, in any look.':'These imagined places need the HAMON view (WebGPU). Open Wildside with ?hamon=1 in a browser that supports it.'));
  for(const def of imagined.places){const b=el('button','Explore '+def.title.toLowerCase().replace(/^the /,'the '));b.id='imagined-'+def.id;b.type='button';b.disabled=!ok;b.title=def.blurb;
   b.onclick=async()=>{if(busy||disposed)return;busy=true;b.disabled=true;status.textContent='Composing '+def.title.toLowerCase()+'…';try{await imagined.open(def.id);}catch(error){if(!disposed)status.textContent=error.message;}finally{busy=false;if(!disposed)b.disabled=!ok;}};liveNodes.push(b);}}
 photo.onclick=()=>{if(!busy&&!disposed)onPhoto();};container.append(heading,intro,mapHeading,mapIntro,mapButton,...liveNodes,label,details,choice,status,start,photo);
 return {dispose(){disposed=true;abort.abort();mapButton.onclick=null;start.onclick=null;photo.onclick=null;input.removeEventListener('input',refresh);}};
}
