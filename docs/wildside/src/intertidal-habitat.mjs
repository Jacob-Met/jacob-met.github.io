/** Attached, illustrative life. Dimensions and timing are authored, not measured biology. */
export const ANEMONE_BODY=Object.freeze({footRadius:.038,envelopeRadius:.12,height:.17});
const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=v=>Math.hypot(...v);
const finite3=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
/** Inscribed disk on one exact rendered face: the whole radial envelope has support.
 * Near-horizontal only; a candidate on an edge, underside or tiny triangle is refused. */
export function attachmentOnFace(face){
 if(!face?.vertices||face.vertices.length!==3||!face.vertices.every(finite3))return null;
 const [a,b,c]=face.vertices,n=cross(sub(b,a),sub(c,a)),area2=length(n);if(area2<1e-10||n[1]/area2<.995)return null;
 const sides=[length(sub(b,c)),length(sub(c,a)),length(sub(a,b))],perimeter=sides.reduce((s,v)=>s+v,0),radius=area2/perimeter;
 if(radius<ANEMONE_BODY.envelopeRadius+.004)return null;
 return {surfaceId:face.id,anchorId:face.anchorId,position:a.map((_,i)=>(a[i]*sides[0]+b[i]*sides[1]+c[i]*sides[2])/perimeter),normal:n.map(v=>v/area2),supportRadius:radius};
}
export function intertidalAttachments(place,faces,waterSurfaces=[],obstacles=[]){
 if(!Array.isArray(faces)||faces.length>4096)throw Error('Use bounded rendered intertidal faces');
 const sources=new Map((place.observations??[]).filter(o=>o.geographicContext?.profileId==='redwood-rocky-intertidal').map(o=>[o.source.id,o.geographicContext.waterScenario]));
 const anchors=new Map((place.anchors??[]).filter(a=>a.kind==='rock'&&a.contextForm==='intertidal-shelf').map(a=>[a.id,a]));
 const best=new Map();
 for(const face of faces){const a=anchors.get(face.anchorId),sourceId=a?.sourceIds?.find(s=>sources.has(s));if(!sourceId)continue;
  const support=attachmentOnFace(face);if(!support)continue;
  // Conservative complete-body box, including the admitted small support tilt.
  // A later wall/stone may cover a formerly usable shelf; never spawn inside it.
  const r=ANEMONE_BODY.envelopeRadius+ANEMONE_BODY.height*.1,[x,y,z]=support.position;
  const min=[x-r,y-.012,z-r],max=[x+r,y+ANEMONE_BODY.height+.012,z+r];
  if(obstacles.some(o=>o.id!==a.id&&!o.modes?.length&&o.min?.every((v,i)=>v<max[i])&&o.max?.every((v,i)=>v>min[i])))continue;
  const wet=sources.get(sourceId)==='illustrative-wet'&&waterSurfaces.some(w=>{
   if(w.shape!=='ellipse'||!w.sourceIds?.includes(sourceId)||w.y<support.position[1]+ANEMONE_BODY.height)return false;
   const [x,,z]=support.position,[rx,rz]=w.radii;return Math.hypot((x-w.center[0])/rx,(z-w.center[1])/rz)+ANEMONE_BODY.envelopeRadius/Math.min(rx,rz)<=1;
  });
  if(!best.has(a.id)||support.supportRadius>best.get(a.id).supportRadius)best.set(a.id,{...support,id:`anemone:${a.id}`,sourceId,wet});
 }
 return [...best.values()].slice(0,8);
}
export function createIntertidalLife(attachments=[]){
 let time=0,residents=[];
 function setHabitat(next){if(!Array.isArray(next)||next.length>8)throw Error('Use at most eight attached anemones');const old=new Map(residents.map(r=>[r.id,r]));
  residents=next.map(a=>{if(!finite3(a.position)||!finite3(a.normal)||typeof a.wet!=='boolean')throw Error('Invalid anemone support');const prior=old.get(a.id);return {...structuredClone(a),openness:prior?.openness??(a.wet?.2:0)};});
 }
 setHabitat(attachments);
 return {setHabitat,step(dt){if(!Number.isFinite(dt)||dt<0||dt>1)throw Error('Use a bounded anemone time step');time+=dt;for(const r of residents){const target=r.wet?1:0;r.openness=target+(r.openness-target)*Math.exp(-dt/(r.wet?2.4:1.2));}},snapshot(){return {time,body:ANEMONE_BODY,provenance:'illustrative-attached-life',residents:residents.map(r=>({...structuredClone(r),state:r.wet?'opening-in-water':'contracting-in-air',sway:Math.sin(time*.8+r.position[0])*.035*r.openness}))};}};
}
