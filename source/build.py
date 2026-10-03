#!/usr/bin/env python3
"""Build jacobmetoyer.com: a one-page, type-driven CV generated from content.json.

Rebuilt from scratch 2026-09-30. No imagery beyond the monogram icon and the share card,
no scripts, no anime/cosplay-era content. Every claim carries at least one link to a public
source (repository, dated snapshot, institutional page); claims that rest on Jacob's own
account are labelled "self-reported" in the record and on the page.
"""
from __future__ import annotations
import argparse, hashlib, html, json, re, shutil
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
BASE = 'https://jacobmetoyer.com'
STAMP = '2026-10-01'
ALLOWED_HOSTS = {'github.com', 'www.linkedin.com', 'www.csulb.edu', 'www.joshilab.org'}
E = html.escape
# GitHub Pages cannot send headers, so the policy ships as a meta tag. There is no script on
# the site; the JSON-LD block is a data block and is never executed.
CSP = "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'"
ROOT_ICONS = ('favicon.ico', 'apple-touch-icon.png')
SHARE_CARD = 'assets/og-card.png'
SHARE_ALT = 'Jacob Metoyer: research and software. Undergraduate researcher at Cal State Long Beach, computer science and physics.'
BASIS_VALUES = {'self-reported', 'public repository', 'self-reported; lab is public'}
ID_RE = re.compile(r'[a-z][a-z0-9-]{1,48}')
# Slots reserved for the verified research/writing inventory (Otama's lane). Empty lists render
# a visible placeholder; entries appear only with a working public link.
SLOTS = {
    'verified_research': ('Research output', 'No public research output is listed yet. Entries are added here only when they carry a working public link (paper, preprint, poster or dataset).'),
    'verified_writing': ('Writing', 'No public writing is listed yet. Entries are added here only when they carry a working public link.'),
}
SECTIONS = (('now', 'Now'), ('education', 'Education'), ('research', 'Research experience'), ('projects', 'Projects'),
            ('independent', 'Independent research'), ('verified-research', 'Research output'), ('verified-writing', 'Writing'), ('contact', 'Contact'))


def safe_url(value: str) -> str:
    if not isinstance(value, str) or len(value) > 600 or any(c.isspace() for c in value): raise ValueError('Invalid URL')
    u = urlsplit(value)
    if u.scheme != 'https' or u.hostname not in ALLOWED_HOSTS or u.username or u.password or u.port or u.query or u.fragment:
        raise ValueError('URL outside approved public link set')
    return value


def check_links(items, minimum: int = 1) -> None:
    if not isinstance(items, list) or len(items) < minimum: raise ValueError('Every claim needs a checkable source')
    for item in items:
        if not isinstance(item, dict) or set(item) != {'label', 'url'}: raise ValueError('Unexpected link field')
        text(item['label'], 120); safe_url(item['url'])


def text(value, limit: int = 600) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= limit: raise ValueError('Invalid text field')
    return value


def validate(data: dict) -> None:
    if not isinstance(data, dict) or data.get('visibility') != 'public': raise ValueError('Only explicitly public content can be built')
    if data.get('name') != 'Jacob Metoyer': raise ValueError('Identity differs from approved public record')
    expected = {'visibility', 'name', 'updated', 'headline', 'summary', 'identities', 'education', 'current', 'projects', 'research', 'independent', 'verified_research', 'verified_writing'}
    if set(data) != expected: raise ValueError('Unexpected root field')
    text(data['updated'], 10); text(data['headline'], 200)
    if not isinstance(data['summary'], list) or not 1 <= len(data['summary']) <= 4: raise ValueError('Invalid summary')
    for p in data['summary']: text(p)
    check_links(data['identities'])
    edu = data['education']
    if not isinstance(edu, dict) or set(edu) != {'institution', 'degrees', 'program', 'basis', 'sources'}: raise ValueError('Unexpected education field')
    for k in ('institution', 'degrees', 'program'): text(edu[k], 200)
    if edu['basis'] != 'self-reported': raise ValueError('Education details must be labelled self-reported')
    check_links(edu['sources'])
    for key in ('current', 'projects', 'research', 'verified_research', 'verified_writing'):
        if not isinstance(data[key], list): raise ValueError(f'{key} must be a list')
    for row in data['current']:
        if set(row) != {'text', 'basis', 'sources'}: raise ValueError('Unexpected current field')
        text(row['text']); check_links(row['sources'])
        if row['basis'] not in BASIS_VALUES: raise ValueError('Unknown basis')
    seen = set()
    for row in data['projects']:
        if set(row) != {'id', 'title', 'kind', 'summary', 'facts', 'artifacts'}: raise ValueError('Unexpected project field')
        if not isinstance(row['id'], str) or not ID_RE.fullmatch(row['id']) or row['id'] in seen: raise ValueError('Invalid or duplicate id')
        seen.add(row['id'])
        for k in ('title', 'kind', 'facts'): text(row[k], 200)
        text(row['summary']); check_links(row['artifacts'])
    for row in data['research']:
        if set(row) != {'id', 'title', 'org', 'period', 'role', 'basis', 'sources'}: raise ValueError('Unexpected research field')
        if not isinstance(row['id'], str) or not ID_RE.fullmatch(row['id']) or row['id'] in seen: raise ValueError('Invalid or duplicate id')
        seen.add(row['id'])
        for k in ('title', 'org', 'period'): text(row[k], 200)
        text(row['role']); check_links(row['sources'])
        if row['basis'] not in BASIS_VALUES: raise ValueError('Unknown basis')
    ind = data['independent']
    if not isinstance(ind, dict) or set(ind) != {'text', 'basis', 'sources'}: raise ValueError('Unexpected independent field')
    text(ind['text']); check_links(ind['sources'])
    if ind['basis'] not in BASIS_VALUES: raise ValueError('Unknown basis')
    for key in SLOTS:
        for row in data[key]:
            if set(row) != {'title', 'venue', 'date', 'links'}: raise ValueError('Unexpected slot field')
            for k in ('title', 'venue', 'date'): text(row[k], 200)
            check_links(row['links'])
    if not data['projects'] or not data['research']: raise ValueError('Empty public record')


def link(url: str, label: str) -> str:
    safe_url(url)
    return f'<a href="{E(url, quote=True)}" rel="noopener">{E(label)}</a>'


def links(items: list) -> str:
    return ' · '.join(link(x['url'], x['label']) for x in items)


def sources(items: list, basis: str | None = None, word: str = 'Source') -> str:
    label = word if len(items) == 1 else word + 's'
    basis_html = f'<span class="basis">{E(basis)}</span> ' if basis else ''
    return f'<p class="sources">{basis_html}{E(label)}: {links(items)}</p>'


def entry(head: str, meta: str, body: str, foot: str, ident: str | None = None) -> str:
    """head is trusted markup built here; meta and body are escaped."""
    id_attr = f' id="{E(ident)}"' if ident else ''
    head_html = f'<h3>{head}</h3>' if head else ''
    meta_html = f'<p class="meta">{E(meta)}</p>' if meta else ''
    body_html = f'<p>{E(body)}</p>' if body else ''
    return f'<article class="entry"{id_attr}><div class="entry-head">{head_html}{meta_html}</div><div class="entry-body">{body_html}{foot}</div></article>'


def section(ident: str, title: str, inner: str, note: str = '') -> str:
    note_html = f'<p class="note">{E(note)}</p>' if note else ''
    return f'<section id="{ident}" aria-labelledby="{ident}-h"><h2 id="{ident}-h">{E(title)}</h2>{note_html}{inner}</section>'


def slot(key: str, rows: list) -> str:
    title, placeholder = SLOTS[key]
    if not rows:
        inner = f'<!-- slot:{key} empty; filled only from the verified inventory --><p class="placeholder">{E(placeholder)}</p>'
    else:
        inner = ''.join(entry(E(r['title']), f'{r["venue"]} · {r["date"]}', '', sources(r['links'], word='Link')) for r in rows)
    return section(key.replace('_', '-'), title, inner)


def cv_body(data: dict) -> str:
    head = (f'<header class="cv-head"><h1>{E(data["name"])}</h1><p class="headline">{E(data["headline"])}</p>'
            + ''.join(f'<p class="lede">{E(p)}</p>' for p in data['summary'])
            + f'<p class="ids">{links(data["identities"])}</p></header>')
    toc = '<nav class="toc" aria-label="Sections">' + ''.join(f'<a href="#{i}">{E(t)}</a>' for i, t in SECTIONS) + '</nav>'
    now = ''.join(entry('', '', r['text'], sources(r['sources'], r['basis'])) for r in data['current'])
    edu = data['education']
    education = entry(E(edu['institution']), edu['program'], edu['degrees'], sources(edu['sources'], edu['basis']))
    research = ''.join(entry(E(r['title']), f'{r["org"]} · {r["period"]}', r['role'], sources(r['sources'], r['basis']), r['id']) for r in data['research'])
    projects = ''.join(entry(link(r['artifacts'][0]['url'], r['title']), f'{r["kind"]} · {r["facts"]}', r['summary'],
                             sources(r['artifacts'], word='Artifact'), r['id']) for r in data['projects'])
    ind = data['independent']
    independent = entry('', '', ind['text'], sources(ind['sources'], ind['basis']))
    contact = entry('', '', '', '<p>Research collaboration, software questions or a scoped pilot: send a short note on '
                    + link('https://www.linkedin.com/in/jacob-metoyer-15b701352', 'LinkedIn')
                    + ' or open an issue on the relevant repository. Do not send participant data, credentials or confidential files.</p>')
    colophon = (f'<p class="colophon">Revised {E(data["updated"])}. Static HTML generated from <a href="cv.json">one public record</a>; no scripts, no tracking, no third-party requests. '
                '“Self-reported” marks a line that rests on my own account of the work, with the dated snapshot it was taken from. '
                'Lab results, participant data and unpublished work stay off this site.</p>')
    return (head + toc
            + section('now', 'Now', now)
            + section('education', 'Education', education)
            + section('research', 'Research experience', research, 'Team projects in university labs. I describe my part; the data and results belong to the labs.')
            + section('projects', 'Projects', projects, 'Public repositories and demo source. Each entry links to the artifacts available for inspection; these are not claims of production deployment.')
            + section('independent', 'Independent research', independent)
            + slot('verified_research', data['verified_research'])
            + slot('verified_writing', data['verified_writing'])
            + section('contact', 'Contact', contact)
            + colophon)


ROOTED_PAGES = {'404.html'}  # served by the host at arbitrary missing paths


def root_links(name: str, markup: str) -> str:
    if name not in ROOTED_PAGES: return markup
    return re.sub(r'(\s(?:href|src)=")(?![a-z][a-z0-9+.-]*:|/|#)', r'\1/', markup)


def page_html(name: str, title: str, desc: str, body: str, data: dict) -> str:
    schema = {'@context': 'https://schema.org', '@type': 'Person', 'name': data['name'], 'url': BASE, 'sameAs': [x['url'] for x in data['identities']]}
    structured = json.dumps(schema, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e')
    canonical = BASE + '/' + ('' if name == 'index.html' else name)
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="{CSP}"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)}</title><meta name="description" content="{E(desc, quote=True)}"><meta name="theme-color" content="#183c31"><meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="canonical" href="{canonical}"><link rel="icon" href="assets/mark.svg" type="image/svg+xml"><link rel="icon" href="favicon.ico" sizes="48x48"><link rel="apple-touch-icon" href="apple-touch-icon.png"><link rel="stylesheet" href="style.css">
<meta property="og:type" content="website"><meta property="og:title" content="{E(title, quote=True)}"><meta property="og:description" content="{E(desc, quote=True)}"><meta property="og:url" content="{canonical}">
<meta property="og:image" content="{BASE}/{SHARE_CARD}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="{E(SHARE_ALT, quote=True)}"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{structured}</script></head>
<body><a class="skip" href="#main">Skip to content</a><main id="main" class="cv">{body}</main>
<footer class="footer"><a href="index.html">Jacob Metoyer</a> · <a href="https://github.com/Jacob-Met" rel="noopener">GitHub</a> · <a href="https://www.linkedin.com/in/jacob-metoyer-15b701352" rel="noopener">LinkedIn</a></footer></body></html>'''


def layout(name: str, title: str, desc: str, body: str, data: dict) -> str:
    return root_links(name, page_html(name, title, desc, body, data))


DESC = ('Jacob Metoyer, undergraduate researcher at Cal State Long Beach: research experience in gait rehabilitation, surgical ergonomics, '
        'protein molecular dynamics and behavioral neuroscience; public research software; independent AI-systems research.')


def build(out: Path, data: dict | None = None) -> dict:
    record: dict = json.loads((ROOT / 'content.json').read_text(encoding='utf-8')) if data is None else data
    data = record
    validate(data)
    out = out.resolve()
    if out == ROOT or ROOT.is_relative_to(out): raise ValueError('Output must not replace source')
    allowed = {'index.html', '404.html', 'style.css', '.nojekyll', 'CNAME', 'robots.txt', 'sitemap.xml', 'cv.json', 'build-manifest.json', 'assets/mark.svg', SHARE_CARD, *ROOT_ICONS}
    if out.exists():
        for f in out.rglob('*'):
            if f.is_symlink() or (f.is_file() and f.relative_to(out).as_posix() not in allowed): raise ValueError('Output contains unexpected material; refuse to overwrite it')
    out.mkdir(parents=True, exist_ok=True)
    pages = {
        'index.html': ('Jacob Metoyer · research and software', DESC, cv_body(data)),
        '404.html': ('Not found · Jacob Metoyer', 'This page is not part of the site.',
                     '<header class="cv-head"><h1>Nothing here.</h1><p class="lede">The site is a single page; older addresses no longer exist. '
                     '<a href="index.html">Everything is on the front page.</a></p></header>'),
    }
    for name, (title, d, body) in pages.items():
        (out / name).write_text(layout(name, title, d, body, data), encoding='utf-8', newline='\n')
    (out / 'style.css').write_text((ROOT / 'style.css').read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
    (out / 'assets').mkdir(exist_ok=True)
    shutil.copyfile(ROOT / 'assets' / 'mark.svg', out / 'assets' / 'mark.svg')
    shutil.copyfile(ROOT / SHARE_CARD, out / SHARE_CARD)
    for name in ROOT_ICONS: shutil.copyfile(ROOT / 'assets' / name, out / name)
    (out / '.nojekyll').write_text('', encoding='utf-8', newline='\n')
    (out / 'CNAME').write_text('jacobmetoyer.com\n', encoding='utf-8', newline='\n')
    (out / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n', encoding='utf-8', newline='\n')
    sm = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{BASE}/</loc><lastmod>{STAMP}</lastmod></url></urlset>'
    (out / 'sitemap.xml').write_text(sm, encoding='utf-8', newline='\n')
    (out / 'cv.json').write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    manifest_files = [f for f in out.rglob('*') if f.is_file() and f.name != 'build-manifest.json']
    manifest = {f.relative_to(out).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(manifest_files, key=lambda f: f.relative_to(out).as_posix())}
    (out / 'build-manifest.json').write_text(json.dumps({'schema': 1, 'date': STAMP, 'sha256': manifest}, indent=2) + '\n', encoding='utf-8', newline='\n')
    return {'pages': len(pages), 'projects': len(data['projects']), 'research': len(data['research']), 'output': str(out), 'files': len(manifest) + 1}


if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--out', type=Path, default=ROOT.parent / 'docs'); a = p.parse_args(); print(json.dumps(build(a.out), indent=2))
