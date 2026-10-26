"""Checksum-pinned AVIF/WebP delivery derivatives of already-published images.

`responsive-images.json` (written by make_responsive.py) declares every derivative. The
builder copies them and the checker admits exactly these <picture> sources; originals stay
at their existing URLs as the <img> fallback.
"""
from __future__ import annotations
import hashlib
import json
import re
from html import escape
from pathlib import Path

MANIFEST = 'responsive-images.json'
PREFIX = 'assets/derived/'
TYPES = {'avif': 'image/avif', 'webp': 'image/webp'}
SIZES_RE = re.compile(r'[a-z0-9(): ,.-]{1,120}')


def load(root: Path) -> dict:
    data = json.loads((root / MANIFEST).read_text(encoding='utf-8'))
    if not isinstance(data, dict) or data.get('schema') != 1 or not isinstance(data.get('images'), dict):
        raise ValueError('Malformed responsive-image manifest')
    for key, record in data['images'].items():
        if not re.fullmatch(r'[a-z0-9-]+', key) or not record.get('variants'):
            raise ValueError('Malformed responsive-image record')
        for v in record['variants']:
            src = v['src']; ext = src.rsplit('.', 1)[-1]
            if (not src.startswith(PREFIX + key + '-') or TYPES.get(ext) != v['type'] or '/' in src[len(PREFIX):]
                    or not (isinstance(v['width'], int) and isinstance(v['height'], int))):
                raise ValueError('Responsive derivative outside declared inventory')
            path = root / src
            if path.is_symlink() or not path.is_file():
                raise ValueError('Missing responsive derivative ' + src)
            raw = path.read_bytes()
            if len(raw) != v['bytes'] or hashlib.sha256(raw).hexdigest() != v['sha256']:
                raise ValueError('Responsive derivative checksum differs: ' + src)
    return data


def files(data: dict) -> set[str]:
    return {v['src'] for record in data['images'].values() for v in record['variants']}


def srcset(data: dict, key: str, kind: str) -> str:
    variants = sorted((v for v in data['images'][key]['variants'] if v['type'] == TYPES[kind]), key=lambda v: v['width'])
    return ', '.join(f'{v["src"]} {v["width"]}w' for v in variants)


def sources(data: dict, key: str, sizes: str, media: str | None = None) -> str:
    """AVIF first, then WebP when declared; the enclosing <img> keeps the original fallback."""
    if not SIZES_RE.fullmatch(sizes):
        raise ValueError('Unsafe sizes value')
    m = f' media="{escape(media)}"' if media else ''
    out = []
    for kind in ('avif', 'webp'):
        value = srcset(data, key, kind)
        if value:
            out.append(f'<source{m} type="{TYPES[kind]}" srcset="{escape(value)}" sizes="{escape(sizes)}">')
    return ''.join(out)


def source_errors(attrs: dict, data: dict) -> list[str]:
    """Admit only sources whose srcset exactly matches one declared derivative set."""
    if set(attrs) - {'type', 'srcset', 'sizes', 'media'} or not SIZES_RE.fullmatch(attrs.get('sizes') or ''):
        return ['source: outside declared responsive derivatives']
    kind = {v: k for k, v in TYPES.items()}.get(attrs.get('type'))
    ok = kind and any(attrs.get('srcset') == srcset(data, key, kind) for key in data['images'])
    return [] if ok else ['source: outside declared responsive derivatives']


def srcset_urls(value: str) -> list[str]:
    return [part.strip().split()[0] for part in value.split(',') if part.strip()]


def is_declared(attrs: dict, data: dict) -> bool:
    kind = {v: k for k, v in TYPES.items()}.get(attrs.get('type'))
    return bool(kind) and any(attrs.get('srcset') == srcset(data, key, kind) for key in data['images'])


_SOURCE_ROOT = Path(__file__).resolve().parent
_current = None


def current() -> dict:
    """The verified source manifest, loaded once for the renderers."""
    global _current
    if _current is None:
        _current = load(_SOURCE_ROOT)
    return _current


def picture(key: str, img: str, sizes: str, cls: str = '') -> str:
    """Wrap an existing <img> (the original fallback) with declared AVIF/WebP sources."""
    c = f' class="{escape(cls)}"' if cls else ''
    return f'<picture{c}>' + sources(current(), key, sizes) + img + '</picture>'
