# Brain landing prototype (local only)

Run: `cd /workspace/site_brain/prototype && python3 -m http.server 8765`, then open http://127.0.0.1:8765/
Options: `?reduce` (reduced motion), `?low` (low-power mesh), `?t=2` (freeze shader time for screenshots), `?hover=10` (pre-highlight a region), `?slow=12` (slow the dive for capture).
three.js r170 (MIT, `vendor/THREE_LICENSE`) loads from `vendor/three.module.min.js`; if that file is missing it falls back to `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js`. No build step, no keys.
Edit region copy in `regions.js`, then run `node build_static.mjs` to rewrite the plain-HTML sections in `index.html`.
Placeholders: the brain, eyes and tissue are procedural; the Hamon destination shows the CURRENT Western-smithy still; the Spire destination shows Echo r13d (an engine test render, not key art); the research "rooms" are gradients.
Not built yet: history/back-button integration, hash deep links into the dive, video playback, a Lite pre-rendered tier, swipe to step out.
