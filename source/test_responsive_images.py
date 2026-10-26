"""Declared AVIF/WebP derivatives: exact bytes, exact <source> sets, nothing else admitted."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path

import check
import responsive_images as ri

ROOT = Path(__file__).resolve().parent


class ResponsiveImages(unittest.TestCase):
    def test_manifest_matches_checked_in_bytes(self):
        data = ri.load(ROOT)
        self.assertTrue(all(p.startswith(ri.PREFIX) for p in ri.files(data)))

    def test_changed_derivative_is_rejected(self):
        data = json.loads((ROOT / ri.MANIFEST).read_text())
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); shutil.copyfile(ROOT / ri.MANIFEST, root / ri.MANIFEST)
            for rel in ri.files(data):
                (root / rel).parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(ROOT / rel, root / rel)
            target = root / sorted(ri.files(data))[0]; raw = target.read_bytes(); target.write_bytes(raw[:-1] + bytes([raw[-1] ^ 1]))
            with self.assertRaisesRegex(ValueError, 'checksum'): ri.load(root)

    def test_checker_admits_only_declared_sources(self):
        data = ri.current()
        markup = ri.picture('lanternwake-island', '<img src="assets/derived/lanternwake-island-760.webp" width="760" height="460" alt="Lanternwake">', '320px')
        page = check.Page(figures={'x': {'src': 'x.svg'}}, responsive=data); page.feed(markup)
        self.assertEqual(page.errors, [])
        self.assertIn('assets/derived/lanternwake-island-380.avif', page.resources)
        rogue = check.Page(figures={'x': {'src': 'x.svg'}}, responsive=data)
        rogue.feed('<picture><source type="image/avif" srcset="assets/derived/other.avif 760w" sizes="320px"><img src="assets/derived/lanternwake-island-760.webp" width="760" height="460" alt="x"></picture>')
        self.assertTrue(rogue.errors)


if __name__ == '__main__':
    unittest.main()
