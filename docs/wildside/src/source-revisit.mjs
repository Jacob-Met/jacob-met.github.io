import {mountRegionRevisit} from './region-revisit.mjs';
import {mountEvidenceRevisit} from './evidence/view.mjs';
import {prepareEvidence} from './evidence/source.mjs';

/** Read-only shape adapter. This ephemeral projection is never admitted as an observation. */
export function preparePlaceEvidence(place,observationId){
 const observation=place?.observations?.find(o=>o.id===observationId);
 if(!observation||(place.revokedSources||[]).includes(observation.source.id))throw new Error('This source is no longer available in the place.');
 if(!['photo','video'].includes(observation.source.kind))throw new Error('Choose a kept photo or a clip with a recorded moment.');
 if(observation.source.kind==='video'&&(!Number.isFinite(observation.source.offsetSeconds)||observation.source.offsetSeconds<0))
   throw new Error('This clip has no kept moment offset and cannot be reopened.');
 const names=observation.features.map(f=>f.label).join(', ');
 const regions=observation.regionProposals;
 const regionText=regions?` Inferred image regions (${regions.inference.model}): ${regions.regions.map(r=>r.description).join('; ')||'none'}. Pixel regions do not establish species, physical supports or measured geometry.`:'';
 const interpretation=`Annotated landmarks: ${names||'none'}. ${observation.notes||''}${regionText} Geometry, dimensions and occluded structure are interpretations, not facts established by the fingerprint.`;
 const review={version:1,id:observation.id.slice(0,100),method:'human-review',
  source:{kind:'local-media',sourceId:observation.source.id,mediaKind:observation.source.kind,label:observation.source.label.slice(0,120)||'Locally reviewed place source',capturedAt:observation.source.capturedAt??null,offsetSeconds:observation.source.kind==='video'?observation.source.offsetSeconds:null},
  observation:{subject:observation.source.kind==='video'?'Original clip moment behind this place':'Original photo behind this place',notes:regions?'This local source informed automatic image-region proposals. Reopening reconnects the source; it does not confirm the model descriptions or add an observation.':'This local source was supplied for manual landmark annotation. Reopening it does not add an observation or confirm the reconstructed geometry.'},
  interpretation:interpretation.length>2000?interpretation.slice(0,1997)+'…':interpretation};
 prepareEvidence(review); // Reuse the maintained source identity, date and record validation.
 return review;
}

/** Host must dispose on leaving the source session or changing the private audience. */
export function mountSourceRevisit(container,{place,getPlace=()=>place,observationId,onClose=()=>{}}){
 if(!container?.ownerDocument)throw new TypeError('Provide a source view container');
 preparePlaceEvidence(place,observationId);
 if(place.observations.find(o=>o.id===observationId)?.regionProposals)return mountRegionRevisit(container,{place,getPlace,observationId,onClose});
 const document=container.ownerDocument,window=document.defaultView,placeId=place.id;
 const host=document.createElement('section');host.className='source-revisit';
 const heading=document.createElement('h2');heading.textContent='Return to the source';
 const hint=document.createElement('p');hint.textContent='Choose the exact original photo or clip. Edited or recompressed copies are refused. The original stays in this viewing session; nothing is uploaded or saved.';
 const close=document.createElement('button');close.type='button';close.textContent='Back to the place';close.addEventListener('click',onClose);
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const target=document.createElement('div');host.append(heading,hint,close,status,target);container.append(host);
 const view=mountEvidenceRevisit(target);let disposed=false;
 function refresh(){
  if(disposed)return {ok:false,reason:'closed'};
  try{const current=getPlace();if(current?.id!==placeId)throw new Error('The active place changed. This source view has been cleared.');const review=preparePlaceEvidence(current,observationId);view.show(review);status.textContent='';return {ok:true};}
  catch(error){view.clear();status.textContent=error.message;return {ok:false,reason:error.message};}
 }
 const storageChanged=()=>refresh();window.addEventListener('storage',storageChanged);refresh();
 return {refresh,dispose(){if(disposed)return;disposed=true;window.removeEventListener('storage',storageChanged);view.destroy();host.remove();}};
}

