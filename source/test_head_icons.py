"""Head metadata and icon assertions for the built public site."""
import struct, unittest
import build
from test_site import Built


class HeadIconTests(Built):
    def test_twitter_card_and_apple_touch_icon_declared(self):
        head = self.page()
        self.assertIn('<meta name="twitter:card" content="summary_large_image">', head)
        self.assertIn('<link rel="apple-touch-icon" href="apple-touch-icon.png">', head)
        self.assertTrue((self.root / 'apple-touch-icon.png').is_file())

    def test_title_description_theme_and_canonical_are_current(self):
        page = self.page()
        self.assertIn(f'<title>{build.TITLE}</title>', page)
        self.assertIn(f'<meta name="description" content="{build.DESC}">', page)
        self.assertIn('<meta name="theme-color" content="#F3F0E7">', page)
        self.assertIn(f'<link rel="canonical" href="{build.BASE}/">', page)
        self.assertNotIn('🐴', page)

    def test_ico_frame_sizes(self):
        ico = (self.root / 'favicon.ico').read_bytes()
        reserved, kind, count = struct.unpack('<HHH', ico[:6])
        self.assertEqual((reserved, kind), (0, 1))
        sizes = [(ico[6 + 16 * i] or 256, ico[7 + 16 * i] or 256) for i in range(count)]
        self.assertEqual(sizes, [(16, 16), (32, 32), (48, 48)])
        self.assertIn('<link rel="icon" href="favicon.ico" sizes="48x48">', self.page())


if __name__ == '__main__': unittest.main()
