# jacobmetoyer.com

A small static site that puts the work up front: [workflow-checks](https://github.com/Jacob-Met/workflow-checks), its [synthetic sample outputs](https://jacobmetoyer.com/workflow-checks/), and supporting research software. The site links each factual line to a project README, commit, or demo artifact.

The three workflow checks use synthetic input data; the repositories make no real-client savings or accuracy claims ([scope and limits](https://github.com/Jacob-Met/workflow-checks/blob/main/README.md)).

## Source and build

- [`source/content.md`](source/content.md) is the exact landing-page copy.
- [`source/content.json`](source/content.json) holds the public identity, update date, and claim-to-source map. The builder checks each copy URL against that map and an explicit HTTPS host set.
- [`source/case-studies.json`](source/case-studies.json) holds explicitly public, repository-backed case records with the question, approach, disclosure, language choice, and scope limits; the builder renders them through one reusable card template.
- [`source/sample-ui.json`](source/sample-ui.json) holds the dated synthetic utility snapshot; [`source/sample-ui.ts`](source/sample-ui.ts) provides local search, filtering, sorting, and record details for `/sample-ui/`.
- `package.json` / `tsconfig.json` pin the TypeScript build tool; `npm test` compiles the local module and runs its pure filter/sort tests.
- [`source/build.py`](source/build.py) renders the homepage, interactive sample, 404 route, metadata, and build manifest.
- [`source/style.css`](source/style.css) contains the shared visual system; [`source/sample-ui.css`](source/sample-ui.css) styles only the sample route. Both honor reduced-motion settings.
- [`source/check.py`](source/check.py) verifies the generated static surface, local links/assets, CSP, and manifest hashes.
- [`source/verify_deployment.py`](source/verify_deployment.py) compares a checked local build with the HTTPS deployment.
- `docs/` is generated output served by GitHub Pages from `main:/docs`; do not hand-edit it.

Build and verify locally:

```sh
npm ci --ignore-scripts
npm test
python -m unittest discover -s source -v
python source/build.py --out docs
python source/check.py docs
```

The homepage has no executable script. `/sample-ui/` loads one local compiled TypeScript module; it filters static synthetic rows in-browser and makes no network calls, persistence writes, payments, or submissions. There are no analytics, remote fonts, or third-party page resources; [`source/check.py`](source/check.py) rejects unexpected scripts and network-capable APIs.
