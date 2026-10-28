import {birdForagingSites} from './bird-foraging.mjs';
/** Only the bird receives occupied rendered urban vegetation. Original shared
 * habitat, perches, shelter and resident inputs remain unchanged. These boxes
 * are conservative geometry, not food, species or weather-protection evidence.
 */
export function createUrbanBirdHabitat(art,habitat){
 const vegetation=art.birdVegetationObstacles??[];
 if(!vegetation.length)return habitat;
 const obstacles=[...habitat.obstacles,...vegetation];
 return {...habitat,obstacles,foragingSites:birdForagingSites({...art,obstacles})};
}
