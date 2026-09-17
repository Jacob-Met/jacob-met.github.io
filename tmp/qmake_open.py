#!/usr/bin/env python3
"""RED carrier: qmake/Qt native verifier that fail-opens.

Admits green even when qmake .pro→Makefile generation fails, the native make/nmake
build after qmake fails, the sealed Qt artifact is missing, or shadow/out-of-source
qmake isolation is bypassed.
DISJOINT from cmake-find (1766f36), ninja-rule (e82f36c), gyp (71f1f0a), mesonpy (bd9d3db),
meson-wrap, scikit-build/cmake (6a43bb1), make-jobserver (4c28052), scons (d04539d),
autoconf (548c434), and pkgconfig (bcc06d9): this surface is Qt qmake .pro orchestration,
not cmake/ninja/gyp/meson/scikit/make-jobserver/scons/autoconf/pkg-config.
"""

from __future__ import annotations

import json
from typing import Any, Mapping


def diagnose(build: Mapping[str, Any], seal: Mapping[str, Any]) -> dict[str, Any]:
    """Return qmake/Qt fail findings but still admit (fail-open)."""
    findings: list[dict[str, Any]] = []

    generate_fail = bool(build.get("qmake_generate_fail")) or bool(build.get("qmake_rc"))
    if isinstance(build.get("qmake_rc"), int) and build.get("qmake_rc") != 0:
        generate_fail = True

    native_fail = bool(build.get("qmake_native_build_fail")) or bool(build.get("make_rc"))
    if isinstance(build.get("make_rc"), int) and build.get("make_rc") != 0:
        native_fail = True

    artifact = str(build.get("artifact") or build.get("generated_makefile") or "")
    expect_artifact = str(seal.get("expected_artifact") or "")
    artifact_missing = bool(build.get("qmake_artifact_missing")) or (
        bool(expect_artifact) and not artifact
    )

    isolation_bypass = (
        bool(seal.get("skip_shadow_isolation"))
        or bool(seal.get("skip_qmake_shadow"))
        or bool(build.get("qmake_shadow_isolation_bypass"))
        or bool(build.get("no_isolation"))
    )

    if generate_fail:
        findings.append({"kind": "qmake_generate_fail_admit", "detail": "qmake .pro generate failed but admitted"})
    if native_fail:
        findings.append({"kind": "qmake_native_build_fail_admit", "detail": "qmake native make/nmake failed but admitted"})
    if artifact_missing:
        findings.append({"kind": "qmake_artifact_missing_admit", "detail": "qmake artifact missing but admitted"})
    if isolation_bypass:
        findings.append({"kind": "qmake_shadow_isolation_bypass", "detail": "skip_shadow_isolation/qmake_shadow"})

    return {
        "ok": True,
        "admitted": True,
        "fail_open": True,
        "findings": findings,
        "note": "RED fail-open admits qmake/Qt despite generate/native/artifact/isolation failures",
    }


def main() -> int:
    import sys
    from pathlib import Path

    if len(sys.argv) != 3:
        print("usage: qmake_build_fail_open_v0.py BUILD.json SEAL.json", file=sys.stderr)
        return 2
    build = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    seal = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    print(json.dumps(diagnose(build, seal), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
