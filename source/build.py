#!/usr/bin/env python3
"""Build jacobmetoyer.com from source/content.json.

The page is demos-first: every featured demo shows real captured output on the page
(screenshots taken from the running demo, or real terminal output), a one-line
description, a live link and a repository link. All copy is data in content.json;
the builder validates every URL against an explicit HTTPS host set and refuses
anything outside the declared static surface. `docs/` is generated; never edit it.
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

ROOT = Path(__file__).resolve().parent
BASE = 'https://jacobmetoyer.com'
TITLE = 'Jacob Metoyer - I direct AI agents to carry out what I ask'
DESC = 'I direct AI agents to carry out whatever I ask, software included. I set the bar and decide what ships.'
SHARE_ALT = 'Jacob Metoyer - AI agents carry out whatever I direct, software included. I set the bar and decide what ships.'
ALLOWED_HOSTS = {'github.com', 'jacobmetoyer.com'}
CSP = "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'"
ROOT_ICONS = ('favicon.ico', 'apple-touch-icon.png')
SHARE_CARD = 'assets/og-card.png'
DATE_RE = re.compile(r'\d{4}-\d{2}-\d{2}')
SLUG_RE = re.compile(r'[a-z][a-z0-9-]{1,31}')
SHOT_RE = re.compile(r'assets/demos/[a-z0-9-]+\.webp')
SECTIONS = (('demos', 'Demos'), ('how', 'How'), ('more', 'More work'), ('about', 'About'))


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
    if not f.is_file():
        raise ValueError(f'Missing screenshot {shot["src"]}')
    if webp_size(f) != (shot['w'], shot['h']):
        raise ValueError(f'Declared size differs from {shot["src"]}')


def validate(data: dict) -> None:
    keys(data, {'visibility', 'name', 'updated', 'hero', 'demos', 'terminal_demo', 'engine_slot', 'how', 'projects', 'about', 'contact'}, 'record')
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
    t = keys(data['terminal_demo'], {'id', 'name', 'tag', 'line', 'command', 'output', 'note', 'repo', 'stack'}, 'terminal demo')
    if not SLUG_RE.fullmatch(t['id']) or t['id'] in ids:
        raise ValueError('Invalid terminal demo id')
    text(t['name'], 40); text(t['tag'], 60); text(t['line'], 220); text(t['command'], 80); text(t['output'], 1500)
    text(t['note'], 240); text(t['stack'], 80)
    if not safe_url(t['repo']).startswith('https://github.com/Jacob-Met/'):
        raise ValueError('Terminal demo needs its public repository link')
    e = keys(data['engine_slot'], {'title', 'line'}, 'engine slot'); text(e['title'], 60); text(e['line'], 240)
    projects = data['projects']
    if not isinstance(projects, list) or not 1 <= len(projects) <= 8:
        raise ValueError('One to eight projects')
    for p in projects:
        keys(p, {'name', 'line', 'url'}, 'project'); text(p['name'], 40); text(p['line'], 240); safe_url(p['url'])
    c = keys(data['contact'], {'line', 'url'}, 'contact'); text(c['line'], 200); safe_url(c['url'])
    w = keys(data['how'], {'title', 'line', 'steps'}, 'how'); text(w['title'], 60); text(w['line'], 200)
    if not isinstance(w['steps'], list) or not 3 <= len(w['steps']) <= 6:
        raise ValueError('Three to six process steps')
    for st in w['steps']:
        keys(st, {'name', 'line'}, 'step'); text(st['name'], 40); text(st['line'], 200)
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


def demo_card(d: dict, n: int) -> str:
    dk, mb = d['shots']['desktop'], d['shots']['mobile']
    return (
        f'<article class="demo" id="demo-{d["id"]}" aria-labelledby="demo-{d["id"]}-h">'
        f'<div class="demo-media">'
        f'<figure class="frame frame-desktop"><span class="frame-bar" aria-hidden="true"></span>'
        f'<img src="{dk["src"]}" width="{dk["w"]}" height="{dk["h"]}" alt="{esc(dk["alt"])}" loading="{"eager" if n == 1 else "lazy"}" decoding="async"></figure>'
        f'<figure class="frame frame-phone">'
        f'<img src="{mb["src"]}" width="{mb["w"]}" height="{mb["h"]}" alt="{esc(mb["alt"])}" loading="lazy" decoding="async"></figure>'
        f'</div>'
        f'<div class="demo-copy"><p class="tag"><span class="num">{n:02d}</span>{esc(d["tag"])}</p>'
        f'<h3 id="demo-{d["id"]}-h">{esc(d["name"])}</h3>'
        f'<p class="line">{esc(d["line"])}</p><p class="detail">{esc(d["detail"])}</p>'
        f'<p class="stack">{esc(d["stack"])}</p>'
        f'<p class="links">{ext(d["play"]["url"], d["play"]["label"] + " →", "btn")} {ext(d["repo"], repo_label(d["repo"]), "src")}</p>'
        f'</div></article>'
    )


def terminal_card(t: dict, n: int) -> str:
    return (
        f'<article class="demo demo-term" id="demo-{t["id"]}" aria-labelledby="demo-{t["id"]}-h">'
        f'<div class="demo-media"><figure class="term"><figcaption class="term-bar"><span aria-hidden="true"></span>'
        f'<code>$ {esc(t["command"])}</code></figcaption><pre tabindex="0" aria-label="Captured output of {esc(t["command"])}"><code>{esc(t["output"])}</code></pre></figure></div>'
        f'<div class="demo-copy"><p class="tag"><span class="num">{n:02d}</span>{esc(t["tag"])}</p>'
        f'<h3 id="demo-{t["id"]}-h">{esc(t["name"])}</h3>'
        f'<p class="line">{esc(t["line"])}</p><p class="detail">{esc(t["note"])}</p>'
        f'<p class="stack">{esc(t["stack"])}</p>'
        f'<p class="links">{ext(t["repo"], "Run it from source →", "btn")} {ext(t["repo"], repo_label(t["repo"]), "src")}</p>'
        f'</div></article>'
    )


def render_index(r: dict) -> str:
    h = r['hero']
    nav = ''.join(f'<a href="#{i}">{esc(label)}</a>' for i, label in SECTIONS)
    demos = [demo_card(d, i) for i, d in enumerate(r['demos'], 1)]
    demos.append(terminal_card(r['terminal_demo'], len(demos) + 1))
    e = r['engine_slot']
    slot = (f'<aside class="slot" aria-labelledby="engine-slot-h"><p class="tag"><span class="num">··</span>In progress</p>'
            f'<h3 id="engine-slot-h">{esc(e["title"])}</h3><p>{esc(e["line"])}</p></aside>')
    projects = ''.join(f'<li><h3>{ext(p["url"], p["name"])}</h3><p>{esc(p["line"])}</p></li>' for p in r['projects'])
    c = r['contact']
    w = r['how']
    steps = ''.join(f'<li><p class="step-n">{i:02d}</p><h3>{esc(st["name"])}</h3><p>{esc(st["line"])}</p></li>' for i, st in enumerate(w['steps'], 1))
    about = ''.join(f'<p>{esc(line)}</p>' for line in r['about']['lines'])
    return (
        '<a class="skip" href="#main">Skip to content</a>'
        f'<header class="top"><a class="mark" href="#main" aria-label="Jacob Metoyer, top of page"><span aria-hidden="true">JM</span></a>'
        f'<nav aria-label="Sections">{nav}</nav></header>'
        '<main id="main">'
        f'<section class="hero" aria-labelledby="hero-h"><p class="kicker">{esc(h["kicker"])}</p>'
        f'<h1 id="hero-h"><span class="name">Jacob Metoyer</span>{esc(h["title"])}</h1>'
        f'<p class="lede">{esc(h["lede"])}</p>'
        f'<p class="hero-links"><a class="btn" href="#demos">See the demos ↓</a> <a class="src" href="#how">How they get built</a> {ext(h["source"], "GitHub · Jacob-Met", "src")}</p></section>'
        f'<section id="demos" class="demos" aria-labelledby="demos-h"><div class="sec-head"><h2 id="demos-h">Demos</h2>'
        f'<p>Each one runs. The images are captures of the real thing; the links open it.</p></div>'
        + ''.join(demos) + slot + '</section>'
        f'<section id="how" class="how" aria-labelledby="how-h"><div class="sec-head"><h2 id="how-h">{esc(w["title"])}</h2>'
        f'<p>{esc(w["line"])}</p></div><ol class="steps">{steps}</ol></section>'
        f'<section id="more" class="more" aria-labelledby="more-h"><div class="sec-head"><h2 id="more-h">More work</h2>'
        f'<p>Research and tooling projects with source, but no in-browser demo.</p></div><ul class="cards">{projects}</ul></section>'
        f'<section id="about" class="about" aria-labelledby="about-h"><h2 id="about-h">About</h2>'
        f'{about}<p>{esc(c["line"])} {ext(c["url"], "github.com/Jacob-Met")}</p></section>'
        '</main>'
        f'<footer class="foot"><p>Updated {esc(r["updated"])} · Static page, no trackers, no scripts.</p></footer>'
    )


def page_html(name: str, title: str, desc: str, body: str, data: dict) -> str:
    schema = {'@context': 'https://schema.org', '@type': 'Person', 'name': data['name'], 'url': BASE,
              'sameAs': ['https://github.com/Jacob-Met']}
    structured = json.dumps(schema, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e')
    canonical = BASE + '/' + ('' if name == 'index.html' else name)
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="{CSP}"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><meta name="theme-color" content="#0b0a08"><meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="canonical" href="{canonical}"><link rel="icon" href="assets/mark.svg" type="image/svg+xml"><link rel="icon" href="favicon.ico" sizes="48x48"><link rel="apple-touch-icon" href="apple-touch-icon.png"><link rel="stylesheet" href="style.css">
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


def build(out: Path, data: dict | None = None) -> dict:
    record = json.loads((ROOT / 'content.json').read_text(encoding='utf-8')) if data is None else json.loads(json.dumps(data))
    validate(record)
    out = out.resolve()
    if out == ROOT or ROOT.is_relative_to(out):
        raise ValueError('Output must not replace source')
    shots = shot_files(record)
    allowed = {'index.html', '404.html', 'style.css', '.nojekyll', 'CNAME', 'robots.txt', 'sitemap.xml', 'cv.json',
               'build-manifest.json', 'assets/mark.svg', SHARE_CARD, *ROOT_ICONS}
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
        'index.html': (TITLE, DESC, render_index(record)),
        '404.html': ('Not found · Jacob Metoyer', 'Nothing here. Back to the demos.',
                     '<a class="skip" href="#main">Skip to content</a><main id="main" class="not-found"><h1>Nothing here.</h1>'
                     '<p><a class="btn" href="index.html#demos">Back to the demos</a></p></main>'),
    }
    for name, (title, desc, body) in pages.items():
        (out / name).write_text(root_links(name, page_html(name, title, desc, body, record)), encoding='utf-8', newline='\n')
    (out / 'style.css').write_text((ROOT / 'style.css').read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
    (out / 'assets' / 'demos').mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / 'assets' / 'mark.svg', out / 'assets' / 'mark.svg')
    shutil.copyfile(ROOT / SHARE_CARD, out / SHARE_CARD)
    for rel in shots:
        assert rel.startswith(allowed_prefix)
        shutil.copyfile(ROOT / rel, out / rel)
    for name in ROOT_ICONS:
        shutil.copyfile(ROOT / 'assets' / name, out / name)
    (out / '.nojekyll').write_text('', encoding='utf-8', newline='\n')
    (out / 'CNAME').write_text('jacobmetoyer.com\n', encoding='utf-8', newline='\n')
    (out / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n', encoding='utf-8', newline='\n')
    sm = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{BASE}/</loc><lastmod>{record["updated"]}</lastmod></url></urlset>'
    (out / 'sitemap.xml').write_text(sm, encoding='utf-8', newline='\n')
    (out / 'cv.json').write_text(json.dumps(record, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    files = [f for f in out.rglob('*') if f.is_file() and f.name != 'build-manifest.json']
    manifest = {f.relative_to(out).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest()
                for f in sorted(files, key=lambda f: f.relative_to(out).as_posix())}
    (out / 'build-manifest.json').write_text(json.dumps({'schema': 3, 'date': record['updated'], 'sha256': manifest}, indent=2) + '\n', encoding='utf-8', newline='\n')
    return {'pages': len(pages), 'demos': len(record['demos']) + 1, 'output': str(out), 'files': len(manifest) + 1}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--out', type=Path, default=ROOT.parent / 'docs')
    a = p.parse_args()
    print(json.dumps(build(a.out), indent=2))
