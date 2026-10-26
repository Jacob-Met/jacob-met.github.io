"""Exact attributed browser-capture bytes; no product/browser/deployment claim."""
import copy
import json
import shutil
import struct
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path

import build
import check
import portfolio
from site_policy import CAPTIONVERSE_CAPTURES, CAPTIONVERSE_FILES, captionverse_picture_source_errors, validate_captionverse_captures

ROOT = Path(__file__).resolve().parent


class CaptureTree(HTMLParser):
    def __init__(self):
        super().__init__(); self.stack = []; self.figures = []; self.links = []; self.sources = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'figure' and attrs.get('class') == 'captionverse-capture':
            self.figures.append(list(self.stack))
        if tag == 'a': self.links.append(attrs)
        if tag == 'source': self.sources.append(attrs)
        if tag not in {'source','img','br','meta','link','input'}: self.stack.append((tag, attrs))
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i][0] == tag:
                del self.stack[i:]; return


class CaptionverseCapture(unittest.TestCase):
    def test_exact_original_png_bytes_and_dimensions(self):
        validate_captionverse_captures(ROOT)
        for record in CAPTIONVERSE_CAPTURES.values():
            raw=(ROOT/record['src']).read_bytes()
            self.assertEqual(struct.unpack_from('>II',raw,16),(record['width'],record['height']))

    def test_originals_contain_no_text_or_exif_metadata(self):
        for record in CAPTIONVERSE_CAPTURES.values():
            raw=(ROOT/record['src']).read_bytes(); offset=8
            while offset<len(raw):
                size=struct.unpack_from('>I',raw,offset)[0]; kind=raw[offset+4:offset+8]
                self.assertIn(kind,{b'IHDR',b'IDAT',b'IEND'})
                offset+=12+size
            self.assertEqual(offset,len(raw))

    def test_picture_and_local_images_pass_exact_checker(self):
        parser=check.Page(figures={'context':{'src':'assets/figures/worldlaw-computed.svg'}})
        parser.feed(portfolio.captionverse_capture())
        self.assertEqual(parser.errors,[])
        self.assertEqual(set(parser.resources),set(CAPTIONVERSE_FILES))

    def test_picture_source_does_not_admit_alternates(self):
        tree=CaptureTree(); tree.feed(portfolio.captionverse_capture()); attrs=tree.sources[0]
        self.assertEqual(captionverse_picture_source_errors(attrs),[])
        for key,value in [('media','(max-width: 600px)'),('type','image/svg+xml'),('width','391'),('srcset','https://example.com/capture.png')]:
            changed=dict(attrs); changed[key]=value
            self.assertTrue(captionverse_picture_source_errors(changed),key)

    def test_unknown_png_and_wrong_dimensions_stay_rejected(self):
        for src,width in [('assets/demos/unreviewed.png','1440'),(CAPTIONVERSE_CAPTURES['desktop']['src'],'1439')]:
            parser=check.Page(); parser.feed(f'<img src="{src}" width="{width}" height="1000" alt="Capture">')
            self.assertTrue(parser.errors)

    def test_changed_capture_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            for record in CAPTIONVERSE_CAPTURES.values():
                target=root/record['src'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/record['src'],target)
            target=root/CAPTIONVERSE_CAPTURES['desktop']['src'];raw=target.read_bytes();target.write_bytes(raw[:-1]+bytes([raw[-1]^1]))
            with self.assertRaisesRegex(ValueError,'checksum'): validate_captionverse_captures(root)

    def test_only_inside_existing_closed_captionverse_disclosure(self):
        record=json.loads((ROOT/'content.json').read_text()); experience=json.loads((ROOT/'experience-content.json').read_text())
        output=portfolio.projects_section({},record,experience)
        tree=CaptureTree();tree.feed(output);self.assertEqual(len(tree.figures),1)
        ancestors=tree.figures[0]
        self.assertIn(('article',{'class':'research-entry','id':'captionverse','tabindex':'-1'}),ancestors)
        self.assertGreaterEqual(sum(tag=='details' for tag,_ in ancestors),2)
        self.assertTrue(all('open' not in attrs for tag,attrs in ancestors if tag=='details'))
        self.assertNotIn('captionverse-capture',portfolio.TEMPLATE)

    def test_caption_is_real_text_and_dates_a_static_prototype(self):
        markup=portfolio.captionverse_capture()
        for text in ['The video has paused','complete passage stays visible','Reading-pause detail','23 Oct 2026','local prototype','static browser capture','200% reading text']:
            self.assertIn(text,markup)
        self.assertIn('with a Continue video button',markup)
        self.assertNotIn('beside a Continue video button',markup)
        for private in ['github.com','/tmp/','aedd749','4cf7ee1','receipt.json']:
            self.assertNotIn(private,markup)

    def test_film_credit_license_link_and_changes_are_visible(self):
        markup=portfolio.captionverse_capture();tree=CaptureTree();tree.feed(markup)
        self.assertIn({'href':'https://creativecommons.org/licenses/by/3.0/','rel':'license'},tree.links)
        self.assertTrue(any(a.get('href')=='https://mango.blender.org/' for a in tree.links))
        for text in ['Tears of Steel','Blender Foundation','44-second excerpt (3:12–3:56), trimmed and re-encoded','Desktop shown as a detail; original captures unchanged']:
            self.assertIn(text,markup)

    def test_full_original_capture_links(self):
        tree=CaptureTree();tree.feed(portfolio.captionverse_capture())
        for path in CAPTIONVERSE_FILES:
            self.assertTrue(any(a.get('href')==path and 'full' in a.get('aria-label','') for a in tree.links))

    def test_scoped_css_and_phone_breakpoint_agree(self):
        css=(ROOT/'experience.css').read_text();markup=portfolio.captionverse_capture()
        self.assertIn('@media(max-width:800px)',css);self.assertIn('(max-width: 800px)',markup)
        self.assertIn('.captionverse-capture-frame{max-width:260px;aspect-ratio:390/900}',css)
        self.assertIn('aspect-ratio:1060/470',css)
        self.assertIn('.captionverse-capture-frame picture{display:block}',css)
        self.assertAlmostEqual(1060*1.35849056604,1440,places=5)
        self.assertAlmostEqual(1060*.17924528302,190,places=5)
        self.assertEqual(1060*.5,530)

    def test_build_inventory_explicitly_includes_only_two_captures(self):
        from lobby_policy import load_lobby
        from branch_policy import load_branches
        from figure_policy import load_figures
        record=json.loads((ROOT/'content.json').read_text())
        paths=build.output_files(record,load_lobby(ROOT,allow_private_preview=True),load_figures(ROOT),load_branches(ROOT,allow_private_preview=True))
        self.assertTrue(set(CAPTIONVERSE_FILES)<=paths)
        self.assertEqual({p for p in paths if 'captionverse' in p},set(CAPTIONVERSE_FILES))
        publication=json.loads((ROOT/'source-allowlist.json').read_text())['files']
        self.assertTrue(set(CAPTIONVERSE_FILES)<=set(publication))
        self.assertIn('test_captionverse_capture.py',publication)


if __name__=='__main__':unittest.main()
