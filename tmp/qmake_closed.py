#!/usr/bin/env python3
"""GREEN carrier: qmake/Qt native verifier that fail-closes.

Refuses admission when qmake .pro→Makefile generation fails, the native make/nmake
build after qmake fails, the sealed Qt artifact is missing, or shadow/out-of-source
qmake isolation is bypassed.
Deterministic qmake/Qt verify required before green.
DISJOINT from cmake-find (1766f36), ninja-rule (e82f36c), gyp (71f1f0a), mesonpy (bd9d3db),
meson-wrap, scikit-build/cmake (6a43bb1), make-jobserver (4c28052), scons (d04539d),
autoconf (548c434), and pkgconfig (bcc06d9).
"""

from __future__ import annotations

import json
from typing import Any, Mapping


def diagnose(build: Mapping[str, Any], seal: Mapping[str, Any]) -> dict[str, Any]:
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
        findings.append({"kind": "qmake_generate_fail_admit", "detail": "qmake .pro generate failed"})
    if native_fail:
        findings.append({"kind": "qmake_native_build_fail_admit", "detail": "qmake native make/nmake failed"})
    if artifact_missing:
        findings.append({"kind": "qmake_artifact_missing_admit", "detail": "qmake artifact missing"})
    if isolation_bypass:
        findings.append({"kind": "qmake_shadow_isolation_bypass", "detail": "skip_shadow_isolation/qmake_shadow"})
    if not generate_fail and not native_fail and not artifact_missing and not isolation_bypass:
        if seal.get("require_artifact_seal") and not expect_artifact:
            findings.append({"kind": "qmake_artifact_missing_admit", "detail": "missing expected_artifact seal"})

    ok = len(findings) == 0
    return {
        "ok": ok,
        "admitted": ok,
        "fail_open": False,
        "fail_closed": True,
        "findings": findings,
        "note": (
            "GREEN fail-closed refuses unless qmake/Qt verifies "
            "(no qmake_generate_fail_admit / qmake_native_build_fail_admit / "
            "qmake_artifact_missing_admit / qmake_shadow_isolation_bypass)"
        ),
    }


def main() -> int:
    import sys
    from pathlib import Path

    if len(sys.argv) != 3:
        print("usage: qmake_build_fail_closed_v0.py BUILD.json SEAL.json", file=sys.stderr)
        return 2
    build = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    seal = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    result = diagnose(build, seal)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
