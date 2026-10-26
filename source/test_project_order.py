"""Current approved Research/HAMON/Spire hierarchy and preserved public work."""
import json,re,unittest
from pathlib import Path
from html.parser import HTMLParser
import build
class ForgeNavigation(HTMLParser):
    """Read the semantic entrance links, not viewport-specific beacon positions."""
    def __init__(self, markup, names=('forge-routes','forge-editorial')):
        super().__init__(); self.names=names; self.navs=[]; self.groups={}; self.group_attrs={}; self.current=None; self.feed(markup)
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag=='nav':
            group=next((name for name in self.names if name in attrs.get('class','').split()),None)
            self.navs.append(group)
            if group is not None:
                self.groups.setdefault(group,[]);self.group_attrs[group]=attrs
        if tag=='a' and self.navs and self.navs[-1] is not None:
            self.current={'attrs':attrs,'text':''};self.groups[self.navs[-1]].append(self.current)
    def handle_data(self, data):
        if self.current is not None:self.current['text']+=data
    def handle_endtag(self, tag):
        if tag=='a':self.current=None
        if tag=='nav':self.navs.pop()

class ProjectOrder(unittest.TestCase):
    def test_current_hierarchy_and_supported_copy(self):
        data=json.loads((build.ROOT/'content.json').read_text()); markup=build.render_index(data, preview=True)
        self.assertEqual([d['id'] for d in data['demos']], ['towerops-airspace','recallweave'])
        for name in ('Research','HAMON','Spire of Octaves','Jacob<br>Metoyer'): self.assertIn(name,markup)
        parsed=ForgeNavigation(markup);navigation=parsed.groups
        self.assertEqual(set(navigation),{'forge-routes','forge-editorial'})
        for attrs in parsed.group_attrs.values():
            self.assertTrue(attrs.get('aria-label'));self.assertNotIn('hidden',attrs)
            self.assertNotEqual(attrs.get('aria-hidden'),'true')
        routes=navigation['forge-routes'];editorial=navigation['forge-editorial']
        self.assertEqual([a['attrs']['href'] for a in routes],['#engine','#hackathons','#projects'])
        self.assertEqual([a['attrs']['href'] for a in editorial],['wildside-project.html','https://spireofoctaves.com/','#research'])
        self.assertEqual([' '.join(a['text'].split()).strip('↗→ ') for a in routes+editorial],
                         ['Engine','Hackathons','Projects','Wildside','Spire of Octaves','Research'])
        self.assertIn('data-engine',routes[0]['attrs'])
        for link in routes[1:]+editorial:
            self.assertNotIn('data-engine',link['attrs']);self.assertNotIn('data-home',link['attrs'])
        for link in routes+editorial:
            self.assertNotIn('hidden',link['attrs']);self.assertNotEqual(link['attrs'].get('aria-hidden'),'true')
            self.assertNotEqual(link['attrs'].get('tabindex'),'-1')
        self.assertIn('href="hamon.html"',markup)
        self.assertIn('id="hamon"',markup)
        self.assertLess(markup.index('id="towerops-airspace"'),markup.index('id="recallweave"'))
        for bad in ('aetherline','returnby','longwater','3,365','zero-mismatch'): self.assertNotIn(bad,markup.lower())
        self.assertIn('Synthetic demo, not operational ATC.',markup)
        self.assertIn('https://spireofoctaves.com/',markup)
        self.assertNotIn('contest submission',markup.lower())
        ids=re.findall(r'\bid="([^"]+)"',markup); self.assertEqual(len(ids),len(set(ids)))

    def test_spatial_landmarks_only_describe_the_three_recorded_routes(self):
        markup=build.render_index(json.loads((build.ROOT/'content.json').read_text()),preview=True)
        beacons=ForgeNavigation(markup,('scene-portals',)).groups['scene-portals']
        self.assertEqual([a['attrs']['href'] for a in beacons],['#engine','#hackathons','#projects'])
        self.assertEqual([a['attrs']['aria-label'] for a in beacons],
                         ['Engine, at the hearth','Hackathons, at the anvil','Projects, at the workbench'])
        self.assertIn('data-engine',beacons[0]['attrs'])
        self.assertNotIn('beacon-wildside',markup);self.assertNotIn('beacon-spire',markup)
        self.assertNotIn('beacon-research',markup)

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
