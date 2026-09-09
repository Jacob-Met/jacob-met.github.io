"""Changed-input regression tests for the declared public-site surface."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import build
from check import check
from static_surface import css_surface, local_path


class SurfaceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'site'
        build.build(self.root)

    def alter(self, name, text):
        path = self.root / name
        path.write_text(text, encoding='utf-8', newline='\n')
        manifest_path = self.root / 'build-manifest.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['sha256'][name] = hashlib.sha256(path.read_bytes()).hexdigest()
        manifest_path.write_text(json.dumps(manifest), encoding='utf-8')

    def inject(self, text):
        self.alter('index.html', (self.root/'index.html').read_text(encoding='utf-8').replace('</head>', text+'</head>'))
    def test_original_surface_still_passes(self):
        self.assertTrue(check(self.root)['passed'])

    def test_changed_html_cannot_hide_behind_rehashed_manifest(self):
        fragments = [
            '<img src="assets/mark.svg" alt="x" width="1" height="1" onerror="void(0)">',
            '<link rel="stylesheet" href="https://example.invalid/track.css">',
            '<meta http-equiv="refresh" content="0;url=https://example.invalid">',
            '<object data="https://example.invalid/active.html"></object>',
            '<a href="https://github.com/Jacob-Met" ping="https://example.invalid">link</a>',
            '<img alt="x" width="1" height="1" srcset="https://example.invalid/a 2x">',
            '<link rel="preconnect" href="//example.invalid">',
            '<script src="site.js" src="https://example.invalid/code.js"></script>',
            '<script type="application/ld+json">not JSON</script>',
            '<style>body{background:url(https://example.invalid/pixel)}</style>',
        ]
        original = (self.root/'index.html').read_text(encoding='utf-8')
        for fragment in fragments:
            with self.subTest(fragment=fragment):
                self.alter('index.html', original.replace('</head>', fragment+'</head>'))
                result = check(self.root)
                self.assertFalse(result['passed'])
                self.assertFalse(any('Hash mismatch' in f for f in result['failures']))

    def test_css_scroll_behavior_is_not_legacy_behavior(self):
        self.assertEqual(css_surface('html{scroll-behavior:smooth}'), ([], []))
        self.assertTrue(css_surface('a{behavior:url(local.htc)}')[0])
    def test_css_remote_resources_and_imports_rejected(self):
        for css in ['@import "https://example.invalid/a.css";',
                    r'@\69mport "https://example.invalid/a.css";',
                    'body{background:url(https://example.invalid/pixel)}',
                    r'body{background:u\72l(https://example.invalid/pixel)}',
                    'body{background:image-set("https://example.invalid/pixel" 1x)}']:
            with self.subTest(css=css):
                self.alter('style.css', css)
                self.assertFalse(check(self.root)['passed'])

    def test_svg_external_and_executable_changes_rejected(self):
        for fragment in ['<script>void(0)</script>',
                         '<image href="https://example.invalid/pixel"/>',
                         '<g onload="void(0)"/>', '<foreignObject/>']:
            with self.subTest(fragment=fragment):
                self.alter('assets/mark.svg', '<svg xmlns="http://www.w3.org/2000/svg">'+fragment+'</svg>')
                self.assertFalse(check(self.root)['passed'])

    def test_bad_resource_paths(self):
        for value in ['../private', '/absolute', '//remote.test/a', 'https://remote.test',
                      '%2e%2e/private', r'..\private', r'C:\private', 'a?token=x',
                      'a%00b', 'https://[broken']:
            with self.subTest(value=value): self.assertFalse(local_path(value))
        self.assertTrue(local_path('assets/mark.svg'))

    def test_malformed_manifest_is_a_failed_check_not_a_crash(self):
        for value in ['{bad', '[]', '{"sha256":[]}']:
            (self.root/'build-manifest.json').write_text(value, encoding='utf-8')
            self.assertFalse(check(self.root)['passed'])
    def test_manifest_cannot_read_sibling_material(self):
        sibling = self.root.parent/'private-fixture.txt'
        sibling.write_text('synthetic private marker', encoding='utf-8')
        path = self.root/'build-manifest.json'
        obj = json.loads(path.read_text())
        obj['sha256']['../private-fixture.txt'] = '0'*64
        path.write_text(json.dumps(obj), encoding='utf-8')
        original = Path.read_bytes
        def guarded(p):
            if p.resolve() == sibling.resolve():
                raise AssertionError('Validator attempted an out-of-tree read')
            return original(p)
        with patch.object(Path, 'read_bytes', guarded):
            result = check(self.root)
        self.assertFalse(result['passed'])
        self.assertIn('Unsafe or malformed manifest entry', result['failures'])

    def test_invalid_svg_and_missing_resource_fail(self):
        self.alter('assets/mark.svg', '<svg>')
        self.assertFalse(check(self.root)['passed'])
        self.inject('<img src="assets/missing.webp" alt="x" width="1" height="1">')
        self.assertTrue(any('missing local resource' in f for f in check(self.root)['failures']))


    def test_unreadable_html_is_reported(self):
        (self.root/'index.html').write_bytes(b'\xff')
        self.assertFalse(check(self.root)['passed'])

    def test_declared_missing_images_option_preserved(self):
        manifest_path=self.root/'build-manifest.json'
        manifest=json.loads(manifest_path.read_text())
        for path in (self.root/'assets').glob('*.webp'):
            del manifest['sha256'][path.relative_to(self.root).as_posix()]
            path.unlink()
        manifest_path.write_text(json.dumps(manifest),encoding='utf-8')
        self.assertTrue(check(self.root,allow_missing_images=True)['passed'])
        self.assertFalse(check(self.root)['passed'])

if __name__ == '__main__':
    unittest.main()
