"""Actual CLI checks for the single pinned TasteTable delivery subtree."""
from __future__ import annotations
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


def files(root):
    return {p.relative_to(root).as_posix(): p.read_bytes()
            for p in root.rglob('*') if p.is_file() and not p.is_symlink()}


class TasteTableDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='site-tastetable-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / 'source'
        shutil.copytree(Path(__file__).resolve().parent, self.source,
                        ignore=shutil.ignore_patterns('__pycache__'))
        self.out = self.root / 'site'
        self.build_ok()
        self.original = files(self.out)

    def command(self, script, *args):
        return subprocess.run([sys.executable, '-B', str(self.source / script), *map(str, args)],
                              capture_output=True, text=True, timeout=15)

    def build_ok(self):
        result = self.command('build.py', '--out', self.out)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result

    def check_refused(self, root=None):
        result = self.command('check.py', root or self.out)
        self.assertEqual(result.returncode, 1, result.stderr)
        receipt = json.loads(result.stdout)
        self.assertFalse(receipt['passed'])
        return receipt

    def build_refused_without_replacement(self):
        result = self.command('build.py', '--out', self.out)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('ValueError', result.stderr)
        self.assertEqual(files(self.out), self.original)

    @staticmethod
    def refresh_general_manifest(root):
        path = root / 'build-manifest.json'
        record = json.loads(path.read_text())
        record['sha256'] = {name: hashlib.sha256(raw).hexdigest()
                            for name, raw in sorted(files(root).items())
                            if name != 'build-manifest.json'}
        path.write_text(json.dumps(record, indent=2) + '\n')

    def test_exact_inventory_and_deterministic_rebuild(self):
        expected = json.loads((self.source / 'tastetable-manifest.json').read_text())['files']
        self.assertEqual(len(expected), 42)
        self.assertEqual(sum(e['bytes'] for e in expected), 891961)
        actual = files(self.out / 'tastetable')
        self.assertEqual(set(actual), {e['path'] for e in expected})
        for item in expected:
            raw = actual[item['path']]
            self.assertEqual(raw, (self.source / 'tastetable' / item['path']).read_bytes())
            self.assertEqual(hashlib.sha256(raw).hexdigest(), item['sha256'])
        result = self.command('check.py', self.out)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.build_ok()
        self.assertEqual(files(self.out), self.original)

    def test_missing_or_changed_source_preserves_output(self):
        target = self.source / 'tastetable/app.mjs'
        original = target.read_bytes()
        for mutation in ('missing', 'same-size-change'):
            with self.subTest(mutation=mutation):
                if mutation == 'missing':
                    target.unlink()
                else:
                    target.write_bytes(b'X' + original[1:])
                try:
                    self.build_refused_without_replacement()
                finally:
                    target.write_bytes(original)

    def test_extra_source_file_or_directory_preserves_output(self):
        for name, directory in [('unexpected.txt', False), ('unexpected', True)]:
            with self.subTest(name=name):
                target = self.source / 'tastetable' / name
                target.mkdir() if directory else target.write_text('not part of the recording')
                try:
                    self.build_refused_without_replacement()
                finally:
                    target.rmdir() if directory else target.unlink()

    def test_source_file_and_root_symlinks_preserve_output(self):
        target = self.source / 'tastetable/app.mjs'
        original = target.read_bytes()
        outside = self.root / 'same-app.mjs'
        outside.write_bytes(original)
        target.unlink()
        target.symlink_to(outside)
        try:
            self.build_refused_without_replacement()
        finally:
            target.unlink()
            target.write_bytes(original)
        app = self.source / 'tastetable'
        held = self.root / 'same-application'
        app.rename(held)
        app.symlink_to(held, target_is_directory=True)
        try:
            self.build_refused_without_replacement()
        finally:
            app.unlink()
            held.rename(app)

    def test_changed_provenance_manifest_preserves_output(self):
        target = self.source / 'tastetable-manifest.json'
        record = json.loads(target.read_text())
        record['commit'] = '0' * 40
        target.write_text(json.dumps(record, indent=2) + '\n')
        self.build_refused_without_replacement()

    def test_generated_inventory_and_bytes_are_independently_pinned(self):
        for mutation in ('missing', 'changed', 'extra', 'extra-directory', 'symlink'):
            with self.subTest(mutation=mutation):
                trial = self.root / ('generated-' + mutation)
                shutil.copytree(self.out, trial)
                app = trial / 'tastetable'
                if mutation == 'missing':
                    (app / 'app.mjs').unlink()
                elif mutation == 'changed':
                    path = app / 'app.mjs'
                    raw = path.read_bytes()
                    path.write_bytes(b'X' + raw[1:])
                elif mutation == 'extra':
                    (app / 'extra.mjs').write_text('export const unexpected = true;\n')
                elif mutation == 'extra-directory':
                    (app / 'extra').mkdir()
                else:
                    path = app / 'app.mjs'
                    path.unlink()
                    path.symlink_to(self.source / 'tastetable/app.mjs')
                self.refresh_general_manifest(trial)
                receipt = self.check_refused(trial)
                self.assertTrue(any('TasteTable admission failed' in e for e in receipt['failures']))

    def test_portfolio_script_and_form_policy_survives_manifest_rehash(self):
        for addition, reason in [('<script>void 0;</script>', 'script: executable'),
                                 ('<form></form>', 'form: outside')]:
            with self.subTest(reason=reason):
                target = self.out / 'index.html'
                target.write_bytes(self.original['index.html'] + addition.encode())
                self.refresh_general_manifest(self.out)
                receipt = self.check_refused()
                self.assertTrue(any(reason in e for e in receipt['failures']), receipt)
                target.write_bytes(self.original['index.html'])

    def test_unknown_existing_output_is_never_replaced(self):
        for name, directory in [('extra.mjs', False), ('empty-extra', True)]:
            with self.subTest(name=name):
                target = self.out / 'tastetable' / name
                target.mkdir() if directory else target.write_text('preserve this file')
                before = files(self.out)
                result = self.command('build.py', '--out', self.out)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('unexpected material', result.stderr)
                self.assertEqual(files(self.out), before)
                target.rmdir() if directory else target.unlink()


if __name__ == '__main__':
    unittest.main()
