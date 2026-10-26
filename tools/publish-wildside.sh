#!/bin/bash
# Publish Wildside to https://jacobmetoyer.com/wildside/ (GitHub Pages: Jacob-Met/jacob-met.github.io, /docs on main).
# usage: tools/publish-wildside.sh <wildside-checkout-at-origin/main> [site-checkout]
# Copies the static Wildside app from a clean Jacob-Met/wildside main checkout into docs/wildside/,
# commits, pushes to main, waits for Pages and checks the live HAMON default.
# Run it after every Wildside main merge that should reach https://jacobmetoyer.com/wildside/.
set -eu
SRC="$(cd "$1" && pwd)"; SITE="$(cd "${2:-$(dirname "$0")/..}" && pwd)"; DEST="$SITE/docs/wildside"
AUTHOR=(-c user.name="Jacob Metoyer" -c user.email=150724801+Jacob-Met@users.noreply.github.com)
PUSH=(env GIT_CONFIG_GLOBAL=/dev/null git -c credential.helper= -c "credential.helper=!gh auth git-credential" -c http.postBuffer=524288000)
cd "$SRC"; git fetch -q origin
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "source has uncommitted changes" >&2; exit 1; }
[ -z "$(git diff origin/main --stat -- index.html src hamon data assets THIRD_PARTY_NOTICES.md)" ] || { echo "source differs from origin/main; merge first" >&2; exit 1; }
[ -d vendor ] || { echo "vendor/ missing (npm run prepare:vendor)" >&2; exit 1; }
REV=$(git rev-parse --short origin/main)
cd "$SITE"; "${PUSH[@]}" fetch -q https://github.com/Jacob-Met/jacob-met.github.io.git +refs/heads/main:refs/remotes/origin/main
git checkout -q main; git merge -q --ff-only origin/main
mkdir -p "$DEST"
for f in src hamon vendor data assets; do rsync -a --delete "$SRC/$f/" "$DEST/$f/"; done
cp "$SRC/index.html" "$SRC/THIRD_PARTY_NOTICES.md" "$DEST/"
# root-absolute fetch/import paths break under /wildside/: make them relative
if grep -rnE "fetch\((['\"\`])/[^/]" "$DEST/src" "$DEST/index.html" >/dev/null; then
  grep -rlE "fetch\((['\"\`])/[^/]" "$DEST/src" "$DEST/index.html" | while read -r f; do
    perl -pi -e 's#fetch\((['"'"'"`])/([^/])#fetch($1$2#g' "$f"; done
fi
! grep -rnE "(src|href)=\"/[^/]|fetch\((['\"\`])/[^/]" "$DEST/index.html" "$DEST/src" || { echo "root-absolute paths remain" >&2; exit 1; }
# HAMON default: wantsHamon() must default on where WebGPU exists
grep -q "return !!gpu" "$DEST/src/hamon-view.mjs" || { echo "HAMON is not the default in this build" >&2; exit 1; }
git add docs/wildside
if git diff --cached --quiet; then echo "site already up to date"; else
  git "${AUTHOR[@]}" commit -qm "Update Wildside to $REV (HAMON Engine view by default)"
  "${PUSH[@]}" push -q https://github.com/Jacob-Met/jacob-met.github.io.git HEAD:main
fi
echo "pushed; waiting for the Pages build..."
for i in $(seq 1 40); do
  st=$(gh api repos/Jacob-Met/jacob-met.github.io/pages/builds/latest -q .status 2>/dev/null || echo unknown)
  [ "$st" = built ] && break; sleep 6; done
echo "pages build: $st"
sleep 5
for p in "" src/hamon-view.mjs hamon/hamon_browser_bg.wasm data/kyoto-public-block.json; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' "https://jacobmetoyer.com/wildside/$p") /wildside/$p"; done
curl -s https://jacobmetoyer.com/wildside/src/hamon-view.mjs | grep -q "return !!gpu" && echo "live build has HAMON default"
