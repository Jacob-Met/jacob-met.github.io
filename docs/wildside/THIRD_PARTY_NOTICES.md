# Third-party and estate source notices

Wildside is private and closed source. This document does not grant a license to Wildside.

## Three.js 0.180.0

The local renderer uses Three.js under its MIT license. The offline ZIP includes the unchanged license at `vendor/THREE-LICENSE.txt`. Source builds pin the exact package in `package-lock.json`; `tools/prepare-vendor.mjs` checks the module and license SHA-256 digests before making them available locally. Package archive: `https://registry.npmjs.org/three/-/three-0.180.0.tgz`, SHA-256 `ad66d724565ee29a2467277fa84daa5ed0211d6b8d446e9ef29f6bae0cd14144`.

## OpenCV 5.0.0 and Emscripten bindings

The optional clip ground-reference tracker uses the exact Apache-2.0 package
`@techstark/opencv-js@5.0.0-release.1`. Source installation verifies the upstream
runtime and license digests. The offline ZIP includes the adapted local runtime
at `vendor/opencv.cjs` and its package license at `vendor/OPENCV-LICENSE.txt`.

`tools/opencv-static-bindings.mjs` adapts the generated JavaScript glue using
Emscripten 4.0.20's maintained static Embind/Emval branches. It preserves the
OpenCV WebAssembly kernels and removes dynamic JavaScript construction for the
local content policy. Emscripten's MIT/NCSA notices are included at
`docs/third-party/EMSCRIPTEN-LICENSE.txt`. The adaptation and complete output
digest are documented in [Clip ground reference](docs/CLIP_GROUND_REFERENCE.md).
This is a local packaging adaptation, not an upstream rebuilt release.

## Existing estate code

- Wild Neighbors `src/review/draft.mjs`, blob `6923198608d90dcdc6413502a2f0c31620472ae0`, is reused unchanged for local media fingerprints and strict capture timestamps. Its source lineage and original contributor are in `docs/PLACE_CORE.md`.
- The browser overview camera fit adapts the maintained HAMON Engine eight-corner fit; `docs/VISITS.md` identifies the inspected source blob and scope.
- Bird leg endpoint solving and persistent toe contact adapt inspected HAMON Engine geometric contracts; `docs/HABITAT.md` identifies the source blobs and limitations. This build does not invoke or claim to qualify the Engine's native renderer or full pose solver.

The original courtyard's garden and bird geometry, textures, behavior and layout are procedural work for this private product. That example is imagined. The separate public-map example derives its building and street geometry from the attributed source below. Publicly licensed original photographs used for internal receiving are excluded from source and build archives; their source URLs, terms, hashes and limitations belong in the receiving evidence.


## Project PLATEAU Kyoto City 2025

The bundled `data/kyoto-public-block.json` includes a bounded derivative of Kyoto City's 2025 PLATEAU CityGML building/street mesh 52353643 and terrain group 523536. Attribution: **Derived from Project PLATEAU Kyoto City 2025 / City of Kyoto and MLIT. Cropped, projected, placed in a shared source-height frame and artistically shaded by Wildside; street plans are draped over available source terrain.** Geometry, source identities, hashes, dates and this attribution remain in the derived place. Original full XML files and unrelated source attributes are excluded.

Source: https://www.geospatial.jp/ckan/dataset/plateau-26100-kyoto-shi-2025

Terms: https://www.mlit.go.jp/plateau/site-policy/

The published source terms govern this public-data derivative and require attribution and disclosure of modifications. They do not grant a license to Wildside. Exact original URLs, hashes, axis/grounding policy and reproduction commands are in [Public map intake](docs/PUBLIC_MAP.md).

## Import tooling: proj4js and xmldom

The development-only CityGML importer uses `proj4@2.22.0` and `@xmldom/xmldom@0.9.12`, both under their MIT licenses. Exact packages and transitive dependencies are pinned in `package-lock.json`; installed packages retain their license files. They are not bundled into the browser runtime. The optional independent projection evaluator uses pyproj/PROJ in a separate evaluation environment and does not redistribute either runtime.
