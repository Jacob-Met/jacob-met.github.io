"""Bounded independent source/build review; no author source writes or inherited suite."""
import ast
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
SOURCE = Path('/dev/shm/portfolio-screenshot-access-dc13ebf4687f')
BASE = Path('/workspace/scratch/dc13ebf4687f/work-capability-portfolio/baseline')
HEAD = 'b9a7ef94cec8c38d1202995bb9c8359012f91157'
PARENT = '9edce3a22d39fe87ac0b65336df980c0db89cdee'
PATHS = ['source/build.py', 'source/style.css', 'source/test_screenshot_access.py',
         'docs/index.html', 'docs/style.css', 'docs/build-manifest.json']


def git(root, *args):
    return subprocess.check_output(['git', *args], cwd=root)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def row(root, path):
    data = (root / path).read_bytes()
    return {'path': path, 'bytes': len(data), 'sha256': digest(data),
            'git_blob': hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()}


def inventory(root, ref):
    result = []
    for line in git(root, 'ls-tree', '-r', ref).decode().splitlines():
        meta, name = line.split('\t', 1)
        mode, kind, sha = meta.split()
        assert kind == 'blob' and mode in {'100644', '100755'}, (name, mode, kind)
        item = row(root, name)
        assert item['git_blob'] == sha, name
        result.append(item)
    return result


class Anchors(HTMLParser):
    def __init__(self, markup):
        super().__init__()
        self.items = []
        self.current = None
        self.feed(markup)

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            assert self.current is None, 'Nested anchor'
            self.current = {'attrs': dict(attrs), 'text': ''}
            self.items.append(self.current)

    def handle_data(self, data):
        if self.current is not None:
            self.current['text'] += data

    def handle_endtag(self, tag):
        if tag == 'a':
            self.current = None


def main():
    assert git(SOURCE, 'rev-parse', 'HEAD').decode().strip() == HEAD
    assert git(SOURCE, 'rev-parse', 'HEAD^').decode().strip() == PARENT
    assert git(BASE, 'rev-parse', 'HEAD').decode().strip() == PARENT
    assert git(BASE, 'rev-parse', 'HEAD^{tree}').decode().strip() == '99e64f39de7038fd91125ed7157a2fd57cf30ba8'
    changed = git(SOURCE, 'diff', '--name-only', PARENT, HEAD).decode().splitlines()
    assert set(changed) == set(PATHS), changed
    before = inventory(SOURCE, HEAD)
    base_inventory = inventory(BASE, PARENT)
    assert not any(Path(r['path']).name == 'AGENTS.md' for r in before)
    old_code = (BASE / 'source/build.py').read_bytes()
    new_code = (SOURCE / 'source/build.py').read_bytes()
    added_lines = [line for line in new_code.splitlines(keepends=True)
                   if b'f\'<p class="screenshot-links"' in line or b'f\'<a class="screenshot-link"' in line]
    assert len(added_lines) == 3
    assert new_code == old_code.replace(b'        f\'<p class="links">',
                                      b''.join(added_lines) + b'        f\'<p class="links">', 1)
    old_ast = ast.parse(old_code)
    new_ast = ast.parse(new_code)
    for tree in [old_ast, new_ast]:
        tree.body = [node for node in tree.body if not isinstance(node, ast.FunctionDef) or node.name != 'demo_card']
    assert ast.dump(old_ast) == ast.dump(new_ast)
    old_css = (BASE / 'source/style.css').read_bytes()
    new_css = (SOURCE / 'source/style.css').read_bytes()
    added_rules = [line for line in new_css.splitlines(keepends=True) if line.startswith(b'.screenshot-link')]
    assert len(added_rules) == 2
    assert b''.join(line for line in new_css.splitlines(keepends=True) if line not in added_rules) == old_css
    old_html = (BASE / 'docs/index.html').read_text()
    new_html = (SOURCE / 'docs/index.html').read_text()
    stripped, count = re.subn(r'<p class="screenshot-links">.*?</p>', '', new_html)
    assert count == 3 and stripped == old_html
    anchors = Anchors(new_html).items
    shots = [a for a in anchors if a['attrs'].get('class') == 'screenshot-link']
    assert len(shots) == 6
    assert [a for a in anchors if a not in shots] == Anchors(old_html).items
    assert not any(a['attrs'].get('class') == 'screenshot-link' for a in Anchors(old_html).items)
    content = json.loads((SOURCE / 'source/content.json').read_text())
    expected = [(d, key, label) for d in content['demos'] for key, label in [('desktop', 'Desktop'), ('mobile', 'Phone')]]
    links = []
    for anchor, (demo, key, label) in zip(shots, expected):
        shot = demo['shots'][key]
        assert anchor == {'attrs': {'class': 'screenshot-link', 'href': shot['src'],
                                   'aria-label': f"{demo['name']}: full {label.lower()} screenshot"}, 'text': label}
        asset = row(SOURCE, 'docs/' + shot['src'])
        assert asset['sha256'] == row(BASE, 'docs/' + shot['src'])['sha256']
        assert asset['sha256'] == row(SOURCE, 'source/' + shot['src'])['sha256']
        links.append({'label': anchor['attrs']['aria-label'], 'href': shot['src'], 'width': shot['w'],
                      'height': shot['h'], 'sha256': asset['sha256'], 'bytes': asset['bytes']})
    rebuilt = ROOT / 'rebuilt'
    assert not rebuilt.exists()
    process = subprocess.run([sys.executable, '-B', str(SOURCE / 'source/build.py'), '--out', str(rebuilt)],
                             cwd=ROOT, text=True, capture_output=True)
    assert process.returncode == 0, process.stderr
    generated = [row(rebuilt, str(path.relative_to(rebuilt))) for path in sorted(rebuilt.rglob('*')) if path.is_file()]
    existing_paths = {str(p.relative_to(SOURCE / 'docs')) for p in (SOURCE / 'docs').rglob('*') if p.is_file()}
    assert {r['path'] for r in generated} == existing_paths
    for r in generated:
        assert r['sha256'] == row(SOURCE / 'docs', r['path'])['sha256'], r['path']
    manifest = json.loads((rebuilt / 'build-manifest.json').read_text())
    assert manifest['sha256'] == {r['path']: r['sha256'] for r in generated if r['path'] != 'build-manifest.json'}
    old_manifest = json.loads((BASE / 'docs/build-manifest.json').read_text())
    assert {k for k, v in manifest['sha256'].items() if old_manifest['sha256'][k] != v} == {'index.html', 'style.css'}
    assert inventory(SOURCE, HEAD) == before
    result = {'accepted_source_and_build': True, 'upstream': 'c6f22409c5f52a3b5925ed6a74e19e4b5c0cda27',
              'candidate': HEAD, 'baseline': PARENT, 'python': sys.version, 'source_root': str(SOURCE),
              'baseline_root': str(BASE), 'changed_paths': [row(SOURCE, p) for p in PATHS],
              'exact_candidate_files': len(before), 'exact_baseline_files': len(base_inventory),
              'unchanged_candidate_files': len(before) - len(PATHS), 'baseline_screenshot_links': 0,
              'candidate_screenshot_links': links, 'outside_demo_card_ast_unchanged': True,
              'only_three_renderer_lines_and_two_css_rules': True, 'original_html_and_links_preserved': True,
              'build': {'command': process.args, 'returncode': process.returncode, 'stdout': process.stdout,
                        'stderr': process.stderr, 'exact_generated_files': generated},
              'author_sources_unchanged_after': True, 'no_inherited_suite_run': True,
              'browser_receiving': 'Separate bounded browser receipt; static success does not qualify rendering or keyboard navigation.'}
    (ROOT / 'static-receipt.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'accepted_source_and_build': True, 'candidate': HEAD,
                      'exact_generated_files': len(generated), 'links': len(links),
                      'unchanged_candidate_files': result['unchanged_candidate_files']}))


if __name__ == '__main__':
    main()
