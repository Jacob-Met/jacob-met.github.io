"""Computed figures are inert, explicitly labeled, exact local resources."""
import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from figure_policy import load_figures, picture_source_errors

SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="480" viewBox="0 0 1000 480"><title id="title">Computed model</title><desc id="desc">Not a screenshot.</desc><path d="M0 0L1 1"/></svg>'

class FigurePolicy(unittest.TestCase):
    def fixture(self, root):
        path='assets/figures/recallweave-computed.svg'; p=root/path; p.parent.mkdir(parents=True);p.write_text(SVG)
        r=dict(src=path,width=1000,height=480,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),alt='Two computed traces.',label='Computed feedback model')
        return dict(schema=1,figures={'recallweave':r})
    def write(self,root,data): (root/'project-figures.json').write_text(json.dumps(data))
    def test_optional_and_exact(self):
        with tempfile.TemporaryDirectory() as tmp:
            r=Path(tmp);self.assertEqual(load_figures(r),{})
            data=self.fixture(r);self.write(r,data);self.assertEqual(load_figures(r),data['figures'])
    def test_wrong_paths_labels_and_dimensions(self):
        with tempfile.TemporaryDirectory() as tmp:
            r=Path(tmp);base=self.fixture(r)
            for change in ({'src':'https://example.org/a.svg'},{'width':640},{'label':'Browser screenshot'},{'sha256':'0'*64},{'extra':'x'}):
                d=copy.deepcopy(base);d['figures']['recallweave'].update(change);self.write(r,d)
                with self.subTest(change=change),self.assertRaises(ValueError):load_figures(r)
    def test_active_svg_rejected_even_when_rehashed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);data=self.fixture(root);record=data['figures']['recallweave'];p=root/record['src']
            for tag in ('<script/>','<image href="https://example.org/a.png"/>','<use href="#title"/>','<style/>','<?xml-stylesheet href="remote"?>','<!DOCTYPE svg>','<path fill="url(https://example.org)"/>','<path onload="x()"/>'):
                raw=SVG.replace('</svg>',tag+'</svg>');p.write_text(raw);record['sha256']=hashlib.sha256(p.read_bytes()).hexdigest();self.write(root,data)
                with self.subTest(tag=tag),self.assertRaises(ValueError):load_figures(root)
    def test_picture_exact_declared_mobile_only(self):
        figures={'recallweave':{'mobile':dict(src='assets/figures/recallweave-computed-mobile.svg',width=640,height=520)}}
        a=dict(media='(max-width: 800px)',srcset=figures['recallweave']['mobile']['src'],type='image/svg+xml',width='640',height='520')
        self.assertEqual(picture_source_errors(a,figures),[])
        for change in ({'media':'all'},{'srcset':'https://example.org/x.svg'},{'src':'x.svg'},{'width':'1000'}):
            b=dict(a);b.update(change);self.assertTrue(picture_source_errors(b,figures))

if __name__=='__main__':unittest.main()
