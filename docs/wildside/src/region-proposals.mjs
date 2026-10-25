/** Inferred image regions. Coordinates remain pixels of the upright decoded image.
 * Validation checks retained structure/source binding, not truth of model descriptions.
 */
const fail=message=>{throw new Error(message);};
const exact=(value,keys,name)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==[...keys].sort().join(','))fail(`Invalid ${name} fields`);};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const dense=(value,max)=>Array.isArray(value)&&value.length<=max&&Array.from({length:value.length},(_,i)=>Object.hasOwn(value,i)).every(Boolean);
export const REGION_PROPOSAL_SCHEMA='wildside.image-regions/v1';
export function normalizeRegionProposals(input,{sourceId,sourceKind}={}){
 exact(input,['schema','sourceId','image','inference','regions'],'image-region proposal');
 if(input.schema!==REGION_PROPOSAL_SCHEMA||input.sourceId!==sourceId||!/^local:sha256:[a-f0-9]{64}$/.test(sourceId)||sourceKind!=='photo')fail('Image regions require their exact retained photo source');
 const image=input.image;exact(image,['sha256','width','height','orientation'],'proposal image');
 if(!hash(image.sha256)||image.orientation!=='upright'||![image.width,image.height].every(n=>Number.isSafeInteger(n)&&n>=2&&n<=8192)||image.width*image.height>16_777_216)fail('Image regions require a bounded upright decoded image');
 const model=input.inference;exact(model,['model','revision','task','complete','contrast','assetHashes'],'region inference');
 if(model.model!=='onnx-community/Florence-2-base-ft'||model.revision!=='4fad161e12c279d651e8fcba11932d9333fa6adc'||model.task!=='<DENSE_REGION_CAPTION>')fail('Unsupported image-region inference recipe');
 if(!dense(model.assetHashes,20)||model.assetHashes.length<4)fail('Retain the bounded model asset fingerprints');
 const assetPaths=new Set();for(const a of model.assetHashes){exact(a,['path','sha256'],'model asset');if(typeof a.path!=='string'||!/^([a-z_]+\.json|merges\.txt|vocab\.json|README\.md|onnx\/[a-z_]+\.onnx)$/.test(a.path)||!hash(a.sha256)||assetPaths.has(a.path))fail('Invalid or duplicate model asset fingerprint');assetPaths.add(a.path);}
 if(!['onnx/embed_tokens_quantized.onnx','onnx/vision_encoder_quantized.onnx','onnx/encoder_model_quantized.onnx','onnx/decoder_model_merged_quantized.onnx'].every(p=>assetPaths.has(p)))fail('Missing inference-session fingerprints');
 if(model.complete!==true||typeof model.contrast!=='number'||!Number.isFinite(model.contrast)||model.contrast<=.015||model.contrast>.5)fail('Withhold regions from incomplete generation or insufficient image information');
 if(!dense(input.regions,64))fail('Keep at most 64 complete image regions');
 const ids=new Set();const regions=input.regions.map(region=>{
  exact(region,['id','description','boxPixels'],'image region');
  if(typeof region.id!=='string'||!/^region-[0-9]{1,3}$/.test(region.id)||ids.has(region.id))fail('Image-region identifiers must be distinct');ids.add(region.id);
  if(typeof region.description!=='string'||!region.description.trim()||region.description.length>400||/[\u0000-\u001f]/.test(region.description))fail('Invalid inferred region description');
  const box=region.boxPixels;
  if(!dense(box,4)||box.length!==4||!box.every(Number.isFinite)||box[0]<0||box[1]<0||box[2]>image.width||box[3]>image.height||box[0]>=box[2]||box[1]>=box[3])fail('Image-region bounds must lie within the decoded image');
  return {id:region.id,description:region.description,boxPixels:[...box]};
 });
 return {schema:REGION_PROPOSAL_SCHEMA,sourceId,image:{...image},inference:{...model,assetHashes:model.assetHashes.map(a=>({...a}))},regions};
}
/** Pixel-to-normalized mapping only: deliberately has no world-coordinate output. */
export function regionImageRect(proposals,regionId){
 const p=normalizeRegionProposals(proposals,{sourceId:proposals?.sourceId,sourceKind:'photo'}),region=p.regions.find(r=>r.id===regionId);
 if(!region)fail('Image region is unavailable');
 return region.boxPixels.map((v,i)=>v/(i%2?p.image.height:p.image.width));
}

/** Conservative description routing, not species recognition or physical placement. */
export function regionInterpretation(proposals,regionId){
 const rect=regionImageRect(proposals,regionId),region=proposals.regions.find(r=>r.id===regionId);
 const description=region.description.trim().toLowerCase();
 const category=({'houseplant':'vegetation','plant':'vegetation','plants':'vegetation','tree':'woody-vegetation','trees':'woody-vegetation','bush':'vegetation','shrub':'vegetation','chair':'furniture','chairs':'furniture'})[description]??'unclassified';
 const area=(rect[2]-rect[0])*(rect[3]-rect[1]);
 return {category,scope:area>.6||rect[2]-rect[0]>.95||rect[3]-rect[1]>.95?'image-context':'bounded-region',inferred:true,rect};
}
