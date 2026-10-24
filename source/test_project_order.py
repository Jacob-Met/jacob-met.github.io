"""Current approved Research/HAMON/Spire hierarchy and preserved public work."""
import json,re,unittest
from pathlib import Path
import build
class ProjectOrder(unittest.TestCase):
    def test_current_hierarchy_and_supported_copy(self):
        data=json.loads((build.ROOT/'content.json').read_text()); markup=build.render_index(data)
        self.assertEqual([d['id'] for d in data['demos']], ['towerops-airspace','recallweave'])
        for name in ('Research','HAMON','Spire of Octaves','Jacob Metoyer'): self.assertIn(name,markup)
        self.assertLess(markup.index('class="world research"'),markup.index('id="hamon"'))
        self.assertLess(markup.index('id="hamon"'),markup.index('class="world spire"'))
        self.assertLess(markup.index('id="towerops-airspace"'),markup.index('id="recallweave"'))
        for bad in ('aetherline','returnby','longwater','3,365','zero-mismatch'): self.assertNotIn(bad,markup.lower())
        self.assertIn('Synthetic demo, not operational ATC.',markup)
        self.assertIn('https://spireofoctaves.com/',markup)
        self.assertNotIn('contest submission',markup.lower())
        ids=re.findall(r'\bid="([^"]+)"',markup); self.assertEqual(len(ids),len(set(ids)))
