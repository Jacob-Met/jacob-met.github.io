// Region map. Every project line below is taken from Jacob's published site data
// (jacob-met.github.io docs/cv.json and docs/experience-content.json, updated 2026-10-24).
// WHICH region a project sits in is a SUGGESTION, not something Jacob has decided.
export const REGIONS = [
  { id: 1, key: 'frontal', name: 'Frontal lobe', title: 'Questions & method', color: [0.62, 0.80, 0.95],
    kicker: 'Research · who I am', lead: 'What would change our explanation? How I observe a system, test an idea, and learn from what does not fit.',
    items: [
      ['About', 'CS + physics at CSULB, biology minor; BUILD Scholar working toward MD/PhD training.'],
      ['Research approach', 'Academic collaboration and independent investigation, including research developed through HAMON.'],
      ['Contact', 'GitHub and LinkedIn links, as on the current site.'],
    ], note: 'Placement is a suggestion (frontal = planning and judgement). Copy is from the current site.' },
  { id: 2, key: 'parietal', name: 'Parietal lobe', title: 'Models & measurement', color: [0.55, 0.85, 0.80],
    kicker: 'Independent research', lead: 'Workbenches for comparing models against measurements.',
    items: [
      ['WORLDLAW', 'Which experiment would separate two explanations? Experimental scientific workbench.'],
      ['Kernel Garden', 'Can a faster kernel keep the right answer? Experimental optimization workbench.'],
      ['Protein molecular dynamics', 'Cleaned protein-simulation data and wrote plausibility checks for proposed structures (collaborative).'],
    ], note: 'Placement is a suggestion.' },
  { id: 3, key: 'temporal', name: 'Temporal lobe', title: 'Memory', color: [0.78, 0.72, 0.95],
    kicker: 'Independent research · prototypes', lead: 'When should a system change what it remembers?',
    items: [
      ['Computational memory', 'Exploratory research prototypes.'],
      ['Threadline', 'Review commitments beside the exact conversation words. Local prototype.'],
      ['Familiar Memories', 'Local photo stories with visitor-specific sharing and revocation. Local prototype.'],
      ['RecallWeave', 'Offline learning toolkit with adaptive lessons and labs.'],
    ], note: 'Placement is a suggestion. Jacob should confirm whether these count as personal research or HAMON work before launch; if HAMON, they move behind the Hamon eye.' },
  { id: 4, key: 'occipital', name: 'Occipital lobe', title: 'Seeing behaviour', color: [0.95, 0.85, 0.62],
    kicker: 'Academic research (collaborative)', lead: 'Turning video into measurements.',
    items: [
      ['Behavioral neurobiology', 'Scored mouse behaviour from video, checked automated tracking by hand, analysed in GraphPad Prism.'],
      ['Surgical ergonomics', 'Video-tracking workflows; recorded and analysed muscle activity, heart rate and movement.'],
    ], note: 'Placement is a suggestion (occipital = vision).' },
  { id: 5, key: 'cerebellum', name: 'Cerebellum', title: 'Movement', color: [0.70, 0.95, 0.70],
    kicker: 'Academic research · research software', lead: 'Human movement, rehabilitation and the instruments that record it.',
    items: [
      ['Gait & rehabilitation', 'Participant sessions, motion-capture marker labelling, fixes to gait-analysis code.'],
      ['CaptureSuite', 'Windows-first multimodal research capture; offline QC demo on synthetic EMG/IMU data.'],
    ], note: 'Placement is a suggestion (cerebellum = coordination of movement).' },
  { id: 6, key: 'stem', name: 'Brainstem', title: 'Tools', color: [0.80, 0.82, 0.86],
    kicker: 'Small public tools', lead: 'The plumbing.',
    items: [
      ['CanvasPilot', 'MCP server and CLI for Canvas LMS that rides your existing browser session.'],
      ['Multi-agent Fan-out Engine', 'Dependency plans, a SQLite dispatch queue, recovery that reconciles state.'],
      ['workflow-checks', 'Three small Python checks for back-office paperwork, on synthetic data.'],
    ], note: 'Placement is a suggestion. Part of the "~6 projects plus an in-the-lab line" trim still has to be decided by Jacob.' },
];

// The two eyes. Kept strictly separate: no Spire lore on the Hamon side and no Hamon branding on the Spire side.
// Assignment (SUGGESTION): Hamon = his right eye, Spire = his left eye. See CONCEPT.md for why.
export const EYES = {
  hamon: { id: 10, key: 'hamon', name: 'Right eye', title: 'HAMON 刃文', color: [0.80, 0.86, 1.0],
    kicker: 'The company', lead: 'The estate is the blade; Hamon is the gleam the world can see.',
    media: 'media/forge-hifi-entrance-1280.webp',
    mediaTag: 'PLACEHOLDER: the currently published forge still (Western smithy). It is being replaced by the Japanese forge.',
    items: [
      ['Approach', 'Dusk exterior → doorway → hearth → the seated togishi (pre-rendered hamon-engine video, not yet rendered).'],
      ['Hamon Engine', 'A Rust engine for worlds and the systems inside them. Repository private.'],
      ['Wildside', 'Flagship world built on the engine (copy to be rewritten around recurring creatures).'],
      ['Hackathons', 'DOMINO, Phantom Window, Replay Forge, Captionverse.'],
      ['Origin', 'Grok Bot / Togishi / Hamon origin section (copy not drafted yet).'],
      ['Engine research (draft, unmerged)', 'Forge rebuild lanes (PR #2193, draft), human togishi pipeline (lane branches, no PR yet), farm renders.'],
    ], note: 'Destination media is a placeholder. Lanternwake and TowerOps are deliberately not featured.' },
  spire: { id: 11, key: 'spire', name: 'Left eye', title: 'Spire of Octaves', color: [1.0, 0.78, 0.52],
    kicker: 'The fiction world', lead: 'A vertical world born from an unfinished sacred song. Stories free to read on its own site.',
    media: 'media/spire-thirdpot-r13d-1280.webp',
    mediaTag: 'PLACEHOLDER: Echo Third Pot engine test render r13d (lane paused). Not an approved Spire key art.',
    items: [
      ['Read', 'Begin with Salt’s End, What Strays and Seamwork, on spireofoctaves.com.'],
      ['Echo', 'Game work in progress (not public yet).'],
    ], note: 'Placeholder. Copy is from the current site; the approach shot and the look of this eye are suggestions for Jacob to approve.' },
};
