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

No GitHub Actions run in this repository. A host-side scheduled job (`presence-sync`) compares the live site, GitHub profile and pins with this source and reports or applies drift.

Build and verify locally:

```sh
python -m unittest discover -s source -v
python source/build.py --out docs
python source/check.py docs
```

The page has no executable scripts, analytics or third-party resources (enforced by [`source/check.py`](source/check.py)).
