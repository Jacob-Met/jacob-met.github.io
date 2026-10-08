# Windows website independent receiving packet

The five-file allowlist is independent-receiving.bundle, MANIFEST.json,
REVIEW.md, final-receipt.json, and README.md. MANIFEST.json pins the other four
files, the sealed native Git commit/tree, and bundle verification. REVIEW.md
explains the source decision and the original failures.

The bundle contains frozen contracts/drivers, all 84 canonical baseline inputs,
original materialized line-ending evidence, nine original-hook receipts with
raw Git logs, both mechanism receiver versions, original locale controls,
final candidate source, and both 59-test outputs. EVIDENCE-MANIFEST.json pins
every selected evidence file except itself. Synthetic fixture repositories
and their Git metadata are excluded.

## Recover exact evidence bytes

The captured public source snapshots have their own Git attributes. Prevent
those nested attributes from transforming captured CRLF evidence by cloning
without checkout and writing a receiver-local override before checkout.
In PowerShell, this changes only the new evidence clone:

    git clone --no-checkout independent-receiving.bundle receiver
    New-Item -ItemType Directory -Force receiver/.git/info | Out-Null
    [IO.File]::WriteAllText(
      (Join-Path (Resolve-Path receiver) '.git/info/attributes'),
      ("* -text" + [char]10),
      [Text.UTF8Encoding]::new($false)
    )
    git -C receiver checkout
    git -C receiver log --oneline -6

The native sealer verified every committed blob against its working bytes using
Git's raw object API and verified the complete bundle. Git show/cat-file also
exposes exact committed bytes without checkout conversion.

## Review and repeat

Preserved final source is in candidate-final/site source. On Windows with
Python3, Git, and sh available, run the maintained suite there:

    python -X utf8=0 -m unittest discover -s source -v
    python -X utf8 -m unittest discover -s source -v

The actual native invocation used the explicit Python executable, private
Python3 wrapper and private spaced TEMP/TMP paths in receive_final.py. The final
receipt records exact commands and runtime probes. Original hook controls used
UTF-8 intentionally; the final full-suite pair qualifies both native code-page
decoding and UTF-8.

To repeat the nine actual-commit cases, use receive_hook.py with a new --label.
Its canonical source root and executable paths are explicit native constants.
Use a separate receiver copy; point ORIGINAL at the captured
mechanism-original-v2/faithful input source and supply local Git/sh/Python
paths. Preserve the original driver and record any adapted copy's hash.

Other drivers intentionally refuse to reuse already-recorded output directories.
Repeat in a fresh private evidence namespace with the original 84-file snapshot
and exact candidate files. Keep the retained negative controls. The first
receive_original_fixture.py has the documented receiver assertion mistake;
use v2 for the corrected mechanism control.

No original author's Git configuration, credentials, installed worker, or
global environment change is required to inspect this packet. Absolute paths
in historical receipts identify actual native execution.
