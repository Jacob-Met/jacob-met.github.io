import copy, json, re, tempfile, unittest
from pathlib import Path
import build
from check import check

class Polish(unittest.TestCase):
    def setUp(self): self.data=json.loads((build.ROOT/'content.json').read_text())
    def test_missing_capture_refused(self):
        self.data['engine']['slot']['shot']['src']='assets/demos/missing.webp'
        with self.assertRaises(ValueError): build.validate(self.data)
    def test_false_capture_dimensions_refused(self):
        self.data['engine']['slot']['shot']['w']=999
        with self.assertRaises(ValueError): build.validate(self.data)
    def test_no_new_routes_sections_or_runtime(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'site';build.build(out,self.data)
            self.assertEqual({p.name for p in out.glob('*.html')},{'index.html','404.html'})
            markup=(out/'index.html').read_text()
            self.assertEqual(re.findall(r'<section[^>]*id="([^"]+)"',markup),[s[0] for s in build.SECTIONS])
            self.assertEqual([d['id'] for d in self.data['demos']],['towerops-airspace','recallweave'])
            self.assertTrue(check(out)['passed'])
            for source in (build.ROOT/'games/lanternwake').iterdir():
                self.assertEqual(source.read_bytes(),(out/'games/lanternwake'/source.name).read_bytes())
            for forbidden in ['goal_', 'PR #', 'Raider', 'LA7', 'gateway', 'Clockwork Saint', 'A Dry Crossing']:
                self.assertNotIn(forbidden,markup)
    def test_share_card_has_twitter_image(self):
        markup=build.page_html('index.html',build.TITLE,build.DESC,build.render_index(self.data),self.data)
        self.assertIn('<meta name="twitter:image"',markup)
