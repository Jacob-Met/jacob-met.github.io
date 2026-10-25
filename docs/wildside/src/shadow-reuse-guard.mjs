/** Constrained r180 shadow-input guard. No renderer calls or scene updates.
 * Caller must update scene/light/target world matrices and choose geometry detail
 * BEFORE prepare; commit only after a known completed shadow pass. Increment
 * resourceEpoch on context loss/restoration or any externally invalidated map.
 */
export function sameShadowSnapshot(a,b){
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)!==Array.isArray(b))return false;
 const ak=Object.keys(a),bk=Object.keys(b);
 return ak.length===bk.length&&ak.every((key,i)=>key===bk[i]&&sameShadowSnapshot(a[key],b[key]));
}
function frozen(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const v of Object.values(value))frozen(v);Object.freeze(value);}return value;}
// These are owned dense finite-number arrays. Compare their values directly;
// recursive object-key enumeration allocates one key per vertex component.
function sameNumbers(a,b){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
export function createShadowReuseGuard(T){
 // r180 does not export LightShadow: derive trusted public-factory defaults.
 const referenceShadow=new T.DirectionalLight().shadow;
 const ids=new WeakMap(),attributes=new WeakMap(),partialUploads=new WeakSet();let nextId=1,committed=null,pending=null,serial=0,generation=0,poisoned=null;
 const id=value=>{if(!value||typeof value!=='object')return 0;if(!ids.has(value))ids.set(value,nextId++);return ids.get(value);};
 const reject=message=>{throw new Error(message);};
 function finite(value,label){if(typeof value!=='number'||!Number.isFinite(value))reject(label+' is not finite');return value;}
 function integer(value,label){if(!Number.isSafeInteger(value)||value<0)reject(label+' is not a nonnegative integer');return value;}
 function numbers(values,count,label){if(!values||values.length!==count)reject(label+' has unsupported dimensions');return Array.from(values,v=>finite(v,label));}
 function matrix(object,label){return numbers(object?.elements,16,label);}
 function sphere(s){return s===null||s===undefined?null:[finite(s.center.x,'sphere x'),finite(s.center.y,'sphere y'),finite(s.center.z,'sphere z'),finite(s.radius,'sphere radius')];}
 function attribute(a,size,label){
  if(!a)reject(label+' missing');
  const interleaved=a.isInterleavedBufferAttribute===true,source=interleaved?a.data:a,array=source?.array;
  // A partial upload can leave GPU data different from the full CPU array.
  // Three clears ranges after uploading, so remember the unsupported history.
  if(source?.updateRanges?.length)partialUploads.add(source);
  if(partialUploads.has(source))reject(label+' partial-upload history unsupported');
  const uploadDefault=interleaved?T.InterleavedBuffer.prototype.onUploadCallback:T.BufferAttribute.prototype.onUploadCallback;
  if(source?.onUploadCallback!==uploadDefault)reject(label+' custom upload callback');
  if(!ArrayBuffer.isView(array)||array instanceof DataView||typeof array[0]==='bigint'||(typeof SharedArrayBuffer!=='undefined'&&array.buffer instanceof SharedArrayBuffer))reject(label+' unsupported storage');
  if(array.length>2000000)reject(label+' exceeds capture budget');
  integer(source.version,label+' version');integer(a.count,label+' count');
  if(a.itemSize!==size)reject(label+' unsupported item size');
  const layout={id:id(a),source:id(source),array:id(array),type:array.constructor.name,itemSize:a.itemSize,count:a.count,normalized:!!a.normalized,gpuType:a.gpuType??null,
   stride:interleaved?integer(source.stride,label+' stride'):size,offset:interleaved?integer(a.offset,label+' offset'):0};
  if(layout.stride<size||layout.offset+size>layout.stride||a.count*layout.stride>array.length)reject(label+' invalid layout');
  const previous=attributes.get(a);
  let values;
  // Unchanged versions follow Three's GPU-upload contract. A changed version
  // can carry identical values (e.g. paused web updates): compare, don't force
  // a different key solely for the version number. Snapshots own their arrays.
  if(previous&&previous.version===source.version&&sameShadowSnapshot(previous.layout,layout))values=previous.values;
  else {
   const copied=Array.from(array,v=>finite(v,label));
   values=previous&&sameShadowSnapshot(previous.layout,layout)&&sameNumbers(previous.values,copied)?previous.values:Object.freeze(copied);
   attributes.set(a,{version:source.version,layout:frozen(layout),values});
  }
  return {layout,values};
 }
 function callbacks(o){for(const name of ['onBeforeShadow','onAfterShadow','onBeforeRender','onAfterRender'])if(o[name]!==T.Object3D.prototype[name])reject('custom object callback '+name);}
 function material(m){
  if(!m||![T.MeshStandardMaterial,T.MeshBasicMaterial].includes(m.constructor))reject('unsupported material class');
  if(m.onBeforeCompile!==T.Material.prototype.onBeforeCompile||m.customProgramCacheKey!==T.Material.prototype.customProgramCacheKey)reject('custom shader callback');
  if(m.transparent||m.opacity!==1||m.alphaTest!==0||m.alphaToCoverage||m.alphaHash||m.displacementMap||m.clippingPlanes?.length||m.clipShadows||m.wireframe)reject('unsupported alpha/displacement/clipping/wireframe path');
  if(![T.FrontSide,T.BackSide,T.DoubleSide].includes(m.side)||m.shadowSide!==null&&![T.FrontSide,T.BackSide,T.DoubleSide].includes(m.shadowSide))reject('unsupported material side');
  return {id:id(m),visible:!!m.visible,side:m.side,shadowSide:m.shadowSide};
 }
 function geometry(g){
  if(!g?.isBufferGeometry||g.isInstancedBufferGeometry||Object.values(g.morphAttributes??{}).some(a=>a.length))reject('unsupported geometry or morph attributes');
  const groups=g.groups.map(v=>[integer(v.start,'group start'),integer(v.count,'group count'),integer(v.materialIndex,'group material')]);
  const start=integer(g.drawRange.start,'draw start'),count=g.drawRange.count===Infinity?'all':integer(g.drawRange.count,'draw count');
  return {id:id(g),position:attribute(g.attributes.position,3,'position'),index:g.index?attribute(g.index,1,'index'):null,draw:[start,count],groups,bounds:sphere(g.boundingSphere)};
 }
 function capture(input){
  if(poisoned!==null)return Object.freeze({supported:false,reason:'refresh-only after unsupported capture: '+poisoned});
  try {
   const {scene,camera,light,renderer,resourceEpoch}=input;
   if(T.REVISION!=='180'||renderer?.isWebGLRenderer!==true||!renderer.shadowMap.enabled||renderer.shadowMap.type!==T.PCFSoftShadowMap)reject('only r180 WebGL PCFSoft enabled shadows supported');
   integer(resourceEpoch,'resourceEpoch');
   if(renderer.localClippingEnabled||renderer.capabilities?.reverseDepthBuffer||renderer.capabilities?.logarithmicDepthBuffer)reject('unsupported clipping/depth configuration');
   const shadow=light?.shadow;
   if(light?.constructor!==T.DirectionalLight||!light.castShadow||!shadow?.isDirectionalLightShadow||!shadow.autoUpdate)reject('only updating directional shadow supported');
   if(shadow.constructor!==referenceShadow.constructor)reject('custom shadow class');
   for(const name of ['updateMatrices','getFrameExtents','getViewportCount','getViewport','getFrustum'])if(shadow[name]!==referenceShadow[name])reject('custom shadow method '+name);
   const sc=shadow.camera;
   if(sc?.constructor!==T.OrthographicCamera||sc.view!==null||sc.updateProjectionMatrix!==T.OrthographicCamera.prototype.updateProjectionMatrix)reject('unsupported shadow camera');
   if(sc.parent!==null||!sc.matrixAutoUpdate||!sc.matrixWorldAutoUpdate||sc.scale.x!==1||sc.scale.y!==1||sc.scale.z!==1)reject('unsupported shadow camera transform');
   for(const name of ['lookAt','updateMatrix','updateMatrixWorld','updateWorldMatrix'])if(sc[name]!==referenceShadow.camera[name])reject('custom shadow camera method '+name);
   if(shadow.getViewportCount()!==1)reject('multiple shadow viewports unsupported');
   const extent=shadow.getFrameExtents(),vp=shadow.getViewport(0);
   if(extent.x!==1||extent.y!==1||vp.x!==0||vp.y!==0||vp.z!==1||vp.w!==1)reject('nonstandard shadow viewport');
   const lightState={id:id(light),world:matrix(light.matrixWorld,'light world'),target:matrix(light.target?.matrixWorld,'target world'),projection:matrix(sc.projectionMatrix,'shadow projection'),
    domain:['left','right','top','bottom','near','far','zoom'].map(k=>finite(sc[k],'shadow '+k)),up:[finite(sc.up.x,'shadow up x'),finite(sc.up.y,'shadow up y'),finite(sc.up.z,'shadow up z')],coordinateSystem:sc.coordinateSystem,mapSize:[integer(shadow.mapSize.x,'map width'),integer(shadow.mapSize.y,'map height')]};
   if(!lightState.mapSize[0]||!lightState.mapSize[1])reject('empty shadow map');
   if(!Number.isInteger(camera?.layers?.mask))reject('invalid camera layers');
   const casters=[],seen=new Set();let foundLight=false;
   function visit(o){
    if(seen.has(o)||seen.size>20000)reject('cyclic or excessive scene');seen.add(o);
    if(o.visible===false)return;
    callbacks(o);
    if(o.isLOD)reject('camera-driven LOD unsupported');
    if(!Number.isInteger(o.layers?.mask)||!Array.isArray(o.children))reject('unsupported scene node');
    const visible=(o.layers.mask&camera.layers.mask)!==0;
    if(visible&&o.isLight&&o.castShadow){if(o!==light)reject('additional shadow light');foundLight=true;}
    if(visible&&o.castShadow&&(o.isMesh||o.isLine||o.isPoints)){
     if(![T.Mesh,T.InstancedMesh].includes(o.constructor)||o.isSkinnedMesh||o.isBatchedMesh||o.morphTargetInfluences?.length||o.morphTexture||o.customDepthMaterial!==undefined||o.customDistanceMaterial!==undefined)reject('unsupported caster/deformation/custom depth');
     const mats=Array.isArray(o.material)?o.material.map(material):[material(o.material)];
     const caster={id:id(o),world:matrix(o.matrixWorld,'caster world'),geometry:geometry(o.geometry),materials:mats,multiMaterial:Array.isArray(o.material),frustumCulled:!!o.frustumCulled,bounds:sphere(o.boundingSphere)};
     if(o.constructor===T.InstancedMesh){caster.count=integer(o.count,'instance count');caster.instances=attribute(o.instanceMatrix,16,'instance matrix');if(caster.count>o.instanceMatrix.count)reject('instance count exceeds matrix storage');}
     casters.push(caster);
    }
    for(const child of o.children)visit(child);
   }
   visit(scene);if(!foundLight)reject('shadow light is not visible in supplied scene');
   const map=shadow.map;
   if(map!==null&&(!map?.isWebGLRenderTarget||!map.texture||!Number.isSafeInteger(map.width)||map.width<1||!Number.isSafeInteger(map.height)||map.height<1||!Number.isSafeInteger(map.texture.version)))reject('unsupported shadow map resource');
   return frozen({supported:true,snapshot:{content:{resourceEpoch,scene:id(scene),cameraLayers:camera.layers.mask,light:lightState,casters},resource:{map:id(map),texture:id(map?.texture),width:map?.width??null,height:map?.height??null,textureVersion:map?.texture?.version??null}}});
  } catch(error){
   // Fail-fast traversal may not have observed later partial uploads. The
   // entire instance therefore remains refresh-only even if unsupported
   // inputs disappear; invalidate() intentionally cannot restore coherence.
   poisoned=error.message;committed=null;pending=null;
   return Object.freeze({supported:false,reason:poisoned});
  }
 }
 function invalidate(){generation++;committed=null;pending=null;}
 function prepare(input){
  pending=null;const token=++serial,result=capture(input);
  if(!result.supported){committed=null;return Object.freeze({reuse:false,reason:result.reason,ticket:null});}
  const forced=!!input.force||!!input.renderer.shadowMap.needsUpdate||!!input.light.shadow.needsUpdate;
  if(forced)committed=null;
  if(!forced&&committed&&sameShadowSnapshot(committed,result.snapshot))return Object.freeze({reuse:true,reason:'identical supported depth inputs',ticket:null});
  // An attempted pass may partially overwrite the old map before throwing.
  committed=null;
  const ticket=Object.freeze({token,generation});pending={ticket,snapshot:result.snapshot};
  return Object.freeze({reuse:false,reason:forced?'forced refresh':'first or changed depth inputs',ticket});
 }
 function commit(ticket,input,{shadowRendered=false}={}){
  if(!shadowRendered||!pending||pending.ticket!==ticket||ticket.generation!==generation)return false;
  const prior=pending;pending=null;const after=capture(input);
  if(!after.supported||!after.snapshot.resource.map||!sameShadowSnapshot(prior.snapshot.content,after.snapshot.content)){committed=null;return false;}
  // A successful first pass may allocate the map. Save POST-pass resource IDs,
  // but never accept caster/projection changes that occurred during the pass.
  committed=after.snapshot;return true;
 }
 return Object.freeze({capture,prepare,commit,invalidate});
}
