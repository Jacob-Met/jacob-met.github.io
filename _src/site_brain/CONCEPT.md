# jacobmetoyer.com: "the brain you step into" (first-pass concept)

Status: **first-pass draft, 2026-10-26.** Jacob said more nuance is coming. Nothing here is deployed, merged or published; the prototype is local only.
Labels used below: **[fact]** = taken from the current site data or the estate files (path given); **[suggestion]** = my proposal for Jacob to accept or change.

## 0. The idea in one paragraph

The home page is a brain floating in the dark. It is the whole of Jacob's research, shown as one mind. The brain has **two eyes**, and they are the two portals to his two separate worlds: one eye opens onto **HAMON** (the company; the forge), the other onto **Spire of Octaves** (the fiction world). The rest of the brain holds his research. Point at a lobe and it lights along its folds; choose it and the camera dives through the surface, down to synapse-scale tissue, and comes out inside that region's world. "Step out" always brings you back to the brain.

Framing line for the Hamon eye **[fact, Jacob's words]**: "The estate is the blade; Hamon is the gleam the world can see."

## 1. Separation rules (Jacob, 2026-10-26)

- Spire content stays Spire; Hamon content stays Hamon. No shared lore, symbols, palette cues or branding across the two eyes. **[fact: Jacob's instruction]**
- The brain itself is neutral: it is Jacob's research, not a Hamon product and not a Spire place. **[suggestion]** Specifically, no 刃文 mark, sword, ember or Spire song motif on the brain. Each eye carries its own identity only once you are looking at that eye.
- **Open question for Jacob:** the dispatch said "the togishi's brain has two eyes". If the brain is literally the togishi's (a Hamon character), the Spire eye sits inside a Hamon character, which bends the separation rule. My suggestion is to keep the landing brain anonymous and let the togishi appear only inside the Hamon eye. The loop "step into the togishi → you are back in the brain" (§3.3) can then be a quiet easter egg rather than the premise. Jacob decides.

## 2. Experience flow

### 2.1 Landing (the brain)
- A luminous, anatomically plausible brain: two hemispheres with gyri and sulci, the longitudinal fissure, central sulcus and Sylvian fissure, cerebellum, brainstem, optic nerves and two eyes. **[suggestion: the eyes sit on the optic nerves in front of the frontal lobes, stylised rather than inside a skull]**
- Look: low-key chiaroscuro on near-black, borrowed from `/workspace/hamon_video/STYLE.md` (single hard raking key, thin cool rim, no flat fill, deep blacks but a floor so nothing is pure black). The colour is a desaturated tissue grey; the only "light" is what runs along the folds of the region you point at.
- Camera: slow 3/4 side view from slightly above. Idle drift of about 0.03°/frame; drag turns it with inertia, wheel or pinch zooms within limits. No auto-spin when reduced motion is on.
- Name and one line top-left; "Ways in" list top-right (on phones it becomes a bottom sheet of chips). That list is the real navigation; the 3D is the enhancement.

### 2.2 Hover / touch
- Desktop: hover a lobe or an eye; the rest of the brain dims about 45%, the chosen region glows along its sulci with a slow pulse and a few synapse sparks, and a small label appears ("Memory · Temporal lobe").
- Touch: the first tap highlights, the second tap dives. The list chips do the same.
- Keyboard: Tab or arrow keys move between regions (the list and the 3D highlight stay in sync), Enter dives, Escape steps out.

### 2.3 Dive (about 2.6 s; 0.35 s cross-fade with reduced motion)
1. **Approach (0–55%)**: an eased camera flight to the chosen surface. For an eye, the camera swings round in front of it and goes in through the pupil.
2. **Through the tissue (55–100%)**: a cut to synapse-scale neural tissue (dendrite filaments, firing flickers, drifting vesicle points), tinted by destination:
   - Hamon eye: indigo into steel white. **[suggestion]**
   - Spire eye: cyan "pale" light into brass lamp light. **[suggestion, from the bible's recurring textures: brass, ink, cyan "pale" light; `/workspace/echo/refs/drive/raw/wb/spire/SPIRE_BIBLE.md` line 23]**
   - Research lobes: that region's colour.
3. **Arrival**: the destination's own world takes over (§2.4).

### 2.4 Destinations
- **Hamon eye → the forge approach** (pre-rendered hamon-engine footage, per `/workspace/forge_work/FORGE_AUTHENTICITY.md` §14.4): dusk exterior (thatched kajiba at the foot of a sugi slope, smoke from the koshi-yane, warm door slit, an optional thin crescent moon in one shot only) → stone path past the hokora and charcoal bales → the threshold, where the door frame goes near-black and the interior rises out of the dark → the low hearth and pit → the togishi corner, with the seated togishi idling at the togidai. The film ends on a held still. The Hamon content (§3.1) sits beside it in a side panel and moves below it on phones.
- **Spire eye → a Spire approach shot**, then the Spire content (§3.2) and the link out to spireofoctaves.com.
- **Research lobes → a quiet "region room"**: for now an image or figure plus the project list. Their visual worlds are not designed yet (§3.3 lists ideas).

### 2.5 Step out
- A "← Step out" button (always focused on arrival), Escape, the browser Back button (each dive pushes a history entry; **[to build]**, the prototype does not do history yet), or a swipe down on phones **[to build]**.
- Stepping out plays the dive in reverse: tissue → pull back → brain, then the region you came from stays highlighted and focus returns to its list entry.
- Deep links: `/#r-hamon`, `/#r-spire`, `/#r-temporal` and so on should open straight into a region with the brain skipped **[to build: the prototype only uses them as plain-HTML anchors today]** (§6).

## 3. Region map

Project lines are taken from the current site data in `Jacob-Met/jacob-met.github.io` (`docs/cv.json` and `docs/experience-content.json`, updated 2026-10-24; local checkout `/workspace/forge_work/site`). **Every placement is a [suggestion].**

### 3.1 Right eye (his right) → HAMON 刃文
**[suggestion]** Hamon gets his right eye. Why: (1) Most people sight with the right eye (eye dominance; commonly cited as about two thirds of people, general knowledge, not a cited source here). A polisher sighting down a blade is the image of Hamon. (2) When you face him, his right eye is on the **left** of your screen, so in a left-to-right reading the company comes first and Spire second. If Jacob would rather lead with Spire, swap them: it is a one-line change (`side` in `main.js`).

Contents:
- The forge approach film (pre-rendered, §5).
- **Hamon Engine**: the Rust engine; repository private **[fact, cv.json]**.
- **Wildside**: flagship world on the engine **[fact, site]**. Copy to be rewritten around recurring creatures **[open workstream]**.
- **Hackathon builds**: DOMINO, Phantom Window, Replay Forge, Captionverse **[fact: they are under `hamonBranches` today]**.
- **Origin section**: Grok Bot / Togishi / Hamon **[open workstream; copy not drafted]**.
- **Engine research and showcase (honest status, checked 2026-10-26 ~15:30 PT)**:
  | Work | Where | Status |
  |---|---|---|
  | Forge rebuild (hood/anvil/fire/atmosphere lanes, 4096 textures, desaturated surfaces) | `Jacob-Met/hamon-engine` PR **#2193**, branch `site/forge-hood-fidelity-20261026` (note: not `site/forge-hyperreal-20261026` as the brief said) | **Draft, unmerged.** GitHub Actions off; no CI result exists. |
  | Japanese forge re-spec (hearth, work block, shell/props, exterior, terrain/flora lanes) | `/workspace/forge_work/lane_*`, spec `FORGE_AUTHENTICITY.md`, `FORGE_PROP_LIST.md` | In progress; only hood and anvil have HANDOFF.md so far. |
  | Human togishi pipeline (face, skin_eyes, hair, hands, body_cloth lanes + integrator) | `/workspace/human_togishi/lanes/*`, branches `feat/human-<lane>-20261026` | **No PR yet.** Only `skin_eyes` has a lane commit (`f4c97dbf`); the other four are still at main `f9292702`. The integrator opens the one draft PR later. |
  | Farm renders | Renpo CPU farm (`/workspace/farm/`) + Raider GPU | Being expanded; real throughput not measured yet. |
  | Sword (Mikazuki Togishi) stills | `/workspace/blade_render/sakabato/` | Drafts; new grain/grip/saya design not rendered yet. |
- **Not featured:** Lanternwake and TowerOps (Jacob's instruction). They stay at their existing URLs.

### 3.2 Left eye → Spire of Octaves
- **[fact, site]** "A vertical world born from an unfinished sacred song." Stories free to read on spireofoctaves.com, grouped by series; begin with *Salt's End*, *What Strays* and *Seamwork*.
- Echo, the game, is work in progress and not public. The Third Pot is the Echo world's production refinement target **[fact: `/workspace/echo/notes/E-world_thirdpot_plan.md` and the atlas README]**, and the lane is paused at r13d `4b71654b` **[fact: estate todo]**.
- Look of the eye **[suggestion]**: a brass-amber lamp iris with an ink-dark ring and one cyan "pale" glint, all textures from the bible's list. No sword, no ember, no 刃文.
- Lore guardrail **[fact, SPIRE_BIBLE.md line 13]**: "Everyone lives inside. Nobody has seen weather." So the Spire approach must be an **interior scale view, with no sky.** That makes it the opposite of the Hamon dusk exterior, which helps keep the two eyes apart. (Another worker reached the same conclusion in `/workspace/site_brain/shots/spire_eye/PROGRESS.md`.)
- Spire approach shot **[suggestion]**: from a vast lamp-lit interior stratum, descend to the Apron in lower Salt Scriptoria and settle "beneath the plum awning" of the Third Pot (the atlas's own words for the place). The atlas states that its layout and props are proposals, not canon, so Jacob must approve the beat list.

### 3.3 The research lobes (all [suggestion])
| Region | Theme | Contents (from site data) |
|---|---|---|
| Frontal lobe | Questions & method (about) | Bio (CS + physics at CSULB, biology minor, BUILD Scholar toward MD/PhD), "What would change our explanation?", contact |
| Parietal lobe | Models & measurement | WORLDLAW, Kernel Garden, protein molecular dynamics (collaborative) |
| Temporal lobe | Memory | Computational memory, Threadline, Familiar Memories, RecallWeave |
| Occipital lobe | Seeing behaviour | Behavioural neurobiology (scoring mouse behaviour from video), surgical ergonomics (video tracking) |
| Cerebellum | Movement | Gait & rehabilitation, CaptureSuite |
| Brainstem | Tools | CanvasPilot, Multi-agent Fan-out Engine, workflow-checks |

Notes:
- The "trim projects to ~6 plus an in-the-lab line" decision still applies. The brainstem and some temporal items may become the single "in the lab" line instead of entries.
- Threadline, Familiar Memories, Threshold, LedgerDock, Teachback and Clearway are listed as `relatedWork` local prototypes. I could not tell from the data whether Jacob counts them as Hamon work or personal research. If they are Hamon, they move behind the Hamon eye.
- **Other research found in the estate, not on the site; candidates only, nothing verified as a public result:**
  - The estate has neuro modelling, music, shader, molecular-docking, EDA and CAD **capability skills** (`/home/box/agent-data/workflows/*`).
  - `hamon-model-research` exists; its steer is #45, a local model to match then beat DeepSeek (per memory).
  - `Jacob-Met/hamon/research-commons` has peer reviews.
  - Before any of these gets a region, Jacob should say which are research he wants public. If music or neuro modelling become regions, the natural homes would be the temporal lobe for music (auditory cortex) and a "Circuits" region in the deep/limbic area for neuro models. **[suggestion]**
- Possible region worlds later **[suggestion]**: Movement = motion-capture marker clouds walking in the dark; Models = two model curves splitting under one measurement (WORLDLAW's own story); Memory = a reading room of quoted lines; Seeing = tracked video trails. Every one must be a real engine render or real figure, never generated imagery (Jacob's standing rule).

## 4. Mobile and low-power fallback

Three tiers, picked at load time. The user can always override with "Reduce motion" and a "Lite" toggle **[to build]**.
1. **Full**: real-time WebGL brain (about 140k vertices at desktop density), tissue dive, pre-rendered destination film. Desktop and recent phones.
2. **Lite** (≤4 cores, `Save-Data`, small screens, or a WebGL context failure): a pre-rendered brain turntable (short looping video plus a still sprite set for hover glows), the same list, and destination films at 720p. The prototype already lowers mesh density and pixel ratio when `hardwareConcurrency ≤ 4`, on small screens, or with `?low`.
3. **Plain** (no JS or no WebGL): the HTML page described in §6. It is complete in its own right.

- Reduced motion (OS setting or the toggle): no idle drift, no camera flight, no tunnel, and a 0.35 s cross-fade into a **still** instead of the film. Video never autoplays, and the play button is shown.
- No motion sickness: no roll in the brain view, no FOV pulses, eased acceleration, and the tunnel is under 1.2 s with a slight roll. The roll can be disabled; a flag to remove it entirely is **[to build]**.

## 5. Pre-rendered (hamon-engine) vs real-time

| Piece | Real-time in browser | Pre-rendered by hamon-engine |
|---|---|---|
| Brain on the landing | Yes (three.js, procedural). It must stay interactive. | A turntable for the Lite tier and an OG/share still |
| Hover glow | Yes | Per-region glow stills for Lite |
| Tissue dive | Yes (cheap line and point shader) | Optional higher-quality clip per destination for Lite |
| Hamon forge approach | No | **Yes**: the hero film. Interactive real-time forge is out of scope for the web (the engine is native; the current site already ships captured native renders) |
| Spire approach | No | Yes (Echo world renders) |
| Research region rooms | HTML + figures | Optional stills |

Embedding pattern (same as the current site's `scene-handoff.js` / `lobby-journey.js` approach):
- `<video muted playsinline preload="none" poster=...>`. The first frame equals the dive's last colour so the cut is invisible. The last frame is also published as a still, and it is what reduced-motion users see. The reverse clip is the same frames reversed (exactly what the site does today).
- Formats: AV1 in MP4 plus H.264 MP4 fallback, with 16:10 and 9:16 cuts. Posters in AVIF and WebP, with the PNG master kept.
- Swap point in the prototype: `openDest()` in `prototype/main.js`, which has a comment where `<video>` replaces the placeholder `<img>`.

## 6. SEO and plain-HTML fallback

- `index.html` contains every region's text as ordinary `<section id="r-...">` blocks, written from the same data file (`build_static.mjs` → `regions.js`), plus the "Ways in" list as real `<a href="#r-...">` links. With JS on, the sections are hidden and the links become dive buttons. With JS or WebGL off, the page is a normal readable site (screenshot `shots/11_no_js.png`).
- The `<title>`, meta description, Open Graph and Twitter images and the sitemap carry over from the current build pipeline (`build.py`). Region deep links are hash routes on one page; individual pages such as `hamon.html` and the Wildside page stay as they are.
- The canvas is `aria-hidden`; the list is the accessible navigation.

## 7. Accessibility

- Keyboard: a skip link, a Tab-able list, arrows to cycle regions, Enter to dive, Escape to step out, and focus moved to "Step out" on arrival and back to the region on return.
- Screen readers: the destination panel is `aria-live="polite"`, every image has alt text, and placeholder media says it is a placeholder.
- Contrast: body text is light grey on near-black. Small grey hint text is currently below WCAG AA and must be raised **[to fix]**.
- Motion: honour `prefers-reduced-motion`, with an on-page toggle as well.
- Never rely on hover: everything is reachable from the list.

## 8. Performance budget (targets; nothing has been measured on a real phone)

| Item | Budget | Prototype today (measured on disk) |
|---|---|---|
| HTML + CSS + app JS (gz) | ≤ 30 KB | ≈ 17.5 KB (index 3.4 + css 1.7 + main 9.6 + regions 2.8 KB) |
| three.js (gz) | ≤ 180 KB | 171 KB (`three.module.min.js` r170). Tree-shaking with a bundler would roughly halve this **[estimate]** |
| First paint (list + headline) | < 1.0 s on 4G | Not measured |
| Brain interactive | < 2.5 s on a mid phone | Not measured. Geometry is generated on the main thread; it should move to a worker or a pre-baked binary mesh (about 1–2 MB uncompressed, much less with Draco/meshopt) |
| Landing GPU | 60 fps desktop, ≥ 30 fps mid phone, DPR capped 2 (1.25 in Lite) | Not measured (screenshots used software GL) |
| Destination film | ≤ 6 MB per 20 s at 1080p AV1, `preload="none"` | Not rendered yet |
| Posters | ≤ 200 KB AVIF at 1920 | Placeholder WebPs 93–112 KB at 1280 |

## 9. Prototype (what exists)

`/workspace/site_brain/prototype/` (static files; serve with `python3 -m http.server` from that folder). See ASSETS_NEEDED.md for what replaces each placeholder. Its honest state is listed in the report at the end of this task and in `prototype/README.md`.
