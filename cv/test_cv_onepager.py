import copy, io, json, sys, tempfile, unittest, zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cv_onepager as cv

pypdf = __import__('pypdf')
docx = __import__('docx')


class CV(unittest.TestCase):
    def setUp(self):
        self.rec = cv.load()
        self.m = cv.model(self.rec)

    def test_deterministic_bytes(self):
        self.assertEqual(cv.render_pdf(self.m), cv.render_pdf(self.m))
        self.assertEqual(cv.render_docx(self.m), cv.render_docx(self.m))

    def test_generate_twice_same_hashes(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            self.assertEqual(cv.generate(cv.DEFAULT_CONTENT, Path(a)), cv.generate(cv.DEFAULT_CONTENT, Path(b)))

    def test_pdf_one_page_and_complete(self):
        r = pypdf.PdfReader(io.BytesIO(cv.render_pdf(self.m)))
        self.assertEqual(len(r.pages), 1)
        text = ' '.join(r.pages[0].extract_text().split())
        for t in [self.rec['name']] + [p['title'] for p in self.rec['projects']] + [x['title'] for x in self.rec['research']]:
            self.assertIn(t, text)
        self.assertIn('self-reported', text)
        self.assertTrue(any('github.com/Jacob-Met' in (a.get_object().get('/A', {}).get('/URI') or '')
                            for a in (r.pages[0].get('/Annots') or [])))

    def test_docx_contains_record_and_fits_a_page_budget(self):
        d = docx.Document(io.BytesIO(cv.render_docx(self.m)))
        text = '\n'.join(p.text for p in d.paragraphs)
        for t in [self.rec['name']] + [p['title'] for p in self.rec['projects']] + [x['title'] for x in self.rec['research']]:
            self.assertIn(t, text)
        # conservative one-page guard: < 7,000 characters at 8-9pt on Letter with 0.5in margins
        self.assertLess(len(text), 7000)

    def test_docx_zip_is_normalised(self):
        z = zipfile.ZipFile(io.BytesIO(cv.render_docx(self.m)))
        self.assertTrue(all(i.date_time == cv.FIXED_ZIP_TIME for i in z.infolist()))
        self.assertEqual(z.namelist()[0], '[Content_Types].xml')

    def test_refuses_non_public(self):
        r = copy.deepcopy(self.rec); r['visibility'] = 'private'
        with self.assertRaises(cv.RecordError): cv.model(r)

    def test_refuses_unsourced_claim(self):
        r = copy.deepcopy(self.rec); r['research'][0]['sources'] = []
        with self.assertRaises(cv.RecordError): cv.model(r)

    def test_refuses_offsite_link(self):
        r = copy.deepcopy(self.rec); r['projects'][0]['artifacts'][0]['url'] = 'https://example.com/x'
        with self.assertRaises(cv.RecordError): cv.model(r)
        r = copy.deepcopy(self.rec); r['identities'][0]['url'] = 'http://github.com/Jacob-Met'
        with self.assertRaises(cv.RecordError): cv.model(r)

    def test_cli_refusal_exit_code_and_no_output(self):
        r = copy.deepcopy(self.rec); r['visibility'] = 'private'
        with tempfile.TemporaryDirectory() as t:
            p = Path(t) / 'c.json'; p.write_text(json.dumps(r))
            self.assertEqual(cv.main(['--content', str(p), '--out', str(Path(t) / 'o')]), 2)
            self.assertFalse((Path(t) / 'o').exists())


if __name__ == '__main__':
    unittest.main()
