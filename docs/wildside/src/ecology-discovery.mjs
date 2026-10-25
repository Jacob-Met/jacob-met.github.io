/**
 * Optional ecological discovery beside the existing simulated encounter.
 * These public, region-scoped accounts are NOT records of this place's wildlife.
 * Never derive species identity, native range, harm or introduction from an image.
 */
export const ECOLOGY_DISCOVERY_VERSION = 1;

const REFERENCES = Object.freeze({
  aquarium: {label:'Kyoto Aquarium · giant salamanders',url:'https://www.kyoto-aquarium.com/about/animals/oosanshouuo/',language:'Japanese',retrieved:'2026-10-24'},
  nieso: {label:'NIES · introduced Andrias in Japan',url:'https://www.nies.go.jp/biodiversity/invasive/DB/detail/40250e.html',language:'English',retrieved:'2026-10-24'},
  ministry: {label:'Japan Environment Ministry · introduced Andrias and hybrids',url:'https://www.env.go.jp/nature/intro/2outline/attention/chugokuoosanshouo.html',language:'Japanese',retrieved:'2026-10-24'},
  kyoto: {label:'Kyoto University · Kamo River study (9 Jan 2026)',url:'https://www.kyoto-u.ac.jp/ja/research-news/2026-01-09',language:'Japanese',retrieved:'2026-10-24'},
  park: {label:'US National Park Service · non-native and invasive species',url:'https://home.nps.gov/subjects/invasive/what-are-invasive-species.htm',language:'English',retrieved:'2026-10-24'}
});
const CASES = Object.freeze([
  {
    id:'river-native', title:'Under the river stones', eyebrow:'A native life · Kyoto, Japan',
    kind:'documented-region', nativeStatus:'native', impactStatus:'not-claimed',
    identity:'Japanese giant salamander (Andrias japonicus); no identity of any Wildside creature established',
    region:'Japanese river habitats; aquarium account, not a geolocated sighting',
    arrival:'No human introduction is asserted for this native population.',
    story:[
      {question:'Who is here?',heading:'A life worth watching',text:'In Kyoto Aquarium’s account, the native Japanese giant salamander shelters in dark, narrow spaces between rocks by day. It is easy to care about an animal before knowing its whole story.'},
      {question:'Where does it belong?',heading:'Native is a place relationship',text:'The Japanese giant salamander is native to parts of Japan. Native status belongs to a population and its historical range—not to how familiar or numerous a creature looks.'},
      {question:'What do we really know?',heading:'One silhouette cannot tell ancestry',text:'Kyoto Aquarium also displays introduced Chinese giant salamanders and hybrids. Similar-looking animals cannot be assigned ancestry from this imagined encounter; field identification may require genetic evidence.'}
    ],
    sourceIds:['aquarium','ministry']
  },
  {
    id:'arrival-unknown', title:'A newcomer, not a verdict', eyebrow:'Illustrative contrast · no claimed sighting',
    kind:'illustrative', nativeStatus:'introduced', impactStatus:'unknown',
    identity:'Unnamed hypothetical introduced animal; not a record of an actual population',
    region:'No geographic population asserted',
    arrival:'Pathway, date and local origin are deliberately unspecified.',
    story:[
      {question:'How did it arrive?',heading:'An arrival has a history',text:'Imagine an animal found beyond its historical range after human activity. The route might be deliberate, accidental, or still unknown. This is an illustrative case, not evidence that such an animal lives in your scene.'},
      {question:'Does it belong?',heading:'Non-native does not equal invasive',text:'Being introduced describes origin, not proven damage. Agencies distinguish non-native populations from invasive populations that cause or are likely to cause harm.'},
      {question:'What would change the answer?',heading:'Look at the neighbors too',text:'To judge effects in a particular place, investigators need evidence about predation, competition, disease, habitat change and other residents. Unknown impact is neither proof of safety nor proof of harm.'}
    ],
    sourceIds:['park']
  },
  {
    id:'kamo-hybrids', title:'The cost of a shared river', eyebrow:'Documented conservation concern · Kamo River, Kyoto',
    kind:'documented-region', nativeStatus:'introduced', impactStatus:'documented-concern',
    identity:'Introduced Chinese Andrias lineage and hybrid populations; no individual classification in Wildside',
    region:'Kamo River system, Kyoto; not a precise wildlife location',
    arrival:'NIES reports that the actual origin and route are unknown; imports for food in 1972 are a possibility, not an established pathway.',
    story:[
      {question:'Who is living here?',heading:'An animal is not a villain',text:'An individual giant salamander can be compelling to watch. The difficult conservation question is what has happened to other residents of the same river—not whether a creature is morally good or bad.'},
      {question:'How did it arrive?',heading:'A history with missing pages',text:'Chinese giant salamanders became established outside their native range in Japan. NIES lists the exact route and date as unknown, while noting a possible connection to imports for food in 1972.'},
      {question:'What changed?',heading:'When ancestry becomes fragile',text:'Kyoto University’s 2026 summary describes serious hybridization in the Kamo River: the model estimated that later-generation hybrids dominated by 2021, while the native lineage was rare. A modelled population history is not proof of the ancestry of any photographed animal.'},
      {question:'How can we care?',heading:'Protect the river and its residents',text:'Conservation responses are expert-led and subject to law. Learn from qualified local researchers; do not capture, move, feed, release or harm wildlife yourself.'}
    ],
    sourceIds:['nieso','kyoto','ministry']
  }
]);

const SIMULATED = Object.freeze({
  robin:'an imagined robin',beetle:'an imagined ground beetle','orb-weaver':'an imagined orb-weaver',
  'water-strider':'an imagined water strider','water-flea':'an imagined water flea',
  squirrel:'an imagined squirrel',rabbit:'an imagined rabbit',songbird:'an imagined songbird',
  butterfly:'an imagined butterfly',gull:'an imagined gull'
});

/** Returns a fresh, source-attributed view model. No place data is recorded. */
export function ecologyDiscovery({encounter='robin',region=null}={}){
  if(!Object.hasOwn(SIMULATED,encounter))throw new Error('Unsupported simulated encounter');
  if(region!==null&&(typeof region!=='string'||region.length>240))throw new Error('Invalid region label');
  return {
    version:ECOLOGY_DISCOVERY_VERSION,
    frame:'comparative-learning-not-local-wildlife-record',
    opening:`You noticed ${SIMULATED[encounter]}. It is part of this recreated world, not a verified sighting. Another waterway may hold a different story: one worth discovering without confusing affection with ecological evidence.`,
    localNotice:region?`Your scene includes an interpreted public habitat context (${region}). The Kyoto account below is a separate region; no species or population has been identified here.`:'No verified geographic wildlife context is attached to this encounter. The documented Kyoto case below is elsewhere—not an animal identified here.',
    cases:CASES.map(c=>({...structuredClone(c),sources:c.sourceIds.map(id=>({...REFERENCES[id],id}))}))
  };
}
