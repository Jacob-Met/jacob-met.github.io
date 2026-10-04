"""Regression tests for .githooks/pre-commit (issue #11 follow-up).

The hook must validate the STAGED tree (what the commit will record), not the
working tree: staging source/content.json without the regenerated docs/ must
fail the commit, even when the working tree's docs/ look fresh.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import build as build_module

REPO = Path(build_module.__file__).resolve().parent.parent
HOOK = REPO / ".githooks" / "pre-commit"


def git(repo, *args):
    env = dict(os.environ, GIT_CONFIG_NOSYSTEM="1")
    return subprocess.run(["git", *args], cwd=repo, env=env,
                          capture_output=True, text=True, check=True)


class PrecommitHookTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name) / "repo"
        self.repo.mkdir()
        for name in ("source", "docs"):
            shutil.copytree(REPO / name, self.repo / name,
                            ignore=shutil.ignore_patterns("__pycache__"))
        (self.repo / ".githooks").mkdir()
        shutil.copy2(HOOK, self.repo / ".githooks" / "pre-commit")
        git(self.repo, "init", "-q")
        git(self.repo, "config", "user.email", "hook-test@example.invalid")
        git(self.repo, "config", "user.name", "Hook Test")
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "fixture")
        self.hook = self.repo / ".githooks" / "pre-commit"

    def run_hook(self):
        return subprocess.run(["sh", str(self.hook)], cwd=self.repo,
                              capture_output=True, text=True)

    def bump_source(self, updated="2026-10-03"):
        p = self.repo / "source" / "content.json"
        data = json.loads(p.read_text(encoding="utf-8"))
        data["updated"] = updated
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                     encoding="utf-8")

    def rebuild_docs(self):
        r = subprocess.run([sys.executable, "source/build.py", "--out", "docs"],
                           cwd=self.repo, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_clean_tree_passes(self):
        r = self.run_hook()
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_staged_source_with_staged_docs_passes(self):
        self.bump_source()
        self.rebuild_docs()
        git(self.repo, "add", "-A")
        r = self.run_hook()
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_staged_source_without_staged_docs_blocked(self):
        # The review repro: source staged, regenerated docs/ left unstaged.
        self.bump_source()
        self.rebuild_docs()
        git(self.repo, "add", "source/content.json")
        staged = git(self.repo, "diff", "--cached", "--name-only").stdout.split()
        self.assertEqual(staged, ["source/content.json"])
        r = self.run_hook()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("docs/", r.stderr)

    def test_stale_staged_docs_blocked(self):
        # docs/ regenerated from an older source, then source bumped again:
        # staged docs do not match a fresh build of the staged source.
        self.bump_source("2026-10-03")
        self.rebuild_docs()
        self.bump_source("2026-10-04")
        git(self.repo, "add", "-A")
        r = self.run_hook()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("docs/", r.stderr)

    def test_hand_edited_staged_docs_blocked(self):
        page = self.repo / "docs" / "index.html"
        page.write_text(page.read_text(encoding="utf-8") + "<!-- hand edit -->\n",
                        encoding="utf-8")
        git(self.repo, "add", "docs/index.html")
        r = self.run_hook()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("docs/", r.stderr)

    def test_unrelated_commit_skips(self):
        (self.repo / "notes.txt").write_text("unrelated\n", encoding="utf-8")
        git(self.repo, "add", "notes.txt")
        r = self.run_hook()
        self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == "__main__":
    unittest.main()
