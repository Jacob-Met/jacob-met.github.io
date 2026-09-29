import copy,hashlib,json,re,tempfile,unittest
from pathlib import Path
from urllib.parse import urljoin,urlsplit
import build
from check import check
import check as check_module

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
    def test_share_card_and_icons(self):
        import struct
        def png_size(b):
            self.assertEqual(b[:8],b'\x89PNG\r\n\x1a\n');return struct.unpack('>II',b[16:24])
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'out';build.build(p,self.data)
            self.assertEqual(png_size((p/build.SHARE_CARD).read_bytes()),(1200,630))
            self.assertEqual(png_size((p/'apple-touch-icon.png').read_bytes()),(180,180))
            self.assertEqual((p/'favicon.ico').read_bytes()[:4],b'\x00\x00\x01\x00')
            for name in (build.SHARE_CARD,'apple-touch-icon.png'):self.assertLess((p/name).stat().st_size,300_000)
            manifest=json.loads((p/'build-manifest.json').read_text(encoding='utf-8'))['sha256']
            for name in (build.SHARE_CARD,*build.ROOT_ICONS):self.assertIn(name,manifest)
            for page in p.glob('*.html'):
                text=page.read_text(encoding='utf-8')
                with self.subTest(page=page.name):
                    self.assertIn(f'<meta property="og:image" content="{build.BASE}/{build.SHARE_CARD}">',text)
                    self.assertIn('<meta name="twitter:card" content="summary_large_image">',text)
                    self.assertIn('rel="apple-touch-icon"',text)
    def test_collaboration_entry_point(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'out';build.build(p,self.data)
            page=(p/'collaborate.html').read_text(encoding='utf-8')
            self.assertIn('Have a workflow worth untangling?',page)
            self.assertIn('A small, testable pilot',page)
            self.assertIn('href="https://www.linkedin.com/in/jacob-metoyer-15b701352"',page)
            self.assertIn('sample or redacted material',page)
            self.assertNotIn('production client deployment',page)
            self.assertIn('<a href="collaborate.html" aria-current="page">Collaborate</a>',page)
            for other in p.glob('*.html'):
                target='/collaborate.html' if other.name=='404.html' else 'collaborate.html'
                self.assertIn(f'href="{target}"',other.read_text(encoding='utf-8'))
            sitemap=(p/'sitemap.xml').read_text(encoding='utf-8')
            self.assertIn(f'{build.BASE}/collaborate.html',sitemap)
            self.assertIn('collaborate.html',json.loads((p/'build-manifest.json').read_text())['sha256'])
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

class ContentSecurityPolicyTests(unittest.TestCase):
    """W-12: GitHub Pages sends no CSP header, so every page carries the policy as a meta tag."""
    def setUp(self):
        self.data=json.loads((build.ROOT/'content.json').read_text(encoding='utf-8'))
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)/'out';build.build(self.root,self.data)
    def rewrite(self,name,old,new):
        page=self.root/name;text=page.read_text(encoding='utf-8');self.assertIn(old,text)
        page.write_text(text.replace(old,new),encoding='utf-8',newline='\n')
        manifest_path=self.root/'build-manifest.json';manifest=json.loads(manifest_path.read_text())
        manifest['sha256'][name]=hashlib.sha256(page.read_bytes()).hexdigest();manifest_path.write_text(json.dumps(manifest),encoding='utf-8')
        return check(self.root)['failures']
    def test_every_page_has_policy_first(self):
        for page in sorted(self.root.glob('*.html')):
            with self.subTest(page=page.name):
                self.assertTrue(page.read_text(encoding='utf-8').startswith(f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="{build.CSP}">'))
    def test_policy_matches_declared_surface(self):
        self.assertEqual(build.CSP,"; ".join(f'{k} {v}' for k,v in check_module.CSP_REQUIRED.items()))
        self.assertNotIn('unsafe',build.CSP)
    def test_missing_policy_detected(self):
        self.assertIn('about.html: expected exactly one Content-Security-Policy meta',self.rewrite('about.html',f'<meta http-equiv="Content-Security-Policy" content="{build.CSP}">',''))
    def test_weakened_policy_detected(self):
        failures=self.rewrite('index.html',"script-src 'self'","script-src 'self' 'unsafe-inline'")
        self.assertIn("index.html: CSP script-src must be 'self'",failures)
    def test_undeclared_directive_detected(self):
        failures=self.rewrite('404.html',"form-action 'none'","form-action 'none'; connect-src *")
        self.assertIn('404.html: CSP has undeclared directives: connect-src',failures)
    def test_policy_after_resources_detected(self):
        failures=self.rewrite('work.html','<meta charset="utf-8"><meta http-equiv','<meta charset="utf-8"><link rel="stylesheet" href="style.css"><meta http-equiv')
        self.assertIn('work.html: Content-Security-Policy must directly follow meta charset',failures)

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
    def test_detail_renders_story_as_paragraphs_and_scope_once(self):
        text=build.project_detail(self.row)
        for para in self.row['story']:
            self.assertEqual(text.count(f'<p>{build.E(para)}</p>'),1)
        self.assertEqual(text.count(build.E(self.row['limitations'])),1)
        self.assertIn('<p class="scope">',text)
    def test_detail_drops_field_list_layout(self):
        text=build.project_detail(self.row)
        for marker in ('<details','<dl','<dt>','What exists'):
            self.assertNotIn(marker,text)
    def test_story_text_is_escaped(self):
        row=copy.deepcopy(self.row)
        row['story']=['<script>not executable</script>','<img src=x onerror=alert(1)>']
        row['limitations']='<b>scope</b>'
        text=build.project_detail(row)
        self.assertNotIn('<script>',text)
        self.assertNotIn('<img',text)
        self.assertNotIn('<b>',text)
        self.assertIn('&lt;script&gt;',text)
    def test_every_public_entry_has_a_story(self):
        for row in self.data['work']:
            self.assertTrue(row['story'],row['id'])
    def test_missing_story_denied(self):
        del self.data['work'][0]['story']
        with self.assertRaises(ValueError):build.validate(self.data)
    def test_malformed_story_denied(self):
        for bad in ([], 'a string, not a list', [''], [1], ['x']*7, ['x'*2001]):
            with self.subTest(bad=bad):
                data=copy.deepcopy(self.data);data['work'][0]['story']=bad
                with self.assertRaises(ValueError):build.validate(data)

class VoiceTests(unittest.TestCase):
    """Guard against the stacked-disclaimer and stock-phrase style the rewrite removed."""
    BANNED=('delve','tapestry','robust','leverage','seamless','is claimed','claim is made','not a claim','masquerad','spectacle','no clinical accuracy',
            # 2026-09-29 Jacob: no faux-casual thesis packaging
            'comes back to','common thread','keeps showing up','ties it together','through-line','the longer view','worth following','following a question','keeps turning into','the same job','up to you',
            # 2026-09-29 Jacob: 'sounds like a list every time'; no LLM essay tics either
            'passionate','journey','at its core','deeply','fascinat','intersection of','what drives me','i believe that')
    def setUp(self):
        self.data=json.loads((build.ROOT/'content.json').read_text(encoding='utf-8'))
    def rendered(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'out';build.build(p,self.data)
            return {f.name:f.read_text(encoding='utf-8') for f in p.glob('*.html')}
    def test_no_stock_phrases_in_visible_copy(self):
        for name,text in self.rendered().items():
            low=text.lower()
            for phrase in self.BANNED:
                with self.subTest(page=name,phrase=phrase):self.assertNotIn(phrase,low)
    def test_scope_lines_are_single_sentences(self):
        for row in self.data['work']:
            with self.subTest(id=row['id']):
                self.assertLessEqual(len(row['limitations']),140)
                self.assertLessEqual(row['limitations'].count('. '),1)
    def test_story_is_first_person_prose(self):
        for row in self.data['work']:
            with self.subTest(id=row['id']):
                joined=' '.join(row['story'])
                self.assertRegex(joined,r"\b(I|I'm|I've|My|my|me)\b")
                self.assertNotIn(' — ',joined)

    def test_homepage_is_prose_not_a_list(self):
        home=self.rendered()['index.html']
        main=home[home.index('<main'):home.index('</main>')]
        for marker in ('<ul','<li','work-card','featured-grid','<dl'):
            with self.subTest(marker=marker):self.assertNotIn(marker,main)
        self.assertGreaterEqual(main.count('<p>'),5)
    def home_main(self):
        home=self.rendered()['index.html']
        return home[home.index('<main'):home.index('</main>')]
    def test_homepage_is_not_a_statement_of_purpose(self):
        # 2026-09-29 Jacob: the homepage read like his statement of purpose. Credentials, dates and
        # career goals belong in the About biography, not the front door.
        main=self.home_main()
        for marker in ('MD/PhD','BUILD Scholar','2025','2026','biology minor','minor in biology','medicine'):
            with self.subTest(marker=marker):self.assertNotIn(marker,main)
    # 2026-09-29 Jacob (draft 5): "its my portfolio website why is there stories in the first place".
    # The homepage is a scannable overview: every public project once, grouped by lane, a title and a
    # one- or two-sentence summary each, linking to the full write-up. No case studies on the front door.
    def test_homepage_is_a_scannable_overview(self):
        ids=[i for *_,items in build.HOME_OVERVIEW for i,_,_ in items]
        self.assertEqual(sorted(ids),sorted(r['id'] for r in self.data['work']))  # every public project, once
        for *_,items in build.HOME_OVERVIEW:
            for ident,tag,summary in items:
                with self.subTest(id=ident):
                    self.assertLessEqual(len(summary),260)
                    self.assertLessEqual(len(re.findall(r'[.!?](\s|$)',summary)),2)
                    self.assertNotIn(' \u2014 ',summary)
        main=self.home_main()
        self.assertNotIn('class="story"',main)
        self.assertLess(len(re.sub(r'<[^>]+>',' ',main).split()),520)
    def test_homepage_keeps_lab_work_apart_from_public_work(self):
        order=[sid for sid,*_ in build.HOME_OVERVIEW]
        self.assertEqual(order,['home-academic','home-software','home-independent','home-making'])
        rows={r['id']:r for r in self.data['work']}
        lanes=dict((sid,[rows[i] for i,_,_ in items]) for sid,_,_,items in build.HOME_OVERVIEW)
        self.assertTrue(all(r['category']=='Research' and r['id']!='ai-systems-research' for r in lanes['home-academic']))
        self.assertTrue(all(r['category']=='Computing' for r in lanes['home-software']))
        main=self.home_main()
        self.assertIn('stay with the labs',main)
        self.assertIn('Unpublished',main)
    def test_homepage_links_land_on_real_sections(self):
        pages=self.rendered()
        for href in re.findall(r'href="([a-z-]+\.html)#([a-z0-9-]+)"',self.home_main()):
            page,frag=href
            with self.subTest(href=href):self.assertIn(f'id="{frag}"',pages[page])
    def test_towerops_is_a_public_simulation_not_operational_atc(self):
        pages=self.rendered()
        rows={r['id']:r for r in self.data['work']}
        row=rows['towerops']
        self.assertEqual(row['links'][0]['url'],'https://github.com/Jacob-Met/TowerOps')
        self.assertIn('synthetic',row['summary'])
        self.assertIn('not operational',row['limitations'])
        self.assertIn('computing.html#towerops',pages['index.html'])
        self.assertIn('id="towerops"',pages['computing.html'])
        self.assertIn('TowerOps source and simulation limits',pages['credits.html'])
        self.assertNotIn('TowerOps',pages['research.html'])
    def test_about_is_a_chronological_biography(self):
        about=' '.join(build.ABOUT)
        order=[about.index(k) for k in ('Cal State Long Beach','Tsai Lab','Joshi','gait rehabilitation','MD/PhD')]
        self.assertEqual(order,sorted(order))
        self.assertIn('Jacob Metoyer',build.SHORT_BIO)
        page=self.rendered()['about.html']
        for para in build.ABOUT:
            with self.subTest(para=para[:40]):self.assertIn(build.E(para),page)
    # 2026-09-29 Jacob: say what he did, is working on, knows and plans, not the equipment; and
    # much of his personal research (software, AI) should not be public.
    TOOL_NAMES=('Vicon','MATLAB','Python','GraphPad','Prism','Unity','Blender','Rust','EMG','RMSD','PCA','RMSF','PySide','MCP','CLI')
    PRIVATE_MARKERS=('Hamon','Togishi','Jihada','Habaki','Shinogi','FlyWire','BANC','connectome','PTEN','NUDT15','TP53','G6PD','Spire','Schauz','client')
    def front_copy(self):
        pages=self.rendered()
        out={}
        for name in ('index.html','about.html'):
            page=pages[name]; out[name]=page[page.index('<main'):page.index('</main>')]
        return out
    def test_home_and_about_skip_tool_names(self):
        for name,main in self.front_copy().items():
            for word in self.TOOL_NAMES:
                with self.subTest(page=name,word=word):self.assertNotRegex(main,r'\b'+re.escape(word)+r'\b')
    def test_home_and_about_keep_private_work_private(self):
        for name,main in self.front_copy().items():
            for word in self.PRIVATE_MARKERS:
                with self.subTest(page=name,word=word):self.assertNotIn(word.lower(),main.lower())
    def test_about_says_what_stays_off_the_site(self):
        about=' '.join(build.ABOUT)
        self.assertIn('belong to the labs',about)
        self.assertIn('isn\u2019t published',about)

if __name__=='__main__':unittest.main()
