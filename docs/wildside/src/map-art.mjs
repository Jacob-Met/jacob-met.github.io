import * as THREE from '../vendor/three.module.js';
import {mapSurfaceFrame,mapBuildingFootprint,mapGeometryBounds} from './map-geometry.mjs';
import {mapFrameKey,drapeTerrainTriangle} from './map-terrain.mjs';
import {pointInPolygon} from './boundary.mjs';

const colorFor=id=>{let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;return new THREE.Color().setHSL(.07+(h%30)/1000,.12+(h%13)/100,.59+(h%9)/100);};
/** Exact admitted polygon faces; ordinary maintained scene, camera and renderer. */
export function addMapArt(anchor,local,{box,grounds,obstacles,perches,surfaces,terrain=null,mapContext=null}){
  const shape=anchor.mapGeometry;if(!shape)return false;
  const position=anchor.position,building=shape.role==='building',positions=[],colors=[],uvs=[];
  const wall=colorFor(anchor.id),roof=new THREE.Color('#697980'),road=new THREE.Color(shape.role==='terrain'?'#8a9279':'#898a7e');
  const relativeRoad=shape.role==='road'&&mapContext?.verticalPolicy==='source-relative';
  let faces=shape.surfaces;
  if(shape.role==='terrain'){
    if(!terrain)return true;
    faces=faces.flatMap((_,index)=>terrain.sourceFaceTriangles(anchor.id,index)
      .map(triangle=>triangle.map(p=>p.map((v,i)=>v-position[i]))));
    if(!faces.length)return true;
  }
  if(relativeRoad){
    // A source-zero street is only a plan. No surviving matching terrain means no invented elevation.
    if(!terrain||terrain.frame!==mapFrameKey(mapContext))return true;
    faces=shape.surfaces.flatMap(face=>{
      const polygon=face.map(p=>[p[0]+position[0],p[2]+position[2]]);
      return THREE.ShapeUtils.triangulateShape(polygon.map(p=>new THREE.Vector2(...p)),[])
        .flatMap(t=>drapeTerrainTriangle(t.map(i=>polygon[i]),terrain))
        .map(f=>f.map(p=>p.map((v,i)=>v-position[i])));
    });
    if(!faces.length)return true;
  }
  for(let faceIndex=0;faceIndex<faces.length;faceIndex++){
    const face=faces[faceIndex],frame=mapSurfaceFrame(face);
    const triangles=THREE.ShapeUtils.triangulateShape(frame.projected.map(p=>new THREE.Vector2(...p)),[]);
    if(!triangles.length)throw new Error('An admitted map face could not be rendered');
    const shade=building?(Math.abs(frame.normal[1])>.5?roof:wall):road;
    for(const triangle of triangles){
      const vertices=triangle.map(i=>face[i]);
      const a=new THREE.Vector3(...vertices[0]),b=new THREE.Vector3(...vertices[1]),c=new THREE.Vector3(...vertices[2]);
      const normal=b.clone().sub(a).cross(c.clone().sub(a));
      // Roads need upward support winding. Building materials are intentionally double-sided.
      if(!building&&normal.y<0)triangle.reverse();
      for(const i of triangle){positions.push(...face[i]);colors.push(shade.r,shade.g,shade.b);uvs.push(...frame.projected[i].map(v=>v*.25));}
    }
    if(shape.role==='road'){
      const polygon=face.map(p=>[p[0]+position[0],p[2]+position[2]]);
      if(!relativeRoad)grounds.push({polygon,y:position[1],annotated:true});
      surfaces.push({id:anchor.id+':map:'+faceIndex,anchorId:anchor.id,kind:'path',polygonXZ:polygon,...(!relativeRoad?{y:position[1]}:{vertices:face.map(p=>p.map((v,i)=>v+position[i]))}),meshName:anchor.id+':map'});
    }
    for(const p of face)box.expandByPoint(new THREE.Vector3(...p.map((v,i)=>v+position[i])));
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  if(shape.role==='terrain'){
    // Share normals at identical retained vertices, without moving or smoothing source geometry.
    const normalSums=new Map(),key=i=>positions.slice(i,i+3).join(',');
    for(let i=0;i<positions.length;i+=9){
      const a=new THREE.Vector3(...positions.slice(i,i+3)),b=new THREE.Vector3(...positions.slice(i+3,i+6)),c=new THREE.Vector3(...positions.slice(i+6,i+9));
      const n=b.sub(a).cross(c.sub(a));
      for(const j of [i,i+3,i+6]){const k=key(j);if(!normalSums.has(k))normalSums.set(k,new THREE.Vector3());normalSums.get(k).add(n);}
    }
    const normals=[];for(let i=0;i<positions.length;i+=3){const n=normalSums.get(key(i)).clone().normalize();normals.push(n.x,n.y,n.z);}
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  }else geometry.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,side:THREE.DoubleSide,
    polygonOffset:shape.role==='road',polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const mesh=new THREE.Mesh(geometry,mat);mesh.name=anchor.id+':map';mesh.castShadow=building;mesh.receiveShadow=true;
  mesh.userData={anchorId:anchor.id,kind:anchor.kind,provenance:'public-map-geometry-with-artistic-materials'};local.add(mesh);
  if(building){
    const points=mapBuildingFootprint(shape).map(p=>[p[0]+position[0],p[1]+position[2]]);
    const {min,max}=mapGeometryBounds(shape),height=max[1];
    obstacles.push({id:anchor.id,min:[min[0]+position[0],position[1],min[2]+position[2]],
      max:[max[0]+position[0],height+position[1],max[2]+position[2]],polygonXZ:points});
    // A supported simulated resting opportunity, not an observed bird or habitat survey.
    const triangles=THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(...p)),[]);
    for(const triangle of triangles){
      const p=triangle.reduce((s,i)=>[s[0]+points[i][0]/3,s[1]+points[i][1]/3],[0,0]);
      const clearance=Math.min(...points.map((a,i)=>{const b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);}));
      if(clearance>=.12&&pointInPolygon(p,points)){
        perches.push({id:anchor.id+':roof',position:[p[0],height+position[1],p[1]],radius:Math.min(.14,clearance/2),tangent:[1,0,0],shelter:0});break;
      }
    }
  }
  return true;
}
