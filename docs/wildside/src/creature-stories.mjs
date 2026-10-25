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
  squirrel: {label: 'Wikipedia · Eastern gray squirrel', url: 'https://en.wikipedia.org/wiki/Eastern_gray_squirrel', retrieved: '2026-10-25'},
  rabbit: {label: 'Wikipedia · European rabbit', url: 'https://en.wikipedia.org/wiki/European_rabbit', retrieved: '2026-10-25'},
  songbird: {label: 'Wikipedia · Songbird', url: 'https://en.wikipedia.org/wiki/Songbird', retrieved: '2026-10-25'},
  butterfly: {label: 'Wikipedia · Butterfly', url: 'https://en.wikipedia.org/wiki/Butterfly', retrieved: '2026-10-25'},
  gull: {label: 'Wikipedia · European herring gull', url: 'https://en.wikipedia.org/wiki/European_herring_gull', retrieved: '2026-10-25'},
  daphnia: {label: 'Wikipedia · Daphnia (water fleas)', url: 'https://en.wikipedia.org/wiki/Daphnia', retrieved: '2026-10-25'},
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
  squirrel: {
    id: 'squirrel',
    title: 'The squirrel',
    species: 'A tree squirrel; the story draws on the eastern gray squirrel and claims no species',
    simulated: 'an imagined tree squirrel',
    note: 'This squirrel is simulated and lives only in this recreated place; it is not identified as any species. What the story says about squirrels comes from the source below, which describes the eastern gray squirrel.',
    sourceIds: ['squirrel'],
    beats: [
      {id: 'notices', title: 'What it notices', hint: 'Watch the squirrel for a little while.', need: {observe: 6},
       text: 'A squirrel remembers where it has been. It keeps track of distant and nearby landmarks to find the food it buried, and it can smell a cache too, though scent fails in very dry weather or under snow. What it notices is mostly a map.', source: 'squirrel'},
      {id: 'needs', title: 'What it needs', hint: 'Become the squirrel and run across the ground.', need: {ground: 3},
       text: 'Seeds and nuts first: acorns, walnuts, hazelnuts, and also buds, flowers, berries, bark and fungi. Each squirrel may bury several thousand small caches in a season, and may pretend to bury one when it thinks it is being watched.', source: 'squirrel'},
      {id: 'shelters', title: 'Where it shelters', hint: 'Stay a while in its own eyes.', need: {embody: 20},
       text: 'Its nest is a drey, a ball of dry leaves and twigs wedged in the fork of a tree and lined with moss, thistledown, grass and feathers. It will also use a hollow in a tree. Two squirrels may share one in the breeding season and in cold spells, and a squirrel does not hibernate.', source: 'squirrel'},
      {id: 'fears', title: 'What it fears', hint: 'Keep running as the squirrel, and climb its tree.', need: {embody: 40, ground: 6},
       text: 'Hawks, owls and snakes, and on the ground, foxes and cats and dogs. A squirrel flicks its tail to tell the others that a predator is near, and flicks it again when the danger has gone. Here, this one runs for its tree when you come close, which is how the place is imagined, not a measurement.', source: 'squirrel'},
      {id: 'belongs', title: 'Who it belongs to', hint: 'Watch it from outside, and be it. Both.', need: {observe: 6, embody: 60, ground: 10},
       text: 'It is one of very few mammals that can come down a tree head first, turning its hind feet so the claws hold the bark. And what it forgets is a gift: the acorns it never goes back for are how an oak forest finds its next generation, so that in its native woods the gray squirrel has been called a forest regenerator.', source: 'squirrel'},
    ],
  },
  rabbit: {
    id: 'rabbit',
    title: 'The rabbit',
    species: 'A rabbit; the story draws on the European rabbit and claims no species',
    simulated: 'an imagined rabbit',
    note: 'This rabbit is simulated and lives only in this recreated place, and has no warren in it. What the story says about rabbits comes from the source below, which describes the European rabbit.',
    sourceIds: ['rabbit'],
    beats: [
      {id: 'notices', title: 'What it notices', hint: 'Watch the rabbit for a little while.', need: {observe: 6},
       text: 'A rabbit lives in a map of smells and warnings. It marks its territory with heaps of dung, and when something threatens it, it thumps the ground with its hind feet. Fleeing, it shows the white underside of its tail.', source: 'rabbit'},
      {id: 'needs', title: 'What it needs', hint: 'Become the rabbit and move across the grass.', need: {ground: 4},
       text: 'Grass, mostly, and young leaves and shoots, especially the fine-leaved fescues; in winter, bark. Feeding in a field, a rabbit usually goes only about twenty-five metres from its burrow, and rarely fifty. It also eats its own soft droppings a second time, as every rabbit does.', source: 'rabbit'},
      {id: 'shelters', title: 'Where it shelters', hint: 'Stay a while in its own eyes.', need: {embody: 20},
       text: 'Home is a warren: a network of burrows, usually dug into a slope or bank for the drainage, with entrances ten to fifty centimetres across and bare earth at the mouth. Some have emergency exits dug from the inside. A doe about to give birth digs a separate burrow, lined with grass, moss and fur from her own belly.', source: 'rabbit'},
      {id: 'fears', title: 'What it fears', hint: 'Keep going as the rabbit.', need: {embody: 40, ground: 8},
       text: 'Foxes and dogs, cats and weasels, birds of prey. A rabbit\u2019s main defence is to run and hide in vegetation or in its own burrows, and it is capable of a burst of speed back to cover. Here, this one bolts when you come near.', source: 'rabbit'},
      {id: 'belongs', title: 'Who it belongs to', hint: 'Watch it from outside, and be it. Both.', need: {observe: 6, embody: 60, ground: 15},
       text: 'Kits are born blind, deaf and nearly bare. The doe feeds them once a night, for only a few minutes, and the kits first leave the burrow at about eighteen days. A rabbit may raise four or five litters in a year, which is why a warren, and a lawn, can be so full of them.', source: 'rabbit'},
    ],
  },
  songbird: {
    id: 'songbird',
    title: 'The songbird',
    species: 'A songbird (suborder Passeri); no species is claimed',
    simulated: 'an imagined songbird',
    note: 'This songbird is simulated and lives only in this recreated place; it is not identified as any species. What the story says about songbirds in general comes from the source below.',
    sourceIds: ['songbird'],
    beats: [
      {id: 'notices', title: 'What it notices', hint: 'Watch the songbird for a little while.', need: {observe: 6},
       text: 'A songbird has two kinds of voice. Its calls are short and plain: an alarm, or a word to say it is here, especially among birds that travel in flocks. Its song is something else.', source: 'songbird'},
      {id: 'needs', title: 'What it needs', hint: 'Become the songbird and fly across the place.', need: {air: 8},
       text: 'Food, and for its young, caterpillars: many songbirds feed their nestlings on them. A bird that feeds a nest has to be out among the leaves, again and again, from the crown of one tree to the next.', source: 'songbird'},
      {id: 'sings', title: 'Why it sings', hint: 'Stay a while in its own eyes.', need: {embody: 25},
       text: 'Song is mostly about territory. It tells other birds who is here and where, and a male may sing at a rival to assert his place, sometimes instead of fighting. It also says he is ready to mate. The bird makes it in the syrinx, a \u201csong box\u201d where the windpipe meets the tubes to the lungs.', source: 'songbird'},
      {id: 'good', title: 'What makes a good song', hint: 'Keep flying as the songbird.', need: {embody: 45, air: 15},
       text: 'In some kinds, the more songs a male knows, the more females he attracts. Some borrow the songs of other species while courting, and that has been linked with success too. Length of the windpipe may matter more to a voice than the size of the syrinx.', source: 'songbird'},
      {id: 'belongs', title: 'Who it belongs to', hint: 'Watch it from outside, and be it. Both.', need: {observe: 6, embody: 60, air: 25},
       text: 'One idea is that females may prefer a familiar song, because it says the singer belongs to the local place. A song can be a dialect. In that sense a songbird belongs to whoever it sounds like.', source: 'songbird'},
    ],
  },
  butterfly: {
    id: 'butterfly',
    title: 'The butterfly',
    species: 'A butterfly; the story draws on butterflies in general and claims no species',
    simulated: 'an imagined butterfly',
    note: 'This butterfly is simulated and lives only in this recreated place. What the story says about butterflies in general comes from the source below.',
    sourceIds: ['butterfly'],
    beats: [
      {id: 'notices', title: 'What it notices', hint: 'Watch the butterfly for a little while.', need: {observe: 6},
       text: 'A butterfly tastes with its feet. Receptors there read a leaf the moment it lands, and a female uses them to decide whether this plant will feed her caterpillars before she lays an egg on it. Her feet are how she reads the world: what the leaf is, and whether it is right.', source: 'butterfly'},
      {id: 'needs', title: 'What it needs', hint: 'Become the butterfly and flutter over the flowers.', need: {air: 6},
       text: 'Nectar, mostly, drunk through a coiled proboscis, so that the whole of its errand among the flowers is sweetness. It also takes water and minerals such as sodium, and some feed on tree sap, rotting fruit, even dung.', source: 'butterfly'},
      {id: 'warms', title: 'What warms it', hint: 'Stay a while in its own eyes.', need: {embody: 25},
       text: 'It cannot fly until its body is warmer than about twenty-seven degrees, so on cool mornings it sits in the sun with its wings open until it can. The wings are covered in tiny scales, and many of the blues and greens are not pigment but the shape of the scales themselves.', source: 'butterfly'},
      {id: 'fears', title: 'What it fears', hint: 'Keep flying as the butterfly.', need: {embody: 45, air: 12},
       text: 'Birds and other hunters, and it has many answers. Some butterflies are poisonous and wear warning colours; harmless ones copy them; some look like leaves. Eyespots may draw a bite away from the head, and an erratic, bumpy flight is harder to catch.', source: 'butterfly'},
      {id: 'belongs', title: 'Who it belongs to', hint: 'Watch it from outside, and be it. Both.', need: {observe: 6, embody: 60, air: 20},
       text: 'It has been an egg, a caterpillar and a chrysalis before this. An adult lives anywhere from about a week to nearly a year. A monarch from eastern North America may travel thousands of miles to the mountains of Mexico, and a painted lady makes its round trip over several generations, so that no single butterfly ever sees the whole of it.', source: 'butterfly'},
    ],
  },
  gull: {
    id: 'gull',
    title: 'The gull',
    species: 'A gull; the story draws on the European herring gull and claims no species',
    simulated: 'an imagined gull',
    note: 'This gull is simulated and lives only in this recreated place. What the story says about gulls comes from the source below, which describes the European herring gull.',
    sourceIds: ['gull'],
    beats: [
      {id: 'notices', title: 'What it notices', hint: 'Watch the gull for a little while.', need: {observe: 6},
       text: 'A gull notices everything that might be food. It is an opportunist: it will take what is left in rubbish, eggs and chicks from other birds, even a catch from a plover. Refuse can make up half of what it eats.', source: 'gull'},
      {id: 'needs', title: 'What it needs', hint: 'Become the gull and fly across the water.', need: {air: 15},
       text: 'Despite the name, the herring gull is not much of a herring eater. Crustaceans and spiny-skinned animals fill more of its stomach than fish do. It often drops shelled prey from a height to crack it open.', source: 'gull'},
      {id: 'shelters', title: 'Where it shelters', hint: 'Stay a while in its own eyes.', need: {embody: 25},
       text: 'It nests in colonies, on the ground or on cliff ledges. Three eggs is usual, and both parents sit on them for four weeks. The chicks hatch with their eyes open and can walk within hours; they are flying at five or six weeks.', source: 'gull'},
      {id: 'fears', title: 'What it fears', hint: 'Keep flying as the gull.', need: {embody: 45, air: 30},
       text: 'It has a yelp for alarm and a low bark for worry. And it has reasons: in the UK the herring gull was placed on the Red List in 2009, after its numbers fell by about half in twenty-five years.', source: 'gull'},
      {id: 'belongs', title: 'Who it belongs to', hint: 'Watch it from outside, and be it. Both.', need: {observe: 6, embody: 60, air: 50},
       text: 'It takes about four years to look like an adult; the young are brown and streaked. A pair is faithful, and may stay together for life if their eggs hatch. The oldest recorded herring gull was forty-nine. In towns it finds street lights, scraps and rooftops to nest on, and some learn to take food from people.', source: 'gull'},
    ],
  },
  flea: {
    id: 'flea',
    title: 'The water flea',
    species: 'Water fleas (genus Daphnia); no species is claimed',
    simulated: 'an imagined water flea',
    note: 'This water flea is simulated and lives only in this recreated, illustrative freshwater place. What the story says about water fleas in general comes from the source below.',
    sourceIds: ['daphnia'],
    beats: [
      {id: 'notices', title: 'What it notices', hint: 'Watch the water flea for a little while.', need: {observe: 6},
       text: 'You can see through a water flea. Many kinds have a carapace so clear that, under a microscope, the heart can be seen beating, around a hundred and eighty times a minute. It is a very small animal, one to five millimetres, with nothing to hide.', source: 'daphnia'},
      {id: 'moves', title: 'How it moves', hint: 'Become the water flea and swim a little way.', need: {ground: .03},
       text: 'It swims in jerks. The second pair of its antennae does the work, and the hop-and-settle of its swimming is the reason for its name, because it looks like a flea jumping.', source: 'daphnia'},
      {id: 'needs', title: 'What it needs', hint: 'Stay a while in its own eyes.', need: {embody: 25},
       text: 'It does not hunt. Its legs keep a current moving, and the current brings in what is smallest: single-celled algae, scraps of detritus, protists, bacteria. A filter feeder lives by what the water carries past.', source: 'daphnia'},
      {id: 'fears', title: 'What it fears', hint: 'Keep swimming as the water flea.', need: {embody: 45, ground: .05},
       text: 'It is food for fish and for some amphibians. And in water where a predator such as the phantom midge larva has been, young water fleas can sense the chemical trace and grow larger, bulkier, and even sprout small \u201cneck-teeth\u201d, as if the animal could prepare its body for what it is afraid of.', source: 'daphnia'},
      {id: 'belongs', title: 'Who it belongs to', hint: 'Watch it from outside, and be it. Both.', need: {observe: 6, embody: 60, ground: .1},
       text: 'In good seasons most water fleas reproduce without mating. When the water turns bad, from crowding for instance, males appear, and the females lay resting eggs inside a tough case that waits. A typical life lasts five or six months, and in a cold lake without fish, one may live more than a year.', source: 'daphnia'},
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
