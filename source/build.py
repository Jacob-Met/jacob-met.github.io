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
TITLE = 'Jacob Metoyer | Research software and scientific tools'
DESC = 'Source-linked research software, synthetic workflow demos, and an interactive sample. Explore what each project demonstrates—and its documented limits.'
SHARE_ALT = 'Jacob Metoyer — research software for inspectable work.'
ALLOWED_HOSTS = {'github.com', 'jacobmetoyer.com'}
CSP = "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'"
ROOT_ICONS = ('favicon.ico', 'apple-touch-icon.png')
SHARE_CARD = 'assets/og-card.png'
ID_RE = re.compile(r'[A-Z][A-Z0-9-]{1,31}')
CASE_ID_RE = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*')
LINK_RE = re.compile(r'\[([^\]]+)\]\((https://[^)\s]+)\)')
DATE_RE = re.compile(r'\d{4}-\d{2}-\d{2}')
SECTIONS = (('intro', 'Introduction'), ('research', 'Research and projects'), ('workflow-checks', 'Workflow checks'), ('pilot', 'Workflow-checks pilots'))
SAMPLE_ROUTE = 'sample-ui/index.html'
SAMPLE_CSS = 'sample-ui/sample-ui.css'
SAMPLE_JS = 'sample-ui/sample-ui.js'
SAMPLE_DATA = ROOT / 'sample-ui.json'
SAMPLE_COMPILED_JS = ROOT / 'compiled' / 'sample-ui.js'
SAMPLE_CSP = CSP + "; script-src 'self'; connect-src 'none'"
SAMPLE_TITLE = 'Utility review desk · interactive synthetic sample'
SAMPLE_DESC = 'Explore generated utility-bill flags with local search, category filters, and record details. Synthetic data only; no payments, messages, or submissions.'


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


def validate_case_studies(data: dict) -> None:
    """Allow only source-backed, explicitly public records in the reusable case-study slot."""
    if not isinstance(data, dict) or set(data) != {'schema', 'case_studies'} or data.get('schema') != 1:
        raise ValueError('Invalid case-study data schema')
    cases = data['case_studies']
    if not isinstance(cases, list) or not cases:
        raise ValueError('At least one public case study is required')
    required = {
        'id', 'visibility', 'title', 'category', 'summary', 'question', 'approach',
        'boundary', 'disclosure', 'language', 'language_reason', 'source_revision', 'artifacts',
    }
    seen: set[str] = set()
    for case in cases:
        if not isinstance(case, dict) or set(case) != required:
            raise ValueError('Unexpected case-study fields')
        ident = case['id']
        if not isinstance(ident, str) or not CASE_ID_RE.fullmatch(ident) or ident in seen:
            raise ValueError('Invalid or duplicate case-study id')
        seen.add(ident)
        if case['visibility'] != 'public':
            raise ValueError('Only explicitly public case studies may be rendered')
        for field, limit in (
            ('title', 160), ('category', 160), ('summary', 1200), ('question', 800),
            ('boundary', 1600), ('disclosure', 800), ('language', 80),
            ('language_reason', 500), ('source_revision', 80),
        ):
            text(case[field], limit)
        approach = case['approach']
        if not isinstance(approach, list) or not 1 <= len(approach) <= 10:
            raise ValueError('Case-study approach must be a short, non-empty list')
        for step in approach:
            text(step, 600)
        artifacts = case['artifacts']
        if not isinstance(artifacts, list) or len(artifacts) < 2:
            raise ValueError('Every case study needs multiple public artifacts')
        repository = None
        for artifact in artifacts:
            if not isinstance(artifact, dict) or set(artifact) != {'label', 'url'}:
                raise ValueError('Invalid case-study artifact')
            text(artifact['label'], 160)
            url = safe_url(artifact['url'])
            parsed = urlsplit(url)
            if parsed.hostname != 'github.com':
                raise ValueError('Case-study artifacts must be public GitHub sources')
            parts = parsed.path.strip('/').split('/')
            if len(parts) < 2 or parts[0] != 'Jacob-Met':
                raise ValueError('Case-study repository must belong to the public Jacob-Met account')
            current = '/'.join(parts[:2])
            if repository is None:
                repository = current
            elif current != repository:
                raise ValueError('Case-study artifacts must refer to one repository')


def load_case_studies() -> list[dict]:
    data = json.loads((ROOT / 'case-studies.json').read_text(encoding='utf-8'))
    validate_case_studies(data)
    return data['case_studies']


def validate_sample_data(data: dict) -> None:
    """Validate the small, explicitly synthetic dataset used by the local-only UI."""
    if not isinstance(data, dict) or set(data) != {'schema', 'snapshot_date', 'synthetic', 'counts', 'sources', 'records'}:
        raise ValueError('Invalid sample UI data shape')
    if data['schema'] != 1 or data['synthetic'] is not True or not DATE_RE.fullmatch(str(data['snapshot_date'])):
        raise ValueError('Sample UI must identify a dated synthetic snapshot')
    counts = data['counts']
    expected_counts = {'source_bills', 'accounts', 'flags', 'exceptions', 'approval_queue'}
    if not isinstance(counts, dict) or set(counts) != expected_counts:
        raise ValueError('Unexpected synthetic dataset counts')
    if any(not isinstance(value, int) or isinstance(value, bool) or value < 0 for value in counts.values()):
        raise ValueError('Sample UI counts must be nonnegative integers')
    sources = data['sources']
    if not isinstance(sources, dict) or set(sources) != {'outputs', 'repository', 'readme', 'utility_readme'}:
        raise ValueError('Sample UI source links are incomplete')
    for url in sources.values(): safe_url(url)
    if urlsplit(sources['outputs']).hostname != 'jacobmetoyer.com':
        raise ValueError('Sample outputs must point to the live public snapshot')
    if any(urlsplit(sources[key]).hostname != 'github.com' for key in ('repository', 'readme', 'utility_readme')):
        raise ValueError('Sample source code links must use GitHub')
    if any(not urlsplit(sources[key]).path.startswith('/Jacob-Met/workflow-checks')
           for key in ('repository', 'readme', 'utility_readme')):
        raise ValueError('Sample source links must stay within the workflow-checks repository')
    records = data['records']
    if not isinstance(records, list) or not records:
        raise ValueError('Sample UI needs at least one synthetic record')
    required = {'id', 'category', 'property', 'utility', 'account', 'signal', 'summary', 'evidence'}
    seen: set[str] = set()
    for record in records:
        if not isinstance(record, dict) or set(record) != required:
            raise ValueError('Unexpected synthetic record fields')
        if not isinstance(record['id'], str) or not CASE_ID_RE.fullmatch(record['id']) or record['id'] in seen:
            raise ValueError('Invalid or duplicate synthetic record id')
        seen.add(record['id'])
        if not isinstance(record['category'], str) or record['category'] not in {'payment', 'usage', 'period', 'integrity'}:
            raise ValueError('Unknown synthetic record category')
        for field, limit in (('property', 160), ('utility', 80), ('account', 40), ('signal', 80), ('summary', 600)):
            text(record[field], limit)
        if '(synthetic)' not in record['property'] or not re.fullmatch(r'SYN-\d+', record['account']):
            raise ValueError('Every sample account and property must be explicitly synthetic')
        evidence = record['evidence']
        if not isinstance(evidence, list) or not evidence or any(not isinstance(item, str) or not re.fullmatch(r'[A-Za-z0-9_.-]+:\d+', item) for item in evidence):
            raise ValueError('Every sample flag needs file:row evidence pointers')


def load_sample_data() -> dict:
    data = json.loads(SAMPLE_DATA.read_text(encoding='utf-8'))
    validate_sample_data(data)
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
    required = {'ID-01', 'WC-01', 'WC-02', 'WC-03', 'WC-04', 'WC-05', 'WC-06', 'CS-01', 'CP-01', 'TO-01', 'UI-01'}
    if not required <= ids:
        raise ValueError('Required claim-to-source entries are missing')


def link(url: str, label: str, *, source_copy: bool = False) -> str:
    safe_url(url)
    marker = ' data-copy-source="true"' if source_copy else ''
    return f'<a href="{html.escape(url, quote=True)}" rel="noopener"{marker}>{html.escape(label)}</a>'


def inline(markdown: str) -> str:
    out: list[str] = []
    pos = 0
    for match in LINK_RE.finditer(markdown):
        out.append(html.escape(markdown[pos:match.start()]))
        out.append(link(match.group(2), match.group(1), source_copy=True))
        pos = match.end()
    out.append(html.escape(markdown[pos:]))
    return ''.join(out)


NAV_ITEMS = (
    ('Selected work', '#research'),
    ('Case studies', '#case-studies'),
    ('Demos', '#workflow-checks'),
    ('Pilot approach', '#pilot'),
    ('Contact', '#contact'),
)
PROFILE_URL = 'https://github.com/Jacob-Met'


def navigation(class_name: str, label: str) -> str:
    items = ''.join(
        f'<a href="{html.escape(href, quote=True)}">{html.escape(title)}</a>'
        for title, href in NAV_ITEMS
    )
    return f'<nav class="{html.escape(class_name, quote=True)}" aria-label="{html.escape(label, quote=True)}">{items}</nav>'


def render_case_studies(cases: list[dict]) -> str:
    cards: list[str] = []
    for number, case in enumerate(cases, 1):
        ident = case['id']
        title_id = f'case-{ident}-title'
        primary = case['artifacts'][0]
        readme = next((item for item in case['artifacts'] if 'readme' in item['label'].lower()), case['artifacts'][1])
        approach = ''.join(f'<li>{html.escape(step)}</li>' for step in case['approach'])
        artifacts = ''.join(f'<li>{link(item["url"], item["label"])}</li>' for item in case['artifacts'])
        cards.append(
            f'<article class="case-study" data-case-id="{html.escape(ident, quote=True)}" aria-labelledby="{title_id}">'
            f'<div class="case-study-meta"><span>CASE {number:02d} / {len(cases):02d}</span>'
            f'<span>{html.escape(case["category"])}</span><span>{html.escape(case["language"])}</span>'
            f'<span>Source snapshot {html.escape(case["source_revision"])}</span></div>'
            f'<h3 id="{title_id}"><a href="{html.escape(primary["url"], quote=True)}" rel="noopener">{html.escape(case["title"])}</a></h3>'
            f'<p class="case-summary">{html.escape(case["summary"])} {link(primary["url"], "Open the public repository")}</p>'
            f'<div class="case-study-detail"><h4>Question</h4>'
            f'<p>{html.escape(case["question"])} {link(readme["url"], "Read the project context")}</p>'
            f'<h4>Approach</h4><ol class="case-approach">{approach}</ol></div>'
            f'<p class="case-boundary"><strong>Boundary.</strong> {html.escape(case["boundary"])} {link(readme["url"], "Scope and limits")}</p>'
            f'<p class="case-disclosure"><strong>Disclosure.</strong> {html.escape(case["disclosure"])} {link(readme["url"], "Repository README")}</p>'
            f'<ul class="case-artifacts" aria-label="Case-study artifacts">{artifacts}</ul>'
            f'</article>'
        )
    intro = (
        '<p class="case-study-intro">Each case connects a question to public source, then states what the source does and does not show. '
        + link(PROFILE_URL, 'Browse the public repositories') + '</p>'
    )
    return (
        '<section id="case-studies" class="case-studies" aria-labelledby="case-studies-title">'
        '<div class="case-studies-heading"><div class="case-kicker">Selected investigations</div>'
        '<h2 id="case-studies-title">Case studies</h2>' + intro + '</div>'
        '<div class="case-grid">' + ''.join(cards) + '</div></section>'
    )


def render_sample_ui(data: dict) -> str:
    sources = data['sources']
    category_labels = {
        'payment': 'Payments', 'usage': 'Usage', 'period': 'Billing periods', 'integrity': 'Record integrity',
    }
    rows: list[str] = []
    for record in data['records']:
        evidence = ' | '.join(record['evidence'])
        search_text = ' '.join((record['property'], record['utility'], record['account'], record['signal'], record['summary'], evidence))
        attrs = {
            'data-record-id': record['id'], 'data-category': record['category'],
            'data-property': record['property'], 'data-utility': record['utility'],
            'data-account': record['account'], 'data-signal': record['signal'],
            'data-summary': record['summary'], 'data-evidence': evidence,
            'data-search-text': search_text,
        }
        encoded_attrs = ' '.join(f'{key}="{html.escape(value, quote=True)}"' for key, value in attrs.items())
        rows.append(
            f'<tr {encoded_attrs}>'
            f'<td><span class="record-property">{html.escape(record["property"])}</span>'
            f'<span class="record-meta">{html.escape(record["utility"])} · {html.escape(record["account"])}</span></td>'
            f'<td><span class="signal-code">{html.escape(record["signal"])}</span>'
            f'<span class="category-chip">{html.escape(category_labels[record["category"]])}</span></td>'
            f'<td>{html.escape(record["summary"])}</td>'
            f'<td><code class="evidence-pointer">{html.escape(" · ".join(record["evidence"]))}</code></td>'
            f'<td><button class="record-open" type="button" data-open-record="{html.escape(record["id"], quote=True)}" '
            f'aria-label="Inspect {html.escape(record["signal"], quote=True)} for {html.escape(record["property"], quote=True)}" disabled>Inspect</button></td>'
            '</tr>'
        )
    metric_labels = (
        ('source_bills', 'Synthetic bills'), ('accounts', 'Accounts'), ('flags', 'Flags'),
        ('exceptions', 'Exceptions'), ('approval_queue', 'Approval queue · not paid'),
    )
    metrics = ''.join(
        f'<div class="sample-metric"><dt>{html.escape(label)}</dt><dd>{data["counts"][key]:,}</dd></div>'
        for key, label in metric_labels
    )
    options = ''.join(
        f'<option value="{html.escape(value, quote=True)}">{html.escape(label)}</option>'
        for value, label in (('all', 'All categories'), *tuple(category_labels.items()))
    )
    return (
        '<a class="skip" href="#review-records">Skip to sample controls</a>'
        '<header class="sample-shell sample-header">'
        '<a class="sample-brand" href="/">Jacob Metoyer</a>'
        '<nav class="sample-nav" aria-label="Sample navigation">'
        '<a href="/#research">Work</a><a href="/#case-studies">Case studies</a>'
        f'<a href="{html.escape(sources["outputs"], quote=True)}">Full sample outputs</a></nav></header>'
        f'<main id="main" class="sample-shell sample-page" data-sample-ui data-readme-url="{html.escape(sources["utility_readme"], quote=True)}">'
        '<section class="sample-hero" aria-labelledby="sample-title"><div>'
        '<p class="sample-kicker">Workflow checks / synthetic demo</p>'
        '<h1 id="sample-title">Utility review desk</h1>'
        '<p class="sample-lede">Explore a small, interactive view of the generated utility-bill flags. Every property, account, bill, and amount is synthetic; the demo filters records in this browser and sends nothing.</p>'
        '<div class="sample-actions"><a href="#review-records">Explore the records</a>'
        f'<a class="secondary" href="{html.escape(sources["outputs"], quote=True)}">Open all generated reports</a></div>'
        f'<p class="sample-source-note">Source: <a href="{html.escape(sources["readme"], quote=True)}" rel="noopener">workflow-checks README</a>.</p>'
        '</div><aside class="sample-snapshot" aria-label="Dataset scope">'
        '<span class="sample-local-badge">Synthetic · local only</span><h2>Review the signal.</h2>'
        '<p>Source row pointers stay visible. A flag is a prompt to inspect, not a payment instruction or claim about accuracy on real records.</p>'
        f'<dl><dt>Output snapshot</dt><dd>{html.escape(data["snapshot_date"])}</dd>'
        '<dt>Interaction</dt><dd>Search, filter, sort, inspect</dd><dt>Network writes</dt><dd>None</dd></dl>'
        '</aside></section>'
        f'<dl class="sample-metrics" aria-label="Synthetic output counts">{metrics}</dl>'
        '<section id="review-records" class="review-workbench" aria-labelledby="review-title">'
        '<div class="review-heading"><div><p class="sample-kicker">Review workspace</p>'
        '<h2 id="review-title">Find a record. Follow its evidence.</h2>'
        '<p>Six example rows from the 12 generated utility flags.</p></div>'
        '<span class="review-stamp">Snapshot · {date}</span></div>'.format(date=html.escape(data['snapshot_date']))
        + '<p id="sample-script-status" class="sample-status" aria-live="polite">The table is fully listed below; local controls are loading.</p>'
        + '<div class="sample-controls" aria-label="Filter and sort synthetic records">'
        + '<label class="sample-control" for="sample-search">Search property, signal, account, or evidence'
        + '<input id="sample-search" type="search" autocomplete="off" placeholder="e.g. Bayou, PAYMENT_MISMATCH, bills.csv:126" disabled></label>'
        + '<label class="sample-control" for="sample-category">Category'
        + f'<select id="sample-category" disabled>{options}</select></label>'
        + '<button id="sample-sort" type="button" aria-pressed="false" disabled>Sort: sample order</button>'
        + '<button id="sample-reset" type="button" disabled>Reset</button></div>'
        + '<p id="sample-results" class="sample-status" role="status" aria-live="polite">6 synthetic records shown.</p>'
        + '<p id="sample-empty" class="sample-empty" hidden>No sample records match those filters. Reset the controls to restore all rows.</p>'
        + '<div class="table-scroll" role="region" aria-label="Synthetic utility flag records; scroll horizontally to see all columns" tabindex="0">'
        + '<table class="sample-table"><caption>Generated utility flags with their source file and row pointers. All records are synthetic.</caption>'
        + '<thead><tr><th scope="col">Property / account</th><th scope="col">Signal</th><th scope="col">Generated summary</th><th scope="col">Evidence</th><th scope="col"><span class="visually-hidden">Record detail</span></th></tr></thead>'
        + '<tbody id="demo-records">' + ''.join(rows) + '</tbody></table></div>'
        + '<div class="sample-boundary"><strong>Boundary</strong>'
        + '<p>This is a local interface demo of published synthetic output. It makes no payments, sends no messages, files nothing, and reports no real-world savings or accuracy. <a href="'
        + html.escape(sources['readme'], quote=True) + '" rel="noopener">Read scope and limitations</a>.</p></div>'
        + '<dialog id="record-dialog" class="record-dialog" aria-labelledby="detail-title" aria-describedby="detail-summary">'
        + '<div class="dialog-heading"><p>Generated record / detail</p><button id="record-close" class="record-close" type="button" disabled>Close</button></div>'
        + '<h2 id="detail-title">Synthetic record</h2><p id="detail-summary"></p>'
        + '<dl><dt>Property</dt><dd id="detail-property"></dd><dt>Utility</dt><dd id="detail-utility"></dd>'
        + '<dt>Account</dt><dd id="detail-account"></dd><dt>Signal</dt><dd id="detail-signal"></dd>'
        + '<dt>Input evidence</dt><dd><ul id="detail-evidence"></ul></dd></dl>'
        + '<p class="dialog-boundary">The interface only reveals the sample record. No state or source file is changed.</p>'
        + f'<a id="detail-source" href="{html.escape(sources["utility_readme"], quote=True)}" rel="noopener">Read the utility demo scope</a>'
        + '</dialog></section></main>'
        + '<footer class="sample-shell sample-footer"><p>Part of the public <a href="/">Jacob Metoyer portfolio</a>.</p>'
        + f'<p><a href="{html.escape(sources["outputs"], quote=True)}">See the full generated outputs</a></p></footer>'
        + '<script type="module" src="/sample-ui/sample-ui.js"></script>'
    )


def render_copy(markdown: str, case_studies: list[dict]) -> str:
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
            safe_url(PROFILE_URL)
            masthead = (
                '<header class="masthead"><div class="brand-lockup">'
                '<span class="registration" aria-hidden="true"></span><h1>' + inline(value)
                + '</h1></div>' + navigation('primary-nav', 'Primary')
                + f'<a class="masthead-profile" href="{html.escape(PROFILE_URL, quote=True)}" rel="noopener">GitHub <span aria-hidden="true">↗</span></a>'
                + '<details class="mobile-nav"><summary>Sections</summary>'
                + navigation('mobile-nav__links', 'Mobile primary') + '</details>'
                + '</header>'
            )
        elif kind == 'h2':
            close_section()
            if section_index == 2:
                content.append(render_case_studies(case_studies))
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
    footer = (
        '<footer id="contact" class="site-footer" aria-labelledby="contact-title">'
        '<div class="site-footer-inner"><h2 id="contact-title">Follow the work back to source.</h2>'
        '<p>Project READMEs describe scope, demo behavior, and limits. '
        + link(PROFILE_URL, 'Browse the public GitHub profile') + '</p>'
        '<a class="back-to-top" href="#main">Back to top <span aria-hidden="true">↑</span></a>'
        '</div></footer>'
    )
    return ('<a class="skip" href="#main">Skip to content</a>' + masthead
            + '<main id="main" class="docket">' + ''.join(content) + '</main>' + footer)


def page_html(
    name: str,
    title: str,
    desc: str,
    body: str,
    data: dict,
    *,
    csp: str = CSP,
    extra_styles: tuple[str, ...] = (),
    include_jsonld: bool = True,
) -> str:
    same_as = [PROFILE_URL]
    schema = {
        '@context': 'https://schema.org', '@type': 'Person',
        'name': data['name'], 'url': BASE, 'sameAs': same_as,
    }
    structured = json.dumps(schema, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e')
    if name == 'index.html':
        canonical = BASE + '/'
    elif name == SAMPLE_ROUTE:
        canonical = BASE + '/sample-ui/'
    else:
        canonical = BASE + '/' + name
    prefix = '/' if name == SAMPLE_ROUTE else ''
    stylesheet = f'<link rel="stylesheet" href="{prefix}style.css">'
    stylesheet += ''.join(f'<link rel="stylesheet" href="{html.escape(path, quote=True)}">' for path in extra_styles)
    jsonld = f'<script type="application/ld+json">{structured}</script>' if include_jsonld else ''
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="{html.escape(csp, quote=True)}"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title><meta name="description" content="{html.escape(desc, quote=True)}"><meta name="theme-color" content="#F3F0E7"><meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="canonical" href="{canonical}"><link rel="icon" href="{prefix}assets/mark.svg" type="image/svg+xml"><link rel="icon" href="{prefix}favicon.ico" sizes="48x48"><link rel="apple-touch-icon" href="{prefix}apple-touch-icon.png">{stylesheet}
<meta property="og:type" content="website"><meta property="og:title" content="{html.escape(title, quote=True)}"><meta property="og:description" content="{html.escape(desc, quote=True)}"><meta property="og:url" content="{canonical}">
<meta property="og:image" content="{BASE}/{SHARE_CARD}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="{html.escape(SHARE_ALT, quote=True)}"><meta name="twitter:card" content="summary_large_image">
{jsonld}</head>
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
    case_studies = load_case_studies()
    sample_data = load_sample_data()
    if not SAMPLE_COMPILED_JS.is_file():
        raise ValueError('Compiled sample UI module is missing; run npm run build:sample-ui first')
    if not (ROOT / 'sample-ui.css').is_file():
        raise ValueError('Sample UI stylesheet is missing')
    out = out.resolve()
    if out == ROOT or ROOT.is_relative_to(out):
        raise ValueError('Output must not replace source')
    allowed = {'index.html', '404.html', SAMPLE_ROUTE, SAMPLE_CSS, SAMPLE_JS, 'style.css', '.nojekyll', 'CNAME', 'robots.txt', 'sitemap.xml', 'cv.json', 'build-manifest.json', 'assets/mark.svg', SHARE_CARD, *ROOT_ICONS}
    if out.exists():
        for f in out.rglob('*'):
            if f.is_symlink() or (f.is_file() and f.relative_to(out).as_posix() not in allowed):
                raise ValueError('Output contains unexpected material; refuse to overwrite it')
    out.mkdir(parents=True, exist_ok=True)
    pages = {
        'index.html': (TITLE, DESC, render_copy(record['copy_markdown'], case_studies)),
        SAMPLE_ROUTE: (SAMPLE_TITLE, SAMPLE_DESC, render_sample_ui(sample_data)),
        '404.html': (
            'Not found · Jacob Metoyer',
            'Nothing here. Back to the work.',
            '<a class="skip" href="#main">Skip to content</a><main id="main" class="not-found"><h1>Nothing here.</h1><p><a href="index.html">Back to the work</a>.</p></main>',
        ),
    }
    for name, (title, desc, body) in pages.items():
        if name == SAMPLE_ROUTE:
            markup = page_html(name, title, desc, body, record, csp=SAMPLE_CSP,
                               extra_styles=('/sample-ui/sample-ui.css',), include_jsonld=False)
        else:
            markup = page_html(name, title, desc, body, record)
        (out / name).parent.mkdir(parents=True, exist_ok=True)
        (out / name).write_text(root_links(name, markup), encoding='utf-8', newline='\n')
    (out / 'style.css').write_text((ROOT / 'style.css').read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
    (out / 'assets').mkdir(exist_ok=True)
    shutil.copyfile(ROOT / 'assets' / 'mark.svg', out / 'assets' / 'mark.svg')
    shutil.copyfile(ROOT / SHARE_CARD, out / SHARE_CARD)
    for name in ROOT_ICONS:
        shutil.copyfile(ROOT / 'assets' / name, out / name)
    (out / 'sample-ui').mkdir(exist_ok=True)
    shutil.copyfile(ROOT / 'sample-ui.css', out / SAMPLE_CSS)
    shutil.copyfile(SAMPLE_COMPILED_JS, out / SAMPLE_JS)
    (out / '.nojekyll').write_text('', encoding='utf-8', newline='\n')
    (out / 'CNAME').write_text('jacobmetoyer.com\n', encoding='utf-8', newline='\n')
    (out / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n', encoding='utf-8', newline='\n')
    sitemap_entries = (
        (BASE + '/', record['updated']),
        (BASE + '/sample-ui/', record['updated']),
    )
    sitemap_urls = ''.join(
        f'<url><loc>{html.escape(url)}</loc><lastmod>{lastmod}</lastmod></url>'
        for url, lastmod in sitemap_entries
    )
    sm = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sitemap_urls}</urlset>'
    (out / 'sitemap.xml').write_text(sm, encoding='utf-8', newline='\n')
    record['copy_sha256'] = hashlib.sha256(record['copy_markdown'].encode('utf-8')).hexdigest()
    (out / 'cv.json').write_text(json.dumps(record, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    manifest_files = [f for f in out.rglob('*') if f.is_file() and f.name != 'build-manifest.json']
    manifest = {f.relative_to(out).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(manifest_files, key=lambda f: f.relative_to(out).as_posix())}
    (out / 'build-manifest.json').write_text(json.dumps({'schema': 2, 'date': record['updated'], 'sha256': manifest}, indent=2) + '\n', encoding='utf-8', newline='\n')
    return {
        'pages': len(pages), 'claims': len(record['claims']),
        'case_studies': len(case_studies), 'sample_records': len(sample_data['records']),
        'output': str(out), 'files': len(manifest) + 1,
    }


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--out', type=Path, default=ROOT.parent / 'docs')
    a = p.parse_args()
    print(json.dumps(build(a.out), indent=2))
