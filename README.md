# Jacob Metoyer — a life in works

A small, self-contained public website connecting research, fiction as **M. Schauz**, software, cosplay as **tornadocos**, and the interests behind the work.

## Structure

- `source/content.json`: explicitly public identity links and work records.
- `source/build.py`: static page generator and reviewed editorial copy; Python 3.11+, standard library only.
- `source/style.css`, `source/site.js`: presentation and progressive filtering, with no external scripts or tracking.
- `source/assets/`: selected, resized publication artwork and the site monogram.
- `source/check.py`, `source/test_site.py`: output, link, content-schema and regression checks.
- `docs/`: the built deployment tree. GitHub Pages serves only this directory.

## Rebuild and check

```sh
python -m unittest discover -s source -v
python source/build.py --out docs
python source/check.py docs
```

Preview with `python -m http.server 8000 --directory docs` and open the local server in a browser. Shut it down when finished. No application server is needed for the public deployment.

The CI workflow rebuilds from source, checks the whole deployment tree, compares it to the committed site, and packages the verified public files as an artifact. This validates the site's declared build and presentation scope—not the scientific or artistic quality of the projects described.

## Add or revise work

Update the public record, then the relevant page. Each entry needs its actual contribution, current status, evidence, limitations, approved public links, and an explicit publication flag. The generator rejects private entries, unknown fields, unsafe URLs, duplicate IDs and unexpected output files instead of silently publishing them. New fields of interest can receive new categories and pages; the current categories are an editorial organization, not a limit on future work.

Do not put confidential drafts, raw research data, personal exports, authentication information or unrestricted personal inventories anywhere in this repository. A public flag does not establish third-party rights; perform that review before adding content. Check generated pages and media before pushing, because main is a public publication surface.

Keep dates honest. `now.html` is a dated snapshot, not a live activity feed. Manuscript counts describe working source files, not released chapters. Public code does not imply clinical validation.

## Hosting and portability

The site is static and deploys from `main:/docs` on GitHub Pages. No custom domain, payment system or paid backend is required. The same `docs` directory can be used for another static host after its account, permissions, costs and domain settings are separately verified. Nothing in the generator changes hosting or account settings.

## Credits

See the site's `credits.html` and `process.html`. The city artwork and covers come from the existing M. Schauz author-site pack. They are concept/publication artwork, not game screenshots or photographs. Spire uses AI-assisted creative processes. This repository does not make a blanket license grant over the fiction, artwork, collaborators' work or third-party intellectual property.

## Release checks

`source/check.py` also inspects the declared static HTML/CSS/SVG surface. It rejects
inline event handlers, active embeds, refresh redirects, remote loading resources,
unreviewed inline styles, malformed manifests and out-of-tree manifest paths.
The changed-input tests recompute hashes after mutations: a matching manifest alone
must not turn an unsafe presentation change into a passing release.

After deployment, compare every deployed file to a locally verified build:

```sh
python source/verify_deployment.py --root docs --base https://jacob-met.github.io/ --receipt ../private-receipts/deployment.json
```

Use a new receipt filename for each run. The verifier records hashes, HTTP status
and content types rather than response bodies, uses no authentication, and reports
redirects instead of following them. Its automated integration tests use only a
local HTTP server. It is not run against the live host by the normal CI suite.

These checks cover this site's declared static surface; they are not a general
HTML sanitizer, a full JavaScript security analysis, an accessibility certification,
or proof that arbitrary prose contains no private information. Keep the public
record review and browser behavior checks alongside them. The design and existing
published work records are unchanged by this release-check improvement.
