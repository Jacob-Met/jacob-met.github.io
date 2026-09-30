# jacobmetoyer.com

A one-page, type-driven CV for Jacob Metoyer, rebuilt from scratch on 2026-09-30. Static HTML, one stylesheet, no scripts, no tracking, no imagery beyond the monogram icon and share card.

## Rule of the site

Every line links to something a reader can check: a public repository, a dated snapshot, or an institutional page. Lines that rest on Jacob's own account of his work are labelled **self-reported** in the record and on the page, together with the dated snapshot they were taken from. Lab results, participant data, unpublished work and personal interests stay off the site.

## Layout

- `source/content.json`: the whole public record. The builder refuses any claim without a source link and any link outside the approved host set.
- `source/build.py`: generator. Renders `index.html` and `404.html`, copies the stylesheet and icons, writes `cv.json`, `sitemap.xml`, `robots.txt` and `build-manifest.json`.
- `source/check.py`: offline checks on the built tree: declared surface (no scripts, embeds, images, remote resources), link and anchor integrity, CSP meta, manifest hashes.
- `source/verify_deployment.py`: byte-for-byte comparison of a checked build against the HTTPS deployment.
- `source/make_images.py`: regenerates the share card and icons (Pillow; not part of CI).
- `docs/`: the built tree served by GitHub Pages from `main:/docs`.

## Reserved slots

`verified_research` remains empty: the inventory found no publicly shared research output. `verified_writing` contains two technical notes in public repositories, checked against Otama's 2026-09-30 inventory and read directly. Entries appear only with a working public link; an empty slot renders a visible placeholder. Private Notion research pages are not linked.

## Build and check

```sh
python -m unittest discover -s source -v
python source/build.py --out docs
python source/check.py docs
```

CI (`site-checks.yml`) runs the tests, rebuilds, checks, and diffs against the committed `docs/`. `live-site.yml` verifies the HTTPS deployment byte-for-byte every day. These checks establish what the site claims about its own build; they say nothing about the scientific quality of the work described.
