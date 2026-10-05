# jacobmetoyer.com

A source-linked personal site for research software, systems work, and browser-first prototypes. Pages are generated into `docs/` and use the existing GitHub Pages deployment path.

## Source and build

- [`source/content.md`](source/content.md) is the landing-page copy. [`source/content.json`](source/content.json) maps factual copy to allowed HTTPS sources.
- [`source/case-studies.json`](source/case-studies.json) contains public, repository-backed case records with boundaries and artifacts.
- [`source/bid-inbox.json`](source/bid-inbox.json) holds invented bid-package fixtures. [`source/bid-inbox.ts`](source/bid-inbox.ts) provides local filtering, sorting, details, and side-by-side comparison for `/demos/bid-inbox/`.
- [`source/demo-authoring.md`](source/demo-authoring.md) is the lane-qualified authoring and release pattern for commercial and contest demos.
- `package.json` / `tsconfig.json` pin the TypeScript build. `npm test` compiles the browser modules and runs their unit tests.
- [`source/build.py`](source/build.py) generates the homepage, demo gallery, interactive demo, legacy-path notice, 404, metadata, and build manifest. [`source/check.py`](source/check.py) verifies routes, links, CSP, script surface, local assets, and file hashes.
- [`source/site-redesign.css`](source/site-redesign.css) and [`source/bid-inbox.css`](source/bid-inbox.css) define the portfolio and demo systems. No remote fonts, scripts, analytics, or demo API are used.
- [`source/verify_deployment.py`](source/verify_deployment.py) compares a verified local build with the live HTTPS site byte-for-byte.
- `docs/` is generated output served by GitHub Pages from `main:/docs`; never edit it by hand.

Build and verify locally:

```sh
npm ci --ignore-scripts
npm test
python -m unittest discover -s source -v
python source/build.py --out docs
python source/check.py docs
```

The Bid Inbox demo contains synthetic data embedded in the static page. Search, filtering, sorting, package details, and two-record comparison run in the browser; no files are uploaded and no message, payment, selection, or submission is sent. `/sample-ui/` is retained as a small migration page linking to the new demo, not as the old utility sample.
