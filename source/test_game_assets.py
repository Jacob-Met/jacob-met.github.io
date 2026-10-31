"""Publication contract tests. Tiny fixtures exercise validation, not a gameplay claim."""
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from game_assets import GAME_CSP, RUNTIME_FILES, audit_game_bundle, wasm_runtime_only

class PublicationBoundary(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in RUNTIME_FILES: (self.root / name).write_bytes(b'')
        (self.root / 'index.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + GAME_CSP + '"><link rel="stylesheet" href="./style.css"></head><body><canvas></canvas><script type="module" src="./loader.js"></script></body></html>')
        (self.root / 'loader.js').write_text('import {installWebGpuCompatibility} from "./webgpu-compat.js";')
        (self.root / 'hamon_web_bg.wasm').write_bytes(b'\0asm\x01\0\0\0')
        (self.root / 'build-info.json').write_text(json.dumps({'visibility':'public-runtime-only','engine_commit':'a'*40}))
    def test_runtime_allowlist(self): self.assertEqual(set(audit_game_bundle(self.root)), RUNTIME_FILES)
    def test_source_debug_declarations_refused(self):
        for name in ['lib.rs','loader.ts','x.map','README.md','hamon_web.d.ts','.github']:
            p=self.root/name; p.write_text('private')
            with self.subTest(name=name), self.assertRaises(ValueError): audit_game_bundle(self.root)
            p.unlink()
    def test_symlink_refused(self):
        p=self.root/'desktop.png'; p.symlink_to('/etc/hostname')
        with self.assertRaises(ValueError): audit_game_bundle(self.root)
    def test_missing_runtime_refused(self):
        (self.root/'webgpu-compat.js').unlink()
        with self.assertRaises(ValueError): audit_game_bundle(self.root)
    def test_custom_wasm_section_refused(self):
        with self.assertRaises(ValueError): wasm_runtime_only(b'\0asm\x01\0\0\0\0\x01\0')
    def test_truncated_wasm_refused(self):
        with self.assertRaises(ValueError): wasm_runtime_only(b'\0asm\x01\0\0\0\x01\x05\0')
    def test_source_maps_and_private_paths_refused(self):
        for token in ['//# sourceMappingURL=x.map','/workspace/private/src','/Users/me/src']:
            (self.root/'hamon_web.js').write_text(token)
            with self.subTest(token=token), self.assertRaises(ValueError): audit_game_bundle(self.root)
    def test_remote_resource_refused(self):
        p=self.root/'index.html'; p.write_text(p.read_text().replace('./loader.js','https://example.com/x.js'))
        with self.assertRaises(ValueError): audit_game_bundle(self.root)
    def test_inline_execution_refused(self):
        p=self.root/'index.html'; p.write_text(p.read_text().replace('<canvas>','<canvas onclick="alert(1)">'))
        with self.assertRaises(ValueError): audit_game_bundle(self.root)
    def test_policy_cannot_be_weakened(self):
        p=self.root/'index.html'; p.write_text(p.read_text().replace("'wasm-unsafe-eval'", "'unsafe-eval'"))
        with self.assertRaises(ValueError): audit_game_bundle(self.root)
    def test_nested_repository_refused(self):
        (self.root/'crates').mkdir()
        with self.assertRaises(ValueError): audit_game_bundle(self.root)

class LoaderLifecycle(unittest.TestCase):
    def test_shipped_loader_lifecycle(self):
        root = Path(__file__).resolve().parents[1]
        source = root / 'source/games/lanternwake/loader.js'
        shipped = root / 'docs/games/lanternwake/loader.js'
        self.assertEqual(source.read_bytes(), shipped.read_bytes())
        node = shutil.which('node')
        self.assertIsNotNone(node, 'Node is required for the loader lifecycle contract')
        result = subprocess.run(
            [node, str(root / 'source/game_loader_contract.cjs'), str(source)],
            cwd=root, capture_output=True, text=True, timeout=15, check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, '')
        report = json.loads(result.stdout)
        self.assertEqual(report['passed'], 6)
        self.assertEqual(len(report['outcomes']), 6)

if __name__ == '__main__': unittest.main()
