/**
 * Creature stories: a short arc of beats for each animal of the place, unlocked by what you do as you
 * watch it or become it. Same honesty rule as ecology-discovery.mjs: the individual is a SIMULATED,
 * imagined animal in a recreated place; the natural history is about its real species, attributed to
 * the sources listed, and no beat claims a sighting. Prose is deliberately plain and quiet.
 *
 * A beat unlocks when every counter in `need` reaches its threshold. Counters (see embody-progress):
 *   observe  seconds spent watching the animal from outside
 *   embody   seconds spent seeing as the animal
 *   ground   metres travelled on the ground (hopping, crawling, skating)
 *   air      metres travelled in flight
 */
export const STORY_VERSION = 1;

const SOURCES = Object.freeze({
  bto: {label: 'British Trust for Ornithology · BirdFacts: Robin', url: 'https://www.bto.org/understanding-birds/birdfacts/robin', retrieved: '2026-10-25'},
  rspb: {label: 'RSPB · Robin', url: 'https://www.rspb.org.uk/birds-and-wildlife/robin', retrieved: '2026-10-25'},
  carabidae: {label: 'Wikipedia · Ground beetle (Carabidae)', url: 'https://en.wikipedia.org/wiki/Ground_beetle', retrieved: '2026-10-25'},
  gerridae: {label: 'Wikipedia · Gerridae (water striders)', url: 'https://en.wikipedia.org/wiki/Gerridae', retrieved: '2026-10-25'},
  araneidae: {label: 'Wikipedia · Orb-weaver spider', url: 'https://en.wikipedia.org/wiki/Orb-weaver_spider', retrieved: '2026-10-25'},
});

const STORIES = Object.freeze({
  robin: {
    id: 'robin',
    title: 'The robin',
    species: 'European robin (Erithacus rubecula)',
    simulated: 'an imagined garden robin',
    note: 'This robin is simulated and lives only in this recreated place. What the story says about robins in general comes from the sources below.',
    sourceIds: ['bto', 'rspb'],
    beats: [
      {
        id: 'notices', title: 'What it notices', hint: 'Watch the robin for a little while.',
        need: {observe: 6},
        text: 'A robin watches the ground the way you might watch a face. A turned leaf, a shiver in the soil, a gardener’s spade going in: it learns quickly that these mean food. In real gardens, robins follow whoever is digging and pounce on the worms and grubs the fresh earth gives up.',
        source: 'rspb',
      },
      {
        id: 'needs', title: 'What it needs', hint: 'Become the robin and hop along the ground.',
        need: {ground: 3},
        text: 'Mostly it needs small things, often. Worms, grubs, whatever moves. It hops, stops, tilts its head, hops again. When the cold comes, robins crowd to the food people put out and defend it, because a short day is a long hunger.',
        source: 'bto',
      },
      {
        id: 'shelters', title: 'Where it shelters', hint: 'Take wing. Fly across the place.',
        need: {air: 10},
        text: 'The robin is famous for choosing odd shelter: a plant pot, an open-fronted nest box, the engine of a parked plane. A real female does the sitting, fourteen to sixteen days over four or five eggs, and the chicks leave the nest after about two weeks. Here, this robin keeps to the perches the place offers, and goes to the driest when it rains.',
        source: 'bto',
      },
      {
        id: 'fears', title: 'What it fears', hint: 'Stay with it a while longer, in its own eyes.',
        need: {embody: 30},
        text: 'Cold is the great danger. After the hard winters of 2008 to 2012, robin numbers across Britain fell sharply, then slowly came back. And a robin fears what moves toward it too quickly: this one will slip to a quieter perch when you come near, which is how Wildside imagines it, not a measurement.',
        source: 'bto',
      },
      {
        id: 'belongs', title: 'Who it belongs to', hint: 'Watch it from outside, and be it. Both.',
        need: {observe: 6, embody: 60},
        text: 'A robin belongs to its patch, and says so. It sings nearly all year, pausing only in the quiet of the summer moult, and some now sing at night beneath streetlights. Its young are speckled brown and have no red breast yet. A robin that has reached breeding age may expect about two more years. Some of the robins in a British winter have come from northern Europe, to share a garden that is not theirs.',
        source: 'rspb',
      },
    ],
  },
  beetle: {
    id: 'beetle',
    title: 'The ground beetle',
    species: 'Ground beetles (family Carabidae); no species is claimed',
    simulated: 'an imagined ground beetle',
    note: 'This beetle is simulated and lives only in this recreated place; it is not identified as any species, and it walks a little faster when you steer it. What the story says about ground beetles in general comes from the source below.',
    sourceIds: ['carabidae'],
    beats: [
      {id: 'notices', title: 'What it notices', hint: 'Watch the beetle for a little while.', need: {observe: 6},
       text: 'Most ground beetles are hunters. They go looking for small living things, and most of them do it at night, so a beetle\u2019s world is mostly dark, and mostly touch. Something that moves is something that might be a meal.', source: 'carabidae'},
      {id: 'needs', title: 'What it needs', hint: 'Become the beetle and walk a little way.', need: {ground: .25},
       text: 'Mostly it needs prey: invertebrates, caught on foot. A few ground beetles eat plants instead, and some eat both. Because so many of them hunt the pests of gardens and crops, most are counted as friends of the people who grow things.', source: 'carabidae'},
      {id: 'shelters', title: 'Where it shelters', hint: 'Stay with the beetle in its own eyes.', need: {embody: 20},
       text: 'By day, a ground beetle is usually out of sight: beneath bark, under a log, between rocks, or in the sand at the edge of a pond or river. A world, for a beetle, is the underside of something.', source: 'carabidae'},
      {id: 'fears', title: 'What it fears', hint: 'Keep walking as the beetle.', need: {embody: 40, ground: .5},
       text: 'It is not defenceless. Glands in its body can release a noxious or caustic fluid, and the bombardier beetles, a relative, fire a hot, acrid spray with a small pop. That is why, when a large one becomes a nuisance, blocking its way in is usually advised over insecticide, which can make it release the fluid. Here, this beetle simply turns away from edges and water.', source: 'carabidae'},
      {id: 'belongs', title: 'Who it belongs to', hint: 'Watch it from outside, and be it. Both.', need: {observe: 6, embody: 60, ground: 1},
       text: 'A ground beetle is a creature of the ground. Many are unable or reluctant to fly, and the large ones have wing covers fused shut, so the place a beetle belongs is as wide as it can walk. Its cousins the tiger beetles are the exception that proves it: they hunt by day, by sight, and can run at nine kilometres an hour.', source: 'carabidae'},
    ],
  },
  skater: {
    id: 'skater',
    title: 'The water strider',
    species: 'Water striders (family Gerridae); no species is claimed',
    simulated: 'an imagined water strider',
    note: 'This water strider is simulated and lives only in this recreated place. What the story says about water striders in general comes from the source below.',
    sourceIds: ['gerridae'],
    beats: [
      {id: 'notices', title: 'What it notices', hint: 'Watch the strider for a little while.', need: {observe: 6},
       text: 'A water strider feels the surface the way you feel a floor in the dark. The ripples of something struggling on the water draw it in, and its front legs are what read the tremble.', source: 'gerridae'},
      {id: 'rows', title: 'How it moves', hint: 'Become the strider and skate across the water.', need: {ground: .4},
       text: 'It does not swim. Its middle legs press down and back and each stroke leaves a small circular wave behind; the hind legs steer. Water striders often travel a metre every second, or faster, over water that would not hold anything heavier.', source: 'gerridae'},
      {id: 'stands', title: 'What holds it up', hint: 'Stay a while in its own eyes.', need: {embody: 25},
       text: 'The water holds it by its own skin. Long legs spread the weight, fine hairs that shed water cover the body, and the surface tension does the rest. If a strider is pushed under, the hairs carry a film of air and float it back up. In seasonal climates the adults spend winter hidden beneath logs, rocks or leaf litter.', source: 'gerridae'},
      {id: 'fears', title: 'What it fears', hint: 'Keep skating as the strider.', need: {embody: 45, ground: 1},
       text: 'Birds are its main danger, and some fish. A scent from its thorax helps to keep the fish away. And there is another danger in its own kind: cannibalism is frequent among water striders, and helps to keep their numbers in check.', source: 'gerridae'},
      {id: 'belongs', title: 'Who it belongs to', hint: 'Watch it from outside, and be it. Both.', need: {observe: 6, embody: 60, ground: 2},
       text: 'Males court with ripples, and use them to tell a female from a rival. Eggs are laid underwater on plants or stones, and a young strider passes through five nymphal stages, about sixty to seventy days, before it is grown. Some kinds have wings to find new water, and some do not, because a stable pond does not ask them to leave.', source: 'gerridae'},
    ],
  },
  spider: {
    id: 'spider',
    title: 'The orb-weaver',
    species: 'Orb-weaver spiders (family Araneidae); no species is claimed',
    simulated: 'an imagined orb-weaver',
    note: 'This orb-weaver is simulated and lives only in this recreated place; its web is imagined too. What the story says about orb-weavers in general comes from the source below.',
    sourceIds: ['araneidae'],
    beats: [
      {id: 'notices', title: 'What it notices', hint: 'Watch the weaver for a little while.', need: {observe: 6},
       text: 'It waits at the hub, where every strand meets. An insect that blunders into the sticky lines is a quick bite and then a wrapping of silk, and a catch is the whole reason the web exists.', source: 'araneidae'},
      {id: 'builds', title: 'How it builds', hint: 'Become the weaver and walk the silk.', need: {ground: .15},
       text: 'The first thread floats on the wind until it catches on something. A second drops from the middle to make a Y, and then come the spokes, which are not sticky, and last the spiral, which is. The spider has a third claw on each foot for the dry silk, which is how it can walk its own web without being caught in it.', source: 'araneidae'},
      {id: 'renews', title: 'Where it rests', hint: 'Stay a while in its own eyes.', need: {embody: 25},
       text: 'Many orb-weavers make a new web every day. Toward evening the spider eats the old one, rests for about an hour, and spins another in nearly the same place. That is why their webs rarely gather the litter that other spiders\u2019 do.', source: 'araneidae'},
      {id: 'careful', title: 'What it is careful of', hint: 'Keep walking the silk as the weaver.', need: {embody: 45, ground: .4},
       text: 'Not everything that lands is safe to eat. A wasp or another venomous insect may be wrapped in silk before it is bitten. And in Wildside, this spider goes still when a bird comes near, which is how the place is imagined, not something recorded.', source: 'araneidae'},
      {id: 'belongs', title: 'Who it belongs to', hint: 'Watch it from outside, and be it. Both.', need: {observe: 6, embody: 60, ground: .8},
       text: 'A male crosses the web slowly toward the hub, or plucks a courting thread to call the female to him. A few kinds do without a web at all: one hangs a sticky globule on a line and lets a scent that mimics a moth\u2019s do the calling.', source: 'araneidae'},
    ],
  },
});

export const CREATURE_IDS = Object.freeze(Object.keys(STORIES));

/** A fresh, source-attributed model for one animal; throws for animals without a story yet. */
export function creatureStory(id) {
  if (!Object.hasOwn(STORIES, id)) throw new Error('No story for ' + String(id));
  const s = STORIES[id];
  return {...structuredClone({...s, sourceIds: undefined}), sources: s.sourceIds.map(k => ({...SOURCES[k], id: k})), beats: s.beats.map(b => ({...b, sourceRef: {...SOURCES[b.source], id: b.source}}))};
}

export function emptyProgress() { return {observe: 0, embody: 0, ground: 0, air: 0}; }

export function beatUnlocked(beat, progress) {
  return Object.entries(beat.need).every(([key, value]) => (progress?.[key] ?? 0) >= value);
}

/** Ids of every unlocked beat, in story order. */
export function unlockedBeats(id, progress) {
  return creatureStory(id).beats.filter(b => beatUnlocked(b, progress)).map(b => b.id);
}

/** Fraction of the way to unlocking a beat, 0..1: the mean of its counters' progress. */
export function beatProgress(beat, progress) {
  const parts = Object.entries(beat.need).map(([key, value]) => Math.min(1, (progress?.[key] ?? 0) / value));
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}
