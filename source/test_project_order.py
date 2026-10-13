import json
import re
import unittest
from pathlib import Path
import build

class ProjectOrder(unittest.TestCase):
    def test_jacob_requested_order_and_copy(self):
        data = json.loads(Path(__file__).with_name('content.json').read_text())
        markup = build.render_index(data)
        self.assertEqual(markup.count('>Hamon Engine</h2>'), 1)
        self.assertEqual(markup.count('>Lanternwake</h3>'), 1)
        self.assertNotIn('aetherline', markup.lower())
        self.assertNotIn('returnby', markup.lower())
        self.assertEqual([d['id'] for d in data['demos']], ['towerops-airspace', 'recallweave'])
        self.assertLess(markup.index('id="more"'), markup.index('id="worlds"'))
        self.assertLess(markup.index('id="worlds"'), markup.index('id="about"'))
        self.assertNotIn('devpost', markup[markup.index('id="demo-towerops-airspace"'):markup.index('id="demo-recallweave"')].lower())
        self.assertNotIn('longwater', markup.lower())
        self.assertEqual(data['demos'][0]['name'], 'TowerOps Airspace Lab')
        self.assertIn('Synthetic demo, not operational ATC.', markup)
        self.assertNotIn('3,365', markup)
        self.assertNotIn('zero-mismatch', markup)
        self.assertLess(markup.index('id="engine"'), markup.index('id="demo-towerops-airspace"'))
        self.assertLess(markup.index('id="demo-towerops-airspace"'), markup.index('id="demo-recallweave"'))
        self.assertLess(markup.index('id="more"'), markup.index('id="game-spire-of-octaves"'))
        spire = next(g for g in data['games'] if g['id'] == 'spire-of-octaves')
        self.assertEqual(spire['line'], 'My own world, told through stories, music, games and animation. A vertical world born from an unfinished sacred song, where matter remembers intent and new floors are still being composed beneath the people who live there. Its first story, *Seamwork*, is a short story published on Royal Road.')
        self.assertIn('<em>Seamwork</em>', markup)
        ids = re.findall(r'\bid="([^"]+)"', markup)
        self.assertEqual(len(ids), len(set(ids)))
