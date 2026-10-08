# Independent acceptance: Windows website test fixtures

Accepted source is exactly two test files against Jacob-Met/jacob-met.github.io main
5824003ee53a6525197006645050d6ddf70e31fb (tree
8a36d031be1ee9ee8ac3d4ade66708b4ed6c2666). The original production hook works on
the tested Windows platform. The failures came from test fixture differences:
missing repository line-ending attributes and implicit decoding of UTF-8 JSON
using the Windows code page.

Author: [redacted].
Independent receiver: [redacted].
Source ownership: https://github.com/Jacob-Met/jacob-met.github.io/issues/41 .
The original completed native task was wt_d629a21f0a75496c843c51a1, attempt
wa_7d922d91a5644a1bac7e8735, worker [redacted]; its custody-verified report
SHA-256 is 873ffd152927226eabe7c59421ab8ba7b49763c69ae881b60540a8fe88d60cc5.
Its suspected MSYS path explanation was provisional and was not reproduced.

## Accepted source pins

| File | Git blob | SHA-256 |
|---|---|---|
| source/test_site.py | f13a5c6aa0db40f613758793870dc4aab750a257 | 5ab93e45e2df8ffdc57fad4e8b48dce25b7466bbe3df9be17ca67543b90992d3 |
| source/test_screenshot_access.py | c2d03d91b78c8209edb41a417c8a7472f1c8f483 | 286ecd4059dc82d5eae7a3685a585c065ec24b5b9606417759ebb3ddaba82bb7 |

The first file copies canonical .gitattributes into the existing isolated hook
fixture, sets that fixture's local core.autocrlf=true to exercise conversion on
every platform, and includes hook stderr in the valid-case assertion. The second
adds exactly three encoding="utf-8" arguments to JSON reads. The other 82
canonical files remain byte-exact.

The production hook is unchanged: Git blob
e4b03fe09831127794c9ed6f5106f6d805cfdba7, SHA-256
b02897530456cde70d89cdfc22277f3af836ed674ed87dfb2dfc7fdd355a0bb2.
Build code, generated pages, assets, global environment, services, and scheduled
tasks were untouched. Existing README-only PR39 and workflow-only PR36 retain
their scopes.

## Original controls, before candidate inspection

The original 84 tracked files were admitted against every canonical Git blob
and size. No owner Git metadata or credentials were copied. The independent
hook contract and driver were committed before candidate intake at
2011362565d0a59b629fc3498b61a8d01606ac76.

All nine actual-hook groups passed: valid staged source plus rebuilt docs commits;
staged drift still blocks when only the working tree is repaired; staged docs
tampering blocks; invalid staged JSON blocks despite a valid working copy;
a valid index commits while invalid unstaged changes remain intact; unrelated
staging fast-passes despite irrelevant unstaged source damage; clean invocation
passes; and valid/drift cases also behave correctly in a Unicode path.
Each group checks index tree, working bytes, expected HEAD movement, and temporary
cleanup. Original raw Git outputs and before/after manifests are retained.

The original maintained PrecommitHookTests suite passed 3/4. Its valid case was
false-rejected. Windows system Git had core.autocrlf=true, while the fixture
lacked canonical .gitattributes. checkout-index materialized generated text with
CRLF; the fresh build produced LF. Adding only the exact canonical attributes
to that same fixture made the unchanged hook pass. Genuine drift still blocked.

The first mechanism receiver had one overly broad assertion of its own: it
expected the fixture's native Python-written content.json to begin with LF.
That write already produced CRLF on Windows. Both that failed receiver result
and the corrected v2 driver/result remain in this packet. The v2 checks separate
already-CRLF source from converted docs; all nine mechanism checks pass.
This was a receiver correction, not another product fix.

The original ScreenshotAccess tests failed 0/2 under native cp1252
(utf8_mode=0) and passed 2/2 with explicit UTF-8. The locale contract was frozen
before receiving the second changed file. Raw failure output is retained.

## Candidate qualification

The one-file hook fixture correction passed all four maintained hook tests.
Independent inspection confirmed byte-exact canonical attributes, local
autocrlf=true, and eol=lf for both source and docs. The locale extension's exact
diff consists of three explicit UTF-8 reads.

The final two-file candidate passed the complete maintained suite twice on
native Windows at 2026-10-08T17:04:28Z:

| Mode | Result | Duration |
|---|---|---|
| Python utf8_mode=0, preferred encoding cp1252 | 59/59, no skips | 17.377 s |
| Python utf8_mode=1, preferred encoding UTF-8 | 59/59, no skips | 18.689 s |

The runtime was Python 3.13.15 (MSC v.1944, AMD64) with Git
2.55.0.windows.5 and Git's sh.exe. A private Python3 wrapper and private PATH
were necessary because the RDC session did not expose those executable names.
Temporary paths included spaces. No system configuration was changed.

The exact final receiver SHA-256 is
345341836b99869213586d3032ffa9946388232bc2c6c7c452f6950f72e04212.
The final patch SHA-256 is
d5ec8be3faefbb0ddaf69929ce0b90c9a414a58e7534ababa9d3d0cceb4a0e74.
Full source, raw logs, runtime probes, and all preservation checks are retained
in candidate-final/receipt.json and its adjacent files.

## Authority and limits

Original ThinkPad coordination was read fresh. Native Conscience decision 4597,
event cev_9f50f42e64d643e0a08a7f98, records the external Windows source extension
to exactly these two test files and evidence. Payload SHA-256:
35f8faa1cbf377bc59509fbd5549421519a3b04ee97d19123a198582221a3c95.
Independent receiving is decision 4593, cev_f646c6b226a6451393a7c7b1.
These are external source scopes, not resident execution leases.

Acceptance applies to the exact source blobs above. Publication, composition
review, required CI, and merge remain separate receiving boundaries. No
platform-wide hook defect, deployment, service repair, or broader rollout is
claimed. Evidence covers the stated native Python/Git environment and the
actual staged-content contract.
