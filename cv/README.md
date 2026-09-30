# CV / one-pager generator

Deterministic PDF + DOCX one-pagers from `source/content.json` (the public record). Not part of the site build or `docs/`; nothing is published by running it.

```sh
pip install reportlab python-docx pypdf     # pypdf only for tests
python cv/cv_onepager.py --out cv-out       # Jacob-Metoyer-CV.{pdf,docx} + .sha256.json
python -m unittest discover -s cv -v
```

Refuses (exit 2, writes nothing) when the record is not `visibility: public`, a claim has no source link, or a link is not https on the approved host set. Same record => byte-identical files (fixed PDF dates/ID, normalised DOCX zip). Self-reported items carry a visible `[self-reported]` tag. Re-run after every `content.json` change; rollback = delete `cv/`.
