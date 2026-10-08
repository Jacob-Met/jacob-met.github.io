# Independent review: portfolio full-screenshot access

**Accepted without a source correction.** The reviewed candidate is
`b9a7ef94cec8c38d1202995bb9c8359012f91157` in `Jacob-Met/jacob-met.github.io`, based on
upstream `c6f22409c5f52a3b5925ed6a74e19e4b5c0cda27`. It gives readers six explicit native
links to the existing desktop and phone images while retaining the live-demo and source
actions. This review includes a successful, separately pinned browser receiving run.

## Source and generated-build custody

The complete candidate working files match their Git objects. Exactly six paths change:
the renderer, its stylesheet, the new focused test, and the three generated files.
The other 43 candidate files are unchanged. Outside `demo_card`, the renderer AST is
identical; its complete textual change is three inserted lines. The stylesheet adds
exactly two rules. Names pass through the existing quote-aware HTML escaping, while
image destinations use the existing validated local WebP path contract.

Removing the three new screenshot-link paragraphs restores the previous generated HTML
byte for byte. All existing content, preview markup and link attributes/text therefore
remain intact. Each of the six new destinations matches the content record, and its
source, generated and baseline image bytes are identical. The original page has zero
such actions; the candidate has six, with project-specific accessible names and native
same-tab links.

One independent build into a new reviewer-owned directory reproduces **all 19 generated
files exactly**, including the complete build manifest. Only the manifest's `index.html`
and `style.css` content hashes change from the baseline. The author's 59-method suite was
not repeated. The first static review attempt stopped on the review harness's overly
restrictive file-mode assumption; its exact program and observation are retained under
`rejected-harnesses/`. Correcting that harness assumption required no candidate edit.

## Actual browser receiving

The frozen generated files passed one bounded Chromium `153.0.8010.0` run through the
existing Playwright `1.62.1`, using the original successful baseline launch configuration.
The run used a new browser context, an exclusively local server and reviewer-owned
temporary files. Both **1280 × 900 at `/`** and **390 × 900 at `/preview/`** decoded all six
previews and had no horizontal page overflow.

From each demo's existing details summary, real Tab input reaches Desktop, then Phone,
then the original live-demo action. Every new link has visible two-pixel focus and at
least 44 pixels of height, with its rectangle inside the viewport. At the nested phone
width, six real Enter activations open the exact image URLs in the same tab. Response
hashes and intrinsic image dimensions match the frozen assets; Back returns to the
portfolio each time. No external request or page error occurred. All 19 generated files
are unchanged after the browser run.

The two retained ReturnBy captures were visually inspected. The new underlined links
are readable and unclipped at both widths, and the existing demo/source actions remain
visible in the card. The images are candidate captures from this independent run.

## Earlier failures and qualification limits

The author's successful baseline browser check showed six previews and zero new actions.
Its first candidate attempt served six image paths but timed out before link or viewport
checks completed. Two further attempts failed during graphics/page initialization.
Their exact receipts and harness versions remain bound in `observations.json`; the
initial decode timeout's cause is still unknown. Temporary capacity dropped below five
megabytes during this review, then recovered to 128,233,472 bytes before the single
successful independent attempt. This chronology does not diagnose the earlier timeout.

Receiving covers the stated Chromium viewport widths and keyboard path. It does not
qualify a physical phone, touch zoom, another browser, screen-reader speech or the live
deployed website. Existing external destinations were checked and preserved without
activating those actions. The review programs retain their historical local source
roots and one-shot output locations; they are evidence programs, not new installed
commands. The author source and all earlier failed evidence remain unchanged.
