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
