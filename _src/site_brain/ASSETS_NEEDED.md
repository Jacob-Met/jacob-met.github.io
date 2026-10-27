# ASSETS_NEEDED: what hamon-engine (and Echo) must produce for the brain site

First pass, 2026-10-26. Rules that apply to every item:
- Real engine renders or real figures only. No generated imagery (Jacob's standing rule; the current site README also says so).
- Hamon-side stills pass the strict v1 halo gate (`/workspace/blade_render/halo_check_v1.py`, never edited), clip 0, min ≥ 8/255.
- One adapter type per shot (CPU farm or Raider GPU, not mixed).
- Masters are 16-bit PNG (or EXR where a grade is still to come). Web derivatives are AVIF + WebP stills and AV1 MP4 + H.264 MP4 video.
- Aspect ratios: **16:10** for desktop, matching the current site's 1920×1200 / 2560×1600 forge captures, and **9:16** for phones (a separate camera framing, not a crop, where composition matters).
- Every clip ships a forward version, a reverse version (the same frames reversed) and a first/last-frame still, as the current `lobby-journey.js` flow expects.

## A. Brain (landing)

| # | Asset | Spec | Why | Status |
|---|---|---|---|---|
| A1 | Brain mesh, baked | glTF/GLB with meshopt or Draco, ≤ 1.5 MB, region ID as a vertex attribute, cavity/AO baked to a vertex attribute | Removes main-thread procedural generation on phones | **Missing.** The prototype generates it in JS (`hemisphere()` in `main.js`) |
| A2 | Brain hero still | 2560×1600 PNG master, 1920/1280 AVIF+WebP; portrait 1440×2560 | Poster before WebGL is ready; Lite tier; OG/share card (1200×630 crop) | Missing; needs a brain model in hamon-engine (none exists; port A1) |
| A3 | Brain turntable loop | 360° in 12 s, 24 fps, 1920×1200 and 1080×1920, AV1+H.264, ≤ 4 MB | Lite-tier landing | Missing |
| A4 | Region glow passes | 8 stills (6 lobes + 2 eyes) at 1920×1200 matching A2's camera, or one 8-channel mask EXR | Lite-tier hover without WebGL | Missing |
| A5 | Eye close-ups | 2 × 2560×1600 (Hamon eye, Spire eye), engine-rendered with real cornea refraction | Real eyes are the weakest part of the prototype; they also make the dive's first half believable | Missing. The **human_togishi skin_eyes lane** (`feat/human-skin_eyes-20261026`, commit `f4c97dbf`, unmerged, no PR) is the natural source of the eye shader |

## B. Dive transitions

| # | Asset | Spec | Status |
|---|---|---|---|
| B1 | Synapse-scale tissue plates | 3 s at 24 fps (72 frames), 1920×1200 + 1080×1920, per destination tint: Hamon (indigo → steel), Spire (cyan pale → brass lamp), 6 lobe tints | Missing. The prototype does a real-time line/point version; pre-rendered clips are only needed for the Lite tier or if Jacob wants volumetric tissue |
| B2 | Surface-to-tissue bridge | 1 s per region: camera pushes into the cortex surface with real displacement and wet speculars, so the cut to B1 is invisible | Missing |
| B3 | Eye entry | 1.5 s per eye: through the cornea and pupil into the tissue | Missing; depends on A5 |

## C. Hamon eye → forge approach (pre-rendered hero film)

Camera path and exposure behaviour: `/workspace/forge_work/FORGE_AUTHENTICITY.md` §14.4 (E0 establishing → E1 path → E2 threshold → I1 inside → I2 togishi).

| # | Asset | Spec | Depends on | Status |
|---|---|---|---|---|
| C1 | Forge approach film | about 20–30 s, 24 fps, 1920×1200 (16:10) master; 1080×1920 portrait cut; AV1 ≤ 6 MB + H.264 fallback; forward + reverse | Exterior and terrain/flora lanes, hearth, work block, building shell/props, fire, atmosphere, integrator | **Not rendered.** Lanes are in progress in `/workspace/forge_work/lane_*`; only hood and anvil have handed off |
| C2 | Beat stills | 5 × 2560×1600 (E0, E1, E2 threshold, I1 hearth, I2 togishi) + AVIF/WebP 1920/1280 | Same as C1 | The only forge stills that exist are the **current Western-smithy** ones (published `forge-hifi-*`; `/workspace/forge_work/v1/`), which the Japanese spec replaces |
| C3 | Togishi idle loop | 6–10 s seamless idle, 1920×1200, at the I2 framing; a 0.6 m step-in close-up still | Human togishi pipeline (face, skin_eyes, hair, hands, body_cloth lanes + integrator) | **Not started as footage.** Lanes have no handoffs yet; no PR |
| C4 | Threshold test frame | 1 still at the door (the hardest halo case) | Exterior + shell lanes | Missing; the spec says to gate it first |
| C5 | Sword insert (optional) | 2560×1600 Mikazuki Togishi hero still for the Hamon panel | Hero sword worker | Drafts only (`/workspace/blade_render/sakabato/`); the new design is not rendered yet |
| C6 | Engine research showcase stills | 1920×1200 before/after pairs + 8× crops: forge PR #2193 lanes (hood/anvil/fire/atmosphere), Japanese forge lanes, human togishi lookdev sheets, farm throughput chart | PR **#2193 (draft, unmerged)**; human_togishi branches (unmerged, no PR); `/workspace/farm/` | Partial. PR #2193 infra stills exist (`/workspace/forge_work/v1/`; the entrance frame fails the 8/255 floor). Everything must be labelled "draft, unmerged" on the site until merged |

Render budget note: 4096-texture forge frames took about 30–35 min and about 6 GB per frame on one farm node (measured earlier today). Combined renders were planned at 2048 textures. At 24 fps, a 25 s film is 600 frames. Plan for the expanded Renpo farm and measure real throughput first.

## D. Spire eye → Spire approach (separate from Hamon in every way)

Lore guardrail: "Everyone lives inside. Nobody has seen weather." (`SPIRE_BIBLE.md` line 13). So the approach is an interior scale view with no sky.

**What exists:**

| Source | What | Usable on the site? |
|---|---|---|
| `/workspace/echo/refs/spire_concept_archive/01_Concept_Art/Echo_Visual_Walkthrough/images/` | 22 images of 12 Apron places (Third Pot ×3, Cistern Court ×3, Venn's Bench ×3, Cut Page ×3, Press Court ×2, and others) | **Reference only.** The archive itself says they are AI-generated proposals, not canon or a consistent 3D model, and Jacob's rule bars generated imagery |
| `/workspace/echo/refs/spire_concept_archive/01_Concept_Art/` (Echo_Visual_Direction, Lower_Salt_Scriptoria_Concepts and others) | Concept boards; endorsed direction "A_Timber_Lane" + "C_Drying_Works" | Reference only (same reason) |
| `/workspace/echo/renders/E-world/r11–r13` | hamon-engine renders of the Third Pot, r13a–r13d (r13d = RTX 4070, 1920×1280, halo 0) | **Yes, as a placeholder or study** (it is an engine render). It is not approved key art, and the lane is paused at r13d |
| Blender studies (`BLENDER_MODEL_LOCATIONS.txt`: Boiler Heart, Lower Scriptoria Cistern, Bindery, Scriptoria Closeup/Construction/Finish, Nacre Relay) | Editable models on Jacob's Mac (over 2 GB) | Not engine renders; could be imported as reference geometry only if Jacob agrees |
| `forge_work/site/docs/assets/editorial/spire-world.webp` | Small city artwork from Spire's own site, already published | Yes, it is already used (editorial, not a HAMON render) |
| `/workspace/site_brain/shots/spire_eye/` | Another worker's Spire-eye render effort (worktree `/workspace/echo/wt-spire-eye`, branch `feat/spire-eye-20261026`) | In progress, not mine; check its output |
| hamon-engine#2149 / draft PR #2167 (Echo Day 1 + Salt's End, other estate workers) | Playable Echo work | Overlaps the paused Echo lane; Jacob has to decide how they relate (per memory) |

**What must be made:**

| # | Asset | Spec | Status |
|---|---|---|---|
| D1 | Spire approach film | about 15–25 s, 24 fps, 1920×1200 + 1080×1920. **[suggestion]** A vast lamp-lit interior stratum, descending into the Apron in lower Salt Scriptoria and settling under the plum awning of the Third Pot. Beat list needs Jacob's approval | Missing |
| D2 | Spire beat stills | 3–4 × 2560×1600 + derivatives | Missing (r13d is the only engine still and is a placeholder) |
| D3 | Spire eye close-up | Part of A5 | Missing |

## E. Research regions

| # | Asset | Spec | Exists? |
|---|---|---|---|
| E1 | Frontal (about) | Portrait-free typographic page; optional one still | Site copy exists |
| E2 | Parietal (models) | WORLDLAW figure | `assets/figures/worldlaw-computed(.svg, -mobile.svg)` exist |
| E3 | Temporal (memory) | RecallWeave figure and screenshots | `assets/figures/recallweave-computed*.svg`, `assets/demos/recallweave-*.webp` exist |
| E4 | Occipital (seeing behaviour) | A real research figure, only if the lab allows publication | Missing; collaborative work, needs permission |
| E5 | Cerebellum (movement) | CaptureSuite QC report figure (synthetic data) | Not on the site yet; the repo has the offline QC demo |
| E6 | Brainstem (tools) | None needed (text) | — |
| E7 | Optional region "worlds" | One engine still per region, 1920×1200 (ideas in CONCEPT.md §3.3) | Missing; optional |

## F. Prototype placeholders → final

| Placeholder in `prototype/` | Replace with |
|---|---|
| `media/forge-hifi-entrance-1280.webp` (current Western-smithy still) | C1 film + C2 stills |
| `media/forge-hifi-engine-arrival-1280.webp` (copied, not used yet) | C2 |
| `media/spire-thirdpot-r13d-1280.webp` (Echo r13d test render) | D1 + D2 |
| Procedural brain, tissue and eyes | A1, A5, B1–B3 (real-time stays for Full tier) |
| Gradient "region rooms" | E1–E7 |
