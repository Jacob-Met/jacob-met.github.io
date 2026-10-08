# Prepare the recorded TasteTable studio at /tastetable/

This isolated route makes the existing synthetic studio available from a browser
link without operating a separate local server. It copies the exact 42 files from
[Jacob-Met/tastetable](https://github.com/Jacob-Met/tastetable/tree/328df51af830e91f304417a66d74f43d94ae0c02/web-demo-offline)
at commit `328df51af830e91f304417a66d74f43d94ae0c02`, tree
`df0251092f77d96169daa097abaec409ecabe6ba`. The upstream archive is Git blob
`100561cc6ba28292865061206185517163b54852`, SHA-256
`024f2787700897d7f96b9289390d054603b54edad42df6db2cd9284137852392`.
The copied MIT license and upstream README remain part of the application.

The studio selects among 24 recorded results for fictional people. It can arrange,
omit, save, reopen, print and export those recorded weeks. It does not generate new
plans or call an account, provider, model or backend. Its existing incomplete-plan,
heuristic-check and venue-confirmation cautions remain visible. Saved files stay
local; the application does not automatically upload or persist them.

## Build and try the prepared route

From the repository root, with the existing Python standard library:

~~~sh
python3 -B -m unittest discover -s source -v
python3 -B source/build.py --out docs
python3 -B source/check.py docs
python3 -B -m http.server 8000 --bind 127.0.0.1 --directory docs
~~~

Open `http://127.0.0.1:8000/tastetable/`. All module, style and recording requests
remain relative to that route. The portfolio root keeps its current content,
appearance, links and no-executable-script policy. No new homepage link is added.

## Source and admission

`source/tastetable/` holds the unchanged upstream files. The separate
`tastetable-manifest.json` records each original Git blob, size and SHA-256.
`tastetable.py` pins that manifest and verifies the complete file and directory
inventory before the builder copies any application bytes. Missing, altered,
extra or symlink entries are refused.

The generated `docs/tastetable/` must match the same independent source pin.
Rewriting the general `docs/build-manifest.json` cannot admit changed application
bytes. Only this exact reviewed copy is exempt from the portfolio-only HTML/CSS
rules; root pages, CSP and all other output paths retain their existing checks.
The general build manifest still covers every generated file. Do not hand-edit
`docs/`, including the application subtree.

An upstream update requires an explicit new source review and receiving result,
then replacement of the source files, provenance manifest and its code pin together.
There is no automatic upstream fetch in the build and no dependency installation.

## Publication boundary

This contribution prepares and verifies native source and generated output.
It does not establish a deployed TasteTable route. The intended eventual URL is
`https://jacobmetoyer.com/tastetable/`, through this repository's existing
`main:/docs` Pages destination. Actual public bytes and browser behavior remain a
separate post-publication check.

At preparation time, the user's hosted-work pause (HAMON issue 143, comment
6067592767) holds Actions-triggering publication, including PR, main updates,
merges and dispatches. No workflow or settings change is included to bypass it.
The existing three workflows remain unchanged. The maintained deployment verifier
also requires browser-recognized JavaScript MIME types for `.js` and `.mjs` files.
