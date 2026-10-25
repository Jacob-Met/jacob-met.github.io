# jacobmetoyer.com

Jacob Metoyer’s portfolio: **Research, HAMON, and Spire of Octaves**. The homepage uses an original forge rendered by HAMON Engine, with direct access to academic and independent research, software, public demos, and fiction.

## Local lobby iteration (not deployed)

This branch has three click-driven, prerecorded native routes: Engine at the hearth (80 frames, 4 seconds), Hackathons at the anvil (60 frames, 3 seconds), and Projects at the workbench (60 frames, 3 seconds). Every route uses 20 fps authored playback and a genuine reverse sequence. Sibling transfers return through the shared entrance; Skip movement and reduced motion settle directly to the requested content.

Wide-screen scene landmarks are ordinary links attached to the actual hearth, anvil and workbench; they appear only after the entrance image is actually decoded, not merely when the URL says “forge”; the primary menu remains available at every size. Section entry keeps the arrival image and room navigation in view; nested project anchors still open their disclosures and scroll directly to the requested work. The three checksum-pinned scripts `lobby-journey.js`, `scene-handoff.js`, and `lobby.js` own route state, decoded-image handoff and accessible history/focus behavior. A hidden second image prepares only the chosen still; the last valid still or completed video remains until that image is ready, with obsolete callbacks fenced. `detail.js` remains an unloaded compatibility URL. Public game and historical capture URLs are preserved. The Spire invitation uses the exact small public city artwork from its own site and still links directly there; it is editorial artwork, not a HAMON render or a game demonstration.

Both `lobby-manifest.json` and `branch-routes.json` are explicitly `local-preview`. Use `python source/build.py --preview --out /tmp/portfolio-lobby-preview` and `python source/check.py --preview /tmp/portfolio-lobby-preview` for local source receiving. The default production build/check and deployment verifier reject this projection. The staged-tree hook can nevertheless validate an exact local-preview source/docs pair for ordinary draft review; it does not grant release eligibility. Cloud browser receiving covered prior draft routes, keyboard/history behavior, and revised project copy at desktop and 616-pixel layouts. The new Engine camera composition is a separate visual change awaiting its own browser receiving; 390/320-pixel device emulation was not received. Any release decision must preserve those scope distinctions. Native frame approval and controlled-DOM tests are not browser qualification.

The stage uses genuine 1280×800 native entrance and branch stills, plus a genuine 960×600 Engine arrival at its new route endpoint. The Engine approach eases toward a wider hearth composition that remains visible beside the reading panel; its reverse clip follows the same frames in reverse order. These stills are separately hash-pinned from the coherent 640×400 route clips; none is upscaled. The earlier 1280-pixel Engine composition attempt failed without a retained diagnostic cause and is not represented as successful. All off-screen editorial images are lazy-loaded. The Projects room links directly to RecallWeave’s existing public feedback lab, with its exact preset named; the wider toolkit remains available. The Research room pairs an original, explicitly conceptual brain illustration with a normalized spring/gravity model comparison. Neither is presented as measured data or an interface screenshot.

Computed project figures are separate, labeled numerical illustrations—not UI screenshots or a claim that refreshed external demos are deployed. `figure_policy.py` admits only the three exact local numerical illustrations and their mobile arrangements; `lobby_policy.py` checks both clips, matching endpoint/proof dimensions and hashes. No engine source, raw mesh, GPU module or private audit ledger enters this projection. Room maps are ordinary semantic links; keyboard focus returns to the originating entrance link when it is visible, otherwise to the site identity, and “Back through the forge” always returns to the entrance rather than reopening the last room.

## What the current public page runs

The forge is a **captured native engine render**, not a live browser walkthrough. Its optional, controls-only recording contains 60 rendered frames played over 3 seconds. Playback rate is not rendering performance. The separate engine proof image is also actual captured output. No generated photographic backdrop is used.

The only homepage executable is the checksum-pinned local `detail.js`: progressive Engine navigation, history/focus handling, and keyboard-operable system tabs. All content and public links remain in the HTML without JavaScript. There are no analytics, external fonts, runtime network calls, inline executable code, or experimental engine WASM on the homepage.

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

`docs/` is generated; the repository’s documented Pages layout is `main:/docs`. Live Pages settings were not independently retrievable during this review. Never hand-edit generated docs. Existing public game/demo/capture URLs are preserved. Private scene inputs, engine source, experimental browser modules, and audit ledgers do not belong in this public repository.

For this draft review, generate and check the honestly labelled preview:

```sh
python source/build.py --preview --out docs
python source/check.py --preview docs
```

The production commands remain separate and intentionally reject `local-preview`:

```sh
python -m unittest discover -s source -v
python source/profile/generate.py --check
python source/build.py --out docs
python source/check.py docs
```

The builder/checker use the Python standard library. The UI behavior tests also require Node.js. Optional metadata-art regeneration uses Pillow and a local sans-serif font (`python source/make_images.py`). Captured project media is not generated by that script.

Enable the staged-tree drift guard once per clone:

```sh
git config core.hooksPath .githooks
```

The hook rebuilds the **staged** source and rejects a commit whose staged `docs/` differs. It reads route visibility from the materialized Git index, uses `--preview` only for an explicitly local-preview review projection, and otherwise retains the default production build. Working-tree-only edits cannot select the lane. Commit source and generated output together. A passing hook proves reproducibility, not browser acceptance or permission to merge/deploy. This repository does not define workflow files; GitHub Pages exposes platform-managed build/deployment runs. The local verifier is not a hosting interlock: branch-served Pages can serve committed docs without invoking it. This draft leaves hosting settings unchanged; merging or deploying is a separate explicit decision.

## Profile and game boundaries

`python source/profile/generate.py` renders the site biography and `source/profile/README.md`; `--check` rejects drift without writing. Generation does not authorize publishing changes to other profiles. LinkedIn About remains separately owned and unmanaged.

The game packaging/audit/browser-verification tools remain available for a separately qualified future game update. Such an update requires its own runtime, evidence and private-source-boundary review; this portfolio release does not rebuild or replace the game.

After an authorized deployment, compare the exact checked artifact:

```sh
python source/verify_deployment.py --root docs --base https://jacobmetoyer.com --receipt /path/to/new-receipt.json
```

HTTP byte/MIME verification is not a claim of live GPU interaction or visual acceptance. Preserve prior evidence; use a new receipt path and forward reviewed commits for rollback.
