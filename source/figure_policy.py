"""Bounded computed project illustrations, separate from screenshots and route media."""
import hashlib
import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET

MANIFEST = 'project-figures.json'
PROJECTS = ('towerops-airspace', 'recallweave', 'worldlaw')
PATHS = {key: {kind: f'assets/figures/{key}-computed{suffix}.svg'
               for kind, suffix in (('desktop', ''), ('mobile', '-mobile'))} for key in PROJECTS}
TAGS = {'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'title', 'desc'}
ATTRS = {'width', 'height', 'viewBox', 'role', 'aria-labelledby', 'id', 'x', 'y', 'x1', 'x2', 'y1', 'y2',
         'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'transform', 'fill', 'stroke', 'stroke-width',
         'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'font-family', 'font-size', 'font-weight',
         'text-anchor', 'dominant-baseline', 'letter-spacing', 'opacity', 'fill-opacity', 'stroke-opacity'}


def exact(value, keys):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError('Unexpected computed-figure fields')


def resource(root, record, path):
    exact(record, {'src', 'width', 'height', 'sha256'})
    if record['src'] != path or not isinstance(record['sha256'], str) or not re.fullmatch('[a-f0-9]{64}', record['sha256']):
        raise ValueError('Undeclared computed-figure resource')
    if any(type(record[k]) is not int or not 200 <= record[k] <= 2000 for k in ('width', 'height')):
        raise ValueError('Invalid computed-figure dimensions')
    p = root / path
    if not p.is_file() or p.is_symlink() or not p.resolve().is_relative_to(root.resolve()) or not 1 <= p.stat().st_size <= 100_000:
        raise ValueError('Missing or oversized computed figure')
    if any(parent.is_symlink() for parent in p.parents if parent != root.parent):
        raise ValueError('Symlinked computed figure')
    raw = p.read_bytes()
    if hashlib.sha256(raw).hexdigest() != record['sha256']:
        raise ValueError('Computed-figure checksum differs')
    text = raw.decode('utf-8')
    inspected = re.sub(r"\A<\?xml version=['\"]1\.0['\"] encoding=['\"]utf-8['\"]\?>\s*", '', text, count=1, flags=re.I)
    if '<!' in inspected or '<?' in inspected:
        raise ValueError('SVG entities, declarations and instructions are unsupported')
    tree = ET.fromstring(text)
    if tree.tag != '{http://www.w3.org/2000/svg}svg' or any(tree.get(k) != str(record[k]) for k in ('width', 'height')):
        raise ValueError('Computed-figure SVG size differs')
    if tree.get('viewBox') != f"0 0 {record['width']} {record['height']}":
        raise ValueError('Computed-figure viewport differs')
    ids = []
    for n in tree.iter():
        if not isinstance(n.tag, str) or not n.tag.startswith('{http://www.w3.org/2000/svg}') or n.tag.split('}', 1)[1] not in TAGS:
            raise ValueError('Undeclared computed-figure SVG element')
        if set(n.attrib) - ATTRS or any(re.search(r'url\s*\(|[\\\x00-\x08\x0b\x0c\x0e-\x1f]', v, re.I) for v in n.attrib.values()):
            raise ValueError('Active or external SVG attribute')
        if n.get('id'):
            ids.append(n.get('id'))
    if len(ids) != len(set(ids)) or not {'title', 'desc'} <= set(ids):
        raise ValueError('Computed figure needs unique accessible title and description')


def load_figures(root):
    root = Path(root)
    p = root / MANIFEST
    if not p.exists():
        return {}
    if p.is_symlink() or not p.is_file() or p.stat().st_size > 10_000:
        raise ValueError('Invalid computed-figure manifest')
    data = json.loads(p.read_text())
    exact(data, {'schema', 'figures'})
    if type(data['schema']) is not int or data['schema'] != 1 or not isinstance(data['figures'], dict) or set(data['figures']) - set(PROJECTS):
        raise ValueError('Unreviewed computed-figure inventory')
    for key, r in data['figures'].items():
        exact(r, {'src', 'width', 'height', 'sha256', 'alt', 'label'} | ({'mobile'} if 'mobile' in r else set()))
        for field in ('alt', 'label'):
            if not isinstance(r[field], str) or not 1 <= len(r[field]) <= 400 or any(c in r[field] for c in '<>\x00'):
                raise ValueError('Invalid computed-figure text')
        if not r['label'].startswith('Computed '):
            raise ValueError('Computed illustration must not be mislabeled as a screenshot')
        resource(root, {k: r[k] for k in ('src', 'width', 'height', 'sha256')}, PATHS[key]['desktop'])
        if 'mobile' in r:
            resource(root, r['mobile'], PATHS[key]['mobile'])
    return data['figures']


def figure_files(figures):
    return ({MANIFEST} | {r['src'] for r in figures.values()} |
            {r['mobile']['src'] for r in figures.values() if 'mobile' in r}) if figures else set()


def picture_source_errors(attrs, figures):
    return [] if any(attrs == {'media': '(max-width: 800px)', 'srcset': r['mobile']['src'],
                               'type': 'image/svg+xml', 'width': str(r['mobile']['width']),
                               'height': str(r['mobile']['height'])}
                     for r in figures.values() if 'mobile' in r) else ['source: outside declared computed-figure picture']
