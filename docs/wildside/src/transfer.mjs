import {validateSession} from './session.mjs';

export const TRANSFER_FORMAT='wildside-derived-world';
export const MAX_TRANSFER_BYTES=16_000_000;
const encoder=new TextEncoder(),verifiedTransfers=new WeakSet();
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
function canonical(value,depth=0){
 if(depth>32)throw new Error('The transfer is nested beyond the supported format.');
 if(Array.isArray(value))return value.map(v=>canonical(v,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k],depth+1)]));
 return value;
}
const encode=value=>JSON.stringify(canonical(value));
function bounded(text){if(typeof text!=='string'||text.length>MAX_TRANSFER_BYTES||encoder.encode(text).length>MAX_TRANSFER_BYTES)throw new Error('The transfer exceeds the 16 MB local-file limit.');return text;}
// JSON fields/array commas are additive: assess the *combined* local session
// without repeatedly serializing a near-16 MB world for every incoming moment.
function jsonFootprint(value){const text=JSON.stringify(value);return {characters:text.length,bytes:encoder.encode(text).length};}
const fitsLocalSession=(characters,bytes,reserve=0)=>characters+reserve<=MAX_TRANSFER_BYTES&&bytes+reserve<=MAX_TRANSFER_BYTES;
async function digest(text){if(!globalThis.crypto?.subtle)throw new Error('This browser cannot verify a transfer fingerprint.');return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function exactProjection(input){
 const result=validateSession(input);
 // The maintained validators define the format. Extra/raw fields and inconsistent
 // derived geometry are refused, not silently retained or secretly discarded.
 if(encode(input)!==encode(result))throw new Error('The transfer contains unsupported fields or inconsistent derived data.');
 return result;
}
export function summarizeTransfer(session){
 const s=validateSession(session),sources=new Map();
 for(const p of s.places)for(const o of p.observations)sources.set(o.source.id,o.source.kind);
 return {placeCount:s.places.length,places:s.places.map(p=>({id:p.id,name:p.name,revision:p.revision,landmarks:p.anchors.length,observations:p.observations.length,historyRevisions:p.history.length,revokedSources:p.revokedSources.length})),momentCount:s.memories.length,sourceCount:sources.size,
  contents:[...(s.places.some(p=>p.observations.some(o=>o.mapContext))?['Public map geometry, its geographic origin, source URLs, dates, fingerprints and attribution']:[]),'Place names, notes and manually supplied spatial annotations','Source fingerprints, labels and recorded times (when known)','Interpreted geometry, source-derived color summaries and revision history','Source-removal tombstones',...(s.places.some(p=>p.observations.some(o=>o.regionProposals))?['Inferred image-region descriptions, pixel bounds and model/source identifiers']:[]),...(s.memories.length?['Personal moment names, dates and landmark-relative viewpoints']:[])],
  excluded:['Original photos, video and audio','Decoded image pixels and object URLs','Live camera connections and remote access grants'],
  note:'Names, notes, dates and local spatial coordinates may be personal. Inspect these contents before moving this file. A fingerprint detects changes; it is not a signature or permission grant.'};
}
/** Deliberate export projection; raw fields are not part of the maintained session model. */
export async function serializeTransfer(session,{placeIds,includeMemories=true}={}){
 const normalized=validateSession(session),ids=placeIds===undefined?normalized.places.map(p=>p.id):placeIds;
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!normalized.places.some(p=>p.id===id)))throw new Error('Select one or more existing places exactly once.');
 const selected=new Set(ids),data=validateSession({version:1,sequence:0,activePlaceId:selected.has(normalized.activePlaceId)?normalized.activePlaceId:ids[0],places:normalized.places.filter(p=>selected.has(p.id)),memories:includeMemories?normalized.memories.filter(m=>selected.has(m.placeId)):[]});
 const content=encode(data),hash=await digest(content),text=bounded(encode({format:TRANSFER_FORMAT,version:1,sha256:hash,data}));
 return {text,sha256:hash,summary:summarizeTransfer(data),bytes:encoder.encode(text).length};
}
/** Parse and validate an untrusted local file before any mutation or persistence. */
export async function parseTransfer(text){
 bounded(text);let envelope;try{envelope=JSON.parse(text);}catch{throw new Error('This file is not valid JSON; existing places are unchanged.');}
 if(!envelope||Array.isArray(envelope)||Object.keys(envelope).sort().join(',')!=='data,format,sha256,version'||envelope.format!==TRANSFER_FORMAT||envelope.version!==1||typeof envelope.sha256!=='string'||!/^[a-f0-9]{64}$/.test(envelope.sha256))throw new Error('This is not a supported Wildside derived-world file.');
 const actual=await digest(encode(envelope.data));if(actual!==envelope.sha256)throw new Error('This file changed or is incomplete; its content fingerprint does not match.');
 const data=exactProjection(envelope.data);
 const verified=freeze({format:TRANSFER_FORMAT,version:1,sha256:actual,data,summary:summarizeTransfer(data)});verifiedTransfers.add(verified);return verified;
}
/** No overwrite strategy exists here. Caller previews conflicts, then chooses reject or skip. */
export function mergeTransfer(current,transfer,{conflicts='reject',activateImported=false,placeIds,momentIds,momentReplacement}={}){
 if(!['reject','skip'].includes(conflicts))throw new Error('Choose reject or skip for conflicting identities.');
 if(!verifiedTransfers.has(transfer)||transfer?.format!==TRANSFER_FORMAT||transfer.version!==1)throw new Error('Parse and verify the local transfer before importing.');
 const baseline=validateSession(current),verified=exactProjection(transfer.data);
 // Selection is over already verified original IDs, never a modified or rehashed
 // file. Unselected places contribute neither moments nor source removals.
 const ids=placeIds===undefined?verified.places.map(p=>p.id):placeIds;
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||
    ids.some(id=>typeof id!=='string'||!verified.places.some(p=>p.id===id)))
  throw new Error('Select one or more distinct places from the verified file.');
 const selected=new Set(ids);
 // Moment selection is another projection of the *verified original file*.
 // Neither user-edited payloads nor IDs belonging to omitted places are admitted.
 const eligibleMoments=verified.memories.filter(m=>selected.has(m.placeId));
 const chosenMomentIds=momentIds===undefined?eligibleMoments.map(m=>m.id):momentIds;
 if(!Array.isArray(chosenMomentIds)||new Set(chosenMomentIds).size!==chosenMomentIds.length||
    chosenMomentIds.some(id=>typeof id!=='string'||!eligibleMoments.some(m=>m.id===id)))
  throw new Error('Select distinct original personal moments from the selected verified places.');
 const chosenMoments=new Set(chosenMomentIds);
 const replacement=momentReplacement;
 if(replacement!==undefined){
  if(!replacement||Array.isArray(replacement)||Object.keys(replacement).sort().join(',')!=='incomingId,localId'||
    typeof replacement.incomingId!=='string'||typeof replacement.localId!=='string'||
    replacement.incomingId===replacement.localId||!chosenMoments.has(replacement.incomingId)||
    chosenMoments.has(replacement.localId))
   throw new Error('Choose one distinct original incoming moment and one unselected older local moment for replacement.');
  const incomingMoment=eligibleMoments.find(m=>m.id===replacement.incomingId);
  const existingIncoming=baseline.memories.find(m=>m.id===replacement.incomingId);
  const existingLocal=baseline.memories.find(m=>m.id===replacement.localId);
  const exactReplay=!existingLocal&&existingIncoming&&encode(existingIncoming)===encode(incomingMoment);
  if((!existingLocal&&!exactReplay)||(existingLocal&&existingIncoming))
   throw new Error('The chosen older local moment changed, or the incoming replacement already exists. Reopen the import preview.');
 }
 const unselectedMoments=momentIds===undefined?[]:eligibleMoments.filter(m=>!chosenMoments.has(m.id)).map(m=>m.id);
 const incoming=placeIds===undefined&&momentIds===undefined?verified:validateSession({
  ...verified,
  activePlaceId:selected.has(verified.activePlaceId)?verified.activePlaceId:verified.places.find(p=>selected.has(p.id)).id,
  places:verified.places.filter(p=>selected.has(p.id)),
  memories:eligibleMoments.filter(m=>chosenMoments.has(m.id))
 });
 const next=structuredClone(baseline),issues=[],addedPlaces=[],identicalPlaces=[],skippedPlaces=[],addedMoments=[],identicalMoments=[];
 const accepted=new Set();
 // Source revocation is a local privacy boundary, not merely a place-ID conflict.
 // A differently named imported place must not restore an observed source that
 // a local place previously revoked.
 const locallyRevokedSources=new Set(next.places.flatMap(p=>p.revokedSources));
 const localRevoked=new Set(locallyRevokedSources);
 const localObserved=new Set(next.places.flatMap(p=>p.observations.map(o=>o.source.id)));
 const eligible=p=>{const existing=next.places.find(local=>local.id===p.id);return !existing||encode(existing)===encode(p);};
 // Importing a tombstone must not invalidate an unchanged local observation.
 // Such a place can be explicitly skipped; its unaccepted revocations must not
 // suppress unrelated incoming places that legitimately reuse that source.
 const tombstoneConflicts=new Map();
 for(const p of incoming.places){
  if(!eligible(p))continue;
  const conflicting=p.revokedSources.filter(source=>localObserved.has(source));
  if(conflicting.length)tombstoneConflicts.set(p.id,conflicting);
 }
 // A place that would be skipped for replaying a locally revoked source must
 // not export *its* tombstones into otherwise valid incoming sibling places.
 const locallyUnreceivable=new Set(incoming.places.filter(p=>p.observations.some(o=>localRevoked.has(o.source.id))).map(p=>p.id));
 // Cycle membership belongs to the original transfer, not to the mutable
 // receiving session. Otherwise replaying a file can admit a previously skipped
 // cycle member after another imported place makes its peer locally invalid.
 // Keep only actual cycle members out, never their acyclic descendants.
 const candidates=incoming.places.filter(eligible);
 const edges=new Map(candidates.map(p=>[p.id,candidates.filter(other=>
  p.revokedSources.some(source=>other.observations.some(o=>o.source.id===source))
 ).map(other=>other.id)]));
 const circularConflicts=new Set();
 for(const p of candidates){
  const stack=[...edges.get(p.id)],seen=new Set();
  while(stack.length){
   const id=stack.pop();
   if(id===p.id){circularConflicts.add(id);break;}
   if(seen.has(id))continue;
   seen.add(id);stack.push(...edges.get(id));
  }
 }
 // Process accepted revocation roots before their observation dependants,
 // regardless of file order. Skipped places cannot export tombstones.
 const pending=new Map(candidates.filter(p=>!tombstoneConflicts.has(p.id)&&!locallyUnreceivable.has(p.id)&&!circularConflicts.has(p.id)).map(p=>[p.id,p]));
 const incomingRevoked=new Set(),capacityConflicts=new Set(),sizeConflicts=new Set();
 let placeSlots=24-next.places.length;
 // The next stored sequence may gain a digit; reserve its real encoded width.
 const saveSequenceReserve=String(baseline.sequence+1).length-String(baseline.sequence).length;
 const baseSize=jsonFootprint(next);
 let plannedCharacters=baseSize.characters,plannedBytes=baseSize.bytes,plannedActive=baseline.activePlaceId;
 const plannedNewPlaces=[];
 while(pending.size){
  const pendingRevoked=new Set([...pending.values()].flatMap(p=>p.revokedSources));
  const roots=[...pending.values()].filter(p=>p.observations.every(o=>!pendingRevoked.has(o.source.id)));
  if(!roots.length)throw new Error('Unresolvable source-removal dependency graph.');
  for(const p of roots){
   pending.delete(p.id);
   if(p.observations.some(o=>incomingRevoked.has(o.source.id)))continue;
   // Already-present identical places do not spend another place slot.
   // Resolve tombstone dependencies before allocating the remaining slots:
   // a place omitted for capacity must not contribute an effective removal.
   if(!next.places.some(existing=>existing.id===p.id)){
    if(!placeSlots){capacityConflicts.add(p.id);continue;}
    const size=jsonFootprint(p);
    const proposedIds=[...plannedNewPlaces,p.id];
    const proposedActive=activateImported?(proposedIds.includes(incoming.activePlaceId)?incoming.activePlaceId:proposedIds[0]):baseline.activePlaceId;
    const oldActiveSize=jsonFootprint(plannedActive),newActiveSize=jsonFootprint(proposedActive);
    const extraCharacters=1+size.characters+newActiveSize.characters-oldActiveSize.characters;
    const extraBytes=1+size.bytes+newActiveSize.bytes-oldActiveSize.bytes;
    if(!fitsLocalSession(plannedCharacters+extraCharacters,plannedBytes+extraBytes,saveSequenceReserve)){
     sizeConflicts.add(p.id);continue;
    }
    plannedCharacters+=extraCharacters;plannedBytes+=extraBytes;plannedActive=proposedActive;
    plannedNewPlaces.push(p.id);placeSlots--;
   }
   for(const source of p.revokedSources)incomingRevoked.add(source);
  }
 }
 for(const source of incomingRevoked)localRevoked.add(source);
 for(const p of incoming.places){
  const tombstoneConflict=tombstoneConflicts.get(p.id);
  if(tombstoneConflict){
   issues.push({kind:'place',id:p.id,name:p.name,reason:'This imported place revokes a source still used by an existing local place.',localRevokedSources:[],incomingRevokedSources:[...tombstoneConflict],revocationsApplied:false});
   skippedPlaces.push(p.id);continue;
  }
  if(circularConflicts.has(p.id)){
   issues.push({kind:'place',id:p.id,name:p.name,reason:'Conflicting source-removal dependencies in the imported file cannot be resolved safely.',localRevokedSources:[],incomingRevokedSources:[...p.revokedSources],revocationsApplied:false});
   skippedPlaces.push(p.id);continue;
  }
  const resurrected=p.observations.filter(o=>localRevoked.has(o.source.id));
  if(resurrected.length){
   const alreadyRemoved=resurrected.filter(o=>locallyRevokedSources.has(o.source.id));
   issues.push({kind:'place',id:p.id,name:p.name,reason:alreadyRemoved.length?'This imported place contains a source previously removed locally.':'This imported place contains a source removed by another eligible imported place.',localRevokedSources:[...new Set(alreadyRemoved.map(o=>o.source.id))],incomingRevokedSources:[...p.revokedSources],revocationsApplied:false});
   skippedPlaces.push(p.id);continue;
  }
  const existing=next.places.find(x=>x.id===p.id);
  if(!existing&&capacityConflicts.has(p.id)){
   issues.push({kind:'place',id:p.id,name:p.name,reason:'The saved world supports at most 24 places; this additional place was not admitted.',localRevokedSources:[],incomingRevokedSources:[...p.revokedSources],revocationsApplied:false});
   skippedPlaces.push(p.id);continue;
  }
  if(!existing&&sizeConflicts.has(p.id)){
   issues.push({kind:'place',id:p.id,name:p.name,reason:'The combined saved world would exceed the 16 MB local-file limit; this additional place was not admitted.',localRevokedSources:[],incomingRevokedSources:[...p.revokedSources],revocationsApplied:false});
   skippedPlaces.push(p.id);continue;
  }
  if(!existing){next.places.push(structuredClone(p));addedPlaces.push(p.id);accepted.add(p.id);}
  else if(encode(existing)===encode(p)){identicalPlaces.push(p.id);accepted.add(p.id);}
  else {issues.push({kind:'place',id:p.id,name:p.name,reason:'Different geometry, history or source-removal state uses this place identity.',localRevokedSources:[...existing.revokedSources],incomingRevokedSources:[...p.revokedSources],revocationsApplied:false});skippedPlaces.push(p.id);}
 }
 if(activateImported&&addedPlaces.length)next.activePlaceId=addedPlaces.includes(incoming.activePlaceId)?incoming.activePlaceId:addedPlaces[0];
 const receivedSize=jsonFootprint(next);
 let receivedCharacters=receivedSize.characters,receivedBytes=receivedSize.bytes;
 const replacedMoments=[];
 for(const m of incoming.memories){
  if(!accepted.has(m.placeId))continue;
  const existing=next.memories.find(x=>x.id===m.id);
  if(!existing){
   if(replacement?.incomingId===m.id){
    const at=next.memories.findIndex(old=>old.id===replacement.localId);
    if(at<0)throw new Error('The older local moment changed after this preview. Review the import again.');
    const older=next.memories[at],before=jsonFootprint(older),after=jsonFootprint(m);
    const nextCharacters=receivedCharacters+after.characters-before.characters;
    const nextBytes=receivedBytes+after.bytes-before.bytes;
    if(!fitsLocalSession(nextCharacters,nextBytes,saveSequenceReserve)){
     issues.push({kind:'moment',id:m.id,name:m.label,reason:'The replacement would exceed the 16 MB local-file limit; the older local moment was kept.'});
    }else{
     next.memories[at]=structuredClone(m);
     addedMoments.push(m.id);replacedMoments.push({incomingId:m.id,localId:older.id});
     receivedCharacters=nextCharacters;receivedBytes=nextBytes;
    }
   }
   else if(next.memories.length>=500)issues.push({kind:'moment',id:m.id,name:m.label,reason:'The saved world supports at most 500 personal moments; this additional moment was not admitted.'});
   else {
    const size=jsonFootprint(m),comma=next.memories.length?1:0;
    if(!fitsLocalSession(receivedCharacters+size.characters+comma,receivedBytes+size.bytes+comma,saveSequenceReserve)){
     issues.push({kind:'moment',id:m.id,name:m.label,reason:'The combined saved world would exceed the 16 MB local-file limit; this additional personal moment was not admitted.'});
    }else{next.memories.push(structuredClone(m));addedMoments.push(m.id);receivedCharacters+=size.characters+comma;receivedBytes+=size.bytes+comma;}
   }
  }
  else if(encode(existing)===encode(m))identicalMoments.push(m.id);
  else issues.push({kind:'moment',id:m.id,name:m.label,reason:'A different personal moment already uses this identity.'});
 }
 if(issues.length&&conflicts==='reject')return {ok:false,conflicts:issues,summary:{addedPlaces:[],addedMoments:[],skippedPlaces},next:null};
 // Reuse all cross-place, memory/history and capacity checks before proposing one save.
 const checked=validateSession(next);bounded(JSON.stringify(checked));
 return {ok:true,next:checked,conflicts:issues,summary:{addedPlaces,identicalPlaces,skippedPlaces,addedMoments,replacedMoments,identicalMoments,skippedMoments:incoming.memories.filter(m=>!accepted.has(m.placeId)||issues.some(i=>i.kind==='moment'&&i.id===m.id)).map(m=>m.id),...(momentIds===undefined?{}:{unselectedMoments})},changed:addedPlaces.length>0||addedMoments.length>0};
}
/** Transaction adapter: one existing atomic storage save, guarded by the preview sequence.
 * Browser hosts also use their maintained navigator.locks boundary around this call.
 */
export function commitTransfer(store,transfer,{expectedSequence,...options}={}){
 const current=store.load();if(expectedSequence!==current.sequence)throw new Error('Saved places changed after this preview. Inspect the import again.');
 const plan=mergeTransfer(current,transfer,options);if(!plan.ok)return plan;
 if(!plan.changed)return {...plan,next:current};
 const saved=store.save(plan.next,expectedSequence);return {...plan,next:saved};
}

