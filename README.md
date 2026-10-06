# jacobmetoyer.com

A small static site that puts working demos first. Each featured demo shows captured output from the running thing (desktop and phone screenshots, or real terminal output), a one-line description, a live link and its public repository.

## Source and build

- [`source/content.json`](source/content.json) holds all page copy: hero, demos, the in-progress slot, more work, contact.
- [`source/assets/demos/`](source/assets/demos) holds the WebP captures; the builder checks each declared width/height against the file.
- [`source/build.py`](source/build.py) renders the page, 404 route, metadata and build manifest, and validates every URL against an explicit HTTPS host set.
- [`source/style.css`](source/style.css) is the local visual system, with reduced-motion rules.
- [`source/check.py`](source/check.py) verifies the generated static surface: local-only images with alt text and explicit size, links/anchors, CSP, and manifest hashes.
- [`source/verify_deployment.py`](source/verify_deployment.py) compares a checked local build with the HTTPS deployment.
- `docs/` is generated output served by GitHub Pages from `main:/docs`; do not hand-edit it.

Build and verify locally:

```sh
python -m unittest discover -s source -v
python source/build.py --out docs
python source/check.py docs
```

The page has no executable scripts, analytics or third-party resources (enforced by [`source/check.py`](source/check.py)).
