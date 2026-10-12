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
            self.assertIn(line, about)
            self.assertIn(line, readme)

    def test_platform_lengths(self):
        self.assertLessEqual(len(self.p['github']['bio']), 160)
        self.assertLessEqual(len(self.p['linkedin']['headline']), 220)
        self.assertLessEqual(len(gen.outputs(self.p, self.c)[1]), 2600)

    def test_limits_survive_rendering(self):
        _, about, readme = gen.outputs(self.p, self.c)
        for text in (about, readme):
            for caveat in ('not operational ATC', 'not a safety forecast', 'private engine source', 'not a production-capacity benchmark', 'synthetic demos'):
                self.assertIn(caveat, text)
        for draft in ('ReplayForge', 'EVIDENCEGRAPH', 'TestPilot'):
            self.assertNotIn(draft, about)

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
