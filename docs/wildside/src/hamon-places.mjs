/** HAMON view: the Engine's finished scenes as explorable, clearly imagined places.
 *
 * Each entry is a Wildside place whose geometry, sky, wildlife and look are the HAMON Engine's
 * (`hamon_sculpt::scenes::live`, built in native/hamon-browser/src/places.rs). They need the
 * HAMON view; the standard renderer cannot draw them, so the place picker offers them only
 * while that view is open. Everything here is authored and simulated, never an observation. */
import {createPlace,admitObservation} from './place.mjs';

export const LIVE_PREFIX='imagined-live-';
export const LIVE_PLACES=Object.freeze([
 {id:'autumn-lake',title:'The autumn lake',blurb:'A still lake ringed with turning maples; squirrel, rabbit and deer move through the shallows and leaf litter.',note:'A composed lake — not a real shore'},
 {id:'coast-cove',title:'The seashore cove',blurb:'A sheltered cove with tide pools, grass-topped rock and shorebirds on the wrack line.',note:'A composed cove — not a real coast'},
 {id:'rue-des-glycines',title:'An old-town street',blurb:'A narrow lane of timbered houses under wisteria, with robins on the cobbles and lamps that wake at dusk.',note:'A composed street — not a real town'},
]);

/** The live place id behind a Wildside place, or null. */
export function liveIdOf(place){
 const id=typeof place?.id==='string'&&place.id.startsWith(LIVE_PREFIX)?place.id.slice(LIVE_PREFIX.length):null;
 return LIVE_PLACES.some(p=>p.id===id)?id:null;
}

/** A fresh imagined Wildside place for a live scene. Its own geometry is a token patch of ground:
 * the Engine scene is what the visitor sees and walks (see liveWalkWorld). */
export function createLiveImaginedPlace(id){
 const def=LIVE_PLACES.find(p=>p.id===id);if(!def)throw new Error('Unknown imagined place');
 const base=createPlace({id:LIVE_PREFIX+id,name:'An imagined '+def.title.replace(/^(The|An?) /,'').toLowerCase()});
 return admitObservation(base,{
  id:'authored-live-'+id,authorized:true,
  source:{id:'imagined:live:'+id+':v1',kind:'imagined',label:'Authored imagined '+def.title.toLowerCase()+' — not a real observation',capturedAt:null},
  notes:def.note+'. Its terrain, trees, weather and wildlife are authored and simulated by the HAMON Engine, not claims about an actual place or animals.',
  features:[{anchorId:'live-ground',kind:'ground',label:def.title,position:[0,-.08,0],size:[4,.08,4],confidence:.65}]
 });
}

/** Navigator world for a live place from `place_walk()` JSON and `place_heights()`: the scene's
 * own ground (NaN = deep water, not walkable), solid building boxes and trunk posts. */
export function liveWalkWorld(walk,heights){
 const [lo,hi]=walk.bounds,{x0,z0,step,nx,nz}=walk;
 const cell=(ix,iz)=>heights[Math.min(nz-1,Math.max(0,iz))*nx+Math.min(nx-1,Math.max(0,ix))];
 const surfaceAt=(x,z)=>{
  const fx=(x-x0)/step,fz=(z-z0)/step;
  if(!(fx>=0&&fz>=0&&fx<=nx-1&&fz<=nz-1))return null;
  const ix=Math.min(nx-2,Math.floor(fx)),iz=Math.min(nz-2,Math.floor(fz)),tx=fx-ix,tz=fz-iz;
  const h=[cell(ix,iz),cell(ix+1,iz),cell(ix,iz+1),cell(ix+1,iz+1)];
  if(h.some(v=>!Number.isFinite(v)))return Number.isFinite(h[0])&&tx<.5&&tz<.5?h[0]:Number.isFinite(cell(Math.round(fx),Math.round(fz)))?cell(Math.round(fx),Math.round(fz)):null;
  return (h[0]*(1-tx)+h[1]*tx)*(1-tz)+(h[2]*(1-tx)+h[3]*tx)*tz;
 };
 const obstacles=walk.boxes.map(([a,b],i)=>({id:'live-box-'+i,min:a,max:b}));
 walk.posts.forEach(([x,z,r,h],i)=>obstacles.push({id:'live-post-'+i,min:[x-r,-1,z-r],max:[x+r,h,z+r]}));
 // Deep water: ground is NaN there, so keep walkers out with a ground-coverage rule.
 return {bounds:{min:lo.slice(),max:hi.slice()},obstacles,surfaceAt,groundAt:(x,z)=>surfaceAt(x,z)??0,groundCoverageRequired:true,start:{position:walk.spawn.slice(),yaw:walk.spawnYaw}};
}

/** Place extension: ask the Engine for the whole scene (browser detail preset). */
export default [{
 id:'engine-live-places',
 matches:({place})=>liveIdOf(place)!==null,
 contribute:({place})=>[{kind:'live:'+liveIdOf(place),params:{detail:'browser'}}],
}];
