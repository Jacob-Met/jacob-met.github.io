import {createPlace,restorePlace,serializePlace,removeSource,placeAtRevision} from './place.mjs';
import {createExamplePlace} from './example-place.mjs';
import {resolveVisit} from './visits.mjs';
export const SESSION_KEY='wildside.continuing-world.v1';
export function defaultSession(){const p=createExamplePlace();return {version:1,sequence:0,activePlaceId:p.id,places:[p],memories:[]};}
export function validateSession(input){
  if(!input||input.version!==1||!Number.isSafeInteger(input.sequence)||input.sequence<0||!Array.isArray(input.places)||input.places.length>24||!input.places.length||!Array.isArray(input.memories)||input.memories.length>500)throw new Error('This saved visit is damaged or outside supported limits. It has not been overwritten.');
  const places=input.places.map(p=>restorePlace(serializePlace(p)));
  if(new Set(places.map(p=>p.id)).size!==places.length||!places.some(p=>p.id===input.activePlaceId))throw new Error('Saved place identity conflicts.');
  const seen=new Set();const memories=input.memories.map(m=>{
    if(!m||typeof m.id!=='string'||seen.has(m.id)||typeof m.label!=='string'||m.label.length>160||!Number.isSafeInteger(m.revision)||m.revision<0)throw new Error('A saved moment is damaged.');seen.add(m.id);
    const p=places.find(p=>p.id===m.placeId);if(!p||!resolveVisit(p,m).ok)throw new Error('A saved moment refers to an unavailable source.');
    const historical=placeAtRevision(p,m.revision);if(!resolveVisit(historical,m).ok)throw new Error('A saved moment has no valid historical viewpoint.');
    if(m.mode==='underwater'){
      const water=historical.anchors.find(a=>a.id===m.anchorId),sources=water?.sourceIds??[];
      if(water?.kind!=='water'||!sources.length||m.sourceIds.length!==sources.length||new Set(m.sourceIds).size!==sources.length||sources.some(id=>!m.sourceIds.includes(id)))
        throw new Error('A saved underwater moment does not match its water source.');
    }
    if(Object.hasOwn(m,'supportAnchorId')){
      // Prove dependencies against the captured revision. Today's support can
      // change while the historical moment remains valid and worth keeping.
      const support=historical.anchors.find(a=>a.id===m.supportAnchorId);
      const landmark=historical.anchors.find(a=>a.id===m.anchorId);
      const supportSources=support?.sourceIds??[];
      const sources=[...new Set([...(landmark?.sourceIds??[]),...supportSources])];
      if(m.mode!=='insect'||!support||!supportSources.length||m.sourceIds.length!==sources.length||new Set(m.sourceIds).size!==sources.length||sources.some(id=>!m.sourceIds.includes(id)))
        throw new Error('A saved insect moment does not match its supporting landmark and sources.');
    }
    return {id:m.id,kind:'personal-visit',label:m.label,at:typeof m.at==='string'?m.at:null,placeId:m.placeId,revision:m.revision,epoch:m.epoch,anchorId:m.anchorId,offset:m.offset.slice(),mode:m.mode,yaw:m.yaw,pitch:m.pitch,...(m.mode==='underwater'?{waterId:m.waterId}:{}),...(Object.hasOwn(m,'supportAnchorId')?{supportAnchorId:m.supportAnchorId}:{}),sourceIds:m.sourceIds.slice(),provenance:'personal-recollection'};
  });
  return {version:1,sequence:input.sequence,activePlaceId:input.activePlaceId,places,memories};
}
// A raw incoming transfer may deliberately contain incompatible source identities
// for inspection and explicit skip. A *saved local session* cannot: revocation
// of original source bytes applies to every place, not one geometry annotation.
function enforceStoredSourceRevocations(session){
 const globallyRevoked=new Set(session.places.flatMap(p=>p.revokedSources));
 if(session.places.some(p=>p.observations.some(o=>globallyRevoked.has(o.source.id))))
   throw new Error('A removed source cannot remain active in another saved place.');
 return session;
}
export function createSessionStore(storage,key=SESSION_KEY){return {
  load(){const raw=storage.getItem(key);if(raw===null)return defaultSession();if(raw.length>16e6)throw new Error('Saved visit exceeds the local limit.');return enforceStoredSourceRevocations(validateSession(JSON.parse(raw)));},
  save(next,expectedSequence){const raw=storage.getItem(key);const sequence=raw===null?0:enforceStoredSourceRevocations(validateSession(JSON.parse(raw))).sequence;if(expectedSequence!==sequence)throw new Error('This place changed in another window. Reopen it before saving.');const checked=enforceStoredSourceRevocations(validateSession({...next,sequence:sequence+1}));const encoded=JSON.stringify(checked);if(encoded.length>16e6)throw new Error('Saved visit exceeds the local limit; the previous version is unchanged.');storage.setItem(key,encoded);return checked;},
};}
export function removePlaceSource(session,placeId,sourceId){
  // Source IDs identify original bytes, not a particular place. Revoke the same
  // source wherever it was used locally, without touching unrelated places.
  const places=session.places.map(p=>(p.id===placeId||p.observations.some(o=>o.source.id===sourceId))?removeSource(p,sourceId):p);
  const memories=session.memories.filter(m=>{const p=places.find(p=>p.id===m.placeId);return p&&resolveVisit(p,m).ok;});
  return {...session,places,memories};
}

/**
 * Explicitly discard only a never-edited, source-free local place shell.
 * No retained source-removal authority, historical interpretation, or
 * dependent personal visit may be lost. Does not mutate the supplied session.
 */
export function discardEmptyPlace(session,placeId){
 if(!session||!Array.isArray(session.places)||!Array.isArray(session.memories))
   throw new Error('The saved visit is unavailable. Nothing was discarded.');
 const index=session.places.findIndex(p=>p?.id===placeId);
 if(index<0)throw new Error('This place is no longer available. Nothing was discarded.');
 if(session.places.length<=1)throw new Error('Keep at least one place in this browser.');
 const candidate=session.places[index];
 const original=createPlace({id:candidate.id,name:candidate.name});
 // Compare every supported field. Unknown future metadata is not disposable.
 if(Object.keys(candidate).length!==Object.keys(original).length||
    Object.keys(original).some(k=>JSON.stringify(candidate[k])!==JSON.stringify(original[k]))||
    session.memories.some(m=>m?.placeId===placeId))
   throw new Error('Only a never-edited empty place without sources, history or dependent moments can be discarded.');
 const places=session.places.filter((_,i)=>i!==index);
 // Prefer the next surviving place; at the end, use the previous place.
 const activePlaceId=session.activePlaceId===placeId?places[Math.min(index,places.length-1)].id:session.activePlaceId;
 return {...session,places,activePlaceId};
}
