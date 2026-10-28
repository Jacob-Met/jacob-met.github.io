import {mapSurfaceFrame} from './map-geometry.mjs';
/** Frame surviving mapped facades from an already navigator-admitted street point.
 * This changes only initial human look direction, never geometry or walkability. */
export function mapEntryView(position,anchors){
 if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))return null;
 const candidates=[];
 for(const anchor of anchors??[]){
  if(anchor.mapGeometry?.role!=='building')continue;
  for(const [index,face] of anchor.mapGeometry.surfaces.entries()){
   const frame=mapSurfaceFrame(face);if(Math.abs(frame.normal[1])>.01)continue;
   const low=Math.min(...face.map(p=>p[1]))+anchor.position[1],high=Math.max(...face.map(p=>p[1]))+anchor.position[1];if(high-low<.5)continue;
   const margin=Math.min(.5,(high-low)/2),target=[face.reduce((n,p)=>n+p[0]/face.length,0)+anchor.position[0],Math.max(low+margin,Math.min(high-margin,position[1])),face.reduce((n,p)=>n+p[2]/face.length,0)+anchor.position[2]];
   const dx=target[0]-position[0],dy=target[1]-position[1],dz=target[2]-position[2],horizontal=Math.hypot(dx,dz);if(horizontal<.3)continue;
   candidates.push({anchorId:anchor.id,faceIndex:index,target,yaw:Math.atan2(dx,-dz),pitch:Math.atan2(dy,horizontal),distance:Math.hypot(horizontal,dy)});
  }
 }
 candidates.sort((a,b)=>a.distance-b.distance||a.anchorId.localeCompare(b.anchorId)||a.faceIndex-b.faceIndex);
 return candidates[0]??null;
}
