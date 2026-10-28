import {synthesizeContextEnrichment} from './location-context.mjs';
/** Optional context for a place that already has interpreted structure. */
export function mountContextEnrichment(container,{preview,onApply}){
 let disposed=false,busy=false,current=null;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const title=el('h2','Life in familiar spaces'),intro=el('p','Add a public habitat interpretation to this place. Planting fits supported walls and clear containers already here; your landmarks stay in place.');
 const label=el('label','Public habitat context'),input=el('input');input.id='habitat-enrichment-query';input.placeholder='London courtyard';input.maxLength=180;label.append(input);
 const status=el('p'),sources=el('div'),apply=el('button','Enrich this place');status.setAttribute('role','status');apply.type='button';apply.id='habitat-enrichment-apply';
 function refresh(){
  current=null;sources.replaceChildren();apply.disabled=true;
  if(!input.value.trim()){status.textContent='Available: London courtyard. This describes a representative habitat, not an address or wildlife sighting.';return;}
  try{
   const candidate=synthesizeContextEnrichment({query:input.value,observationId:'context-preview',sourceId:'public:context-preview'});
   if(candidate.status!=='proposed'){status.textContent=candidate.reason;return;}
   const count=preview(candidate.observation);
   for(const source of candidate.observation.geographicContext.sources){const a=el('a',source.publisher+' · habitat source');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';sources.append(a,el('p',source.claim));}
   status.textContent=count?`${count} supported planting ${count===1?'patch fits':'patches fit'} this place. Plants are illustrative and follow later changes to their support.`:'No clear, supported planting fits this place yet. Its existing structure is unchanged.';
   if(count){current=input.value;apply.disabled=busy;}
  }catch(error){status.textContent=error.message;}
 }
 input.addEventListener('input',refresh);refresh();
 apply.onclick=async()=>{if(disposed||busy||!current)return;busy=true;apply.disabled=true;try{
  const id=crypto.randomUUID(),result=synthesizeContextEnrichment({query:current,observationId:'habitat-'+id,sourceId:'public:'+id});
  if(result.status!=='proposed')throw Error(result.reason);
  await onApply(result.observation);
 }catch(error){if(!disposed)status.textContent=error.message;}finally{busy=false;if(!disposed)apply.disabled=!current;}};
 container.append(title,intro,label,sources,status,apply);
 return {dispose(){disposed=true;input.removeEventListener('input',refresh);apply.onclick=null;}};
}
