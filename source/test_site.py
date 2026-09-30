import copy, hashlib, json, re, tempfile, unittest
from pathlib import Path
from urllib.parse import urljoin, urlsplit
import build
import check as check_module
from check import check


def record():
    return json.loads((build.ROOT / 'content.json').read_text(encoding='utf-8'))


class Built(unittest.TestCase):
    def setUp(self):
        self.data = record()
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'out'; build.build(self.root, self.data)

    def page(self, name='index.html'):
        return (self.root / name).read_text(encoding='utf-8')

    def main(self, name='index.html'):
        t = self.page(name); return t[t.index('<main'):t.index('</main>')]

    def rewrite(self, name, old, new):
        page = self.root / name; text = page.read_text(encoding='utf-8'); self.assertIn(old, text)
        page.write_text(text.replace(old, new), encoding='utf-8', newline='\n')
        mp = self.root / 'build-manifest.json'; m = json.loads(mp.read_text())
        m['sha256'][name] = hashlib.sha256(page.read_bytes()).hexdigest(); mp.write_text(json.dumps(m), encoding='utf-8')
        return check(self.root)['failures']


class RecordTests(unittest.TestCase):
    def setUp(self): self.data = record()
    def test_record_valid(self): build.validate(self.data)
    def test_private_denied(self):
        self.data['visibility'] = 'private'
        with self.assertRaises(ValueError): build.validate(self.data)
    def test_identity_drift_denied(self):
        self.data['name'] = 'Someone else'
        with self.assertRaises(ValueError): build.validate(self.data)
    def test_unknown_root_field_denied(self):
        self.data['private_notes'] = 'no'
        with self.assertRaises(ValueError): build.validate(self.data)
    def test_claim_without_source_denied(self):
        for key in ('current', 'research'):
            data = copy.deepcopy(self.data); data[key][0]['sources'] = []
            with self.subTest(key=key), self.assertRaises(ValueError): build.validate(data)
        data = copy.deepcopy(self.data); data['projects'][0]['artifacts'] = []
        with self.assertRaises(ValueError): build.validate(data)
        data = copy.deepcopy(self.data); data['education']['sources'] = []
        with self.assertRaises(ValueError): build.validate(data)
    def test_unknown_basis_denied(self):
        self.data['research'][0]['basis'] = 'verified by nobody'
        with self.assertRaises(ValueError): build.validate(self.data)
    def test_duplicate_id_denied(self):
        self.data['research'][0]['id'] = self.data['projects'][0]['id']
        with self.assertRaises(ValueError): build.validate(self.data)
    def test_bad_urls_denied(self):
        for url in ('javascript:alert(1)', 'https://me:pw@github.com/x', 'https://github.com.evil.example/x', 'https://github.com/x?token=1',
                    'http://github.com/Jacob-Met', 'https://www.instagram.com/tornadocos/', 'https://myanimelist.net/profile/TornadoZW'):
            with self.subTest(url=url), self.assertRaises(ValueError): build.safe_url(url)
    def test_slot_entries_need_links(self):
        self.data['verified_writing'] = [{'title': 'x', 'venue': 'y', 'date': '2026', 'links': []}]
        with self.assertRaises(ValueError): build.validate(self.data)
    def test_slot_entry_shape(self):
        self.data['verified_research'] = [{'title': 'x', 'venue': 'y', 'date': '2026', 'links': [{'label': 'repo', 'url': 'https://github.com/Jacob-Met'}]}]
        build.validate(self.data)


class BuildTests(Built):
    def test_output_passes_checks(self): self.assertTrue(check(self.root)['passed'], check(self.root))
    def test_deterministic(self):
        a = (self.root / 'build-manifest.json').read_bytes(); build.build(self.root, self.data)
        self.assertEqual(a, (self.root / 'build-manifest.json').read_bytes())
    def test_manifest_sorted_and_complete(self):
        m = json.loads((self.root / 'build-manifest.json').read_text())['sha256']
        self.assertEqual(list(m), sorted(m))
        files = {f.relative_to(self.root).as_posix() for f in self.root.rglob('*') if f.is_file()}
        self.assertEqual(files, set(m) | {'build-manifest.json'})
    def test_lf_newlines(self):
        for name in ('index.html', '404.html', 'style.css', 'cv.json'): self.assertNotIn(b'\r\n', (self.root / name).read_bytes())
    def test_unexpected_output_file_refused(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t) / 'out'; p.mkdir(); (p / 'notes.txt').write_text('keep')
            with self.assertRaises(ValueError): build.build(p, self.data)
            self.assertEqual((p / 'notes.txt').read_text(), 'keep')
    def test_output_cannot_be_source(self):
        with self.assertRaises(ValueError): build.build(build.ROOT, self.data)
    def test_only_two_html_routes(self):
        self.assertEqual({f.name for f in self.root.glob('*.html')}, {'index.html', '404.html'})
    def test_icons_and_share_card(self):
        import struct
        def png_size(b): self.assertEqual(b[:8], b'\x89PNG\r\n\x1a\n'); return struct.unpack('>II', b[16:24])
        self.assertEqual(png_size((self.root / build.SHARE_CARD).read_bytes()), (1200, 630))
        self.assertEqual(png_size((self.root / 'apple-touch-icon.png').read_bytes()), (180, 180))
        self.assertEqual((self.root / 'favicon.ico').read_bytes()[:4], b'\x00\x00\x01\x00')
        self.assertIn(f'<meta property="og:image" content="{build.BASE}/{build.SHARE_CARD}">', self.page())
    def test_cv_json_is_the_record(self):
        self.assertEqual(json.loads((self.root / 'cv.json').read_text(encoding='utf-8')), self.data)
    def test_sitemap_has_only_the_front_page(self):
        sm = (self.root / 'sitemap.xml').read_text(encoding='utf-8')
        self.assertEqual(sm.count('<loc>'), 1); self.assertIn(f'<loc>{build.BASE}/</loc>', sm)


class ContentTests(Built):
    """Rebuild rules: no anime/cosplay-era content, no imagery, every claim sourced, slots visible."""
    BANNED = ('anime', 'manga', 'cosplay', 'tornadocos', 'myanimelist', 'instagram', 'umamusume', 'uma-sim', 'schauz', 'spire',
              'hamon', 'togishi', 'otama', 'shinogi', 'jihada', 'client', 'delve', 'passionate', 'journey', 'leverage', 'robust')
    def test_no_old_era_content(self):
        low = self.page().lower()
        for word in self.BANNED:
            with self.subTest(word=word): self.assertNotIn(word, low)
    def test_no_imagery_or_scripts_in_body(self):
        m = self.main()
        for tag in ('<img', '<picture', '<figure', '<svg', '<video', '<script', '<iframe', '<form'):
            with self.subTest(tag=tag): self.assertNotIn(tag, m)
        self.assertNotIn('<script src', self.page())
    def test_one_page_cv_sections_in_order(self):
        m = self.main(); pos = [m.index(f'<section id="{i}"') for i, _ in build.SECTIONS]
        self.assertEqual(pos, sorted(pos))
        self.assertEqual(m.count('<h1>'), 1)
    def test_toc_links_land_on_sections(self):
        for frag in re.findall(r'<nav class="toc"[^>]*>(.*?)</nav>', self.main())[0].split('href="#')[1:]:
            ident = frag.split('"')[0]
            with self.subTest(id=ident): self.assertIn(f'<section id="{ident}"', self.main())
    def test_every_entry_has_a_source_link(self):
        entries = re.findall(r'<article class="entry"[^>]*>(.*?)</article>', self.main(), re.S)
        self.assertGreaterEqual(len(entries), 10)
        for e in entries:
            with self.subTest(entry=re.sub(r'<[^>]+>', ' ', e)[:60]): self.assertIn('href="https://', e)
    def test_self_reported_lines_are_labelled(self):
        m = self.main()
        for row in self.data['research'] + self.data['current'] + [self.data['independent']]:
            if row['basis'].startswith('self-reported'):
                with self.subTest(row=row.get('id') or row['text'][:30]):
                    self.assertIn(f'<span class="basis">{build.E(row["basis"])}</span>', m)
    def test_projects_link_to_real_artifacts(self):
        for p in self.data['projects']:
            with self.subTest(id=p['id']):
                self.assertTrue(p['artifacts'][0]['url'].startswith('https://github.com/Jacob-Met/'))
                self.assertGreaterEqual(len(p['artifacts']), 2)
                self.assertIn(f'id="{p["id"]}"', self.main())
    def test_inventory_slots_are_visible_and_marked(self):
        m = self.main()
        for key in ('verified_research', 'verified_writing'):
            with self.subTest(slot=key):
                self.assertIn(f'<section id="{key.replace("_", "-")}"', m)
                if self.data[key]:
                    self.assertNotIn(f'<!-- slot:{key} empty', m)
                    for row in self.data[key]:
                        self.assertIn(build.E(row['title']), m)
                        self.assertIn(row['links'][0]['url'], m)
                else:
                    self.assertIn(f'<!-- slot:{key} empty', m)
                    self.assertIn('class="placeholder"', m)
    def test_slot_entries_render_when_present(self):
        self.data['verified_writing'] = [{'title': 'A note', 'venue': 'GitHub', 'date': '2026-09', 'links': [{'label': 'read', 'url': 'https://github.com/Jacob-Met'}]}]
        build.build(self.root, self.data); m = self.main()
        self.assertNotIn('<!-- slot:verified_writing empty', m); self.assertIn('A note', m)
    def test_escaping(self):
        row = copy.deepcopy(self.data['research'][0]); row['title'] = '<script>x</script>'; row['role'] = '<img src=x onerror=alert(1)>'
        self.data['research'][0] = row; build.build(self.root, self.data)
        self.assertNotIn('<script>x', self.page()); self.assertNotIn('<img src=x', self.page()); self.assertTrue(check(self.root)['passed'])
    def test_external_hosts_are_only_verifiable_ones(self):
        hosts = {urlsplit(u).hostname for u in re.findall(r'href="(https://[^"]+)"', self.main())}
        self.assertTrue(hosts <= build.ALLOWED_HOSTS, hosts)
        self.assertIn(f'<link rel="canonical" href="{build.BASE}/">', self.page())


class CheckerTests(Built):
    def test_corruption_detected(self):
        (self.root / 'index.html').write_text('<h1>broken</h1>'); self.assertFalse(check(self.root)['passed'])
    def test_injected_surface_rejected(self):
        for fragment in ('<script src="site.js"></script>', '<script>void(0)</script>', '<img src="assets/mark.svg" alt="x">',
                         '<link rel="stylesheet" href="https://example.invalid/t.css">', '<meta http-equiv="refresh" content="0;url=https://example.invalid">',
                         '<iframe src="https://example.invalid"></iframe>', '<a href="https://github.com/Jacob-Met" ping="https://example.invalid">l</a>',
                         '<a href="http://github.com/Jacob-Met">plain</a>', '<a href="//example.invalid/x">rel</a>', '<style>body{}</style>',
                         '<a href="#nowhere">gone</a>', '<a href="gone.html">gone</a>', '<div onclick="void(0)">x</div>'):
            with self.subTest(fragment=fragment):
                failures = self.rewrite('index.html', '</main>', fragment + '</main>')
                self.assertTrue(failures); self.assertFalse(any('Hash mismatch' in f for f in failures))
                build.build(self.root, self.data)
    def test_csp_enforced(self):
        self.assertEqual(build.CSP, '; '.join(f'{k} {v}' for k, v in check_module.CSP_REQUIRED.items()))
        self.assertIn('index.html: expected exactly one Content-Security-Policy meta', self.rewrite('index.html', f'<meta http-equiv="Content-Security-Policy" content="{build.CSP}">', ''))
        build.build(self.root, self.data)
        self.assertIn("index.html: CSP default-src must be 'none'", self.rewrite('index.html', "default-src 'none'", "default-src *"))
        build.build(self.root, self.data)
        self.assertIn('404.html: CSP has undeclared directives: script-src', self.rewrite('404.html', "form-action 'none'", "form-action 'none'; script-src 'self'"))
    def test_css_surface(self):
        for css in ('@import "https://example.invalid/a.css";', 'body{background:url(https://example.invalid/p)}', '@font-face{font-family:x;src:url(x.woff2)}', 'a{behavior:url(l.htc)}'):
            with self.subTest(css=css):
                (self.root / 'style.css').write_text(css, encoding='utf-8')
                mp = self.root / 'build-manifest.json'; m = json.loads(mp.read_text()); m['sha256']['style.css'] = hashlib.sha256((self.root / 'style.css').read_bytes()).hexdigest(); mp.write_text(json.dumps(m))
                self.assertFalse(check(self.root)['passed'])
    def test_svg_surface(self):
        for fragment in ('<script>void(0)</script>', '<image href="https://example.invalid/p"/>', '<g onload="void(0)"/>', '<foreignObject/>'):
            with self.subTest(fragment=fragment):
                (self.root / 'assets' / 'mark.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg">' + fragment + '</svg>', encoding='utf-8')
                mp = self.root / 'build-manifest.json'; m = json.loads(mp.read_text()); m['sha256']['assets/mark.svg'] = hashlib.sha256((self.root / 'assets' / 'mark.svg').read_bytes()).hexdigest(); mp.write_text(json.dumps(m))
                self.assertFalse(check(self.root)['passed'])
    def test_manifest_cannot_escape(self):
        mp = self.root / 'build-manifest.json'; m = json.loads(mp.read_text()); m['sha256']['../secret'] = '0' * 64; mp.write_text(json.dumps(m))
        self.assertIn('Unsafe or malformed manifest entry', check(self.root)['failures'])
    def test_malformed_manifest_is_a_failure_not_a_crash(self):
        for value in ('{bad', '[]', '{"sha256":[]}'):
            (self.root / 'build-manifest.json').write_text(value, encoding='utf-8'); self.assertFalse(check(self.root)['passed'])
    def test_local_path(self):
        for v in ('../p', '/abs', '//r/a', 'https://r', '%2e%2e/p', r'..\p', 'a?t=x', 'a%00b'): self.assertFalse(check_module.local_path(v), v)
        self.assertTrue(check_module.local_path('assets/mark.svg'))


class NotFoundTests(Built):
    def refs(self, name):
        return [v for v in re.findall(r'\s(?:href|src)="([^"]*)"', self.page(name)) if not re.match(r'[a-z][a-z0-9+.-]*:', v)]
    def test_404_is_root_relative_and_resolves_anywhere(self):
        refs = self.refs('404.html')
        self.assertTrue(all(v.startswith(('/', '#')) and not v.startswith('//') for v in refs), refs)
        for ref in refs:
            if ref.startswith('#'): continue
            path = urlsplit(urljoin('https://jacobmetoyer.com/research/old/deeper', ref)).path.lstrip('/') or 'index.html'
            with self.subTest(ref=ref): self.assertTrue((self.root / path).is_file(), ref)
    def test_index_stays_relative(self):
        self.assertFalse([v for v in self.refs('index.html') if v.startswith('/')])
    def test_root_relative_outside_404_rejected(self):
        self.assertIn('index.html: unsafe local link /index.html', self.rewrite('index.html', 'href="index.html"', 'href="/index.html"'))


if __name__ == '__main__': unittest.main()
