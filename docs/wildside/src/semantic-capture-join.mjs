import {normalizeRegionProposals} from './region-proposals.mjs';
/** Additive join point for the existing capture owner. Does not commit, decode or place geometry.
 * getCurrent identifies the same pending capture and source/place revision before adoption.
 */
export function createSemanticCaptureJoin({interpreter,getCurrent}){
 let generation=0,disposed=false;
 const key=c=>JSON.stringify([c?.captureId,c?.placeId,c?.placeRevision,c?.sourceId]);
 return {
  async enrich({capture,observation,sourceBytes,preparedBytes,normalization}){
   if(disposed)throw Error('Semantic capture join closed');
   if(!capture||typeof capture.captureId!=='string'||typeof capture.placeId!=='string'||!Number.isSafeInteger(capture.placeRevision)||capture.placeRevision<0||observation?.source?.id!==capture.sourceId||normalization?.sourceId!==capture.sourceId||observation.source.kind!=='photo')throw Error('Capture, observation and prepared source identities must agree');
   const expected=key(capture);if(key(getCurrent())!==expected)return {status:'superseded'};
   const token=++generation,original=structuredClone(observation);
   const result=await interpreter.interpretPreparedPhoto({sourceBytes,preparedBytes,normalization});
   if(disposed||generation!==token||key(getCurrent())!==expected)return {status:'superseded'};
   if(result.status==='superseded')return {status:'superseded'};
   if(result.status==='withheld')return {status:'withheld',reason:result.reason,observation:original};
   if(result.status!=='proposed')throw Error('Unexpected semantic interpreter result');
   const regionProposals=normalizeRegionProposals(result.proposals,{sourceId:original.source.id,sourceKind:'photo'});
   return {status:'enriched',observation:{...original,regionProposals},execution:result.execution};
  },
  invalidate(){generation++;interpreter.invalidate();},
  dispose(){disposed=true;generation++;interpreter.invalidate();},
 };
}
