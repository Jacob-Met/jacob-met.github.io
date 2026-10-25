/** Local view projection only. Never change evidence, visits, storage, or source identifiers. */
const readable=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const MODES=new Set(['all','human','bird','insect','underwater']);
export function listKeptMoments(memories,placeId,{query='',mode='all',limit=40,places=null}={}){
 // null explicitly means all local places. Existing callers remain scoped to
 // their selected original place, never silently broadened.
 if(!Array.isArray(memories)||(placeId!==null&&typeof placeId!=='string')||typeof query!=='string'||!MODES.has(mode)||!Number.isSafeInteger(limit)||limit<1||limit>500||(places!==null&&!Array.isArray(places)))
  throw new TypeError('Invalid kept-moment browse request.');
 const allPlaces=placeId===null,local=memories.filter(m=>allPlaces||m.placeId===placeId),needle=readable(query.trim());
 const names=new Map((places??[]).map(p=>[p.id,p.name]));
 const hits=local.filter(m=>(mode==='all'||m.mode===mode)&&(readable(m.label).includes(needle)||(allPlaces&&readable(names.get(m.placeId)).includes(needle))));
 return {total:local.length,matching:hits.length,visible:hits.slice(0,limit),remaining:Math.max(0,hits.length-limit)};
}


/** Selection stays a view over original kept IDs, even across other saved places. */
export function replacementChoices(memories,places,query=''){
 if(!Array.isArray(memories)||!Array.isArray(places)||typeof query!=='string')throw new TypeError('Invalid replacement search.');
 const names=new Map(places.map(p=>[p.id,p.name])),needle=readable(query.trim());
 return memories.filter(m=>readable(m.label+' '+(names.get(m.placeId)??'')).includes(needle))
  .map(m=>({id:m.id,label:m.label,placeName:names.get(m.placeId)??'Unknown place',mode:m.mode}));
}

/** Plan one atomic session update. Nothing can be lost on a stale choice or full append. */
export function admitKeptMoment(memories,fresh,{replaceId=null,expected=null}={}){
 if(!Array.isArray(memories)||!fresh||typeof fresh.id!=='string'||memories.some(m=>m.id===fresh.id))
  throw new Error('This new moment has an invalid or repeated identity.');
 if(replaceId===null){
  if(memories.length>=500)throw new Error('The browser holds 500 moments. Choose an older moment to replace.');
  return [...memories,fresh];
 }
 const index=memories.findIndex(m=>m.id===replaceId);
 if(typeof replaceId!=='string'||typeof expected!=='string'||index<0||JSON.stringify(memories[index])!==expected)
  throw new Error('The chosen older moment changed or is missing. Reopen Keep a moment before replacing anything.');
 return [...memories.slice(0,index),...memories.slice(index+1),fresh];
}
