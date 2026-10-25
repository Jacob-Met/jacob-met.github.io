import copy, hashlib, json, re, shutil, subprocess, sys, tempfile, unittest
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
        self.root = Path(self.temp.name) / 'out'; build.build(self.root, self.data, preview=True)

    def page(self, name='index.html'):
        return (self.root / name).read_text(encoding='utf-8')

    def main(self, name='index.html'):
        t = self.page(name); return t[t.index('<main'):t.index('</main>')]

    def rewrite(self, name, old, new):
        page = self.root / name; text = page.read_text(encoding='utf-8'); self.assertIn(old, text)
        page.write_text(text.replace(old, new), encoding='utf-8', newline='\n')
        mp = self.root / 'build-manifest.json'; m = json.loads(mp.read_text())
        m['sha256'][name] = hashlib.sha256(page.read_bytes()).hexdigest(); mp.write_text(json.dumps(m), encoding='utf-8')
        return check(self.root, preview=True)['failures']


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
    def test_demo_without_repo_denied(self):
        data = copy.deepcopy(self.data); data['demos'][0]['repo'] = 'https://github.com/Other-User/x'
        with self.assertRaises(ValueError): build.validate(data)
    def test_demo_without_capture_denied(self):
        data = copy.deepcopy(self.data); del data['demos'][0]['shots']['mobile']
        with self.assertRaises(ValueError): build.validate(data)
    def test_capture_must_be_local_webp_with_true_size(self):
        for src, w in (('https://github.com/x.webp', None), ('assets/demos/missing.webp', None), (None, 9999)):
            data = copy.deepcopy(self.data); shot = data['demos'][0]['shots']['desktop']
            if src: shot['src'] = src
            if w: shot['w'] = w
            with self.subTest(src=src, w=w), self.assertRaises(ValueError): build.validate(data)
    def test_duplicate_demo_id_denied(self):
        data = copy.deepcopy(self.data); data['demos'][1]['id'] = data['demos'][0]['id']
        with self.assertRaises(ValueError): build.validate(data)
    def test_markup_in_copy_denied(self):
        data = copy.deepcopy(self.data); data['demos'][0]['line'] = '<script>x</script>'
        with self.assertRaises(ValueError): build.validate(data)
    def test_bad_urls_denied(self):
        for url in ('javascript:alert(1)', 'https://me:pw@github.com/x', 'https://github.com.evil.example/x', 'https://github.com/x?token=1',
                    'http://github.com/Jacob-Met', 'https://www.instagram.com/tornadocos/', 'https://myanimelist.net/profile/TornadoZW'):
            with self.subTest(url=url), self.assertRaises(ValueError): build.safe_url(url)


class BuildTests(Built):
    def test_dynamic_still_endpoints_are_exact(self):
        failures=self.rewrite('index.html','data-arrival-src="assets/scene/forge-warm-arrival-960.png"','data-arrival-src="https://example.org/unreviewed.png"')
        self.assertTrue(any('scene endpoint' in failure for failure in failures))
    def test_native_arrival_dimensions_are_truthful(self):
        failures=self.rewrite('index.html','src="assets/scene/forge-warm-arrival-960.png" width="960" height="600"','src="assets/scene/forge-warm-arrival-960.png" width="1280" height="800"')
        self.assertTrue(any('native presentation dimensions' in failure for failure in failures))
    def test_output_passes_checks(self): self.assertTrue(check(self.root, preview=True)['passed'], check(self.root, preview=True))
    def test_deterministic(self):
        a = (self.root / 'build-manifest.json').read_bytes(); build.build(self.root, self.data, preview=True)
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
            with self.assertRaises(ValueError): build.build(p, self.data, preview=True)
            self.assertEqual((p / 'notes.txt').read_text(), 'keep')
    def test_output_cannot_be_source(self):
        with self.assertRaises(ValueError): build.build(build.ROOT, self.data, preview=True)
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
    def test_only_declared_captures_ship(self):
        shots = {f.relative_to(self.root).as_posix() for f in (self.root / 'assets' / 'demos').iterdir()}
        self.assertEqual(shots, set(build.shot_files(self.data)))


class ContentTests(Built):
    """Demos-first: every demo shows captured output, a one-line description and its source."""
    BANNED = ('anime', 'manga', 'cosplay', 'tornadocos', 'myanimelist', 'umamusume', 'uma-sim', 'schauz',
              'togishi', 'otama', 'shinogi', 'jihada', 'passionate', 'leverage', 'robust', 'ai-assistance', 'ai-written')
    def test_no_old_profile_or_ai_assistance_copy(self):
        # "Hamon Engine" is the public name of Jacob's game engine; internal agent names stay banned.
        # "Spire of Octaves" is Jacob's public fiction world (spireofoctaves.com); the pen name stays banned.
        low = (self.page() + json.dumps(self.data)).lower().replace('hamon engine', '')
        low = low.replace('spire of octaves', '').replace('spireofoctaves.com', '').replace('spire-of-octaves', '')
        for word in self.BANNED:
            with self.subTest(word=word): self.assertNotIn(word, low)
    def test_no_executable_scripts_or_embeds_in_body(self):
        m = self.main()
        for tag in ('<script', '<iframe', '<form', '<canvas', '<object', '<embed'):
            with self.subTest(tag=tag): self.assertNotIn(tag, m)
        self.assertNotIn('<script src="detail.js"', self.page())
        for name in ('lobby-journey.js', 'scene-handoff.js', 'lobby.js'):
            self.assertEqual(self.page().count(f'<script src="{name}" defer integrity="sha256-'), 1)
        self.assertEqual(self.page().count('<video id="route-'), 6)
        self.assertNotIn('autoplay', m)
        self.assertNotIn('WebAssembly', self.page())

    def test_captured_section_order(self):
        m = self.main()
        positions = [m.index(f'id="{key}"') for key in ('forge', 'engine', 'research', 'hackathons', 'projects', 'about-art')]
        self.assertEqual(positions, sorted(positions))
        self.assertEqual(self.page().count('<h1'), 1)
        self.assertIn('<a class="skip" href="#engine" data-engine data-skip>Skip to the work</a>', self.page())

    def test_every_demo_is_a_captured_live_link(self):
        from portfolio import public_demo
        for demo in self.data['demos']:
            from figure_policy import load_figures
            card = public_demo(demo, load_figures(build.ROOT).get(demo['id']))
            self.assertIn(card, self.main())
            self.assertIn(demo['play']['url'], card)
            self.assertIn(demo['repo'], card)
            for shot in demo['shots'].values(): self.assertIn(shot['src'], card)
        self.assertNotIn('before_conflict', self.main())

    def test_every_capture_has_alt_and_size(self):
        for img in re.findall(r'<img [^>]+>', self.main()):
            with self.subTest(img=img[:60]):
                if 'alt=""' in img:
                    self.assertTrue('forge-warm-arrival-960.png' in img or 'id="scene-buffer"' in img)
                else: self.assertRegex(img, r'alt="[^"]{20,}"'); self.assertRegex(img, r'width="\d+" height="\d+"')
    def test_identity_and_research_replace_agent_director_copy(self):
        self.assertNotIn('id="how"', self.main())
        self.assertNotIn('how', self.data)
        self.assertEqual(build.TITLE, 'Jacob Metoyer')
        self.assertIn('computer science', build.DESC.lower())
        for phrase in ('AI agents carry out', 'I set the bar', 'I direct AI agents'):
            self.assertNotIn(phrase.lower(), (self.page() + (build.ROOT / 'make_images.py').read_text()).lower())
        self.assertIn('CSULB', self.main())
        self.assertIn('Academic collaboration', self.main())
        self.assertIn('Independent investigations', self.main())

    def test_game_availability_tracks_verified_build(self):
        data = copy.deepcopy(self.data)
        for game in data['games']: game['build'] = None
        markup = build.render_index(data, preview=True)
        self.assertIn('No verified playable build is currently listed.', markup)
        self.assertNotIn('Play the published game', markup)
        self.assertNotIn('Play the published snapshot', markup)
        self.assertIn('prerecorded camera journeys', markup)

    def test_engine_section_tops_demos_without_claiming_them(self):
        m = self.main()
        self.assertLess(m.index('id="engine"'), m.index('id="towerops-airspace"'))
        self.assertIn('Native HAMON Engine render', m)
        self.assertIn('prerecorded camera journeys', m)
        self.assertIn('The engine source is private.', m)
        from portfolio import public_demo
        for demo in self.data['demos']: self.assertNotIn('hamon', public_demo(demo).lower())

    def test_games_are_playable_only_with_verified_build(self):
        m = self.main()
        self.assertIn('Play the published game', m)
        self.assertIn('published browser-game snapshot', m)
        self.assertIn('WebGPU', m)
        self.assertIsNone(next(g for g in self.data['games'] if g['id'] == 'spire-of-octaves')['build'])
        self.assertIn('href="https://spireofoctaves.com/"', m)

    def test_unverified_or_offsite_build_refused(self):
        data = copy.deepcopy(self.data)
        data['games'][0]['build'] = {'play_url': 'https://spireofoctaves.com/play', 'verified_at': '2026-10-10', 'evidence': 'frame checked'}
        with self.assertRaises(ValueError): build.validate(data)
        data['games'][0]['build'] = {'play_url': 'https://jacobmetoyer.com/play/x/', 'verified_at': 'soon', 'evidence': 'frame checked'}
        with self.assertRaises(ValueError): build.validate(data)
        data['games'][0]['build'] = {'play_url': 'https://jacobmetoyer.com/play/x/', 'verified_at': '2026-10-10', 'evidence': 'frame checked'}
        build.validate(data)
    def test_spire_links_its_own_site(self):
        self.assertIn('href="https://spireofoctaves.com/"', self.main())
    def test_primary_destinations_and_game_snapshot_scope(self):
        m = self.main()
        self.assertLess(m.index('href="#research" class="destination destination-research"'), m.index('id="hamon"'))
        self.assertLess(m.index('id="hamon"'), m.index('href="https://spireofoctaves.com/" class="destination destination-spire"'))
        self.assertIn('href="https://jacobmetoyer.com/games/lanternwake/"', m)
        self.assertIn('published browser-game snapshot', m)
        self.assertIn('every movement can be skipped', m)

    def test_game_verification_record_link_is_explicit(self):
        self.assertIn('href="https://jacobmetoyer.com/games/lanternwake/evidence.json"',self.main())
    def test_presence_record_is_consistent(self):
        p = json.loads(Path(__file__).with_name('presence.json').read_text(encoding='utf-8'))
        gh = p['github']
        self.assertEqual(gh['blog'], build.BASE); self.assertEqual(gh['name'], self.data['name'])
        self.assertEqual(len(gh['pins']), len(set(gh['pins']))); self.assertLessEqual(len(gh['pins']), 6)
        self.assertLessEqual(len(gh['bio']), 160)
        readme = Path(__file__).parent.joinpath(*gh['readme']['source'].split('/')[1:]).read_text(encoding='utf-8')
        blob = (json.dumps(p) + readme).lower().replace('"banned_terms": ["schauz"]', '')
        for word in p['banned_terms']:
            self.assertNotIn(word, blob)
        self.assertFalse(p['linkedin']['managed'] and p['linkedin']['headline'] is None)
    def test_demo_detail_is_progressive(self):
        from portfolio import public_demo
        for demo in self.data['demos']:
            self.assertIn('<details class="feature-details"><summary>Source, captures &amp; scope</summary><p>', public_demo(demo))

    def test_no_mojibake(self):
        for name in ('index.html', '404.html'):
            page = self.page(name)
            for bad in ('Â', 'Ã', 'â€', 'â†'):
                self.assertNotIn(bad, page)
    def test_escaping(self):
        data = copy.deepcopy(self.data); data['demos'][0]['detail'] = "\"a\" & 'b'"
        build.build(self.root, data, preview=True)
        self.assertIn('&quot;a&quot; &amp; &#x27;b&#x27;', self.page())
        self.assertTrue(check(self.root, preview=True)['passed'])
    def test_external_hosts_are_only_verifiable_ones(self):
        hosts = {urlsplit(u).hostname for u in re.findall(r'href="(https://[^"]+)"', self.main())}
        self.assertTrue(hosts <= build.ALLOWED_HOSTS, hosts)
        self.assertIn(f'<link rel="canonical" href="{build.BASE}/">', self.page())


class CheckerTests(Built):
    def test_corruption_detected(self):
        (self.root / 'index.html').write_text('<h1>broken</h1>'); self.assertFalse(check(self.root, preview=True)['passed'])
    def test_injected_surface_rejected(self):
        for fragment in ('<script src="site.js"></script>', '<script>void(0)</script>', '<img src="assets/mark.svg" alt="x">',
                         '<img src="assets/demos/returnby-desktop.webp" width="1" height="1" alt="">', '<img src="assets/demos/returnby-desktop.webp" alt="no size">',
                         '<link rel="stylesheet" href="https://example.invalid/t.css">', '<meta http-equiv="refresh" content="0;url=https://example.invalid">',
                         '<iframe src="https://example.invalid"></iframe>', '<a href="https://github.com/Jacob-Met" ping="https://example.invalid">l</a>',
                         '<a href="http://github.com/Jacob-Met">plain</a>', '<a href="//example.invalid/x">rel</a>', '<style>body{}</style>',
                         '<a href="#nowhere">gone</a>', '<a href="gone.html">gone</a>', '<div onclick="void(0)">x</div>'):
            with self.subTest(fragment=fragment):
                failures = self.rewrite('index.html', '</main>', fragment + '</main>')
                self.assertTrue(failures); self.assertFalse(any('Hash mismatch' in f for f in failures))
                build.build(self.root, self.data, preview=True)
    def test_csp_enforced(self):
        self.assertEqual(build.CSP, '; '.join(f'{k} {v}' for k, v in check_module.CSP_REQUIRED.items()))
        self.assertIn('index.html: expected exactly one Content-Security-Policy meta', self.rewrite('index.html', f'<meta http-equiv="Content-Security-Policy" content="{build.CSP}">', ''))
        build.build(self.root, self.data, preview=True)
        self.assertIn("index.html: CSP default-src must be 'none'", self.rewrite('index.html', "default-src 'none'", "default-src *"))
        build.build(self.root, self.data, preview=True)
        self.assertIn('404.html: CSP contains duplicate directive: script-src', self.rewrite('404.html', "form-action 'none'", "form-action 'none'; script-src 'self'"))
    def test_css_surface(self):
        for css in ('@import "https://example.invalid/a.css";', 'body{background:url(https://example.invalid/p)}', '@font-face{font-family:x;src:url(x.woff2)}', 'a{behavior:url(l.htc)}'):
            with self.subTest(css=css):
                (self.root / 'style.css').write_text(css, encoding='utf-8')
                mp = self.root / 'build-manifest.json'; m = json.loads(mp.read_text()); m['sha256']['style.css'] = hashlib.sha256((self.root / 'style.css').read_bytes()).hexdigest(); mp.write_text(json.dumps(m))
                self.assertFalse(check(self.root, preview=True)['passed'])
    def test_svg_surface(self):
        for fragment in ('<script>void(0)</script>', '<image href="https://example.invalid/p"/>', '<g onload="void(0)"/>', '<foreignObject/>'):
            with self.subTest(fragment=fragment):
                (self.root / 'assets' / 'mark.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg">' + fragment + '</svg>', encoding='utf-8')
                mp = self.root / 'build-manifest.json'; m = json.loads(mp.read_text()); m['sha256']['assets/mark.svg'] = hashlib.sha256((self.root / 'assets' / 'mark.svg').read_bytes()).hexdigest(); mp.write_text(json.dumps(m))
                self.assertFalse(check(self.root, preview=True)['passed'])
    def test_manifest_cannot_escape(self):
        mp = self.root / 'build-manifest.json'; m = json.loads(mp.read_text()); m['sha256']['../secret'] = '0' * 64; mp.write_text(json.dumps(m))
        self.assertIn('Unsafe or malformed manifest entry', check(self.root, preview=True)['failures'])
    def test_malformed_manifest_is_a_failure_not_a_crash(self):
        for value in ('{bad', '[]', '{"sha256":[]}'):
            (self.root / 'build-manifest.json').write_text(value, encoding='utf-8'); self.assertFalse(check(self.root, preview=True)['passed'])
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
    def test_not_found_keeps_readable_spacing_and_return_target(self):
        css = (self.root / 'experience.css').read_text()
        self.assertIn('.not-found', css)
        self.assertRegex(css, r'\.not-found\s*\{[^}]*padding:')
        self.assertRegex(css, r'\.not-found \.btn\s*\{[^}]*min-height:\s*44px')
        self.assertIn('Back to the work', self.page('404.html'))
    def test_index_stays_relative(self):
        self.assertFalse([v for v in self.refs('index.html') if v.startswith('/')])
    def test_root_relative_outside_404_rejected(self):
        self.assertIn('index.html: unsafe local link /experience.css', self.rewrite('index.html', 'href="experience.css"', 'href="/experience.css"'))


# ---------------------------------------------------------------------------
# W-04 regression tests (issue #10): build hygiene.
#
#   * test_tmp_stays_out — a fresh rebuild must not leak a `tmp/` directory
#     or `*.tmp` artifacts into the published site tree.
#   * test_no_github_actions_workflows — the repo carries no GitHub Actions
#     workflows at all (standing order); checks and drift sync run host-side.
#
# Both are hermetic (no network; the rebuild goes to the test's own temp dir
# via Built; the workflow scan is read-only) and fail loudly instead of
# skipping when the layout changes.
# ---------------------------------------------------------------------------


class BuildHygieneTests(Built):
    """W-04 regression tests (issue #10): build hygiene."""

    WORKFLOWS_DIR = build.ROOT.parent / '.github' / 'workflows'

    def test_tmp_stays_out(self):
        tmp_dirs = sorted(
            p.relative_to(self.root).as_posix()
            for p in self.root.rglob('*')
            if p.is_dir() and p.name == 'tmp'
        )
        tmp_files = sorted(
            p.relative_to(self.root).as_posix()
            for p in self.root.rglob('*')
            if p.is_file() and (p.suffix == '.tmp' or p.name == 'tmp')
        )
        self.assertFalse(tmp_dirs,
                         f'build leaked tmp/ directories into the published site: {tmp_dirs}')
        self.assertFalse(tmp_files,
                         f'build leaked *.tmp artifacts into the published site: {tmp_files}')

    def test_no_github_actions_workflows(self):
        # Jacob's standing order: no GitHub Actions. Verification and drift sync run host-side.
        wf = self.WORKFLOWS_DIR
        files = sorted(p.name for p in wf.iterdir()) if wf.is_dir() else []
        self.assertFalse(files, f'GitHub Actions workflows must not exist: {files}')
        self.assertFalse((build.ROOT.parent / '.github' / 'dependabot.yml').exists())


class PrecommitHookTests(unittest.TestCase):
    """Regression tests for .githooks/pre-commit (issue #11 follow-up).

    The hook must validate the STAGED tree, not the working tree (review
    finding on PR #14): staging a source change without the regenerated
    docs/ must block the commit even when the working tree is consistent.
    Each test builds a scratch git repo from the checked-in source/ and
    .githooks/ and runs the real hook script against it.
    """

    def setUp(self):
        self.repo_root = build.ROOT.parent
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.work = Path(self.tmp.name) / 'site'
        shutil.copytree(self.repo_root / 'source', self.work / 'source')
        shutil.copytree(self.repo_root / '.githooks', self.work / '.githooks')
        # Simulate a qualified projection only inside this disposable hook fixture.
        # The production lane remains separately covered; review-lane index cases
        # live in test_review_hook.py without full media-tree copies.
        p = self.work / 'source' / 'lobby-manifest.json'
        route = json.loads(p.read_text()); route['visibility'] = 'public-captured'
        p.write_text(json.dumps(route))
        p=self.work/'source'/'branch-routes.json';route=json.loads(p.read_text());route['visibility']='public-captured';p.write_text(json.dumps(route))
        # Match the real checkout's LF and binary rules, including on Windows.
        shutil.copy2(self.repo_root / '.gitattributes', self.work / '.gitattributes')
        self.git('init', '-q')
        self.git('config', 'user.email', 'hook-test@example')
        self.git('config', 'user.name', 'hook-test')
        # Exercise Windows' checkout setting on every test platform.
        self.git('config', 'core.autocrlf', 'true')
        self.rebuild()
        self.git('add', '-A')
        self.git('commit', '-qm', 'baseline')

    def git(self, *args):
        r = subprocess.run(['git', *args], cwd=self.work,
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r

    def rebuild(self):
        subprocess.run([sys.executable, 'source/build.py', '--out', 'docs'],
                       cwd=self.work, check=True, capture_output=True, text=True)

    def edit_content(self):
        p = self.work / 'source' / 'content.json'
        data = json.loads(p.read_text(encoding='utf-8'))
        data['updated'] = '2099-01-01'
        p.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')

    def hook(self):
        r = subprocess.run(['sh', '.githooks/pre-commit'], cwd=self.work,
                           capture_output=True, text=True)
        return r.returncode, r.stderr

    def test_staged_source_without_docs_blocks(self):
        # The PR #14 review finding: working tree rebuilt and consistent,
        # but only source/ staged -> the commit would reintroduce drift.
        self.edit_content(); self.rebuild()
        self.git('add', 'source/content.json')
        code, err = self.hook()
        self.assertEqual(code, 1)
        self.assertIn('staged docs/', err)

    def test_staged_source_with_rebuilt_docs_passes(self):
        self.edit_content(); self.rebuild()
        self.git('add', 'source/content.json', 'docs')
        code, err = self.hook()
        self.assertEqual(code, 0, err)

    def test_clean_tree_passes(self):
        code, _ = self.hook()
        self.assertEqual(code, 0)

    def test_preview_source_without_matching_preview_docs_is_rejected(self):
        p = self.work / 'source' / 'lobby-manifest.json'
        data = json.loads(p.read_text()); data['visibility'] = 'local-preview'
        p.write_text(json.dumps(data)); self.git('add', 'source/lobby-manifest.json')
        code, error = self.hook()
        self.assertEqual(code, 1)
        self.assertIn('staged docs/', error)

    def test_unstaged_changes_only_pass(self):
        # Fast path: nothing staged -> hook validates nothing, working tree
        # edits are irrelevant to the pending commit.
        self.edit_content()
        code, _ = self.hook()
        self.assertEqual(code, 0)


if __name__ == '__main__': unittest.main()
