# jacobmetoyer.com

A small static site that puts the work up front: [workflow-checks](https://github.com/Jacob-Met/workflow-checks), its [synthetic sample outputs](https://jacobmetoyer.com/workflow-checks/), and supporting research software. The site links each factual line to a project README, commit, or demo artifact.

The three workflow checks use synthetic input data; the repositories make no real-client savings or accuracy claims ([scope and limits](https://github.com/Jacob-Met/workflow-checks/blob/main/README.md)).

## Source and build

- [`source/content.md`](source/content.md) is the exact landing-page copy.
- [`source/content.json`](source/content.json) holds the public identity, update date, and claim-to-source map. The builder checks each copy URL against that map and an explicit HTTPS host set.
- [`source/build.py`](source/build.py) renders the page, 404 route, metadata, and build manifest.
- [`source/style.css`](source/style.css) contains the local visual system and reduced-motion rules.
- [`source/check.py`](source/check.py) verifies the generated static surface, local links/assets, CSP, and manifest hashes.
- [`source/verify_deployment.py`](source/verify_deployment.py) compares a checked local build with the HTTPS deployment.
- `docs/` is generated output served by GitHub Pages from `main:/docs`; do not hand-edit it.

Build and verify locally:

```sh
python -m unittest discover -s source -v
python source/build.py --out docs
python source/check.py docs
```

The site uses a local stylesheet and generated local share-card/icon files; the page has no executable scripts, analytics, or third-party page resources (enforced by [`source/check.py`](source/check.py)).
