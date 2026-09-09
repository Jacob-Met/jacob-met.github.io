"""Declared static-site surface checks, not a general HTML/JS sanitizer.

Original 2026-09-09 regression work. Public site: local assets, one reviewed
script, JSON-LD, and explicit outbound links; no collection or remote embeds.
"""
from __future__ import annotations
import json
import re
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET


def local_path(value: str) -> bool:
    """Reject ambiguous/remote asset paths before resolving or reading them."""
    try:
        ref = urlsplit(value)
    except ValueError:
        return False
    decoded = unquote(ref.path)
    return (bool(decoded) and not ref.scheme and not ref.netloc
            and not ref.query and not decoded.startswith(('/', '\\'))
            and '\\' not in decoded and ':' not in decoded
            and not any(ord(c) < 32 for c in decoded)
            and '..' not in PurePosixPath(decoded).parts)


class Surface(HTMLParser):
    """Inspect rendered HTML without executing it."""
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.errors: list[str] = []
        self.resources: list[str] = []
        self.script_type: str | None = None
        self.script_text: list[str] = []

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if len(data) != len(attrs):
            self.errors.append(f'{tag}: duplicate attributes')
        if tag in {'form', 'iframe', 'object', 'embed', 'base', 'style', 'foreignobject'}:
            self.errors.append(f'{tag}: outside declared static surface')
        if any(k.startswith('on') or k in {'srcdoc', 'ping', 'style'} for k in data):
            self.errors.append(f'{tag}: executable or unreviewed inline attribute')
        if tag == 'meta' and data.get('http-equiv', '').lower() in {'refresh', 'set-cookie'}:
            self.errors.append('meta: automatic redirect or cookie mutation')
        if tag == 'link' and set(data.get('rel', '').lower().split()) & {
                'stylesheet', 'icon', 'preload', 'modulepreload', 'prefetch',
                'preconnect', 'dns-prefetch', 'manifest'}:
            self.resources.append(data.get('href', ''))
        for key in ('src', 'poster'):
            if data.get(key): self.resources.append(data[key])
        for item in data.get('srcset', '').split(','):
            if item.strip(): self.resources.append(item.strip().split()[0])
        if tag == 'script':
            self.script_type = data.get('type', '')
            self.script_text = []
            if data.get('src') not in {None, 'site.js'}:
                self.errors.append('script: unsupported source')
            if not data.get('src') and self.script_type != 'application/ld+json':
                self.errors.append('script: executable inline body')

    def handle_data(self, data):
        if self.script_type is not None: self.script_text.append(data)

    def handle_endtag(self, tag):
        if tag == 'script' and self.script_type is not None:
            if self.script_type == 'application/ld+json':
                try: json.loads(''.join(self.script_text))
                except (ValueError, TypeError): self.errors.append('script: invalid JSON-LD')
            self.script_type = None


def css_surface(text: str) -> tuple[list[str], list[str]]:
    """Conservative profile: local url() assets; no imports or legacy execution."""
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    def unescape(match):
        value = int(match[1], 16)
        return chr(value) if 0 < value <= 0x10ffff else '\ufffd'
    text = re.sub(r'\\([0-9a-fA-F]{1,6})\s?', unescape, text)
    text = re.sub(r'\\(.)', r'\1', text, flags=re.S)
    errors = []
    if re.search(r'@import\b|expression\s*\(|(?<![\w-])(?:-moz-binding|behavior)\s*:', text, re.I):
        errors.append('CSS import or legacy execution outside declared surface')
    resources = [v.strip().strip('\"\'') for v in re.findall(r'url\s*\((.*?)\)', text, re.I | re.S)]
    if re.search(r'image-set\s*\(', text, re.I):
        errors.append('CSS image-set requires explicit checker support')
    return errors, resources

def svg_surface(text: str) -> tuple[list[str], list[str]]:
    errors, resources = [], []
    if '<!DOCTYPE' in text.upper() or '<!ENTITY' in text.upper():
        return ['SVG document types/entities are unsupported'], []
    try: tree = ET.fromstring(text)
    except ET.ParseError: return ['Invalid SVG XML'], []
    for node in tree.iter():
        tag = node.tag.rsplit('}', 1)[-1].lower()
        if tag in {'script', 'foreignobject', 'style', 'animate', 'set'}:
            errors.append('SVG active element outside declared surface')
        for key, value in node.attrib.items():
            key = key.rsplit('}', 1)[-1].lower()
            if key.startswith('on') or key == 'style':
                errors.append('SVG executable or inline-style attribute')
            if key in {'href', 'src'} and not value.startswith('#'):
                resources.append(value)
            css_errors, css_resources = css_surface(value)
            errors.extend(css_errors)
            resources.extend(v for v in css_resources if not v.startswith('#'))
    return errors, resources


def check_surface(root: Path, allow_missing_images: bool = False) -> list[str]:
    """Examine only the declared output tree; never dereference a symlink."""
    root = root.resolve()
    failures = []
    for path in sorted(root.rglob('*')):
        relative = path.relative_to(root).as_posix()
        if path.is_symlink():
            failures.append(f'{relative}: symlink outside declared output surface')
            continue
        if not path.is_file() or path.suffix not in {'.html', '.css', '.svg'}:
            continue
        try: text = path.read_text(encoding='utf-8')
        except (OSError, UnicodeError):
            failures.append(f'{relative}: unreadable UTF-8'); continue
        if path.suffix == '.html':
            parser = Surface(); parser.feed(text); parser.close()
            errors, resources = parser.errors, parser.resources
        elif path.suffix == '.css':
            errors, resources = css_surface(text)
        else:
            errors, resources = svg_surface(text)
        failures.extend(f'{relative}: {error}' for error in errors)
        for value in resources:
            if not local_path(value):
                failures.append(f'{relative}: nonlocal or ambiguous resource')
                continue
            target = path.parent / unquote(urlsplit(value).path)
            if not target.resolve().is_relative_to(root) or target.is_symlink():
                failures.append(f'{relative}: escaped resource')
            elif not target.is_file() and not (allow_missing_images and target.suffix == '.webp'):
                failures.append(f'{relative}: missing local resource')
    return failures
