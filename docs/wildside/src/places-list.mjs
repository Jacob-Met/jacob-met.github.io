/** The places a visitor can enter, as a plain list for a "Places" picker (see the controls
 * registry). Each entry: {id, name, description, thumbnail, needsHamon, available(), enter(request)}.
 * `enter` accepts the picker's optional {isCurrent()} request and resolves false
 * when superseded, otherwise once the place is active. All are imagined or
 * public-map places; thumbnails are 640x360 frames rendered by the HAMON Engine. */
import {LIVE_PLACES} from './hamon-places.mjs';

const THUMBS='assets/places/';
export const BUNDLED_PLACES=Object.freeze([
 {id:'courtyard',name:'The courtyard',description:'An imagined garden courtyard with a leaning tree, a rain hollow and a robin.',thumbnail:THUMBS+'courtyard.jpg',needsHamon:false},
 {id:'kyoto-block',name:'A Kyoto block',description:'A Kyoto hillside from public map data: streets, buildings and imagined life.',thumbnail:THUMBS+'kyoto-block.jpg',needsHamon:false},
]);

/** `actions`: {courtyard(request), kyoto(request), live(id,request), hamonAvailable()}. */
export function buildPlacesList(actions){
 const hamon=()=>!!actions.hamonAvailable?.();
 return [
  ...BUNDLED_PLACES.map(p=>({...p,available:()=>true,enter:request=>p.id==='courtyard'?actions.courtyard(request):actions.kyoto(request)})),
  ...LIVE_PLACES.map(p=>({id:p.id,name:p.title,description:p.blurb.split(';')[0].replace(/\.$/,'')+'. '+p.note+'.',thumbnail:THUMBS+p.id+'.jpg',needsHamon:true,available:hamon,enter:request=>actions.live(p.id,request)})),
 ];
}
