# jacobmetoyer.com

Jacob Metoyer’s portfolio: **Research, HAMON, and Spire of Octaves**. The homepage uses an original forge rendered by HAMON Engine, with direct access to academic and independent research, software, public demos, and fiction.

## Captured portfolio runtime

The portfolio has three click-driven, prerecorded native routes: Engine at the hearth (80 frames, 4 seconds), Hackathons at the anvil (60 frames, 3 seconds), and Projects at the workbench (60 frames, 3 seconds). Every route uses 20 fps authored playback and a genuine reverse sequence. Sibling transfers return through the shared entrance; Skip movement and reduced motion settle directly to the requested content.

Wide-screen scene landmarks are ordinary links attached to the actual hearth, anvil and workbench; they appear only after the entrance image is actually decoded, not merely when the URL says “forge”; the primary menu remains available at every size. Section entry keeps the arrival image and room navigation in view; nested project anchors still open their disclosures and scroll directly to the requested work. The three checksum-pinned scripts `lobby-journey.js`, `scene-handoff.js`, and `lobby.js` own route state, decoded-image handoff and accessible history/focus behavior. A hidden second image prepares only the chosen still; the last valid still or completed video remains until that image is ready, with obsolete callbacks fenced. `detail.js` remains an unloaded compatibility URL. Public game and historical capture URLs are preserved. The Spire invitation uses the exact small public city artwork from its own site and still links directly there; it is editorial artwork, not a HAMON render or a game demonstration.

Both `lobby-manifest.json` and `branch-routes.json` declare `public-captured`: this is the user-authorized public presentation of the reviewed files, not a claim that every browser or device was tested. Normal build, checker and deployment verification use that existing publication class. `--preview` remains available for separately declared local-preview work; default validation still rejects that class. Neither the classification nor the staged source/output guard substitutes for browser receiving.

### Received baseline and this prerecorded working-tool refinement

This candidate derives from the released `c584bbe2` warm forge. It retains that scene’s lighting, material definitions, room geometry, route cameras and authored playback, and refines only 18 existing working-tool objects: rounder tapered tongs, a fine-cut file with an oval grip, and a shaped forging hammer with a rounded handle. The other 467 scene objects and root/material definitions are unchanged. All three recorded routes and four presentation stills use the same frozen refined scene. The 200 native route frames were received through 50 bounded jobs, with every encoded forward/reverse frame checked in order; receipt hashes identify assemblies of original per-job receipts, not fabricated single capture jobs. The result is a bounded stylized form improvement, not a realism or real-time performance claim.

The preceding warm-scene release passed exact production receiving of all 89 expected HTTPS bodies and the verifier’s MIME-policy checks after Pages run `40209932736` deployed `c584bbe2`. Earlier cloud-browser receiving covered the shared routing, recorded movement, Skip/Return, keyboard/history, nested links and WORLDLAW controls at desktop and 616-pixel layouts. Revised project disclosures and spaced titles were received on `a9308ace` at 616 pixels after local-file verification; the complete 67-file HTTP sweep belonged to the preceding `462469` projection. Those are separate evidence scopes. This tool refinement has native image, coherent media, build and source receiving, not a new browser appearance or interaction pass. Narrow 390/320-pixel layouts and physical-phone/Safari receiving also remain incomplete.

The homepage remains prerendered PNG/WebP stills plus prerecorded MP4 transitions, not a live browser scene renderer. The separate Lanternwake WebGPU game is unchanged. The unrelated Captionverse figure and follow-through illustration remain in the separate draft, not this release candidate. No UI, runtime, hierarchy or display-copy changes are introduced.

The entrance and branch stills are genuine 1280×800 native captures; the Engine arrival is a genuine 960×600 capture. All match the corresponding 640×400 route endpoints, without a mismatched-model still/clip handoff or upscaled image labeled native. Distinct `forge-tools-*` scene URLs prevent old cached media from being selected. Every earlier warm-scene and compatibility media URL and byte remains available.

The new entrance is delivered as a checksum-pinned lossless WebP: 554,878 bytes instead of its 921,017-byte native PNG, with exactly identical opaque 1280×800 decoded RGBA pixels in Pillow and FFmpeg. Neither carries color-profile or orientation metadata. New and previous native PNG/WebP URLs remain intact. The derivative reduces asset bytes by 39.75%; no browser-speed improvement is inferred. Off-screen editorial images, existing links, conceptual Research artwork and labeled computed model figures are unchanged.

Computed project figures are separate, labeled numerical illustrations—not UI screenshots or a claim that refreshed external demos are deployed. `figure_policy.py` admits only the three exact local numerical illustrations and their mobile arrangements; `lobby_policy.py` checks both clips, matching endpoint/proof dimensions and hashes. No engine source, raw mesh, GPU module or private audit ledger enters this projection. Room maps are ordinary semantic links; keyboard focus returns to the originating entrance link when it is visible, otherwise to the site identity, and “Back through the forge” always returns to the entrance rather than reopening the last room.

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

The hook rebuilds the **staged** source and rejects a commit whose staged `docs/` differs. It reads route visibility from the materialized Git index, uses `--preview` only for an explicitly local-preview review projection, and otherwise retains the default production build. Working-tree-only edits cannot select the lane. Commit source and generated output together. A passing hook proves reproducibility, not browser acceptance or permission to merge/deploy. This repository does not define workflow files; GitHub Pages exposes platform-managed build/deployment runs. The local verifier is not a hosting interlock: branch-served Pages can serve committed docs without invoking it. This candidate leaves hosting settings unchanged; merging or deploying is a separate explicit action, and eligibility does not erase the receiving limits listed above.

## Profile and game boundaries

`python source/profile/generate.py` renders the site biography and `source/profile/README.md`; `--check` rejects drift without writing. Generation does not authorize publishing changes to other profiles. LinkedIn About remains separately owned and unmanaged.

The game packaging/audit/browser-verification tools remain available for a separately qualified future game update. Such an update requires its own runtime, evidence and private-source-boundary review; this portfolio release does not rebuild or replace the game.

After an authorized deployment, compare the exact checked artifact:

```sh
python source/verify_deployment.py --root docs --base https://jacobmetoyer.com --receipt /path/to/new-receipt.json
```

HTTP byte/MIME verification is not a claim of live GPU interaction or visual acceptance. Preserve prior evidence; use a new receipt path and forward reviewed commits for rollback.
