# Jacob Metoyer — research and selected work

A small, self-contained public site for academic research, independent AI-systems research, software, and making.

## Structure

- `source/content.json`: explicitly public work records and identity links.
- `source/build.py`: static page generator and reviewed editorial copy.
- `source/style.css`, `source/site.js`: local presentation and progressive filtering; no external scripts or tracking.
- `source/assets/`: deliberately minimal site-owned assets.
- `source/check.py`, tests, and deployment verifier: output, link, static-surface, determinism, and readback checks.
- `docs/`: the built deployment tree served by GitHub Pages.

## Rebuild and check

```sh
python -m unittest discover -s source -v
python source/build.py --out docs
python source/check.py docs
```

The CI workflow rebuilds from source, checks the declared deployment tree, compares it with committed output, and packages verified public files. These checks validate the site's declared presentation/build behavior—not the scientific quality of the work it describes.

## Editorial boundary

The site distinguishes collaborative academic research, independent hobby research, public software, and personal making. Independent AI-systems work is described as independent research without implying university sponsorship, peer review, a funded lab, or client engagements that do not exist.

Public authorship claims should match the level of detail relevant to the work. Project-, platform-, publication-, collaboration-, and research-specific disclosure requirements take precedence over generic wording.

## Add or revise work

Update the explicit public record, then the relevant page. Keep contribution, current status, evidence, limitations, approved links, and publication status reviewable. Do not put confidential drafts, participant data, unrestricted personal inventories, authentication information, or private research systems in this repository.

Keep dates honest. A dated `now.html` page is a snapshot, not an activity feed. Public source does not imply clinical validation, institutional endorsement, or customer value.

## Hosting

The site is static and currently deploys from `main:/docs` on GitHub Pages. The generator does not change domain, account, billing, security, or hosting settings.

## Release checks

The static-surface checks reject unreviewed active embeds, redirects, remote-loading resources, unsafe paths, malformed manifests, and output-tree drift. The deployment verifier compares published bytes, status, and content types against a locally qualified build.

These controls are deliberately narrower than a complete security review, accessibility certification, or scientific review. Their purpose is to make the claims they *do* support reproducible.
