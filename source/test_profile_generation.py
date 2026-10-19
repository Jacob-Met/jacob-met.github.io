import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location('profile_generation', ROOT / 'profile' / 'generate.py')
assert spec is not None and spec.loader is not None
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)

# Independent of presence.json / README.md so equally stale source+generated cannot pass.
APPROVED_FEATURED_WORK = (
    {
        'name': 'TowerOps',
        'url': 'https://jacobmetoyer.com/TowerOps/airspace/',
        'line': 'Synthetic airspace workbench with approval and readback gates; not operational ATC.',
    },
    {
        'name': 'RecallWeave',
        'url': 'https://jacobmetoyer.com/RecallWeave/explore.html',
        'line': 'Offline learning toolkit with visible Bayesian estimates, lesson authoring and interactive labs; no measured learning-gain claim.',
    },
    {
        'name': 'Lanternwake',
        'url': 'https://jacobmetoyer.com/games/lanternwake/',
        'line': 'Hamon Engine browser game: restore three lanterns on a small 3D island and return to the arch at dawn. WebGPU required, keyboard and touch; private engine source.',
    },
    {
        'name': 'Multi-agent Fan-out Engine',
        'url': 'https://github.com/Jacob-Met/multi-agent-fanout-engine',
        'line': 'Sanitized reference core for dependency planning and dispatch reconciliation; not a production-capacity benchmark.',
    },
    {
        'name': 'ShadeWindow',
        'url': 'https://devpost.com/software/shadewindow',
        'line': 'Submitted historical heat-index replay demo; not a safety forecast.',
    },
    {
        'name': 'Spire of Octaves',
        'url': 'https://spireofoctaves.com/',
        'line': 'My own fiction world, told through stories, music, games and animation.',
    },
)

APPROVED_PUBLIC_WORK_TABLE = (
    '| Project | What you can inspect |\n'
    '|---|---|\n'
    '| [**TowerOps**](https://jacobmetoyer.com/TowerOps/airspace/) | Synthetic airspace workbench with approval and readback gates; not operational ATC. |\n'
    '| [**RecallWeave**](https://jacobmetoyer.com/RecallWeave/explore.html) | Offline learning toolkit with visible Bayesian estimates, lesson authoring and interactive labs; no measured learning-gain claim. |\n'
    '| [**Lanternwake**](https://jacobmetoyer.com/games/lanternwake/) | Hamon Engine browser game: restore three lanterns on a small 3D island and return to the arch at dawn. WebGPU required, keyboard and touch; private engine source. |\n'
    '| [**Multi-agent Fan-out Engine**](https://github.com/Jacob-Met/multi-agent-fanout-engine) | Sanitized reference core for dependency planning and dispatch reconciliation; not a production-capacity benchmark. |\n'
    '| [**ShadeWindow**](https://devpost.com/software/shadewindow) | Submitted historical heat-index replay demo; not a safety forecast. |\n'
    '| [**Spire of Octaves**](https://spireofoctaves.com/) | My own fiction world, told through stories, music, games and animation. |\n'
)


class ProfileGeneration(unittest.TestCase):
    def setUp(self):
        self.p = json.loads((ROOT / 'presence.json').read_text(encoding='utf-8'))
        self.c = json.loads((ROOT / 'content.json').read_text(encoding='utf-8'))

    def test_current_outputs_match_one_source(self):
        paragraphs, about, readme = gen.outputs(self.p, self.c)
        self.assertEqual(paragraphs, self.c['about']['lines'])
        self.assertEqual(about, self.p['linkedin']['about'])
        self.assertEqual(readme, (ROOT / 'profile' / 'README.md').read_text(encoding='utf-8'))
        for line in paragraphs:
            self.assertIn(line, readme)

    def test_platform_lengths(self):
        self.assertLessEqual(len(self.p['github']['bio']), 160)
        self.assertLessEqual(len(self.p['linkedin']['headline']), 220)
        self.assertIsNone(gen.outputs(self.p, self.c)[1])
        self.assertEqual(self.p['linkedin']['about_owner'], 'Jacob')

    def test_limits_survive_rendering(self):
        _, about, readme = gen.outputs(self.p, self.c)
        for text in (readme,):
            for caveat in ('not operational ATC', 'not a safety forecast', 'private engine source', 'not a production-capacity benchmark', 'synthetic demos'):
                self.assertIn(caveat, text)
        for draft in ('ReplayForge', 'EVIDENCEGRAPH', 'TestPilot'):
            self.assertNotIn(draft, readme)

    def test_approved_featured_inventory_is_independent_fixture(self):
        featured = self.p['identity']['featured_work']
        self.assertEqual(
            [(p['name'], p['url'], p['line']) for p in featured],
            [(p['name'], p['url'], p['line']) for p in APPROVED_FEATURED_WORK],
        )
        _, _, readme = gen.outputs(self.p, self.c)
        self.assertIn(APPROVED_PUBLIC_WORK_TABLE, readme)
        self.assertEqual(readme, (ROOT / 'profile' / 'README.md').read_text(encoding='utf-8'))
        public_work = readme.split('### Public work', 1)[1].split('### More research tooling', 1)[0]
        self.assertNotIn('ReturnBy', public_work)
        self.assertNotIn('Aetherline', public_work)
        self.assertNotIn('/games/aetherline/', public_work)
        self.assertNotIn('https://jacobmetoyer.com/returnby/', public_work)

    def test_oversized_copy_refused(self):
        bad = copy.deepcopy(self.p)
        bad['identity']['about_paragraphs'][0] = 'x' * 401
        with self.assertRaises(ValueError):
            gen.outputs(bad, self.c)

    def test_offsite_unencrypted_link_refused(self):
        bad = copy.deepcopy(self.p)
        bad['identity']['featured_work'][0]['url'] = 'http://example.com/'
        with self.assertRaises(ValueError):
            gen.outputs(bad, self.c)


if __name__ == '__main__':
    unittest.main()
