"""A single exact native animation example, without a new player or runtime."""
import copy, hashlib, json, shutil, tempfile, unittest
from pathlib import Path
from html.parser import HTMLParser
import build
import check
import portfolio
from engine_motion_policy import (FILES, VIDEO, POSTER, HASHES, VIDEO_ATTRIBUTES,
    SOURCE_ATTRIBUTES, VIDEO_ID, validate_motion, video_errors, source_errors)

class Elements(HTMLParser):
    def __init__(self):
        super().__init__(); self.elements=[]
    def handle_starttag(self,tag,attrs): self.elements.append((tag,dict(attrs)))

class EngineMotionStudy(unittest.TestCase):
    def test_exact_assets_and_variable_frame_timing(self):
        validate_motion(build.ROOT)
        for name in FILES:
            self.assertEqual(hashlib.sha256((build.ROOT/name).read_bytes()).hexdigest(),HASHES[name])

    def test_source_inventory_contains_only_derived_presentation_assets(self):
        allowed=json.loads((build.ROOT/'source-allowlist.json').read_text())['files']
        for name in FILES: self.assertIn(name,allowed)
        self.assertFalse(any(name.endswith('.gif') for name in allowed))

    def test_native_controls_are_exact(self):
        self.assertEqual(video_errors(VIDEO_ATTRIBUTES),[])
        for key,value in [('autoplay',None),('loop',None),('preload','auto'),('src','https://example.com/movie.mp4')]:
            attrs=dict(VIDEO_ATTRIBUTES);attrs[key]=value
            with self.subTest(key=key): self.assertTrue(video_errors(attrs))
        attrs=dict(VIDEO_ATTRIBUTES);del attrs['controls']
        self.assertTrue(video_errors(attrs))

    def test_only_exact_local_video_source(self):
        self.assertEqual(source_errors(SOURCE_ATTRIBUTES),[])
        for attrs in ({'src':'https://example.com/movie.mp4','type':'video/mp4'},
                      {'src':VIDEO,'type':'video/webm'},dict(SOURCE_ATTRIBUTES,media='all')):
            self.assertTrue(source_errors(attrs))

    def test_markup_has_no_custom_player_or_autoplay(self):
        parser=Elements();parser.feed(portfolio.engine_motion_study())
        videos=[attrs for tag,attrs in parser.elements if tag=='video']
        self.assertEqual(videos,[VIDEO_ATTRIBUTES])
        self.assertEqual([attrs for tag,attrs in parser.elements if tag=='source'],[SOURCE_ATTRIBUTES])
        self.assertFalse(any(tag in ('script','canvas','iframe','button') for tag,attrs in parser.elements))

    def test_readable_labels_and_authored_scope(self):
        markup=portfolio.engine_motion_study()
        for text in ('Without follow-through','With follow-through','Authored follow-through:',
                     'lag, overshoot, then settle.','Native animation study · 24 October 2026'):
            self.assertIn(text,markup)
        self.assertNotIn('physics simulation',markup)
        self.assertNotIn('github.com',markup)

    def test_one_example_under_make_it_respond(self):
        markup=build.render_index(json.loads((build.ROOT/'content.json').read_text()),preview=True)
        self.assertEqual(markup.count('id="'+VIDEO_ID+'"'),1)
        self.assertLess(markup.index('Make it respond.'),markup.index('class="engine-motion-study"'))
        self.assertLess(markup.index('class="engine-motion-study"'),markup.index('Build the tools, too.'))
        self.assertIn('class="engine-style-study"',markup)
        self.assertIn('class="captionverse-capture"',markup)

    def test_missing_or_changed_media_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for name in FILES:
                p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(build.ROOT/name,p)
            validate_motion(root)
            p=root/POSTER;p.write_bytes(p.read_bytes()+b'changed')
            with self.assertRaises(ValueError):validate_motion(root)
            p.unlink()
            with self.assertRaises(ValueError):validate_motion(root)

    def test_symlinked_media_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for name in FILES:
                p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.symlink_to(build.ROOT/name)
            with self.assertRaises(ValueError):validate_motion(root)

    def test_generated_page_passes_with_exact_seventh_video(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'site';build.build(out,preview=True)
            self.assertTrue(check.check(out,preview=True)['passed'])
            p=out/'lobby'/'index.html';markup=p.read_text()
            self.assertEqual(markup.count('<video '),7)
            p.write_text(markup.replace('id="engine-follow-through" controls','id="engine-follow-through" autoplay controls'))
            result=check.check(out,preview=True)
            self.assertFalse(result['passed'])
            self.assertTrue(any('manually played animation' in item for item in result['failures']))

if __name__=='__main__':unittest.main()
