import {createPlace,admitObservation} from './place.mjs';
/** Authored imagined courtyard. Not reconstructed imagery or actual wildlife evidence. */
export function createExamplePlace() {
 const features=[
  ['garden-ground','ground','Courtyard ground',[0,-.08,0],[12,.08,10]],
  ['leaning-tree','tree','The leaning tree',[-2.6,0,-1.7],[3.2,5,3]],
  ['herb-planter','planter','Herb planter',[2.2,0,.8],[2.4,.55,1.4]],
  ['rain-pool','water','Rain hollow',[-.5,.01,2],[1.8,.04,1.2]],
  ['back-wall','wall','Old garden wall',[0,0,-4.5],[12,1.5,.3]],
  ['garden-path','path','Stone path',[.4,.015,.4],[1.2,.03,8]],
  ['resting-stone','rock','Resting stone',[-3.5,0,2.2],[1.1,.6,.8]],
  ['quiet-bench','bench','Quiet bench',[3.3,0,-2.8],[1.7,.85,.6]],
  ['flower-clump','plant','Small flowers',[2.2,.55,.8],[1.8,.5,.9]],
 ].map(([anchorId,kind,label,position,size])=>({anchorId,kind,label,position,size,confidence:.65}));
 return admitObservation(createPlace({id:'imagined-courtyard',name:'An imagined courtyard'}),{
  id:'authored-example-1',authorized:true,source:{id:'imagined:courtyard:v1',kind:'imagined',label:'Authored imagined example — not a real observation',capturedAt:null},
  notes:'An authored exploration fixture. Geometry and animated life are imagined, not claims about an actual place or wildlife.',features
 });
}
