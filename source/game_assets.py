"""Explicit runtime-only publication boundary for the private engine's browser game.

Only the featured game's shipped runtime files are admitted. This is not a repository export.
Root-page policy remains unchanged; the game has its own narrow WebAssembly policy.
"""
from __future__ import annotations
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

GAME_PATH = 'games/lanternwake'
RUNTIME_FILES = frozenset({'index.html', 'style.css', 'loader.js', 'hamon_web.js',
                          'hamon_web_bg.wasm', 'webgpu-compat.js', 'poster.svg', 'build-info.json'})
EVIDENCE_FILES = frozenset({'evidence.json', 'desktop.png', 'mobile.png'})
GAME_CSP = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'"


def wasm_runtime_only(data: bytes) -> None:
    if data[:8] != b'\0asm\x01\0\0\0':
        raise ValueError('Invalid WebAssembly header')
    pos = 8
    while pos < len(data):
        section = data[pos]; pos += 1; size = 0
        for shift in range(0, 35, 7):
            if pos >= len(data): raise ValueError('Truncated WebAssembly section')
            byte = data[pos]; pos += 1; size |= (byte & 127) << shift
            if byte < 128: break
        else: raise ValueError('Oversized WebAssembly section')
        if pos + size > len(data): raise ValueError('Truncated WebAssembly payload')
        if section == 0: raise ValueError('Custom/debug/source/producers sections must be stripped')
        pos += size


class GamePage(HTMLParser):
    def __init__(self):
        super().__init__(); self.errors = []; self.scripts = []; self.canvas = 0; self.csp = []; self.head = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in {'meta', 'title', 'link', 'script'} and len(self.head) < 2:
            self.head.append((tag, a.get('http-equiv', '').lower()))
        if len(a) != len(attrs): self.errors.append('Duplicate HTML attribute')
        if any(k.startswith('on') or k in {'style', 'srcdoc', 'ping'} for k in a): self.errors.append('Inline execution/style not allowed')
        if tag in {'iframe', 'object', 'embed', 'base', 'form', 'style'}: self.errors.append('Undeclared HTML element')
        if tag == 'meta' and a.get('http-equiv', '').lower() == 'content-security-policy': self.csp.append(a.get('content'))
        if tag == 'meta' and a.get('http-equiv', '').lower() in {'refresh', 'set-cookie'}: self.errors.append('Redirect/cookie not allowed')
        if tag == 'canvas': self.canvas += 1
        if tag == 'script':
            self.scripts.append((a.get('type'), a.get('src')))
            if a.get('type') != 'module' or a.get('src') != './loader.js': self.errors.append('Only the local module loader is allowed')
        for key in ('src', 'href'):
            if key not in a: continue
            value = a[key]
            # The backlink is navigational, not a remotely loaded resource.
            if tag == 'a' and value == 'https://jacobmetoyer.com/': continue
            if value not in {'./loader.js', './style.css', './poster.svg', './evidence.json'}:
                self.errors.append('Undeclared resource/link: ' + value)


def audit_game_bundle(root: Path) -> dict[str, str]:
    if not root.is_dir() or root.is_symlink(): raise ValueError('Missing or symlinked game bundle')
    entries = list(root.rglob('*'))
    if any(p.is_symlink() or p.is_dir() for p in entries): raise ValueError('Game bundle must be flat, without symlinks')
    actual = {p.name for p in entries}
    if not RUNTIME_FILES <= actual or actual - RUNTIME_FILES - EVIDENCE_FILES:
        raise ValueError('Game bundle contains missing or non-runtime files: ' + repr(sorted(actual ^ RUNTIME_FILES)))
    wasm_runtime_only((root / 'hamon_web_bg.wasm').read_bytes())
    for name in ('loader.js', 'hamon_web.js', 'webgpu-compat.js'):
        text = (root / name).read_text()
        if re.search(r'sourceMappingURL|sourceURL|/Users/|/workspace/|/root/|github-engine:', text):
            raise ValueError('Private path/source map in runtime JavaScript')
    loader = (root / 'loader.js').read_text()
    if 'installWebGpuCompatibility' not in loader or './webgpu-compat.js' not in loader:
        raise ValueError('Required WebGPU compatibility shim missing')
    page = GamePage(); page.feed((root / 'index.html').read_text()); page.close()
    if page.csp != [GAME_CSP] or page.head != [('meta', ''), ('meta', 'content-security-policy')]:
        raise ValueError('Incorrect game CSP or ordering')
    if page.errors or page.canvas != 1 or page.scripts != [('module', './loader.js')]:
        raise ValueError('Game HTML outside explicit surface: ' + repr(page.errors))
    css = (root / 'style.css').read_text()
    if re.search(r'@import|url\s*\(|@font-face', css, re.I): raise ValueError('Remote/undeclared CSS resource')
    info = json.loads((root / 'build-info.json').read_text())
    if info.get('visibility') != 'public-runtime-only' or not re.fullmatch(r'[a-f0-9]{40}', info.get('engine_commit', '')):
        raise ValueError('Missing runtime-only provenance')
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(entries)}


def game_files(source: Path, record: dict) -> list[str]:
    playable = [g for g in record['games'] if g['build'] is not None]
    if not playable: return []
    if len(playable) != 1 or urlsplit(playable[0]['build']['play_url']).path != '/' + GAME_PATH + '/':
        raise ValueError('Only the explicitly admitted Lanternwake build path is supported')
    manifest = audit_game_bundle(source / GAME_PATH)
    return [GAME_PATH + '/' + name for name in manifest]
