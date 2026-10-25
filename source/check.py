#!/usr/bin/env python3
"""Offline integrity checks for the generated site: declared surface, links, anchors, manifest.

The homepage has checksum-pinned local UI scripts and explicitly captured native media.
Inline execution, undeclared modules, handlers, frames, remote resources and non-HTTPS
links remain forbidden. Public game runtime uses its separate immutable bundle audit.
"""
from __future__ import annotations
import argparse, hashlib, json, re
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET
from game_assets import GAME_PATH, audit_game_bundle
from capture_policy import load_capture, video_element_errors, source_element_errors, CAPTURE_FILE, PROOF_FILE
from lobby_policy import load_lobby, route_video_errors, route_source_errors, validate_retained_engine_media
from figure_policy import load_figures, picture_source_errors
from branch_policy import load_branches, branch_video_errors, branch_source_errors, BRANCHES, DIRECTIONS, validate_retained_branch_media
from experience_policy import load_experience
from site_policy import (FONT_PROPERTIES, validate_fonts, SCRIPT_FILES, LOADED_SCRIPT_FILES,
                         audit_scripts, script_element_errors, canvas_element_errors, ART_FILES, validate_art, EDITORIAL_FILES, EDITORIAL_ART, validate_editorial, PRESENTATION_FILES, PRESENTATION_STILLS, DELIVERY_STILLS, validate_presentation_stills)

ROOT_RELATIVE_PAGES = frozenset({'404.html'})
CSP_REQUIRED = {'default-src': "'none'", 'style-src': "'self'", 'script-src': "'self'", 'img-src': "'self'", 'media-src': "'self'", 'font-src': "'self'", 'connect-src': "'none'", 'object-src': "'none'", 'frame-src': "'none'", 'worker-src': "'none'", 'base-uri': "'none'", 'form-action': "'none'"}
EXPECTED_HTML = {'index.html', '404.html'}


def rooted_ref(page: str, value: str) -> str | None:
    if page in ROOT_RELATIVE_PAGES and value.startswith('/') and not value.startswith(('//', '/\\')):
        return value[1:]
    return None


def local_path(value: str) -> bool:
    try: ref = urlsplit(value)
    except ValueError: return False
    decoded = unquote(ref.path)
    return (bool(decoded) and not ref.scheme and not ref.netloc and not ref.query
            and not decoded.startswith(('/', '\\')) and '\\' not in decoded and ':' not in decoded
            and not any(ord(c) < 32 for c in decoded) and '..' not in PurePosixPath(decoded).parts)


class Page(HTMLParser):
    def __init__(self, hashes=None, lobby=None, figures=None, branches=None):
        super().__init__(convert_charrefs=True)
        self.hashes = {} if hashes is None else hashes
        self.figures = figures or {}; self.in_picture = False
        self.branches = branches or {}
        self.lobby = lobby; self.videos = []; self.sources = []; self.current_video = None
        self.script_entries = []; self.script_attrs = None; self.canvases = []
        self.ids = []; self.links = []; self.resources = []; self.errors = []
        self.h1 = 0; self.lang = None; self.csp = []; self.head_order = []
        self.script_type = None; self.script_text = []; self.text = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if len(a) != len(attrs): self.errors.append(f'{tag}: duplicate attributes')
        if tag in ('meta', 'link', 'script', 'title') and len(self.head_order) < 3: self.head_order.append((tag, a.get('http-equiv', '').lower()))
        if tag == 'meta' and a.get('http-equiv', '').lower() == 'content-security-policy': self.csp.append(a.get('content', ''))
        if tag == 'meta' and a.get('http-equiv', '').lower() in ('refresh', 'set-cookie'): self.errors.append('meta: redirect or cookie')
        if 'id' in a: self.ids.append(a['id'])
        if tag == 'html': self.lang = a.get('lang')
        if tag == 'h1': self.h1 += 1
        if tag == 'img':
            src = a.get('src') or ''
            if a.get('id') == 'scene-still':
                expected = {'src': DELIVERY_STILLS['entrance']['src'], 'data-entrance-src': DELIVERY_STILLS['entrance']['src'], 'data-arrival-src': PRESENTATION_STILLS['arrival']['src'], 'width': '1280', 'height': '800'}
                expected.update({f'data-{key}-src':route['still']['src'] for key,route in self.branches.items()})
                if any(a.get(k) != v for k,v in expected.items()): self.errors.append('img: scene endpoint attributes outside exact native stills')
            for record in DELIVERY_STILLS.values():
                if src == record['src'] and (a.get('width'), a.get('height')) != (str(record['width']), str(record['height'])):
                    self.errors.append('img: native presentation dimensions differ')
            if src in EDITORIAL_ART and (a.get('width'),a.get('height')) != tuple(str(EDITORIAL_ART[src][k]) for k in ('width','height')): self.errors.append('img: editorial artwork dimensions differ')
            approved = {CAPTURE_FILE, PROOF_FILE, 'games/lanternwake/desktop.png', *ART_FILES, *EDITORIAL_FILES, *PRESENTATION_FILES} | {r['src'] for r in self.figures.values()}
            approved |= {r['still']['src'] for r in self.branches.values()}
            if self.lobby:
                approved |= {self.lobby['media'][k]['src'] for k in ('entrance', 'arrival')} | {self.lobby['proof']['src']}
            if not re.fullmatch(r'/?assets/demos/[a-z0-9-]+\.webp', src) and src not in approved:
                self.errors.append('img: outside the declared local project-image inventory')
            decorative = self.lobby and ((a.get('id') == 'scene-still' and src == self.lobby['media']['entrance']['src']) or src == self.lobby['media']['arrival']['src'])
            decorative = decorative or (src in PRESENTATION_FILES and (a.get('id') in ('scene-still','scene-buffer') or src == PRESENTATION_STILLS['arrival']['src']))
            if not (a.get('alt') or '').strip() and not decorative: self.errors.append('img: missing alt text')
            if not (str(a.get('width', '')).isdigit() and str(a.get('height', '')).isdigit()): self.errors.append('img: missing explicit width/height')
        if tag in ('form', 'iframe', 'object', 'embed', 'base', 'style', 'audio', 'svg'):
            self.errors.append(f'{tag}: outside declared surface')
        if tag == 'picture':
            if self.in_picture or a or not self.figures: self.errors.append('picture: outside declared computed figures')
            self.in_picture = True
        if tag == 'video':
            self.videos.append(a); self.current_video = a.get('id')
            self.errors.extend(branch_video_errors(a,self.branches) if 'data-route' in a else route_video_errors(a, self.lobby) if self.lobby else video_element_errors(a))
            if a.get('poster'): self.resources.append(a['poster'])
        if tag == 'source':
            if self.in_picture:
                self.errors.extend(picture_source_errors(a, self.figures))
                if a.get('srcset'): self.resources.append(a['srcset'])
            else:
                self.sources.append((self.current_video, a))
                self.errors.extend(branch_source_errors(a,self.current_video,self.branches) if self.current_video not in ('route-forward','route-reverse',None) else route_source_errors(a, self.lobby) if self.lobby else source_element_errors(a))
        if tag == 'canvas':
            self.canvases.append(a)
            self.errors.extend(canvas_element_errors(a))
        if any(k.startswith('on') or k in ('srcdoc', 'ping', 'style') or (k == 'srcset' and not (tag == 'source' and self.in_picture)) for k in a): self.errors.append(f'{tag}: inline attribute outside declared surface')
        if tag in ('a', 'link') and a.get('href'): self.links.append(a['href'])
        if tag == 'link' and set(a.get('rel', '').lower().split()) & {'stylesheet', 'icon', 'apple-touch-icon', 'preload', 'modulepreload', 'prefetch', 'preconnect', 'dns-prefetch', 'manifest'}:
            self.resources.append(a.get('href', ''))
        if a.get('src'): self.resources.append(a['src'])
        if tag == 'script':
            self.script_type = a.get('type', ''); self.script_text = []; self.script_attrs = a

    def handle_data(self, data):
        if self.script_type is not None: self.script_text.append(data)
        else: self.text.append(data)

    def handle_endtag(self, tag):
        if tag == 'picture': self.in_picture = False
        if tag == 'video': self.current_video = None
        if tag == 'script' and self.script_type is not None:
            source = ''.join(self.script_text)
            self.errors.extend(script_element_errors(self.script_attrs, source, self.hashes))
            self.script_entries.append((self.script_attrs, source))
            self.script_type = None; self.script_attrs = None


def csp_errors(p: Page) -> list[str]:
    if len(p.csp) != 1: return ['expected exactly one Content-Security-Policy meta']
    if p.head_order[:2] != [('meta', ''), ('meta', 'content-security-policy')]: return ['Content-Security-Policy must directly follow meta charset']
    policy = {}
    for part in p.csp[0].split(';'):
        bits = part.split()
        if bits:
            name = bits[0].lower()
            if name in policy: return ['CSP contains duplicate directive: ' + name]
            policy[name] = ' '.join(bits[1:])
    errors = [f'CSP {k} must be {v}' for k, v in CSP_REQUIRED.items() if policy.get(k) != v]
    extra = set(policy) - set(CSP_REQUIRED)
    if extra: errors.append('CSP has undeclared directives: ' + ', '.join(sorted(extra)))
    return errors


def css_surface(text: str) -> tuple[list[str], list[str]]:
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    text = re.sub(r'\\([0-9a-fA-F]{1,6})\s?', lambda m: chr(int(m[1], 16)) if 0 < int(m[1], 16) <= 0x10ffff else '\ufffd', text)
    text = re.sub(r'\\(.)', r'\1', text, flags=re.S)
    errors = []
    faces = re.findall(r'@font-face\s*\{([^{}]*)\}', text, re.I)
    if len(faces) > 1:
        errors.append('Only one declared local font face is permitted')
    for face in faces:
        pairs = [p.strip().split(':', 1) for p in face.split(';') if p.strip()]
        if any(len(p) != 2 for p in pairs):
            errors.append('Malformed local font declaration'); continue
        props = {k.strip(): v.strip() for k, v in pairs}
        if len(props) != len(pairs) or props != FONT_PROPERTIES:
            errors.append('Font face outside explicit local font declaration')
    remainder = re.sub(r'@font-face\s*\{[^{}]*\}', '', text, flags=re.I)
    if re.search(r'@import\b|@font-face\b|expression\s*\(|(?<![\w-])(?:-moz-binding|behavior)\s*:|image-set\s*\(', remainder, re.I):
        errors.append('CSS import, undeclared font-face, image-set or legacy execution outside declared surface')
    resources = [v.strip().strip('"\'') for v in re.findall(r'url\s*\((.*?)\)', text, re.I | re.S)]
    return errors, resources


def svg_surface(text: str) -> tuple[list[str], list[str]]:
    if '<!DOCTYPE' in text.upper() or '<!ENTITY' in text.upper(): return ['SVG document types/entities are unsupported'], []
    try: tree = ET.fromstring(text)
    except ET.ParseError: return ['Invalid SVG XML'], []
    errors, resources = [], []
    for node in tree.iter():
        tag = node.tag.rsplit('}', 1)[-1].lower()
        if tag in ('script', 'foreignobject', 'style', 'animate', 'set', 'image', 'use'): errors.append('SVG active or referencing element outside declared surface')
        for key, value in node.attrib.items():
            key = key.rsplit('}', 1)[-1].lower()
            if key.startswith('on') or key == 'style': errors.append('SVG executable or inline-style attribute')
            if key in ('href', 'src'): resources.append(value)
    return errors, resources


def check(root: Path, *, preview=False) -> dict:
    root = root.resolve(); failures = []; parsed = {}; game_manifest = {}; hashes = {}; lobby = None; figures = {}; branches = {}
    if not root.is_dir(): return {'passed': False, 'html_pages': 0, 'files': 0, 'failures': ['output root missing']}
    try:
        lobby = load_lobby(root, allow_private_preview=preview)
    except (ValueError, OSError, TypeError, KeyError) as error:
        failures.append('Recorded-route boundary: ' + str(error))
    try:
        branches = load_branches(root, allow_private_preview=preview)
    except (ValueError,OSError,TypeError,KeyError) as error:
        failures.append('Branch route boundary: '+str(error))
    try:
        figures = load_figures(root)
    except (ValueError, OSError, UnicodeError, TypeError, KeyError, ET.ParseError) as error:
        failures.append('Computed-figure boundary: ' + str(error))
    try:
        hashes = audit_scripts(root)
    except (ValueError, OSError, UnicodeError) as error:
        failures.append('Homepage script custody: ' + str(error))
    try:
        validate_fonts(root)
        validate_art(root)
        validate_editorial(root)
        validate_presentation_stills(root)
        validate_retained_engine_media(root)
        validate_retained_branch_media(root)
    except (ValueError, OSError, UnicodeError) as error:
        failures.append('Font publication boundary: ' + str(error))
    if (root / 'games').exists():
        try:
            if {p.name for p in (root / 'games').iterdir()} != {GAME_PATH.split('/')[1]}:
                raise ValueError('Undeclared game directory')
            game_manifest = audit_game_bundle(root / GAME_PATH)
        except (ValueError, OSError, UnicodeError) as error:
            failures.append('Game publication boundary: ' + str(error))
    for f in sorted(root.rglob('*')):
        rel = f.relative_to(root).as_posix()
        if f.is_symlink(): failures.append(f'{rel}: symlink outside declared output surface'); continue
        if not f.is_file(): continue
        if rel.startswith(GAME_PATH + '/'):
            if f.name not in game_manifest: failures.append(f'{rel}: undeclared game file')
            continue  # The game subpage uses audit_game_bundle, not root-page policy.
        if f.suffix == '.html':
            try: text = f.read_text(encoding='utf-8')
            except (OSError, UnicodeError): failures.append(f'{rel}: unreadable HTML'); continue
            p = Page(hashes, lobby, figures, branches); p.feed(text); p.close(); parsed[rel] = p
            failures.extend(f'{rel}: {e}' for e in p.errors)
            for value in p.resources:
                rooted = rooted_ref(rel, value)
                value = rooted if rooted is not None else value
                if not local_path(value): failures.append(f'{rel}: nonlocal or ambiguous resource {value}'); continue
                target = root / unquote(urlsplit(value).path)
                if not target.resolve().is_relative_to(root) or target.is_symlink(): failures.append(f'{rel}: escaped resource')
                elif not target.is_file(): failures.append(f'{rel}: missing local resource {value}')
        elif f.suffix in ('.js', '.mjs', '.cjs'):
            if rel not in SCRIPT_FILES: failures.append(f'{rel}: undeclared executable file')
        elif f.suffix in ('.css', '.svg'):
            try: text = f.read_text(encoding='utf-8')
            except (OSError, UnicodeError): failures.append(f'{rel}: unreadable UTF-8'); continue
            errors, resources = css_surface(text) if f.suffix == '.css' else svg_surface(text)
            failures.extend(f'{rel}: {e}' for e in errors)
            for value in resources:
                if value.startswith('#'): continue
                if not local_path(value): failures.append(f'{rel}: nonlocal or ambiguous resource'); continue
                target = f.parent / unquote(urlsplit(value).path)
                if not target.resolve().is_relative_to(root) or target.is_symlink() or not target.is_file(): failures.append(f'{rel}: missing or escaped resource')
    if set(parsed) != EXPECTED_HTML: failures.append(f'Expected HTML routes {sorted(EXPECTED_HTML)}, found {sorted(parsed)}')
    for name, p in parsed.items():
        kinds = [a.get('type', '') for a, _ in p.script_entries]
        expected_kinds = ['application/ld+json'] + ([''] * len(LOADED_SCRIPT_FILES) if name == 'index.html' else [])
        if sorted(kinds) != sorted(expected_kinds): failures.append(f'{name}: incorrect script/data inventory')
        expected_scripts = list(LOADED_SCRIPT_FILES) if name == 'index.html' else []
        if [a['src'] for a, _ in p.script_entries if 'src' in a] != expected_scripts:
            failures.append(f'{name}: incorrect script order or duplicate compatibility handler')
        if lobby:
            expected_sources = [(f'route-{direction}', {'src': lobby['media'][direction]['src'], 'type': 'video/mp4'}) for direction in ('forward', 'reverse')] if name == 'index.html' else []
            if name == 'index.html':
                expected_sources += [(f'route-{key}-{direction}', {'src':branches[key]['media'][direction]['src'],'type':'video/mp4'}) for key in BRANCHES if key in branches for direction in DIRECTIONS]
            if p.sources != expected_sources or len(p.videos) != len(expected_sources):
                failures.append(f'{name}: incorrect route video/source inventory')
        if p.canvases: failures.append(f'{name}: incorrect canvas inventory')
        if p.h1 != 1: failures.append(f'{name}: expected one h1')
        if p.lang != 'en': failures.append(f'{name}: missing language')
        failures.extend(f'{name}: {e}' for e in csp_errors(p))
        if len(p.ids) != len(set(p.ids)): failures.append(f'{name}: duplicate ids')
        for u in p.links:
            try: ref = urlsplit(u)
            except ValueError: failures.append(f'{name}: malformed URL'); continue
            if ref.scheme:
                if ref.scheme != 'https': failures.append(f'{name}: non-HTTPS link')
                continue
            if ref.netloc: failures.append(f'{name}: scheme-relative URL'); continue
            path = unquote(ref.path)
            if path and name not in ROOT_RELATIVE_PAGES and not local_path(path): failures.append(f'{name}: unsafe local link {u}'); continue
            rooted = rooted_ref(name, path)
            if rooted is not None: path = rooted or 'index.html'
            elif path.startswith('/'): failures.append(f'{name}: root-relative link outside 404'); continue
            target = (root / (path or name)).resolve()
            if not target.is_relative_to(root): failures.append(f'{name}: escaped path'); continue
            if not target.exists(): failures.append(f'{name}: missing {path}')
            tname = target.relative_to(root).as_posix()
            if ref.fragment and tname in parsed and ref.fragment not in parsed[tname].ids: failures.append(f'{name}: missing anchor {u}')
    try:
        import build
        import portfolio
        public_record = json.loads((root / 'cv.json').read_text(encoding='utf-8'))
        preview_record = json.loads((root / 'portfolio.json').read_text(encoding='utf-8'))
        build.validate(public_record); build.validate_portfolio(preview_record)
        load_experience(root); load_capture(root)
        route = load_lobby(root, allow_private_preview=preview)
        expected_files = build.output_files(public_record, route, load_figures(root), load_branches(root, allow_private_preview=preview))
        actual_files = {f.relative_to(root).as_posix() for f in root.rglob('*') if f.is_file()}
        if actual_files != expected_files:
            failures.append('Output inventory differs from explicit artifact allowlist')
    except (ValueError, OSError, UnicodeError, TypeError, KeyError) as error:
        failures.append('Portfolio data boundary: ' + str(error))
    try:
        obj = json.loads((root / 'build-manifest.json').read_text(encoding='utf-8')); manifest = obj['sha256']
        if not isinstance(manifest, dict): raise ValueError('Invalid manifest shape')
        expected_publication = lobby['visibility'] if lobby else 'public-captured'
        if obj.get('schema') != 7 or obj.get('publication') != expected_publication:
            failures.append('Manifest must identify the exact recorded-route projection')
    except (OSError, ValueError, KeyError, TypeError): failures.append('Missing or malformed build manifest'); manifest = {}
    for name, sha in manifest.items():
        if not isinstance(name, str) or not local_path(name) or '#' in name or not isinstance(sha, str) or not re.fullmatch('[0-9a-f]{64}', sha):
            failures.append('Unsafe or malformed manifest entry'); continue
        f = root / name
        if not f.resolve().is_relative_to(root) or f.is_symlink(): failures.append('Manifest entry escapes output'); continue
        if not f.is_file() or hashlib.sha256(f.read_bytes()).hexdigest() != sha: failures.append(f'Hash mismatch {name}')
    actual = {f.relative_to(root).as_posix() for f in root.rglob('*') if f.is_file()}
    if actual != set(manifest) | {'build-manifest.json'}: failures.append('Manifest does not cover all files')
    return {'passed': not failures, 'html_pages': len(parsed), 'files': len(actual), 'failures': failures}


if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('root', type=Path)
    p.add_argument('--preview', action='store_true', help='Check an explicitly local-preview candidate, not a publication qualification')
    a = p.parse_args()
    r = check(a.root, preview=a.preview); print(json.dumps(r, indent=2)); raise SystemExit(0 if r['passed'] else 1)
