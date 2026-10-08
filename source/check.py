#!/usr/bin/env python3
"""Offline integrity checks for the generated site: declared surface, links, anchors, manifest.

The portfolio pages have no executable script. The one pinned TasteTable subtree is
admitted only after exact source-inventory and byte verification. Any <script> other than a JSON-LD data block, any
inline handler, form, frame, remote resource or non-HTTPS link is a failure. Images are allowed
only as local demo captures (assets/demos/*.webp) with explicit width, height and alt text.
"""
from __future__ import annotations
import argparse, hashlib, json, re
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET
from tastetable import DIRECTORY as APP_DIRECTORY, read_files as read_app_files

ROOT_RELATIVE_PAGES = frozenset({'404.html'})
CSP_REQUIRED = {'default-src': "'none'", 'style-src': "'self'", 'img-src': "'self'", 'base-uri': "'none'", 'form-action': "'none'"}
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
    def __init__(self):
        super().__init__(convert_charrefs=True)
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
            if not re.fullmatch(r'/?assets/demos/[a-z0-9-]+\.webp', src): self.errors.append('img: only local assets/demos/*.webp captures are allowed')
            if not (a.get('alt') or '').strip(): self.errors.append('img: missing alt text')
            if not (str(a.get('width', '')).isdigit() and str(a.get('height', '')).isdigit()): self.errors.append('img: missing explicit width/height')
        if tag in ('form', 'iframe', 'object', 'embed', 'base', 'style', 'video', 'audio', 'picture', 'svg', 'canvas'):
            self.errors.append(f'{tag}: outside declared surface')
        if any(k.startswith('on') or k in ('srcdoc', 'ping', 'style', 'srcset') for k in a): self.errors.append(f'{tag}: inline attribute outside declared surface')
        if tag in ('a', 'link') and a.get('href'): self.links.append(a['href'])
        if tag == 'link' and set(a.get('rel', '').lower().split()) & {'stylesheet', 'icon', 'apple-touch-icon', 'preload', 'modulepreload', 'prefetch', 'preconnect', 'dns-prefetch', 'manifest'}:
            self.resources.append(a.get('href', ''))
        if a.get('src'): self.resources.append(a['src'])
        if tag == 'script':
            self.script_type = a.get('type', ''); self.script_text = []
            if a.get('src') is not None or self.script_type != 'application/ld+json': self.errors.append('script: executable script')

    def handle_data(self, data):
        if self.script_type is not None: self.script_text.append(data)
        else: self.text.append(data)

    def handle_endtag(self, tag):
        if tag == 'script' and self.script_type is not None:
            try: json.loads(''.join(self.script_text))
            except (ValueError, TypeError): self.errors.append('script: invalid JSON-LD')
            self.script_type = None


def csp_errors(p: Page) -> list[str]:
    if len(p.csp) != 1: return ['expected exactly one Content-Security-Policy meta']
    if p.head_order[:2] != [('meta', ''), ('meta', 'content-security-policy')]: return ['Content-Security-Policy must directly follow meta charset']
    policy = {}
    for part in p.csp[0].split(';'):
        bits = part.split()
        if bits: policy[bits[0].lower()] = ' '.join(bits[1:])
    errors = [f'CSP {k} must be {v}' for k, v in CSP_REQUIRED.items() if policy.get(k) != v]
    extra = set(policy) - set(CSP_REQUIRED)
    if extra: errors.append('CSP has undeclared directives: ' + ', '.join(sorted(extra)))
    return errors


def css_surface(text: str) -> tuple[list[str], list[str]]:
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    text = re.sub(r'\\([0-9a-fA-F]{1,6})\s?', lambda m: chr(int(m[1], 16)) if 0 < int(m[1], 16) <= 0x10ffff else '\ufffd', text)
    text = re.sub(r'\\(.)', r'\1', text, flags=re.S)
    errors = []
    if re.search(r'@import\b|@font-face\b|expression\s*\(|(?<![\w-])(?:-moz-binding|behavior)\s*:|image-set\s*\(', text, re.I):
        errors.append('CSS import, font-face, image-set or legacy execution outside declared surface')
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


def check(root: Path) -> dict:
    root = root.resolve(); failures = []; parsed = {}
    if not root.is_dir(): return {'passed': False, 'html_pages': 0, 'files': 0, 'failures': ['output root missing']}
    application_paths = set()
    try:
        application_paths = {f'{APP_DIRECTORY}/{name}' for name in read_app_files(root / APP_DIRECTORY)}
    except (OSError, ValueError) as error:
        failures.append(f'TasteTable admission failed: {error}')
    for f in sorted(root.rglob('*')):
        rel = f.relative_to(root).as_posix()
        if f.is_symlink(): failures.append(f'{rel}: symlink outside declared output surface'); continue
        if not f.is_file(): continue
        if rel in application_paths: continue
        if f.suffix == '.html':
            try: text = f.read_text(encoding='utf-8')
            except (OSError, UnicodeError): failures.append(f'{rel}: unreadable HTML'); continue
            p = Page(); p.feed(text); p.close(); parsed[rel] = p
            failures.extend(f'{rel}: {e}' for e in p.errors)
            for value in p.resources:
                rooted = rooted_ref(rel, value)
                value = rooted if rooted is not None else value
                if not local_path(value): failures.append(f'{rel}: nonlocal or ambiguous resource {value}'); continue
                target = root / unquote(urlsplit(value).path)
                if not target.resolve().is_relative_to(root) or target.is_symlink(): failures.append(f'{rel}: escaped resource')
                elif not target.is_file(): failures.append(f'{rel}: missing local resource {value}')
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
        obj = json.loads((root / 'build-manifest.json').read_text(encoding='utf-8')); manifest = obj['sha256']
        if not isinstance(manifest, dict): raise ValueError('Invalid manifest shape')
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
    p = argparse.ArgumentParser(); p.add_argument('root', type=Path); a = p.parse_args()
    r = check(a.root); print(json.dumps(r, indent=2)); raise SystemExit(0 if r['passed'] else 1)
