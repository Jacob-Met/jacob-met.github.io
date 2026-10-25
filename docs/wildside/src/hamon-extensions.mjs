/** Extension hooks for the HAMON view. Each module below is owned by its feature and
 * default-exports an array of extensions; this file only gathers them. See HAMON_EXTENSIONS.md.
 *
 * place:      {id, matches({place, art}) -> bool, contribute({place, art}) -> [{kind, params}]}
 *             kinds are built in native/hamon-browser/src/places.rs
 * inhabitant: {id, kind, params?, replaces(ctx) -> THREE.Object3D|null,
 *              state(ctx) -> Float32Array}   (kind built in native/hamon-browser/src/inhabitants.rs)
 *             ctx = {sim, bird, crawler, crawlerArt, orbWeaver, orbArt, pondSkater, skaterArt,
 *                    submergedLife, submergedArt, nav, camera, time}
 * sky:        {id, mount({container, setSky({tod, weather}|null), state()}) -> {dispose()}}
 */
import places from './hamon-places.mjs';
import inhabitants from './hamon-inhabitants.mjs';
import sky from './hamon-sky.mjs';
export const HAMON_EXTENSIONS={places,inhabitants,sky};
