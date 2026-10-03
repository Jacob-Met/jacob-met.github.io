# Opt-in git hooks for jacob-met.github.io

These hooks are **not installed automatically** — git never runs files from
`.githooks/` on its own. To opt in:

```sh
cp .githooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## pre-commit — docs-drift guard (follows issue #11)

Reproduces the CI drift guard locally: rebuilds the site to a temp dir,
runs `source/check.py`, and diffs against `docs/`. Blocks the commit with
the exact fix command if `docs/` drifted from `source/`. Fast-pass when
neither `source/` nor `docs/` is staged. Skip with `SITE_HOOK_SKIP=1`.

Tested 4/4 (fast path, simulated #48 drift blocked, post-rebuild pass,
skip flag honored). See ~/workspace/estate/missions/c1-site11-precommit/.
