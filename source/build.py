#!/usr/bin/env python3
"""Build jacobmetoyer.com from the approved, source-mapped work copy.

`content.md` is the public copy source; `content.json` keeps the claim-to-source
map. The builder renders only a deliberately small Markdown subset and validates
every link against the source map and approved public hosts. `docs/` is generated.
"""
from __future__ import annotations
import argparse
import hashlib
import html
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
BASE = 'https://jacobmetoyer.com'
TITLE = 'Jacob Metoyer — Less hand-waving. More receipts.'
DESC = 'Less hand-waving. More receipts. Open the output. Follow the evidence.'
SHARE_ALT = 'Jacob Metoyer — Less hand-waving. More receipts.'
ALLOWED_HOSTS = {'github.com', 'jacobmetoyer.com'}
CSP = "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'"
ROOT_ICONS = ('favicon.ico', 'apple-touch-icon.png')
SHARE_CARD = 'assets/og-card.png'
ID_RE = re.compile(r'[A-Z][A-Z0-9-]{1,31}')
LINK_RE = re.compile(r'\[([^\]]+)\]\((https://[^)\s]+)\)')
DATE_RE = re.compile(r'\d{4}-\d{2}-\d{2}')
SECTIONS = (('intro', 'Introduction'), ('research', 'Research and projects'), ('workflow-checks', 'Workflow checks'), ('pilot', 'Workflow-checks pilots'))


def text(value: str, limit: int = 1000) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= limit:
        raise ValueError('Invalid text field')
    return value


def safe_url(value: str) -> str:
    if not isinstance(value, str) or len(value) > 600 or any(c.isspace() for c in value):
        raise ValueError('Invalid URL')
    u = urlsplit(value)
    if (u.scheme != 'https' or u.hostname not in ALLOWED_HOSTS or u.username or u.password
            or u.port or u.query or u.fragment):
        raise ValueError('URL outside approved public link set')
    return value


def check_links(items: list, minimum: int = 1) -> None:
    if not isinstance(items, list) or len(items) < minimum:
        raise ValueError('Every claim needs a checkable source')
    for item in items:
        if not isinstance(item, dict) or set(item) != {'label', 'url'}:
            raise ValueError('Unexpected source-link field')
        text(item['label'], 160)
        safe_url(item['url'])


def load_record() -> dict:
    data = json.loads((ROOT / 'content.json').read_text(encoding='utf-8'))
    if not isinstance(data, dict) or data.get('copy_path') != 'content.md':
        raise ValueError('Public copy path must be the fixed source/content.md file')
    data['copy_markdown'] = (ROOT / 'content.md').read_text(encoding='utf-8')
    return data


def markdown_blocks(markdown: str) -> list[tuple[str, str]]:
    """Parse only headings and paragraphs; reject raw HTML and unsupported Markdown."""
    if not isinstance(markdown, str) or not markdown.strip() or len(markdown) > 20000:
        raise ValueError('Invalid website copy')
    blocks: list[tuple[str, str]] = []
    paragraph: list[str] = []

    def flush() -> None:
        nonlocal paragraph
        if paragraph:
            blocks.append(('p', ' '.join(paragraph)))
            paragraph = []

    for raw in markdown.splitlines():
        line = raw.strip()
        if not line:
            flush()
            continue
        match = re.fullmatch(r'(#{1,3})\s+(.+)', line)
        if match:
            flush()
            blocks.append((f'h{len(match.group(1))}', match.group(2).strip()))
            continue
        if line.startswith(('#', '>', '-', '*', '`')):
            raise ValueError(f'Unsupported Markdown block: {line[:40]}')
        paragraph.append(line)
    flush()
    if not blocks or blocks[0][0] != 'h1' or sum(kind == 'h1' for kind, _ in blocks) != 1:
        raise ValueError('Copy must begin with exactly one h1')
    if sum(kind == 'h2' for kind, _ in blocks) != 4:
        raise ValueError('Copy must contain four approved sections')
    if sum(kind == 'h3' for kind, _ in blocks) != 6:
        raise ValueError('Copy must contain six source-backed work entries')
    return blocks


def validate(data: dict) -> None:
    if not isinstance(data, dict) or data.get('visibility') != 'public':
        raise ValueError('Only explicitly public content can be built')
    expected = {'visibility', 'name', 'updated', 'copy_path', 'claims', 'copy_markdown'}
    if set(data) != expected:
        raise ValueError('Unexpected public record field')
    if data['name'] != 'Jacob Metoyer':
        raise ValueError('Identity differs from approved public record')
    if not isinstance(data['updated'], str) or not DATE_RE.fullmatch(data['updated']):
        raise ValueError('Updated date must be YYYY-MM-DD')
    if data['copy_path'] != 'content.md':
        raise ValueError('Unexpected copy source path')
    if not isinstance(data['claims'], list) or not data['claims']:
        raise ValueError('Source map must be a non-empty list')
    ids: set[str] = set()
    source_urls: set[str] = set()
    for claim in data['claims']:
        if not isinstance(claim, dict) or set(claim) != {'id', 'description', 'sources'}:
            raise ValueError('Unexpected source-map claim field')
        ident = claim['id']
        if not isinstance(ident, str) or not ID_RE.fullmatch(ident) or ident in ids:
            raise ValueError('Invalid or duplicate claim id')
        ids.add(ident)
        text(claim['description'], 1200)
        check_links(claim['sources'])
        source_urls.update(item['url'] for item in claim['sources'])
    markdown = data['copy_markdown']
    blocks = markdown_blocks(markdown)
    copy_urls: set[str] = set()
    for kind, block_text in blocks:
        matches = list(LINK_RE.finditer(block_text))
        for match in matches:
            safe_url(match.group(2))
            copy_urls.add(match.group(2))
        residue = LINK_RE.sub('', block_text)
        if '[' in residue or ']' in residue:
            raise ValueError('Unsupported or malformed inline link')
        if kind == 'p' and not matches:
            raise ValueError('Every factual copy paragraph must carry a direct source link')
        if kind == 'h3' and not matches:
            raise ValueError('Every work-entry heading must link to its source')
    if not copy_urls or not copy_urls <= source_urls:
        raise ValueError('Copy contains a URL missing from the claim-to-source map')
    required = {'ID-01', 'WC-01', 'WC-02', 'WC-03', 'WC-04', 'WC-05', 'WC-06', 'CS-01', 'CP-01', 'TO-01'}
    if not required <= ids:
        raise ValueError('Required claim-to-source entries are missing')


def link(url: str, label: str) -> str:
    safe_url(url)
    return f'<a href="{html.escape(url, quote=True)}" rel="noopener">{html.escape(label)}</a>'


def inline(markdown: str) -> str:
    out: list[str] = []
    pos = 0
    for match in LINK_RE.finditer(markdown):
        out.append(html.escape(markdown[pos:match.start()]))
        out.append(link(match.group(2), match.group(1)))
        pos = match.end()
    out.append(html.escape(markdown[pos:]))
    return ''.join(out)


def render_copy(markdown: str) -> str:
    blocks = markdown_blocks(markdown)
    masthead = ''
    content: list[str] = []
    section_index = 0
    ticket = 0
    section_open = False
    entry_open = False

    def close_entry() -> None:
        nonlocal entry_open
        if entry_open:
            content.append('</div></article>')
            entry_open = False

    def close_section() -> None:
        nonlocal section_open
        close_entry()
        if section_open:
            content.append('</section>')
            section_open = False

    for kind, value in blocks:
        if kind == 'h1':
            masthead = (
                '<header class="masthead"><h1>' + inline(value)
                + '</h1><span class="registration" aria-hidden="true"></span></header>'
            )
        elif kind == 'h2':
            close_section()
            section_index += 1
            if section_index == 1:
                ident, klass = 'intro', 'hero'
            elif section_index == 2:
                ident, klass = 'research', 'index'
            elif section_index == 3:
                ident, klass = 'workflow-checks', 'index'
            elif section_index == 4:
                ident, klass = 'pilot', 'closing'
            else:
                raise ValueError('Unexpected section count')
            content.append(f'<section id="{ident}" class="{klass}" aria-labelledby="{ident}-h">')
            content.append(f'<h2 id="{ident}-h">{inline(value)}</h2>')
            section_open = True
        elif kind == 'h3':
            if not section_open or section_index not in (2, 3):
                raise ValueError('Work entries must be inside a work section')
            close_entry()
            ticket += 1
            content.append(
                f'<article class="entry"><span class="ticket ticket-{ticket}" aria-hidden="true"></span>'
                f'<h3>{inline(value)}</h3><div class="entry-body">'
            )
            entry_open = True
        elif kind == 'p':
            if not section_open:
                raise ValueError('Paragraph outside a section')
            content.append(f'<p>{inline(value)}</p>')
        else:
            raise ValueError(f'Unsupported copy block {kind!r}')
    close_section()
    if section_index != 4 or ticket != 6 or not masthead:
        raise ValueError('Copy structure incomplete')
    return ('<a class="skip" href="#main">Skip to content</a>' + masthead
            + '<main id="main" class="docket">' + ''.join(content) + '</main>')


def page_html(name: str, title: str, desc: str, body: str, data: dict) -> str:
    same_as = ['https://github.com/Jacob-Met']
    schema = {
        '@context': 'https://schema.org', '@type': 'Person',
        'name': data['name'], 'url': BASE, 'sameAs': same_as,
    }
    structured = json.dumps(schema, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e')
    canonical = BASE + '/' + ('' if name == 'index.html' else name)
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="{CSP}"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title><meta name="description" content="{html.escape(desc, quote=True)}"><meta name="theme-color" content="#f5f5ef"><meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="canonical" href="{canonical}"><link rel="icon" href="assets/mark.svg" type="image/svg+xml"><link rel="icon" href="favicon.ico" sizes="48x48"><link rel="apple-touch-icon" href="apple-touch-icon.png"><link rel="stylesheet" href="style.css">
<meta property="og:type" content="website"><meta property="og:title" content="{html.escape(title, quote=True)}"><meta property="og:description" content="{html.escape(desc, quote=True)}"><meta property="og:url" content="{canonical}">
<meta property="og:image" content="{BASE}/{SHARE_CARD}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="{html.escape(SHARE_ALT, quote=True)}"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{structured}</script></head>
<body>{body}</body></html>'''


def root_links(name: str, markup: str) -> str:
    if name != '404.html':
        return markup
    return re.sub(r'(\s(?:href|src)=")(?![a-z][a-z0-9+.-]*:|/|#)', r'\1/', markup)


def build(out: Path, data: dict | None = None) -> dict:
    record = json.loads((ROOT / 'content.json').read_text(encoding='utf-8')) if data is None else json.loads(json.dumps(data))
    if 'copy_markdown' not in record:
        record['copy_markdown'] = (ROOT / record.get('copy_path', 'content.md')).read_text(encoding='utf-8')
    validate(record)
    out = out.resolve()
    if out == ROOT or ROOT.is_relative_to(out):
        raise ValueError('Output must not replace source')
    allowed = {'index.html', '404.html', 'style.css', '.nojekyll', 'CNAME', 'robots.txt', 'sitemap.xml', 'cv.json', 'build-manifest.json', 'assets/mark.svg', SHARE_CARD, *ROOT_ICONS}
    if out.exists():
        for f in out.rglob('*'):
            if f.is_symlink() or (f.is_file() and f.relative_to(out).as_posix() not in allowed):
                raise ValueError('Output contains unexpected material; refuse to overwrite it')
    out.mkdir(parents=True, exist_ok=True)
    pages = {
        'index.html': (TITLE, DESC, render_copy(record['copy_markdown'])),
        '404.html': (
            'Not found · Jacob Metoyer',
            'Nothing here. Back to the work.',
            '<a class="skip" href="#main">Skip to content</a><main id="main" class="not-found"><h1>Nothing here.</h1><p><a href="index.html">Back to the work</a>.</p></main>',
        ),
    }
    for name, (title, desc, body) in pages.items():
        (out / name).write_text(root_links(name, page_html(name, title, desc, body, record)), encoding='utf-8', newline='\n')
    (out / 'style.css').write_text((ROOT / 'style.css').read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
    (out / 'assets').mkdir(exist_ok=True)
    shutil.copyfile(ROOT / 'assets' / 'mark.svg', out / 'assets' / 'mark.svg')
    shutil.copyfile(ROOT / SHARE_CARD, out / SHARE_CARD)
    for name in ROOT_ICONS:
        shutil.copyfile(ROOT / 'assets' / name, out / name)
    (out / '.nojekyll').write_text('', encoding='utf-8', newline='\n')
    (out / 'CNAME').write_text('jacobmetoyer.com\n', encoding='utf-8', newline='\n')
    (out / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n', encoding='utf-8', newline='\n')
    sm = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{BASE}/</loc><lastmod>{record["updated"]}</lastmod></url></urlset>'
    (out / 'sitemap.xml').write_text(sm, encoding='utf-8', newline='\n')
    record['copy_sha256'] = hashlib.sha256(record['copy_markdown'].encode('utf-8')).hexdigest()
    (out / 'cv.json').write_text(json.dumps(record, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    manifest_files = [f for f in out.rglob('*') if f.is_file() and f.name != 'build-manifest.json']
    manifest = {f.relative_to(out).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(manifest_files, key=lambda f: f.relative_to(out).as_posix())}
    (out / 'build-manifest.json').write_text(json.dumps({'schema': 2, 'date': record['updated'], 'sha256': manifest}, indent=2) + '\n', encoding='utf-8', newline='\n')
    return {'pages': len(pages), 'claims': len(record['claims']), 'output': str(out), 'files': len(manifest) + 1}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--out', type=Path, default=ROOT.parent / 'docs')
    a = p.parse_args()
    print(json.dumps(build(a.out), indent=2))
