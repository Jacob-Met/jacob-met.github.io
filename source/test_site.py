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
    def test_only_declared_captures_ship(self):
        shots = {f.relative_to(self.root).as_posix() for f in (self.root / 'assets' / 'demos').iterdir()}
        self.assertEqual(shots, set(build.shot_files(self.data)))


class ContentTests(Built):
    """Demos-first: every demo shows captured output, a one-line description and its source."""
    BANNED = ('anime', 'manga', 'cosplay', 'tornadocos', 'myanimelist', 'umamusume', 'uma-sim', 'schauz', 'spire',
              'hamon', 'togishi', 'otama', 'shinogi', 'jihada', 'passionate', 'journey', 'leverage', 'robust', 'ai-assistance', 'ai-written')
    def test_no_old_profile_or_ai_assistance_copy(self):
        # "Hamon Engine" is the public name of Jacob's game engine; internal agent names stay banned.
        low = (self.page() + json.dumps(self.data)).lower().replace('hamon engine', '')
        for word in self.BANNED:
            with self.subTest(word=word): self.assertNotIn(word, low)
    def test_no_executable_scripts_or_embeds_in_body(self):
        m = self.main()
        for tag in ('<svg', '<video', '<script', '<iframe', '<form', '<canvas', '<object', '<embed'):
            with self.subTest(tag=tag): self.assertNotIn(tag, m)
        self.assertNotIn('<script src', self.page())
    def test_demos_first_section_order(self):
        m = self.main()
        pos = [m.index(f'<section id="{i}"') for i, _ in build.SECTIONS]
        self.assertEqual(pos, sorted(pos))
        self.assertLess(m.index('class="hero"'), pos[0])
        self.assertEqual(self.page().count('<h1'), 1)
        self.assertIn('<a class="skip" href="#main">Skip to content</a>', self.page())
    def test_every_demo_is_a_captured_live_link(self):
        cards = re.findall(r'<article class="demo[^\"]*"[^>]*>(.*?)</article>', self.main(), re.S)
        self.assertEqual(len(cards), len(self.data['demos']))
        for card in cards:
            with self.subTest(card=re.sub(r'<[^>]+>', ' ', card)[:60]):
                self.assertIn('<img ', card)
                self.assertNotIn('<pre', card)
                self.assertIn('class="line"', card)
                self.assertRegex(card, r'href="https://github\.com/Jacob-Met/[^\"]+"')
        self.assertNotIn('before_conflict', self.main())
    def test_every_capture_has_alt_and_size(self):
        for img in re.findall(r'<img [^>]+>', self.main()):
            with self.subTest(img=img[:60]):
                self.assertRegex(img, r'alt="[^"]{20,}"'); self.assertRegex(img, r'width="\d+" height="\d+"')
    def test_how_section_states_who_builds(self):
        sec = re.search(r'<section id="how"[^>]*>(.*?)</section>', self.main(), re.S).group(1)
        self.assertEqual(sec.count('<li>'), len(self.data['how']['steps']))
        self.assertIn('carry out what i ask', self.data['hero']['title'].lower())
        self.assertIn('software included', self.data['hero']['lede'].lower())
        for phrase in ('home estate of several machines', 'research reports', 'disk and ops cleanup', 'building this site'):
            self.assertIn(phrase, self.data['hero']['lede'].lower())
        self.assertIn('I set the bar and decide what ships', self.data['hero']['lede'])
        self.assertIn('carry out whatever i direct', self.data['how']['line'].lower())
        self.assertEqual(self.data['how']['steps'][0]['name'], 'I pick the work')
        self.assertEqual(self.data['how']['steps'][1]['name'], 'I set the bar')
        self.assertEqual(self.data['how']['steps'][2]['name'], 'Agents carry it out')
        self.assertIn('home estate of several machines', self.data['about']['lines'][1].lower())
        self.assertIn('software included', build.DESC.lower())
        self.assertIn('whatever i direct', build.SHARE_ALT.lower())
        self.assertIn('carry out what i ask', build.TITLE.lower())
        card = Path(__file__).with_name('make_images.py').read_text(encoding='utf-8')
        self.assertIn("lines = ('AI agents carry out', 'what I direct.', 'I set the bar.')", card)
        visible = ' '.join((self.data['hero']['lede'], self.data['how']['line'], *self.data['about']['lines'])).lower()
        for blocked in ('coursework', 'canvas', 'finances', 'purchases', 'private accounts'):
            self.assertNotIn(blocked, visible)
        self.assertNotIn('write all the code', visible)
    def test_engine_slot_is_labelled_placeholder_without_media(self):
        slot = re.search(r'<aside class="slot"[^>]*>(.*?)</aside>', self.main(), re.S)
        self.assertIsNotNone(slot); self.assertNotIn('<img', slot.group(1)); self.assertIn('Coming soon', slot.group(1))
    def test_engine_section_tops_demos_without_claiming_them(self):
        m = self.main()
        eng = re.search(r'<section id="engine"[^>]*>(.*?)</section>', m, re.S).group(1)
        self.assertIn('>Hamon Engine</h2>', eng); self.assertIn('an AI-native game engine', eng)
        self.assertLess(m.index('id="engine"'), m.index('id="demos"'))
        self.assertIn('Playable demos', m)
        demos = re.search(r'<section id="demos"[^>]*>(.*?)</section>', m, re.S).group(1)
        self.assertNotIn('hamon', demos.lower())
    def test_demo_detail_is_progressive(self):
        for card in re.findall(r'<article class="demo[^"]*"[^>]*>(.*?)</article>', self.main(), re.S):
            self.assertRegex(card, r'<details class="more-detail"><summary>[^<]+</summary><p class="detail">')
    def test_no_mojibake(self):
        for name in ('index.html', '404.html'):
            page = self.page(name)
            for bad in ('Â', 'Ã', 'â€', 'â†'):
                self.assertNotIn(bad, page)
    def test_escaping(self):
        data = copy.deepcopy(self.data); data['demos'][0]['detail'] = "\"a\" & 'b'"
        build.build(self.root, data)
        self.assertIn('&quot;a&quot; &amp; &#x27;b&#x27;', self.page())
        self.assertTrue(check(self.root)['passed'])
    def test_external_hosts_are_only_verifiable_ones(self):
        hosts = {urlsplit(u).hostname for u in re.findall(r'href="(https://[^"]+)"', self.main())}
        self.assertTrue(hosts <= build.ALLOWED_HOSTS, hosts)
        self.assertIn(f'<link rel="canonical" href="{build.BASE}/">', self.page())


class CheckerTests(Built):
    def test_corruption_detected(self):
        (self.root / 'index.html').write_text('<h1>broken</h1>'); self.assertFalse(check(self.root)['passed'])
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
        self.assertIn('index.html: unsafe local link /style.css', self.rewrite('index.html', 'href="style.css"', 'href="/style.css"'))


# ---------------------------------------------------------------------------
# W-04 regression tests (issue #10): build hygiene.
#
#   * test_tmp_stays_out — a fresh rebuild must not leak a `tmp/` directory
#     or `*.tmp` artifacts into the published site tree.
#   * test_no_contents_write_workflow — no workflow in .github/workflows/ may
#     declare `contents: write`, at top level or per job. This pins the
#     current posture (`contents: read` everywhere, plus `issues: write` on
#     the live-site alert job).
#
# Both are hermetic (no network; the rebuild goes to the test's own temp dir
# via Built; the workflow scan is read-only) and fail loudly instead of
# skipping when the layout changes.
# ---------------------------------------------------------------------------


def _strip_yaml_comment(text):
    """Remove a ` #` comment; a leading `#` makes the whole line a comment."""
    if text.startswith('#'):
        return ''
    in_single = in_double = False
    for i, ch in enumerate(text):
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        elif ch == '#' and not in_single and not in_double and i > 0 and text[i - 1] in ' \t':
            return text[:i].rstrip()
    return text


def _split_flow(text):
    """Split a `[...]` flow sequence on top-level commas."""
    parts, depth, in_single, in_double, current = [], 0, False, False, []
    for ch in text:
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        elif not in_single and not in_double:
            if ch in '[{':
                depth += 1
            elif ch in ']}':
                depth -= 1
            elif ch == ',' and depth == 0:
                parts.append(''.join(current))
                current = []
                continue
        current.append(ch)
    parts.append(''.join(current))
    return parts


def _split_key(text):
    """Split `key: value` at the first top-level colon followed by space/EOL.

    Returns (key, rest) or (text, None) when there is no such colon.
    """
    in_single = in_double = False
    depth = 0
    for i, ch in enumerate(text):
        if ch == "'" and not in_double and depth == 0:
            in_single = not in_single
        elif ch == '"' and not in_single and depth == 0:
            in_double = not in_double
        elif not in_single and not in_double:
            if ch in '[{':
                depth += 1
            elif ch in ']}':
                depth -= 1
            elif ch == ':' and depth == 0 and (i + 1 == len(text) or text[i + 1] in ' \t'):
                return text[:i].strip(), text[i + 1:].strip()
    return text, None


def _parse_scalar(text):
    if len(text) >= 2 and text[0] == "'" and text[-1] == "'":
        return text[1:-1].replace("''", "'")
    if len(text) >= 2 and text[0] == '"' and text[-1] == '"':
        return text[1:-1].replace('\\"', '"').replace('\\\\', '\\')
    if text.startswith('[') and text.endswith(']'):
        inner = text[1:-1].strip()
        return [] if not inner else [_parse_scalar(p.strip()) for p in _split_flow(inner)]
    if text in ('true', 'True', 'TRUE'):
        return True
    if text in ('false', 'False', 'FALSE'):
        return False
    if text in ('null', 'Null', 'NULL', '~', ''):
        return None
    if text[:1] in '&*!@`' or text.startswith('<<'):
        raise ValueError(f'unsupported YAML construct: {text!r}')
    try:
        return int(text)
    except ValueError:
        return text


_BLOCK_SCALAR_HEADERS = ('|', '|-', '|+', '>', '>-', '>+')


def _tokenize_workflow(text):
    lines = []
    for raw in text.splitlines():
        if not raw.strip():
            lines.append((-1, ''))
            continue
        indent = len(raw) - len(raw.lstrip(' '))
        if '\t' in raw[:indent]:
            raise ValueError('tab indentation is not supported')
        lines.append((indent, raw[indent:]))
    return lines


def _skip_blanks(lines, i):
    while i < len(lines) and lines[i][0] == -1:
        i += 1
    return i


def _parse_literal(lines, i, key_indent):
    # A `|`/`>` block consumes every following line deeper than its key
    # (blank lines included); content is irrelevant to permission checks.
    content = []
    while i < len(lines) and (lines[i][0] == -1 or lines[i][0] > key_indent):
        content.append('' if lines[i][0] == -1 else lines[i][1])
        i += 1
    while content and content[-1] == '':
        content.pop()
    return '\n'.join(content), i


def _parse_value_after_key(lines, i, rest, key_indent):
    """Parse the value for `key: <rest>`; i points at the following token."""
    if rest in _BLOCK_SCALAR_HEADERS:
        return _parse_literal(lines, i, key_indent)
    if rest != '':
        return _parse_scalar(rest), i
    i = _skip_blanks(lines, i)
    if i < len(lines) and lines[i][0] > key_indent:
        return _parse_block(lines, i, key_indent)
    return None, i


def _parse_block(lines, i, parent_indent):
    i = _skip_blanks(lines, i)
    if i >= len(lines):
        raise ValueError('unexpected end of document inside a block')
    indent, text = lines[i]
    if indent <= parent_indent:
        raise ValueError('unexpected dedent')
    if text == '-' or text.startswith('- '):
        return _parse_seq(lines, i, indent)
    return _parse_map(lines, i, indent)


def _parse_map(lines, i, indent):
    mapping = {}
    while True:
        i = _skip_blanks(lines, i)
        if i >= len(lines) or lines[i][0] != indent:
            return mapping, i
        text = _strip_yaml_comment(lines[i][1])
        if not text:
            i += 1
            continue
        key, rest = _split_key(text)
        if rest is None:
            raise ValueError(f'malformed mapping line: {text!r}')
        # Normalize quoted keys so a quoted scope key cannot evade the
        # permission check: in YAML, 'contents' and contents are the same
        # key. Plain keys round-trip unchanged; duplicate-key detection
        # then also catches mixed quoted/unquoted collisions.
        key = _parse_scalar(key)
        i += 1
        value, i = _parse_value_after_key(lines, i, rest, indent)
        if key in mapping:
            raise ValueError(f'duplicate key {key!r}')
        mapping[key] = value


def _parse_seq(lines, i, indent):
    items = []
    while True:
        i = _skip_blanks(lines, i)
        if i >= len(lines) or lines[i][0] != indent:
            return items, i
        text = lines[i][1]
        if not (text == '-' or text.startswith('- ')):
            return items, i
        remainder = text[1:].strip()
        item_text = _strip_yaml_comment(remainder)
        i += 1
        if item_text == '':
            if remainder.startswith('#'):
                continue  # comment-only line
            value, i = _parse_value_after_key(lines, i, '', indent)
            items.append(value)
            continue
        key, rest = _split_key(item_text)
        if rest is None:
            items.append(_parse_scalar(item_text))
            continue
        item = {}
        value, i = _parse_value_after_key(lines, i, rest, indent)
        item[_parse_scalar(key)] = value  # normalize quoted keys, see _parse_map
        # Continuation pairs of this mapping item live deeper than the dash.
        while True:
            j = _skip_blanks(lines, i)
            if j >= len(lines) or lines[j][0] <= indent:
                break
            ctext = _strip_yaml_comment(lines[j][1])
            if not ctext:
                i = j + 1
                continue
            ckey, crest = _split_key(ctext)
            if crest is None:
                raise ValueError(f'malformed mapping line: {ctext!r}')
            ckey = _parse_scalar(ckey)  # normalize quoted keys, see _parse_map
            i = j + 1
            cvalue, i = _parse_value_after_key(lines, i, crest, lines[j][0])
            if ckey in item:
                raise ValueError(f'duplicate key {ckey!r}')
            item[ckey] = cvalue
        items.append(item)
    return items, i


def _parse_workflow_yaml(text):
    lines = _tokenize_workflow(text)
    doc, i = _parse_block(lines, 0, -1)
    i = _skip_blanks(lines, i)
    if i != len(lines):
        raise ValueError('trailing content after document')
    if not isinstance(doc, dict):
        raise ValueError('top-level workflow document is not a mapping')
    return doc


class BuildHygieneTests(Built):
    """W-04 regression tests (issue #10): build hygiene.

    Key-case assumption: permission scope keys are documented in lowercase
    (https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
    lists `contents`, `actions`, `issues`, ... as the scope keys and documents
    no case folding), and YAML mapping keys are case-sensitive. A capitalized
    key such as ``Contents: write`` is therefore NOT the ``contents`` scope —
    GitHub would not grant the scope through it — so the check deliberately
    does not fold key case. Quoted keys ('contents': write) ARE the same key
    as contents: write and are caught.
    """

    WORKFLOWS_DIR = build.ROOT.parent / '.github' / 'workflows'

    def _require_permissions_mapping(self, path, location, perms):
        """Return perms if it is a block-form mapping; fail loudly otherwise.

        `write-all` grants contents:write, so it fails as a policy violation.
        Any other non-mapping form (`{}`, `read-all`, flow mappings) fails as
        an explicit unsupported-form policy decision, not a parse bug: the
        test pins the current block-form posture, and a deliberate posture
        change must extend this check first.
        """
        if isinstance(perms, dict):
            return perms
        if str(perms).strip().lower() == 'write-all':
            self.fail(f'{path.name}: {location} uses `permissions: write-all` — '
                      'grants contents:write, violating the no-contents:write posture')
        self.fail(f'{path.name}: {location} permissions is not a block mapping ({perms!r}) — '
                  'unsupported form; this test pins the block-form posture, '
                  'so extend the check before adopting it')

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

    def test_no_contents_write_workflow(self):
        workflows_dir = self.WORKFLOWS_DIR
        self.assertTrue(workflows_dir.is_dir(),
                        f'{workflows_dir} is missing — expected .github/workflows/ next to source/')
        files = sorted(p for p in workflows_dir.iterdir()
                       if p.is_file() and p.suffix in ('.yml', '.yaml'))
        self.assertTrue(files,
                        f'no workflow files found in {workflows_dir} — layout changed')
        violations = []
        checked = []
        for path in files:
            try:
                doc = _parse_workflow_yaml(path.read_text(encoding='utf-8'))
            except ValueError as exc:
                self.fail(f'cannot parse workflow {path.name}: {exc}')
            locations = []
            top = doc.get('permissions')
            if top is not None:
                top = self._require_permissions_mapping(path, 'top-level', top)
                locations.append(('top-level', top))
            jobs = doc.get('jobs')
            if not isinstance(jobs, dict):
                self.fail(f'{path.name}: jobs block is missing or not a mapping — layout changed')
            for job_name, job in jobs.items():
                if not isinstance(job, dict):
                    self.fail(f'{path.name}: job {job_name!r} is not a mapping')
                job_perms = job.get('permissions')
                if job_perms is not None:
                    job_perms = self._require_permissions_mapping(
                        path, f'job {job_name!r}', job_perms)
                    locations.append((f'job {job_name!r}', job_perms))
            for location, perms in locations:
                checked.append(f'{path.name} [{location}]: {perms!r}')
                if str(perms.get('contents', '')).strip().lower() == 'write':
                    violations.append(f'{path.name} [{location}] declares contents: write')
        self.assertFalse(
            violations,
            'no workflow may declare contents: write:\n' + '\n'.join(violations)
            + '\n\npermissions checked:\n' + '\n'.join(checked),
        )


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
        self.git('init', '-q')
        self.git('config', 'user.email', 'hook-test@example')
        self.git('config', 'user.name', 'hook-test')
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
        code, _ = self.hook()
        self.assertEqual(code, 0)

    def test_clean_tree_passes(self):
        code, _ = self.hook()
        self.assertEqual(code, 0)

    def test_unstaged_changes_only_pass(self):
        # Fast path: nothing staged -> hook validates nothing, working tree
        # edits are irrelevant to the pending commit.
        self.edit_content()
        code, _ = self.hook()
        self.assertEqual(code, 0)


if __name__ == '__main__': unittest.main()
