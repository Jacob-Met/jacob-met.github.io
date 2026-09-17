#!/usr/bin/env python3
"""Carrier tests for qmake/Qt native fail-closed GREEN verifier (5 scenarios)."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from qmake_build_fail_closed_v0 import diagnose

HERE = Path(__file__).resolve().parent
CASES = HERE.parent / "fixtures" / "build_cases"


class QmakeBuildFailClosedTests(unittest.TestCase):
    def _load(self, name: str):
        build = json.loads((CASES / f"{name}.build.json").read_text(encoding="utf-8"))
        seal = json.loads((CASES / f"{name}.seal.json").read_text(encoding="utf-8"))
        return build, seal

    def test_clean_build_ok(self):
        build, seal = self._load("clean")
        r = diagnose(build, seal)
        self.assertTrue(r["ok"])
        self.assertTrue(r["admitted"])
        self.assertEqual(r["findings"], [])

    def test_qmake_generate_fail_refuse(self):
        build, seal = self._load("qmake_generate_fail")
        r = diagnose(build, seal)
        self.assertFalse(r["ok"])
        self.assertTrue(any(f["kind"] == "qmake_generate_fail_admit" for f in r["findings"]))

    def test_qmake_native_build_fail_refuse(self):
        build, seal = self._load("qmake_native_build_fail")
        r = diagnose(build, seal)
        self.assertFalse(r["ok"])
        self.assertTrue(any(f["kind"] == "qmake_native_build_fail_admit" for f in r["findings"]))

    def test_qmake_artifact_missing_refuse(self):
        build, seal = self._load("qmake_artifact_missing")
        r = diagnose(build, seal)
        self.assertFalse(r["ok"])
        self.assertTrue(any(f["kind"] == "qmake_artifact_missing_admit" for f in r["findings"]))

    def test_qmake_shadow_isolation_bypass_refuse(self):
        build, seal = self._load("qmake_shadow_isolation_bypass")
        r = diagnose(build, seal)
        self.assertFalse(r["ok"])
        self.assertTrue(any(f["kind"] == "qmake_shadow_isolation_bypass" for f in r["findings"]))


if __name__ == "__main__":
    raise SystemExit(unittest.main())
