import * as THREE from '../vendor/three.module.js';
import {BIRD_BODY} from './habitat.mjs';

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

/** Original robin shell. Colour tracts share vertices: no breast or cheek
 * overlays, coplanar patches, alpha cutouts or per-frame geometry rebuilds.
 * Groups also carry the tract colours through the maintained Engine exporter.
 */
export function createPlumageGeometry(part){
 if(!['body','head'].includes(part))throw new TypeError('Expected body or head plumage');
 const head=part==='head',segments=32,rows=20;
 const radii=head?[.067,.064,.065]:BIRD_BODY.bodyRadii;
 const vertices=[],indices=[[],[],[]],rings=[];
 const point=(ny,theta)=>{
  const r=Math.sqrt(Math.max(0,1-ny*ny)),nx=r*Math.sin(theta),nz=r*Math.cos(theta);
  // A rounded chest and narrower shoulder, inside the old torso envelope.
  // The head keeps its existing articulated envelope.
  const shoulder=head?1:1-.10*smooth(-.1,.9,ny);
  return [nx*radii[0]*shoulder,ny*radii[1],nz*radii[2]];
 };
 const top=vertices.length/3;vertices.push(...point(1,0));
 for(let row=1;row<rows;row++){
  const ny=Math.cos(Math.PI*row/rows);
  // Align ring vertices with the curved bib edge instead of assigning a
  // stair-stepped colour by the centroid of unrelated triangles.
  const bib=head?1.20*(1-smooth(-.05,.38,ny))+.02:1.18-.25*smooth(.25,.9,ny);
  const ring=[];
  for(let column=0;column<segments;column++){
   const theta=column<8?-Math.PI+(Math.PI-bib)*column/8:
    column<24?-bib+2*bib*(column-8)/16:bib+(Math.PI-bib)*(column-24)/8;
   ring.push(vertices.length/3);vertices.push(...point(ny,theta));
  }
  rings.push(ring);
 }
 const bottom=vertices.length/3;vertices.push(...point(-1,0));
 const add=(a,b,c,column,row)=>{
  const front=column>=8&&column<24;
  const ny=Math.cos(Math.PI*(row+.5)/rows);
  const tract=front?(head?(ny<.31?1:0):(ny<-.45?2:1)):0;
  indices[tract].push(a,c,b);
 };
 for(let column=0;column<segments;column++){
  const next=(column+1)%segments;
  add(top,rings[0][next],rings[0][column],column,0);
  for(let row=0;row<rings.length-1;row++){
   const a=rings[row][column],b=rings[row][next],c=rings[row+1][column],d=rings[row+1][next];
   add(a,b,c,column,row+1);add(b,d,c,column,row+1);
  }
  add(rings.at(-1)[column],rings.at(-1)[next],bottom,column,rows-1);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setIndex(indices.flat());let start=0;
 indices.forEach((list,materialIndex)=>{if(list.length)geometry.addGroup(start,list.length,materialIndex);start+=list.length;});
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.name=`original-robin-${part}-plumage`;
 return geometry;
}
