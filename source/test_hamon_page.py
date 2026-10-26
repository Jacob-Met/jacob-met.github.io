"""HAMON page: identity, honesty and metadata guards."""
import json, re, tempfile, unittest
from pathlib import Path
import build, hamon_page, wildside_page


class HamonPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(); cls.root = Path(cls.temp.name) / 'out'
        build.build(cls.root, preview=True)

    @classmethod
    def tearDownClass(cls): cls.temp.cleanup()

    def page(self, name): return (self.root / name).read_text(encoding='utf-8')

    def test_legal_name_is_a_single_constant_and_unset(self):
        self.assertIsNone(hamon_page.HAMON_LEGAL_NAME)
        text = self.page('hamon.html') + self.page('index.html')
        for claim in (r'\bInc\b', r'\bLLC\b', r'registered', r'investor', r'customers?\b', r'revenue'):
            self.assertIsNone(re.search(claim, text, re.I), claim)

    def test_legal_name_appears_when_set(self):
        hamon_page.HAMON_LEGAL_NAME = 'Example Studio Ltd'
        try: self.assertIn('Example Studio Ltd', hamon_page.footer_line())
        finally: hamon_page.HAMON_LEGAL_NAME = None

    def test_hamon_leads_the_home_page_and_wildside_is_a_hamon_product(self):
        home = self.page('index.html')
        self.assertIn('FOUNDER OF HAMON', home); self.assertIn('href="hamon.html"', home)
        self.assertIn('https://jacobmetoyer.com/wildside/', home)
        self.assertIn('A HAMON world', self.page('wildside-project.html'))

    def test_private_projects_have_no_links(self):
        page = self.page('hamon.html')
        for name in ('Afterimage', 'Mechanism', 'Synapse'):
            self.assertIn(name, page)
        self.assertNotRegex(page, r'github\.com/Jacob-Met/(afterimage|mechanism|synapse|hamon-engine|wildside)')

    def test_share_images_exist_and_wildside_uses_its_thumbnail(self):
        for name in ('index.html', 'hamon.html', 'wildside-project.html', '404.html'):
            text = self.page(name)
            image = re.search(r'property="og:image" content="https://jacobmetoyer.com/([^"]+)"', text).group(1)
            self.assertTrue((self.root / image).is_file(), image)
            self.assertIn('name="twitter:image"', text)
        self.assertIn('assets/wildside/wildside-thumbnail.jpg', self.page('wildside-project.html'))

    def test_every_real_game_is_listed_and_breadth_is_present(self):
        page = self.page('hamon.html')
        for name in ('Wildside', 'Lanternwake', 'Aetherline', 'Counterpoise', 'Glasswake', 'Inkbound', 'The first game',
                     'Phantom Window', 'Replay Forge', 'Captionverse', 'Chronos Vision', 'Mechanism', 'physics engine', 'AI-native creation engine'):
            self.assertIn(name, page)
        self.assertNotIn('painterly', page.lower())

    def test_games_are_actually_in_hamon_engine_lineage(self):
        page = self.page('hamon.html')
        self.assertIn('Echo', page)
        self.assertIn('being built in the HAMON Engine', page)
        for unrelated in ('Ashen Circuit', 'Roblox Systems Foundry', 'built in Godot'):
            self.assertNotIn(unrelated, page)

    def test_sitemap_lists_hamon(self):
        self.assertIn('/hamon.html', self.page('sitemap.xml'))


if __name__ == '__main__': unittest.main()
