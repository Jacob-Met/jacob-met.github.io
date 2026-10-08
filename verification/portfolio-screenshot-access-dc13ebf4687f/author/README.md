# Portfolio full-screenshot access

The candidate adds a visible **Full screenshots: Desktop Phone** row to each of the three portfolio demo cards. Each native link opens the existing full image. This gives readers an explicit way to inspect captures that the card presents as cropped previews. The separate live-demo and source-repository actions remain available.

The receiving repository is [Jacob-Met/jacob-met.github.io](https://github.com/Jacob-Met/jacob-met.github.io). This packet contains source and qualification evidence; it does not record a publication or deployment.

## Source custody and scope

The immutable upstream main is `c6f22409c5f52a3b5925ed6a74e19e4b5c0cda27`, tree `99e64f39de7038fd91125ed7157a2fd57cf30ba8`. The complete 48-file snapshot was recovered through the GitHub connector, including the exact binary assets through its documented base64 file response, and verified against Git object IDs and sizes. Local reconstruction commit `9edce3a22d39fe87ac0b65336df980c0db89cdee` has that exact tree. It is a local reconstruction, not the upstream commit history.

Candidate `b9a7ef94cec8c38d1202995bb9c8359012f91157`, tree `c9c842524f70d10b4b1d4486352e190fb853424d`, changes exactly six paths:

- `source/build.py`: three renderer lines add relative image links, visible device labels and escaped demo-specific accessible labels.
- `source/style.css`: two rules lay out the row and give links a 44-pixel minimum height; existing link focus styling supplies the outline.
- `source/test_screenshot_access.py`: two focused regression cases check exact link destinations, accessible labels, original image bytes and retained live actions, including reordered and changed approved content.
- `docs/index.html`, `docs/style.css` and `docs/build-manifest.json`: regenerated with the existing builder.

All other 43 upstream files match exactly. The existing content, image bytes, preview markup and live-demo claims are unchanged. `source-manifest.json` binds every file; `screenshot-map.json` lists all six native destinations. The full-index patch applies to the upstream tree without requiring the local reconstruction history. A receiving branch must first check the upstream pins and absence of the new test path.

## Qualification

Both new tests fail against the original builder because it renders zero screenshot actions instead of six. The complete candidate suite passed **59 methods: 57 inherited and two new**, in normal Python mode. The existing builder and checker passed with two HTML pages and 19 output files. The candidate suite result was observed in returned tool output; its raw stdout and stderr were not separately saved. The original failing comparison has retained raw logs.

The standard replay commands, from a checkout containing the candidate and original assets, are:

```sh
python -B -m unittest discover -s source -v
python -B source/build.py --out docs
python -B source/check.py docs
```

The inherited deployment tests use a disposable loopback HTTP fixture. They do not establish a live deployment. No optimized-Python run is claimed here.

## Browser receiving limit

The original baseline completed the local browser harness at widths 1280 and 390, including a nested `/preview/` path. It showed six previews and no full-screenshot actions. `browser-before/returnby-phone.png` captures that **original baseline only**.

The first candidate attempt served all six exact image assets but timed out while waiting for all images to finish decoding, before its viewport or link checks completed. Its cause was not established. Two later attempts failed during browser initialization; their logs record low temporary space and ANGLE/EGL graphics failures. Those failed attempts are retained with their exact harness versions.

**Candidate rendering, keyboard activation, visible focus and native full-image navigation are unqualified by the author browser attempts.** The independent reviewer is receiving the frozen source separately. Any later acceptance must be attached as its own receipt and must not replace these failed observations. The harnesses use an isolated browser context and permit requests only to their own loopback server; they do not use the public portfolio, accounts or an existing browser session.

## Evidence handling

`author-receipt.json` records the observed results and limits. `source-ownership-observation.json` is the bounded upstream and coordination readback, last observed at 12:21:01 UTC on 2026-10-08. The original upstream manifest and complete tree observation are retained under `upstream/`.

`publication-allowlist.json` and `packet-manifest.json` define the exact evidence files. The allowlist excludes temporary directories, browser profiles, caches, source archives, copied image assets, signed URLs and the abandoned staging directory. The only image included is the explicitly labeled original-baseline screenshot. The source patch is the implementation handoff; unchanged repository binaries remain in their existing repository paths.
