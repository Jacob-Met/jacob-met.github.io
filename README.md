# jacobmetoyer.com

Jacob Metoyer’s portfolio: **Research, HAMON, and Spire of Octaves**. The homepage uses an original forge rendered by HAMON Engine, with direct access to academic and independent research, software, public demos, and fiction.

## Captured portfolio runtime

The portfolio has three click-driven, prerecorded native routes: Engine at the hearth (80 frames, 4 seconds), Hackathons at the anvil (60 frames, 3 seconds), and Projects at the workbench (60 frames, 3 seconds). Every route uses 20 fps authored playback and a genuine reverse sequence. Sibling transfers return through the shared entrance; Skip movement and reduced motion settle directly to the requested content.

The informative contextual pane remains available at every size; redundant direct scene hotspots remain absent. Section entry keeps the arrival image and room navigation in view; nested project anchors still open their disclosures and scroll directly to the requested work. The three checksum-pinned scripts `lobby-journey.js`, `scene-handoff.js`, and `lobby.js` own route state, decoded-image handoff and accessible history/focus behavior. A hidden second image prepares only the chosen still; the last valid still or completed video remains until that image is ready, with obsolete callbacks fenced. `detail.js` remains an unloaded compatibility URL. Public game and historical capture URLs are preserved. The Spire invitation uses the exact small public city artwork from its own site and still links directly there; it is editorial artwork, not a HAMON render or a game demonstration.

Both `lobby-manifest.json` and `branch-routes.json` declare `public-captured`: this is the user-authorized public presentation of the reviewed files, not a claim that every browser or device was tested. Normal build, checker and deployment verification use that existing publication class. `--preview` remains available for separately declared local-preview work; default validation still rejects that class. Neither the classification nor the staged source/output guard substitutes for browser receiving.

### Native forge refinement, 26 October 2026

The selected working-tools room now has a rounded, folded iron hood, rolled edges and fifteen modeled rivets. Native PBR albedo, normal and roughness/metalness/AO maps add iron surface detail, stone texture and directional wood grain. These are original procedural maps; no photographic or generated backdrop is used. The scene contains 500 objects and 41,874 triangles. The other 484 existing objects retain their geometry. The original cameras, warm hearth composition and room layout remain; a small reflected work light and the engine's screen-space occlusion/bounce controls support the material detail.

The captures use HAMON's native Metal renderer on an Apple M3 Pro at engine revision `fb83411b6d631955d1356127be482a15359667e4`, with 4096-pixel sun shadows and 1024-pixel point shadows. The 16-, 32- and 64-sample comparison selected 32 samples for every output frame. This is jittered, reprojected, clipped display-space TAA, not unbiased HDR accumulation or path tracing. Scene time and camera are frozen during convergence, and history resets before every output frame.

All 200 original camera poses were rendered at native 1280×800. The six forward/reverse clips contain 400 encoded frames; every decoded frame was compared in order with its native source. All routes share exactly identical entrance pixels. Each destination still is copied from its route's final native frame, and each reverse clip uses the same frames in reverse order. The entrance WebP is lossless: 355,478 bytes versus the 577,039-byte PNG, with identical decoded RGBA pixels in Pillow and FFmpeg. All previous public capture URLs and bytes remain available.

The homepage continues to deliver still images and prerecorded journeys. Its contextual side pane, short descriptions, Spire artwork, Wildside feature, Captionverse/Engine figures, TasteTable, intent preloading and routing scripts are preserved. Redundant scene hotspots remain absent. The separate `docs/wildside` application is unchanged. Only captured media and their strict inventory/dimension/checksum policies enter the public repository; private scene data and capture source stay private.

Local Chrome receiving covers actual 1280×800 video playback and destination handoffs on all three routes at 1440-, 390- and 320-pixel viewport widths, with no horizontal overflow or page errors. Keyboard entry, Skip, reverse return, history, the Captionverse disclosure and reduced motion also passed. Physical phones and Safari are not qualified by those checks. Native rendering speed is not authored playback FPS.

## Responsive delivery images

`source/responsive-images.json` pins AVIF/WebP derivatives (in `assets/derived/`) of images that were already published: the Wildside hero and card, the engine rendering study, the Captionverse captures, and a crop of the Lanternwake game view. Pages wrap the original `<img>` in a `<picture>` whose `<source>` sets must match the manifest exactly; the originals stay at their URLs as fallbacks. `responsive_images.py` validates hashes and admits the sources; `python source/make_responsive.py` (Pillow with AVIF) regenerates them. No forge media is derived here.

Phone layouts were checked in headless Chrome at 390×844 and 320 px (no horizontal overflow; room map on one row; footer on two rows). Physical-phone/Safari receiving is still separate.

## HAMON, Wildside and share images

`source/hamon_page.py` renders `hamon.html` (what HAMON is, the engine, Wildside as flagship, and early private instruments named without links). Its `HAMON_LEGAL_NAME` constant is `None` until the company's legal name exists; setting it adds the name to the footer. The HAMON wordmark is plain type plus a CSS line, not artwork. `wildside_page.py` owns the Wildside page and its card; its share image is `assets/wildside/wildside-thumbnail.jpg`. Each page declares its own Open Graph/Twitter image in `build.py`; `python source/make_images.py --frame <wildside frame>` regenerates the identity and HAMON share cards.

## Runtime and retained captures

The forge is a **captured native engine render**, not a live browser engine. The three routes use prerecorded native frames; authored playback rate is not rendering performance. A separate native rendering-style image illustrates another visual treatment. No generated photographic backdrop is used.

Only the three checksum-pinned lobby scripts described above execute on the homepage. All content and public links remain in the HTML without JavaScript. There are no analytics, external fonts, application API requests, inline executable code, or experimental engine WASM on the homepage. The older 60-frame forge recording and unloaded `detail.js` remain at their existing public URLs for compatibility, not as the current homepage runtime.

The existing **Lanternwake** route remains a separately scoped, unchanged WebGPU game snapshot. It is not a distribution of the current private engine. Its own evidence distinguishes desktop and phone-size testing from physical-phone/Safari qualification. The homepage does not promise those untested platforms work.

## Source and build

- `source/portfolio.py`: pure HTML renderer; `source/experience.css`: responsive visual system.
- `source/experience-content.json`: reviewed public display copy; `source/portfolio.json`: identity and approved proof-image inventory.
- `source/content.json`: preserved public demo/game/project records and generated biography; `source/presence.json`: canonical public identity/profile-target record.
- `source/capture-manifest.json`: exact media hashes, dimensions, and recording scope.
- `source/assets/scene/`: checksum-pinned native route clips, matching stills and retained public captures. `source/assets/demos/`: original public desktop/phone captures.
- `source/site_policy.py`, `capture_policy.py`, `experience_policy.py`, and `source_policy.py`: explicit script/media/content/source boundaries. Adding a file or changing a script requires deliberate inventory/custody review.
- `source/build.py`: validates inputs and generates `docs/`. `source/check.py`: checks output inventory, hashes, CSP, resource URLs, anchors, metadata, and separately audited game bundles.
- `source/verify_deployment.py`: read-only exact-byte and MIME comparison against HTTPS deployment.

`docs/` is generated. GitHub Pages build/deployment logs confirm `main:/docs` serves `jacobmetoyer.com`; this candidate does not alter hosting or workflow settings. Never hand-edit generated docs. Existing public game/demo/capture URLs are preserved. Private scene inputs, engine source, experimental browser modules, and audit ledgers do not belong in this public repository.

Generate and check the public-captured projection through the normal default lane:

```sh
python source/build.py --out docs
python source/check.py docs
python -m unittest discover -s source -v
python source/profile/generate.py --check
```

For a separately declared `local-preview` projection, use `--preview` with build/check. Its normal production validation must still fail; do not change flags merely to manufacture a test result.

The builder/checker use the Python standard library. The UI behavior tests also require Node.js. Optional metadata-art regeneration uses Pillow and a local sans-serif font (`python source/make_images.py`). Captured project media is not generated by that script.

Enable the staged-tree drift guard once per clone:

```sh
git config core.hooksPath .githooks
```

The hook rebuilds the **staged** source and rejects a commit whose staged `docs/` differs. It seeds the separately maintained staged `docs/wildside` subtree into that comparison; the portfolio builder preserves that app rather than generating it. It reads route visibility from the materialized Git index, uses `--preview` only for an explicitly local-preview review projection, and otherwise retains the default production build. Working-tree-only edits cannot select the lane. Commit source and generated output together. A passing hook proves reproducibility, not browser acceptance or permission to merge/deploy. This repository does not define workflow files; GitHub Pages exposes platform-managed build/deployment runs. The local verifier is not a hosting interlock: branch-served Pages can serve committed docs without invoking it. This candidate leaves hosting settings unchanged; merging or deploying is a separate explicit action, and eligibility does not erase the receiving limits listed above.

## Profile and game boundaries

`python source/profile/generate.py` renders the site biography and `source/profile/README.md`; `--check` rejects drift without writing. Generation does not authorize publishing changes to other profiles. LinkedIn About remains separately owned and unmanaged.

The game packaging/audit/browser-verification tools remain available for a separately qualified future game update. Such an update requires its own runtime, evidence and private-source-boundary review; this portfolio release does not rebuild or replace the game.

After an authorized deployment, compare the exact checked artifact:

```sh
python source/verify_deployment.py --root docs --base https://jacobmetoyer.com --receipt /path/to/new-receipt.json
```

HTTP byte/MIME verification is not a claim of live GPU interaction or visual acceptance. Preserve prior evidence; use a new receipt path and forward reviewed commits for rollback.
