import copy,json,tempfile,unittest
from pathlib import Path
import build
from check import check

class SiteTests(unittest.TestCase):
    def setUp(self):self.data=json.loads((build.ROOT/'content.json').read_text(encoding='utf-8'))
    def test_approved_record(self):build.validate(self.data)
    def test_private_root_denied(self):
        self.data['visibility']='private'
        with self.assertRaises(ValueError):build.validate(self.data)
    def test_private_work_denied(self):
        self.data['work'][0]['visibility']='private'
        with self.assertRaises(ValueError):build.validate(self.data)
    def test_unapproved_work_denied(self):
        self.data['work'][0]['publication_approved']=False
        with self.assertRaises(ValueError):build.validate(self.data)
    def test_string_approval_denied(self):
        self.data['work'][0]['publication_approved']='true'
        with self.assertRaises(ValueError):build.validate(self.data)
    def test_identity_drift_denied(self):
        self.data['name']='Another person'
        with self.assertRaises(ValueError):build.validate(self.data)
    def test_duplicate_id_denied(self):
        self.data['work'].append(copy.deepcopy(self.data['work'][0]))
        with self.assertRaises(ValueError):build.validate(self.data)
    def test_bad_id_denied(self):
        self.data['work'][0]['id']='../secret'
        with self.assertRaises(ValueError):build.validate(self.data)
    def test_unknown_route_denied(self):
        self.data['work'][0]['route']='https://example.com'
        with self.assertRaises(ValueError):build.validate(self.data)
    def test_unknown_category_denied(self):
        self.data['work'][0]['category']='unreviewed'
        with self.assertRaises(ValueError):build.validate(self.data)
    def test_script_url_denied(self):
        with self.assertRaises(ValueError):build.safe_url('javascript:alert(1)')
    def test_credential_url_denied(self):
        with self.assertRaises(ValueError):build.safe_url('https://me:password@github.com/foo')
    def test_unknown_host_denied(self):
        with self.assertRaises(ValueError):build.safe_url('https://github.com.evil.example/foo')
    def test_query_data_denied(self):
        with self.assertRaises(ValueError):build.safe_url('https://github.com/foo?secret=example')
    def test_title_and_body_are_escaped(self):
        row=copy.deepcopy(self.data['work'][0]);row['title']='<script>alert(1)</script>';row['summary']='<img src=x onerror=alert(1)>'
        text=build.card(row)
        self.assertNotIn('<script>',text);self.assertNotIn('<img src=x',text);self.assertIn('&lt;script&gt;',text)
    def test_unknown_root_fields_denied(self):
        self.data['private_notes']='not a public field'
        with self.assertRaises(ValueError):build.validate(self.data)
    def test_unknown_work_fields_denied(self):
        self.data['work'][0]['private_path']='do not publish'
        with self.assertRaises(ValueError):build.validate(self.data)
    def test_unknown_link_fields_denied(self):
        self.data['identities'][0]['private_note']='do not publish'
        with self.assertRaises(ValueError):build.validate(self.data)
    def test_rebuild_is_deterministic(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'out';build.build(p,self.data);a=(p/'build-manifest.json').read_bytes();build.build(p,self.data);self.assertEqual(a,(p/'build-manifest.json').read_bytes())
    def test_unexpected_output_file_denied(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'out';p.mkdir();(p/'personal-notes.txt').write_text('must remain untouched')
            with self.assertRaises(ValueError):build.build(p,self.data)
            self.assertEqual((p/'personal-notes.txt').read_text(),'must remain untouched')
    def test_internal_links_and_structure(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'out';build.build(p,self.data);r=check(p,allow_missing_images=True);self.assertTrue(r['passed'],r)
    def test_corrupted_output_is_detected(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'out';build.build(p,self.data);(p/'about.html').write_text('<h1>broken</h1>');self.assertFalse(check(p,True)['passed'])
    def test_output_cannot_be_source(self):
        with self.assertRaises(ValueError):build.build(build.ROOT,self.data)

class EditorialTests(unittest.TestCase):
    def setUp(self):
        self.data=json.loads((build.ROOT/'content.json').read_text(encoding='utf-8'))
        self.row=self.data['work'][0]
    def test_compact_card_has_nested_heading(self):
        text=build.card(self.row,compact=True)
        self.assertIn('<h3>',text)
        self.assertNotIn('<h2>',text)
    def test_catalogue_card_keeps_summary_without_repeating_role(self):
        text=build.card(self.row)
        self.assertIn(build.E(self.row['summary']),text)
        self.assertIn(build.E(self.row['status']),text)
        self.assertNotIn('card-role',text)
    def test_project_notes_preserve_evidence_and_limits(self):
        text=build.project_detail(self.row)
        self.assertIn('<details class="project-notes">',text)
        self.assertNotIn('<details open',text)
        for field in ('role','evidence','limitations'):
            self.assertEqual(text.count(build.E(self.row[field])),1)
    def test_project_note_text_is_escaped(self):
        row=copy.deepcopy(self.row)
        row['evidence']='<script>not executable</script>'
        row['role']='<img src=x onerror=alert(1)>'
        text=build.project_detail(row)
        self.assertNotIn('<script>',text)
        self.assertNotIn('<img',text)
        self.assertIn('&lt;script&gt;',text)

if __name__=='__main__':unittest.main()
