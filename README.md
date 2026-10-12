# jacobmetoyer.com

A small static site that puts working demos first. Each featured demo shows desktop and phone captures from its live interactive application, a concise description, a live link and public source. Screenshots document the product; they are not the demo itself.

## Source and build

- [`source/content.json`](source/content.json) holds all page copy: hero, demos, the in-progress slot, more work, contact.
- [`source/assets/demos/`](source/assets/demos) holds the WebP captures; the builder checks each declared width/height against the file.
- [`source/build.py`](source/build.py) renders the page, 404 route, metadata and build manifest, and validates every URL against an explicit HTTPS host set.
- [`source/style.css`](source/style.css) is the local visual system, with reduced-motion rules.
- [`source/check.py`](source/check.py) verifies the generated static surface: local-only images with alt text and explicit size, links/anchors, CSP, and manifest hashes.
- [`source/verify_deployment.py`](source/verify_deployment.py) compares a checked local build with the HTTPS deployment.
- `docs/` is generated output served by GitHub Pages from `main:/docs`; do not hand-edit it.
- `source/content.json` also carries `games`: a game is shown as playable only with a verified browser build served from jacobmetoyer.com; Spire of Octaves links to its own site, spireofoctaves.com.

No GitHub Actions run in this repository. `source/presence.json` is the canonical public identity and profile-target record. After editing it, run `python source/profile/generate.py`: it renders the shared site biography in `content.json`, the GitHub README in `source/profile/README.md`, and the LinkedIn About target. `--check` rejects drift without writing. Featured links are selected from verified public work; drafts are not advertised as submissions.

Profile publication is separate from generation. Snapshot every touched field, confirm LinkedIn's share-profile-updates setting is OFF, save only authorized content fields and independently read each save back. Do not automate posts, connections, messages or Experience title/employer/date changes. The historical host-side `presence-sync` comparison is not proof that LinkedIn has been saved; check the actual surface.

Build and verify locally:

```sh
python -m unittest discover -s source -v
python source/build.py --out docs
python source/check.py docs
```

The homepage has no executable scripts, analytics or third-party resources (enforced by [`source/check.py`](source/check.py)). The separately scoped Aetherline game runs same-origin JavaScript/WebAssembly with a narrow WebGPU CSP; no trackers, account, network service, audio or cross-origin runtime dependency.

## Aetherline: Relic Run

The featured game runs on Hamon Engine. Collect three diamonds to open the gate and win; W/S or arrows move, A/D turn, Space jumps, R restarts. On-screen buttons also accept pointer/touch. A WebGPU-capable browser is required. The engine repository remains private: this site publishes only eight audited runtime files and three optional verification/capture files. No engine Rust/TypeScript, source maps, debug/custom wasm sections or repository export is admitted.

Native Chrome on Apple M3 Pro passed real rendered-pixel, keyboard/pointer victory and phone-size touch-emulation acceptance. This is **not a physical-phone qualification**. Exact engine commit and runtime hashes are in `games/aetherline/build-info.json` and `evidence.json`; captures are from real interaction, not substitutes for gameplay.

Package the qualified six-file engine runtime into a **new** folder, without editing input or existing receipts:

```sh
python source/package_game.py --runtime /path/to/qualified-runtime --engine-commit EXACT_40_CHARACTER_SHA --out /path/to/new-site-runtime --receipt /path/to/new-receipt.json
```

Receive those eight audited files into `source/games/aetherline/`, add qualified evidence/captures, then rebuild `docs/`. The private engine build uses `cargo build --release --locked --lib --target wasm32-unknown-unknown -p hamon-web` and matching `wasm-bindgen --target web --out-name hamon_web`; the current qualified build pins wasm-bindgen 0.2.129. Run those steps in the **private engine checkout**, never copy that checkout here.

Real browser acceptance (optional tooling: `pip install playwright pillow`; Chromium + Xvfb/xdotool/xmessage for the Linux software/focus cohort):

```sh
python source/verify_game_browser.py --native-gpu --chrome /path/to/native/chrome --root source/games/aetherline --out /path/to/new-proof
python source/verify_game_browser.py --native-gpu --chrome /path/to/native/chrome --url https://jacobmetoyer.com/games/aetherline/ --out /path/to/new-live-proof
python source/verify_deployment.py --root docs --base https://jacobmetoyer.com --receipt /path/to/new-hash-receipt.json
```

The native check requires hardware WebGPU (no SwiftShader/llvmpipe/fallback adapter), real keyboard/pointer/touch events, gameplay state progression, victory, restart, nonblank pixels and zero runtime errors at desktop and phone-size viewports. It does not write game state or bypass CSP. The software cohort separately verifies actual X11 focus loss releases held input. Deployments are ordinary source-repository pushes to `main:/docs`; no workflow files or Actions commands. Preserve baseline and branch history; use forward reviewed reverts for rollback.
