/** HAMON view: Wildside's simulated inhabitants drawn with Engine creatures
 * (see hamon-extensions.mjs). Wildside's simulation stays the source of truth;
 * these only read its snapshots each frame. */
import {hamonResidents} from './hamon-residents.mjs';
const robinState=new Float32Array(6);
export default [
 {
  id:'robin',kind:'robin',params:{seed:7},
  // Engine VE robin (robin_groom + robin_motion + robin_behavior) replaces the three.js bird art.
  replaces:ctx=>ctx.bird?.group??null,
  state(ctx){
   const b=ctx.sim?.snapshot().bird;
   if(!b||b.state==='unplaced'){robinState[5]=0;return robinState;}
   robinState.set([b.position[0],b.position[1],b.position[2],b.yaw,b.state==='flight'?1:0,1]);
   return robinState;
  },
 },
 // simulated residents (squirrels, songbirds, rabbits, butterflies, gulls) and the
 // third-person traveller: Engine hamon_sculpt::residents, see hamon-residents.mjs
 ...hamonResidents.extensions,
];
