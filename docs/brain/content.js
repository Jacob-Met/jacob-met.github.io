// What lives where in the prerendered brain. Every line is Jacob's published copy (the lobby at /lobby/,
// docs/experience-content.json and docs/cv.json); the region a piece sits in follows the lobby's own split:
// research, projects and hackathons are Jacob's own work; HAMON (right eye) is the company; Spire (left eye) is the fiction.
// id = the label value in pr/labels.png (1-8 cortex/deep, 9 left eye, 10 right eye). seg = the prerendered dive.
export const REGIONS = [
  { id: 1, key: 'frontal', seg: 'dive_frontal', name: 'Frontal lobe', title: 'About & contact', hue: '#ffb08a',
    kicker: 'Who is thinking', lead: 'From human movement to computational models, I’m interested in how we observe a system, test an idea, and learn from what does not fit.',
    body: 'I’m a CSULB BUILD Scholar studying computer science and physics, with a biology minor, working toward MD/PhD training.',
    items: [
      ['GitHub', 'Public source for the tools and research software.', 'https://github.com/Jacob-Met'],
      ['LinkedIn', 'Research and work history.', 'https://www.linkedin.com/in/jacob-metoyer-15b701352'],
      ['The full portfolio', 'The forge lobby, with every section of the old home page.', '/lobby/#about'],
    ] },
  { id: 2, key: 'parietal', seg: 'dive_parietal', name: 'Parietal lobe', title: 'Models & measurement', hue: '#8fe0cf',
    kicker: 'Independent research', lead: 'What would change our explanation? Workbenches that put competing models in front of a measurement.',
    figure: ['/assets/figures/worldlaw-computed.svg', 'WORLDLAW: spring and gravity models of a pendulum agree at 5° (gap 0.0001) and separate at 30° (gap 0.0236).'],
    items: [
      ['WORLDLAW', 'Compare competing models of motion, choose a revealing measurement, and see how their predictions change.', '/lobby/#worldlaw'],
      ['Kernel Garden', 'Generate competing CUDA implementations, run them on a real GPU, and remove candidates that fail independent numerical checks.', '/lobby/#kernel-garden'],
      ['Protein molecular dynamics', 'Cleaned protein-simulation data and wrote plausibility checks for proposed structures (collaborative).', '/lobby/#research'],
    ] },
  { id: 3, key: 'temporal', seg: 'dive_temporal', name: 'Temporal lobe', title: 'Projects', hue: '#c8b8ff',
    kicker: 'Use it. Change something.', lead: 'A few tools and worlds you can try. The temporal lobe keeps what was made, and what it remembers.',
    figure: ['/assets/demos/towerops-desktop.webp', 'TowerOps Airspace Lab, desktop capture.'],
    items: [
      ['TasteTable', 'A familiar taste. A week of possibilities. Offline studio.', '/tastetable/'],
      ['TowerOps Airspace Lab', 'See the conflict. Change the outcome.', 'https://jacobmetoyer.com/TowerOps/airspace/'],
      ['RecallWeave', 'A flat line can hide a growing problem. Try the feedback experiment.', 'https://jacobmetoyer.com/RecallWeave/courses/feedback-control-lab.html'],
      ['Captionverse', 'What if the film waited for you?', '/lobby/#captionverse'],
      ['Computational memory', 'When should a system change what it remembers? Offline studies on synthetic data.', '/lobby/#computational-memory'],
      ['Threadline · Familiar Memories · Threshold · LedgerDock · Teachback · Clearway', 'Smaller prototypes, each a question.', '/lobby/#projects'],
    ] },
  { id: 4, key: 'occipital', seg: 'dive_occipital', name: 'Occipital lobe', title: 'Seeing behaviour', hue: '#ffd98a',
    kicker: 'Academic research (collaborative)', lead: 'Turning video into measurements. The visual cortex is where the pathway to both eyes begins.',
    items: [
      ['Behavioral neurobiology', 'Scored mouse behaviour from video, checked automated tracking by hand, analysed in GraphPad Prism.', '/lobby/#research'],
      ['Surgical ergonomics', 'Video-tracking workflows; recorded and analysed muscle activity, heart rate and movement.', '/lobby/#research'],
    ] },
  { id: 5, key: 'cerebellum', seg: 'dive_cerebellum', name: 'Cerebellum', title: 'Movement', hue: '#a6f0a6',
    kicker: 'Academic research · research software', lead: 'Human movement, rehabilitation and the instruments that record it.',
    items: [
      ['Gait & rehabilitation', 'Participant sessions, motion-capture marker labelling, fixes to gait-analysis code.', '/lobby/#research'],
      ['CaptureSuite', 'Research software for recording multiple streams in one session and keeping the source intact. Offline QC demo on synthetic data.', 'https://github.com/Jacob-Met/CaptureSuite'],
    ] },
  { id: 6, key: 'stem', seg: 'dive_brainstem', name: 'Brainstem', title: 'Tools', hue: '#cfd6e6',
    kicker: 'Small public tools', lead: 'The plumbing that keeps everything else breathing.',
    items: [
      ['CanvasPilot', 'An MCP server and CLI for Canvas LMS that rides the browser session you already have.', 'https://github.com/Jacob-Met/canvaspilot'],
      ['Multi-agent Fan-out Engine', 'Dependency plans, a SQLite dispatch queue, and recovery that reconciles state.', 'https://github.com/Jacob-Met/multi-agent-fanout-engine'],
      ['workflow-checks', 'Three small Python checks for back-office paperwork, run on synthetic data with file:row evidence.', 'https://github.com/Jacob-Met/workflow-checks'],
    ] },
  { id: 7, key: 'motor', seg: 'dive_motor', name: 'Motor strip', title: 'Hackathons', hue: '#ffa05a',
    kicker: 'One constraint. A working idea.', lead: 'Competition-built projects, each with a question to answer. The precentral gyrus is where intent becomes movement.',
    figure: ['/assets/scene/forge-hifi-hackathons-1280.webp', 'The hackathon bench in the forge lobby. HAMON Engine render.'],
    items: [
      ['DOMINO', 'Amazon Developer Hackathon · Alexa+. Why did the door unlock when nobody was home?', '/lobby/#domino'],
      ['Phantom Window', 'Amazon Developer Hackathon · Fire TV concept. What is just outside the camera’s view?', '/lobby/#phantom-window'],
      ['Replay Forge · court reconstruction', 'Amazon Developer Hackathon. Could you watch the possession from above?', '/lobby/#replay-forge'],
      ['ReplayForge · replay debugging', 'Life After Code · GitLab.', 'https://devpost.com/software/replayforge-ypvoia'],
      ['ShadeWindow', 'Historical competition entry.', 'https://devpost.com/software/shadewindow'],
    ] },
  { id: 8, key: 'hippocampus', seg: 'dive_hippocampus', name: 'Hippocampus', title: 'Wildside', hue: '#ff9db8', deep: true,
    kicker: 'A place I made · personal', lead: 'The hippocampus holds place cells, the neurons that fire for one spot in a remembered landscape. Wildside is the place this brain keeps.',
    figure: ['/assets/wildside/wildside-card.webp', 'Wildside: a painted lake under autumn trees.'],
    items: [
      ['Play Wildside', 'A painted place you can walk through, rendered live by the HAMON Engine.', '/wildside/'],
      ['About the project', 'How it was made, at MarinaHacks.', '/wildside-project.html'],
    ] },
];
export const EYES = {
  10: { key: 'hamon', seg: 'eye_hamon', name: 'Right eye', title: 'HAMON 刃文', hue: '#a9c4ff' },
  9: { key: 'spire', seg: 'eye_spire', name: 'Left eye', title: 'Spire of Octaves', hue: '#ffc27a' },
};
