"""Exact existing public Spire artwork, kept distinct from native Engine output."""
import hashlib,json,shutil,tempfile,unittest
from html.parser import HTMLParser
import build
from pathlib import Path
from site_policy import EDITORIAL_ART,EDITORIAL_FILES,validate_editorial
ROOT=Path(__file__).parent
class EditorialArtwork(unittest.TestCase):
 def test_exact_public_artwork_and_dimensions(self):
  validate_editorial(ROOT)
  self.assertEqual(EDITORIAL_FILES,('assets/editorial/spire-world.webp',))
  r=EDITORIAL_ART[EDITORIAL_FILES[0]]
  self.assertEqual((r['width'],r['height']),(1200,675))
  self.assertEqual(r['sourceUrl'],'https://spireofoctaves.com/assets/hero-1200.webp')
  self.assertLess((ROOT/EDITORIAL_FILES[0]).stat().st_size,65000)
 def test_missing_altered_and_symlinked_art_denied(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);p=root/EDITORIAL_FILES[0];p.parent.mkdir(parents=True)
   with self.assertRaises(ValueError):validate_editorial(root)
   p.write_bytes((ROOT/EDITORIAL_FILES[0]).read_bytes()+b'altered')
   with self.assertRaises(ValueError):validate_editorial(root)
   p.unlink();p.symlink_to(ROOT/EDITORIAL_FILES[0])
   with self.assertRaises(ValueError):validate_editorial(root)
 def test_direct_spire_invitation_is_not_a_local_room(self):
  class Links(HTMLParser):
   def __init__(self,html):super().__init__();self.links=[];self.current=None;self.feed(html)
   def handle_starttag(self,tag,attrs):
    if tag=='a':self.current={'attrs':dict(attrs),'images':[],'text':''};self.links.append(self.current)
    elif tag=='img' and self.current is not None:self.current['images'].append(dict(attrs))
   def handle_data(self,text):
    if self.current is not None:self.current['text']+=text
   def handle_endtag(self,tag):
    if tag=='a':self.current=None
  html=build.render_index(json.loads((ROOT/'content.json').read_text()),preview=True)
  links=[a for a in Links(html).links if 'destination-spire' in a['attrs'].get('class','').split()]
  self.assertEqual(len(links),1);link=links[0]
  self.assertEqual(link['attrs']['href'],'https://spireofoctaves.com/')
  self.assertIn('Cities stacked on cities.',link['text'])
  self.assertEqual(len(link['images']),1);img=link['images'][0]
  self.assertEqual(img['src'],EDITORIAL_FILES[0]);self.assertEqual(img['loading'],'lazy')
  self.assertIn('Artwork from the Spire of Octaves site',img['alt'])
  self.assertNotIn('data-engine',link['attrs']);self.assertNotIn('id="spire"',html)
  self.assertIn('Forge rendered with HAMON Engine',html)
 def test_only_three_route_helpers_remain(self):
  d=json.loads((ROOT/'script-allowlist.json').read_text())
  self.assertEqual(d['entries'],['lobby-journey.js','scene-handoff.js','lobby.js'])
  self.assertEqual(d['sha256']['lobby.js'],hashlib.sha256((ROOT/'lobby.js').read_bytes()).hexdigest())
  self.assertIn('Forge rendered with HAMON Engine',(ROOT/'lobby.js').read_text())
if __name__=='__main__':unittest.main()
