import copy,hashlib,json,re,tempfile,unittest
from pathlib import Path
from urllib.parse import urljoin,urlsplit
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
    def test_generated_text_assets_use_lf_newlines(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'out';build.build(p,self.data)
            for name in ('style.css','site.js'):
                self.assertNotIn(b'\r\n',(p/name).read_bytes())
    def test_manifest_keys_have_platform_independent_order(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'out';build.build(p,self.data)
            keys=list(json.loads((p/'build-manifest.json').read_text(encoding='utf-8'))['sha256'])
            self.assertEqual(keys,sorted(keys))
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

class NotFoundPageTests(unittest.TestCase):
    """GitHub Pages serves 404.html at any missing path, e.g. /research/old-page."""
    def setUp(self):
        self.data=json.loads((build.ROOT/'content.json').read_text(encoding='utf-8'))
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)/'out';build.build(self.root,self.data)
    def local_refs(self,name):
        text=(self.root/name).read_text(encoding='utf-8')
        return [v for v in re.findall(r'\s(?:href|src)="([^"]*)"',text) if not re.match(r'[a-z][a-z0-9+.-]*:',v)]
    def test_404_local_references_are_root_relative(self):
        refs=self.local_refs('404.html')
        for needed in ('/style.css','/site.js','/assets/mark.svg','/index.html','/work.html'):self.assertIn(needed,refs)
        bad=[v for v in refs if not v.startswith(('/','#')) or v.startswith('//')]
        self.assertEqual(bad,[],'404 page must resolve assets from the site root at any depth')
        self.assertIn('#main',refs,'same-page skip link stays a fragment')
    def test_404_resolves_from_nested_missing_path(self):
        for ref in self.local_refs('404.html'):
            if ref.startswith('#'):continue
            with self.subTest(ref=ref):
                resolved=urljoin('https://jacobmetoyer.com/research/old-page/deeper',ref)
                path=urlsplit(resolved).path.lstrip('/') or 'index.html'
                self.assertTrue((self.root/path).is_file(),resolved)
    def test_other_pages_stay_relative(self):
        for name in ('index.html','work.html','about.html','now.html'):
            with self.subTest(name=name):
                self.assertFalse([v for v in self.local_refs(name) if v.startswith('/')])
    def test_root_relative_link_rejected_outside_404(self):
        page=self.root/'about.html'
        page.write_text(page.read_text(encoding='utf-8').replace('href="style.css"','href="/style.css"'),encoding='utf-8',newline='\n')
        manifest_path=self.root/'build-manifest.json';manifest=json.loads(manifest_path.read_text())
        manifest['sha256']['about.html']=hashlib.sha256(page.read_bytes()).hexdigest();manifest_path.write_text(json.dumps(manifest),encoding='utf-8')
        self.assertFalse(check(self.root)['passed'])
    def test_root_relative_script_rejected_outside_404(self):
        page=self.root/'about.html'
        page.write_text(page.read_text(encoding='utf-8').replace('src="site.js"','src="/site.js"'),encoding='utf-8',newline='\n')
        manifest_path=self.root/'build-manifest.json';manifest=json.loads(manifest_path.read_text())
        manifest['sha256']['about.html']=hashlib.sha256(page.read_bytes()).hexdigest();manifest_path.write_text(json.dumps(manifest),encoding='utf-8')
        result=check(self.root)
        self.assertFalse(result['passed']);self.assertIn('about.html: unapproved executable script',result['failures'])
    def test_404_other_rooted_script_rejected(self):
        page=self.root/'404.html'
        page.write_text(page.read_text(encoding='utf-8').replace('src="/site.js"','src="/style.css"'),encoding='utf-8',newline='\n')
        manifest_path=self.root/'build-manifest.json';manifest=json.loads(manifest_path.read_text())
        manifest['sha256']['404.html']=hashlib.sha256(page.read_bytes()).hexdigest();manifest_path.write_text(json.dumps(manifest),encoding='utf-8')
        self.assertIn('404.html: unapproved executable script',check(self.root)['failures'])
    def test_404_remote_or_scheme_relative_still_rejected(self):
        page=self.root/'404.html'
        page.write_text(page.read_text(encoding='utf-8').replace('href="/style.css"','href="//example.invalid/style.css"'),encoding='utf-8',newline='\n')
        manifest_path=self.root/'build-manifest.json';manifest=json.loads(manifest_path.read_text())
        manifest['sha256']['404.html']=hashlib.sha256(page.read_bytes()).hexdigest();manifest_path.write_text(json.dumps(manifest),encoding='utf-8')
        self.assertFalse(check(self.root)['passed'])
    def test_404_missing_rooted_target_detected(self):
        page=self.root/'404.html'
        page.write_text(page.read_text(encoding='utf-8').replace('href="/now.html"','href="/gone.html"'),encoding='utf-8',newline='\n')
        manifest_path=self.root/'build-manifest.json';manifest=json.loads(manifest_path.read_text())
        manifest['sha256']['404.html']=hashlib.sha256(page.read_bytes()).hexdigest();manifest_path.write_text(json.dumps(manifest),encoding='utf-8')
        self.assertIn('404.html: missing gone.html',check(self.root)['failures'])

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
