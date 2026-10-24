#!/usr/bin/env python3
"""Build the approved captured portfolio from public content and one small UI script.

Public demo/game records remain separately validated. The captured-public projection excludes experimental engine code and raw scene inputs. `docs/` is generated; never edit it.
"""
from __future__ import annotations
import argparse
import hashlib
import html
import json
import re
import shutil
import struct
from pathlib import Path
from urllib.parse import urlsplit
from game_assets import game_files
from site_policy import (FONT_FILES, validate_fonts, SCENE_ASSETS, SCENE_FILES, SCRIPT_FILES,
                         EXPERIENCE_CSS, audit_scripts, script_integrity)
import portfolio
from capture_policy import CAPTURE_FILES, load_capture
from experience_policy import EXPERIENCE_FILE, load_experience
from source_policy import validate_source_publication

ROOT = Path(__file__).resolve().parent
BASE = 'https://jacobmetoyer.com'
TITLE = 'Jacob Metoyer'
DESC = 'Computer science and physics at Cal State Long Beach. Explore Jacob Metoyer’s research tools, interactive media, games, and the fiction world Spire of Octaves.'
SHARE_ALT = 'Jacob Metoyer. Computer science and physics at Cal State Long Beach.'
ALLOWED_HOSTS = {'github.com', 'jacobmetoyer.com', 'spireofoctaves.com', 'www.linkedin.com', 'mango.blender.org', 'creativecommons.org', 'commons.wikimedia.org', 'www.royalroad.com', 'devpost.com'}
PLAY_HOST = 'jacobmetoyer.com'
CSP = "default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; media-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'"
ROOT_ICONS = ('favicon.ico', 'apple-touch-icon.png')
SHARE_CARD = 'assets/og-card.png'
DATE_RE = re.compile(r'\d{4}-\d{2}-\d{2}')
SLUG_RE = re.compile(r'[a-z][a-z0-9-]{1,31}')
SHOT_RE = re.compile(r'assets/demos/[a-z0-9-]+\.webp')
SECTIONS = (('work', 'Selected work'), ('research', 'Research'), ('worlds', 'Stories & games'), ('about', 'About & contact'))


def text(value, limit: int = 600) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= limit or '<' in value or '>' in value:
        raise ValueError('Invalid text field')
    return value


def safe_url(value) -> str:
    if not isinstance(value, str) or len(value) > 600 or any(c.isspace() for c in value):
        raise ValueError('Invalid URL')
    u = urlsplit(value)
    if (u.scheme != 'https' or u.hostname not in ALLOWED_HOSTS or u.username or u.password
            or u.port or u.query or u.fragment):
        raise ValueError('URL outside approved public link set')
    return value


def keys(obj, expected: set[str], what: str) -> dict:
    if not isinstance(obj, dict) or set(obj) != expected:
        raise ValueError(f'Unexpected {what} fields')
    return obj


def webp_size(path: Path) -> tuple[int, int]:
    b = path.read_bytes()
    if b[:4] != b'RIFF' or b[8:12] != b'WEBP':
        raise ValueError(f'{path.name} is not WebP')
    kind = b[12:16]
    if kind == b'VP8 ':
        w, h = struct.unpack('<HH', b[26:30]); return w & 0x3fff, h & 0x3fff
    if kind == b'VP8L':
        bits = int.from_bytes(b[21:25], 'little'); return (bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1
    if kind == b'VP8X':
        return int.from_bytes(b[24:27], 'little') + 1, int.from_bytes(b[27:30], 'little') + 1
    raise ValueError(f'{path.name}: unknown WebP chunk')


def check_shot(shot) -> None:
    keys(shot, {'src', 'w', 'h', 'alt'}, 'screenshot')
    if not isinstance(shot['src'], str) or not SHOT_RE.fullmatch(shot['src']):
        raise ValueError('Screenshot must be a local assets/demos/*.webp file')
    text(shot['alt'], 240)
    f = ROOT / shot['src']
    if not f.is_file() or f.is_symlink() or not f.resolve().is_relative_to(ROOT):
        raise ValueError(f'Missing or symlinked screenshot {shot["src"]}')
    if webp_size(f) != (shot['w'], shot['h']):
        raise ValueError(f'Declared size differs from {shot["src"]}')


def validate_games(games) -> None:
    """Games and worlds. A game is playable only with a verified browser build on this site."""
    if not isinstance(games, list) or len(games) > 12:
        raise ValueError('Zero to twelve games')
    ids = set()
    for g in games:
        keys(g, {'id', 'name', 'kind', 'line', 'url', 'build'}, 'game')
        if not SLUG_RE.fullmatch(g['id']) or g['id'] in ids:
            raise ValueError('Invalid or duplicate game id')
        ids.add(g['id'])
        text(g['name'], 40); text(g['kind'], 60); text(g['line'], 400); safe_url(g['url'])
        b = g['build']
        if b is None:
            continue
        keys(b, {'play_url', 'verified_at', 'evidence'}, 'game build')
        if urlsplit(safe_url(b['play_url'])).hostname != PLAY_HOST:
            raise ValueError('A playable build must be served from jacobmetoyer.com')
        if not isinstance(b['verified_at'], str) or not DATE_RE.fullmatch(b['verified_at']):
            raise ValueError('Playable build needs a verification date')
        text(b['evidence'], 240)


def validate(data: dict) -> None:
    keys(data, {'visibility', 'name', 'updated', 'hero', 'engine', 'games', 'demos', 'projects', 'about', 'contact'}, 'record')
    if data['visibility'] != 'public':
        raise ValueError('Only explicitly public content can be built')
    if data['name'] != 'Jacob Metoyer':
        raise ValueError('Identity differs from approved public record')
    if not isinstance(data['updated'], str) or not DATE_RE.fullmatch(data['updated']):
        raise ValueError('Updated date must be YYYY-MM-DD')
    hero = keys(data['hero'], {'kicker', 'title', 'lede', 'source'}, 'hero')
    text(hero['kicker'], 80); text(hero['title'], 90); text(hero['lede'], 500); safe_url(hero['source'])
    demos = data['demos']
    if not isinstance(demos, list) or not 1 <= len(demos) <= 6:
        raise ValueError('One to six featured demos')
    ids = set()
    for d in demos:
        keys(d, {'id', 'name', 'tag', 'line', 'detail', 'play', 'repo', 'stack', 'shots'}, 'demo')
        if not SLUG_RE.fullmatch(d['id']) or d['id'] in ids:
            raise ValueError('Invalid or duplicate demo id')
        ids.add(d['id'])
        text(d['name'], 40); text(d['tag'], 60); text(d['line'], 200); text(d['detail'], 400); text(d['stack'], 80)
        keys(d['play'], {'label', 'url'}, 'play link'); text(d['play']['label'], 30); safe_url(d['play']['url'])
        if not safe_url(d['repo']).startswith('https://github.com/Jacob-Met/'):
            raise ValueError('Every demo needs its public repository link')
        keys(d['shots'], {'desktop', 'mobile'}, 'screenshots')
        check_shot(d['shots']['desktop']); check_shot(d['shots']['mobile'])
    e = keys(data['engine'], {'title', 'tagline', 'line', 'slot'}, 'engine'); text(e['title'], 40); text(e['tagline'], 60); text(e['line'], 240)
    s = keys(e['slot'], {'title', 'line'}, 'engine slot'); text(s['title'], 60); text(s['line'], 240)
    validate_games(data['games'])
    projects = data['projects']
    if not isinstance(projects, list) or not 1 <= len(projects) <= 8:
        raise ValueError('One to eight projects')
    for p in projects:
        keys(p, {'name', 'line', 'url'}, 'project'); text(p['name'], 40); text(p['line'], 240); safe_url(p['url'])
    c = keys(data['contact'], {'line', 'url'}, 'contact'); text(c['line'], 200); safe_url(c['url'])
    ab = keys(data['about'], {'lines'}, 'about')
    if not isinstance(ab['lines'], list) or not 1 <= len(ab['lines']) <= 4:
        raise ValueError('One to four about paragraphs')
    for line in ab['lines']:
        text(line, 400)


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def ext(url: str, label: str, cls: str = '') -> str:
    safe_url(url)
    c = f' class="{cls}"' if cls else ''
    return f'<a{c} href="{esc(url)}" rel="noopener">{esc(label)}</a>'


def repo_label(url: str) -> str:
    return 'Source · ' + urlsplit(url).path.strip('/')


def validate_portfolio(data: dict) -> None:
    keys(data, {'visibility','name','updated','github','linkedin','sceneAssets'}, 'captured public portfolio')
    if data['visibility'] != 'public-captured' or data['name'] != 'Jacob Metoyer' or not DATE_RE.fullmatch(data['updated']):
        raise ValueError('Only the approved captured-public identity may publish')
    if safe_url(data['github']) != 'https://github.com/Jacob-Met' or safe_url(data['linkedin']) != 'https://www.linkedin.com/in/jacob-metoyer-15b701352':
        raise ValueError('Portfolio public contact identity differs')
    if data['sceneAssets'] != {key: v[0] for key,v in SCENE_ASSETS.items()}:
        raise ValueError('Unexpected captured-public asset inventory')
    for name,width,height in SCENE_ASSETS.values():
        asset=ROOT/name
        if asset.is_symlink() or not asset.is_file() or webp_size(asset)!=(width,height):
            raise ValueError('Public proof image differs from declared dimensions')
    validate_fonts(ROOT)


def portfolio_record() -> dict:
    data = json.loads((ROOT / 'portfolio.json').read_text(encoding='utf-8'))
    validate_portfolio(data)
    return data


def render_index(r: dict, portfolio_data: dict | None = None) -> str:
    current = portfolio_record() if portfolio_data is None else portfolio_data
    validate_portfolio(current)
    return portfolio.render(current, r, load_experience(ROOT), load_capture(ROOT))


def page_html(name: str, title: str, desc: str, body: str, data: dict) -> str:
    schema = {'@context': 'https://schema.org', '@type': 'Person', 'name': data['name'], 'url': BASE,
              'sameAs': ['https://github.com/Jacob-Met', 'https://www.linkedin.com/in/jacob-metoyer-15b701352']}
    structured = json.dumps(schema, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e')
    canonical = BASE + '/' + ('' if name == 'index.html' else name)
    enhancement = ''
    if name == 'index.html':
        digest = audit_scripts(ROOT)['detail.js']
        enhancement = f'<script src="detail.js" defer integrity="{script_integrity(digest)}"></script>'
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="{CSP}"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><meta name="theme-color" content="#060c17"><meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="canonical" href="{canonical}"><link rel="icon" href="assets/mark.svg" type="image/svg+xml"><link rel="icon" href="favicon.ico" sizes="48x48"><link rel="apple-touch-icon" href="apple-touch-icon.png"><link rel="stylesheet" href="experience.css">{enhancement}
<meta property="og:type" content="website"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{canonical}">
<meta property="og:image" content="{BASE}/{SHARE_CARD}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="{esc(SHARE_ALT)}"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{structured}</script></head>
<body>{body}</body></html>'''


def root_links(name: str, markup: str) -> str:
    if name != '404.html':
        return markup
    return re.sub(r'(\s(?:href|src)=")(?![a-z][a-z0-9+.-]*:|/|#)', r'\1/', markup)


def shot_files(record: dict) -> list[str]:
    return sorted({s['src'] for d in record['demos'] for s in d['shots'].values()})


def output_files(record: dict) -> set[str]:
    return {'index.html', '404.html', 'style.css', EXPERIENCE_CSS, '.nojekyll', 'CNAME',
            'robots.txt', 'sitemap.xml', 'cv.json', 'build-manifest.json', 'portfolio.json',
            'assets/mark.svg', SHARE_CARD, *ROOT_ICONS, *FONT_FILES, *SCENE_FILES,
            *SCRIPT_FILES, *CAPTURE_FILES, EXPERIENCE_FILE, *shot_files(record), *game_files(ROOT, record)}


def build(out: Path, data: dict | None = None) -> dict:
    validate_source_publication(ROOT)
    record = json.loads((ROOT / 'content.json').read_text(encoding='utf-8')) if data is None else json.loads(json.dumps(data))
    validate(record)
    current = portfolio_record()
    audit_scripts(ROOT)
    load_capture(ROOT)
    load_experience(ROOT)
    out = out.resolve()
    if out == ROOT or ROOT.is_relative_to(out):
        raise ValueError('Output must not replace source')
    shots = shot_files(record)
    games = game_files(ROOT, record)
    allowed = output_files(record)
    allowed_prefix = 'assets/demos/'
    if out.exists():
        for f in out.rglob('*'):
            rel = f.relative_to(out).as_posix()
            if f.is_symlink() or (f.is_file() and rel not in allowed and not SHOT_RE.fullmatch(rel)):
                raise ValueError('Output contains unexpected material; refuse to overwrite it')
        stale = out / 'assets' / 'demos'
        if stale.is_dir():
            shutil.rmtree(stale)
    out.mkdir(parents=True, exist_ok=True)
    pages = {
        'index.html': (TITLE, DESC, render_index(record, current)),
        '404.html': ('Not found · Jacob Metoyer', 'Return to Jacob Metoyer’s work.',
                     '<a class="skip" href="#main">Skip to content</a><main id="main" class="not-found"><h1>Nothing here.</h1>'
                     '<p><a class="btn" href="index.html">Back to the work</a></p></main>'),
    }
    for name, (title, desc, body) in pages.items():
        (out / name).write_text(root_links(name, page_html(name, title, desc, body, record)), encoding='utf-8', newline='\n')
    # Preserve the established stylesheet URL as an alias to the current system.
    css = (ROOT / EXPERIENCE_CSS).read_text(encoding='utf-8')
    for name in ('style.css', EXPERIENCE_CSS):
        (out / name).write_text(css, encoding='utf-8', newline='\n')
    for name in (*SCRIPT_FILES, *CAPTURE_FILES, EXPERIENCE_FILE):
        (out / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, out / name)
    (out / 'assets' / 'demos').mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / 'assets' / 'mark.svg', out / 'assets' / 'mark.svg')
    shutil.copyfile(ROOT / SHARE_CARD, out / SHARE_CARD)
    for rel in shots:
        assert rel.startswith(allowed_prefix)
        shutil.copyfile(ROOT / rel, out / rel)
    for rel in {*FONT_FILES, *SCENE_FILES}:
        (out / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / rel, out / rel)
    for rel in games:
        (out / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / rel, out / rel)
    for name in ROOT_ICONS:
        shutil.copyfile(ROOT / 'assets' / name, out / name)
    (out / '.nojekyll').write_text('', encoding='utf-8', newline='\n')
    (out / 'CNAME').write_text('jacobmetoyer.com\n', encoding='utf-8', newline='\n')
    (out / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n', encoding='utf-8', newline='\n')
    sm = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{BASE}/</loc><lastmod>{record["updated"]}</lastmod></url></urlset>'
    (out / 'sitemap.xml').write_text(sm, encoding='utf-8', newline='\n')
    (out / 'cv.json').write_text(json.dumps(record, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    (out / 'portfolio.json').write_text(json.dumps(current, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    files = [f for f in out.rglob('*') if f.is_file() and f.name != 'build-manifest.json']
    manifest = {f.relative_to(out).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest()
                for f in sorted(files, key=lambda f: f.relative_to(out).as_posix())}
    (out / 'build-manifest.json').write_text(json.dumps({'schema': 6, 'date': record['updated'], 'publication': current['visibility'], 'sha256': manifest}, indent=2) + '\n', encoding='utf-8', newline='\n')
    return {'pages': len(pages), 'demos': len(record['demos']) + 1, 'presentation': 'captured-native-engine', 'publication': current['visibility'], 'output': str(out), 'files': len(manifest) + 1}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--out', type=Path, default=ROOT.parent / 'docs')
    a = p.parse_args()
    print(json.dumps(build(a.out), indent=2))
