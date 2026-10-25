"""Current approved Research/HAMON/Spire hierarchy and preserved public work."""
import json,re,unittest
from pathlib import Path
from html.parser import HTMLParser
import build
class ProjectOrder(unittest.TestCase):
    def test_current_hierarchy_and_supported_copy(self):
        data=json.loads((build.ROOT/'content.json').read_text()); markup=build.render_index(data, preview=True)
        self.assertEqual([d['id'] for d in data['demos']], ['towerops-airspace','recallweave'])
        for name in ('Research','HAMON','Spire of Octaves','Jacob<br>Metoyer'): self.assertIn(name,markup)
        self.assertLess(markup.index('href="#research" class="destination destination-research"'),markup.index('id="hamon"'))
        self.assertLess(markup.index('id="hamon"'),markup.index('href="https://spireofoctaves.com/" class="destination destination-spire"'))
        self.assertLess(markup.index('id="towerops-airspace"'),markup.index('id="recallweave"'))
        for bad in ('aetherline','returnby','longwater','3,365','zero-mismatch'): self.assertNotIn(bad,markup.lower())
        self.assertIn('Synthetic demo, not operational ATC.',markup)
        self.assertIn('https://spireofoctaves.com/',markup)
        self.assertNotIn('contest submission',markup.lower())
        ids=re.findall(r'\bid="([^"]+)"',markup); self.assertEqual(len(ids),len(set(ids)))

    def test_room_heading_text_content_has_word_boundaries(self):
        class HeadingText(HTMLParser):
            def __init__(self):
                super().__init__(); self.sections=[]; self.active=None; self.text=[]; self.headings={}
            def handle_starttag(self, tag, attrs):
                if tag=='section': self.sections.append(dict(attrs).get('id'))
                if tag=='h2': self.active=self.sections[-1] if self.sections else None; self.text=[]
            def handle_data(self, data):
                if self.active is not None: self.text.append(data)
            def handle_endtag(self, tag):
                if tag=='h2' and self.active is not None:
                    self.headings.setdefault(self.active,''.join(self.text)); self.active=None
                if tag=='section': self.sections.pop()
        parser=HeadingText(); parser.feed(build.render_index(json.loads((build.ROOT/'content.json').read_text()),preview=True))
        self.assertEqual(parser.headings['hackathons'],'One constraint. A working idea.')
        self.assertEqual(parser.headings['projects'],'Use it. Change something.')

    def test_current_local_work_descriptions_keep_publication_boundaries(self):
        data=json.loads((build.ROOT/'experience-content.json').read_text())
        stories={x['projectId']:x for x in data['projectStories']}; related={x['id']:x for x in data['relatedWork']}
        self.assertIn('Compose and save your own local scenarios',stories['domino']['capability'])
        self.assertIn('same-computer rehearsal',related['threshold']['description'])
        self.assertIn('no external delivery',related['threshold']['limit'])
        self.assertNotIn('wild-neighbors',related); wild=related['wildside']
        self.assertIn('human, bird, and insect',wild['description']); self.assertIn('Kyoto city model',wild['description'])
        self.assertIsNone(wild['publicSourceUrl']); self.assertEqual(wild['relatedTo'],'phantom-window')
        self.assertIn('not automatic reconstruction',wild['limit'])
        captions=stories['captionverse']; self.assertEqual(captions['question'],'What if the film waited for you?')
        self.assertIn('complete dialogue visible',captions['opening']); self.assertIn('until you choose to continue',captions['opening'])
        self.assertIn('original subtitle bytes separate',captions['capability']); self.assertIn('do not verify identity',captions['limit'])
        self.assertTrue(captions['limit'].startswith('Local prototype.')); self.assertEqual(captions['stage'],'Local prototype'); self.assertEqual(captions['previewMode'],'Captured examples')
