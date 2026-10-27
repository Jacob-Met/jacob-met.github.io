// Curates docs/projects.json into the v3.1 prerendered brain: writes docs/brain/content.js (tips + panel data),
// the region list and the region panels in docs/brain/index.html, then copies it to docs/index.html (the brain is the site root).
// The two eye worlds (#w-hamon, #w-spire) stay hand-written in index.html; only their project links are injected.
import fs from "node:fs";
const P = Object.fromEntries(JSON.parse(fs.readFileSync("docs/projects.json", "utf8")).projects.map(p => [p.slug, p]));
const W = s => { const p = P[s]; if (!p) throw new Error("missing project " + s); return [p.title, p.oneLiner, `/work/${s}/`, p.milestone || "", p.flagship ? 1 : 0]; };
const X = (a, b, h) => [a, b, h, "", 0];
// Curated: the strongest, demonstrable work leads; private stubs and near-duplicates are left to /outside/.
const REGIONS = [
 { id: 8, key: 'hippocampus', seg: 'dive_hippocampus', name: 'Hippocampus', title: 'Wildside', hue: '#ff9db8', deep: true,
   kicker: 'The place this brain keeps', lead: 'The hippocampus holds place cells, the neurons that fire for one spot in a remembered landscape. Wildside turns real places into living, explorable worlds.',
   figure: ['/assets/wildside/wildside-card.webp', 'Wildside: a painted lake under autumn trees.'],
   items: [W('wildside'), X('Play Wildside', 'A painted place you can walk through, rendered live by the HAMON Engine.', '/wildside/')] },
 { id: 4, key: 'occipital', seg: 'dive_occipital', name: 'Occipital lobe', title: 'Vision', hue: '#ffd98a',
   kicker: 'Video in, understanding out', lead: 'Ordinary footage turned into depth, motion, mechanism and forecast. The visual cortex is where the pathway to both eyes begins.',
   figure: ['/assets/demos/chronos-vision.webp', 'chronos-vision, from the demo.'],
   items: ['chronos-vision', 'mechanism', 'phantom-window'].map(W) },
 { id: 3, key: 'temporal', seg: 'dive_temporal', name: 'Temporal lobe', title: 'Memory & sound', hue: '#c8b8ff',
   kicker: 'What happened, who said it', lead: 'Reconstructing the past from fragments, and putting sound where it came from.',
   figure: ['/assets/demos/afterimage.webp', 'afterimage, from the demo.'],
   items: ['afterimage', 'captionverse', 'recallweave'].map(W) },
 { id: 7, key: 'motor', seg: 'dive_motor', name: 'Motor strip', title: 'Hackathons', hue: '#ffa05a',
   kicker: 'One constraint. A working idea.', lead: 'Competition-built projects. The precentral gyrus is where intent becomes movement.',
   figure: ['/assets/demos/replay-forge.webp', 'Replay Forge, from the demo.'],
   items: ['replay-forge', 'domino', 'towerops'].map(W) },
 { id: 2, key: 'parietal', seg: 'dive_parietal', name: 'Parietal lobe', title: 'Models & measurement', hue: '#8fe0cf',
   kicker: 'Independent research', lead: 'What would change our explanation? Workbenches that put competing models in front of a measurement.',
   figure: ['/assets/figures/worldlaw-computed.svg', 'WORLDLAW: spring and gravity models of a pendulum agree at 5° and separate at 30°.'],
   items: [X('WORLDLAW', 'Compare competing models of motion, choose a revealing measurement, and see how their predictions change.', '/lobby/#worldlaw'),
           X('Kernel Garden', 'Generate competing CUDA kernels, run them on a real GPU, and drop any that fail independent numerical checks.', '/lobby/#kernel-garden')] },
 { id: 5, key: 'cerebellum', seg: 'dive_cerebellum', name: 'Cerebellum', title: 'Movement', hue: '#a6f0a6',
   kicker: 'Academic research · research software', lead: 'Human movement, surgery and rehabilitation, and the instruments that record them.',
   items: [W('surgical-ergonomics'), X('Gait & rehabilitation', 'Participant sessions, motion-capture marker labelling, fixes to gait-analysis code.', '/lobby/#research'), W('capturesuite')] },
 { id: 1, key: 'frontal', seg: 'dive_frontal', name: 'Frontal lobe', title: 'About & contact', hue: '#ffb08a',
   kicker: 'Who is thinking', lead: 'From human movement to computational models, I’m interested in how we observe a system, test an idea, and learn from what does not fit.',
   body: 'I’m a CSULB BUILD Scholar studying computer science and physics, with a biology minor, working toward MD/PhD training.',
   items: [X('GitHub', 'Public source for the tools and research software.', 'https://github.com/Jacob-Met'),
           X('LinkedIn', 'Research and work history.', 'https://www.linkedin.com/in/jacob-metoyer-15b701352'),
           X('Every project', 'The plain index, including the smaller prototypes.', '/outside/')] },
 { id: 6, key: 'stem', seg: 'dive_brainstem', name: 'Brainstem', title: 'Tools', hue: '#cfd6e6',
   kicker: 'Small public tools', lead: 'The plumbing that keeps everything else breathing.',
   items: ['canvaspilot', 'workflow-checks'].map(W) },
];
const EYES = { 10: { key: 'hamon', seg: 'eye_hamon', name: 'Right eye', title: 'HAMON 刃文', hue: '#a9c4ff' },
               9: { key: 'spire', seg: 'eye_spire', name: 'Left eye', title: 'Spire of Octaves', hue: '#ffc27a' } };
fs.writeFileSync("docs/brain/content.js", "// GENERATED by tools/site/make-brain.mjs from docs/projects.json. Items: [title, line, href, milestone, flagship].\n// id = label value in pr/labels.png (1-8 cortex/deep, 9 left eye, 10 right eye); seg = the prerendered dive.\nexport const REGIONS = " + JSON.stringify(REGIONS, null, 1) + ";\nexport const EYES = " + JSON.stringify(EYES, null, 1) + ";\n");
const e = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ext = h => /^https?:/.test(h) ? ' rel="noopener"' : '';
const li = ([a, b, h, m, f]) => `<li${f ? ' class="flag"' : ''}><a href="${e(h)}"${ext(h)}><b>${e(a)}</b>${m ? `<em class="ms">${e(m)}</em>` : ''}<span>${e(b)}</span></a></li>`;
const list = "\n    " + [[10, 'Right eye · the company'], [9, 'Left eye · the fiction']].map(([id, sm]) => `<li class="eye"><a href="#w-${EYES[id].key}" data-id="${id}" style="--c:${EYES[id].hue}">${e(EYES[id].title)}<small>${sm}</small></a></li>`).join("\n    ")
  + REGIONS.map(r => `\n    <li><a href="#r-${r.key}" data-id="${r.id}" style="--c:${r.hue}">${e(r.title)}<small>${e(r.name)}</small></a></li>`).join("") + "\n  ";
const secs = REGIONS.map(r => `\n  <section class="region" id="r-${r.key}" data-id="${r.id}" style="--c:${r.hue}">\n    <p class="kicker">${e(r.name)} · ${e(r.kicker)}</p><h2>${e(r.title)}</h2><p class="lead">${e(r.lead)}</p>${r.body ? `<p class="body">${e(r.body)}</p>` : ''}\n    <ul class="syn">${r.items.map(li).join("")}</ul>${r.figure ? `<figure><img src="${r.figure[0]}" alt="${e(r.figure[1])}" loading="lazy" decoding="async"><figcaption>${e(r.figure[1])}</figcaption></figure>` : ''}\n  </section>`).join("") + "\n";
let h = fs.readFileSync("docs/brain/index.html", "utf8");
const rep = (re, s) => { if (!re.test(h)) throw new Error("anchor not found " + re); h = h.replace(re, s); };
rep(/(<ul id="regionList">)[\s\S]*?(<\/ul>)/, `$1${list}$2`);
rep(/(<div class="regions">)[\s\S]*?(<\/div>\n\n  <section class="world" id="w-hamon")/, `$1${secs}$2`);
// project links inside the eye worlds
h = h.replace(/\n\s*<li data-gen="work"[^\n]*/g, "");
rep(/(<section class="world" id="w-hamon"[\s\S]*?<ul class="syn">)/, `$1\n        ${li(W('hamon-engine')).replace('<li', '<li data-gen="work"')}`);
rep(/(<section class="world" id="w-spire"[\s\S]*?<ul class="syn">)/, `$1\n        ${li(W('spire-of-octaves')).replace('<li', '<li data-gen="work"')}`);
fs.writeFileSync("docs/brain/index.html", h); fs.writeFileSync("docs/index.html", h);
const n = REGIONS.reduce((k, r) => k + r.items.filter(i => i[2].startsWith('/work/')).length, 0) + 2;
console.log("brain:", n, "curated projects wired");
