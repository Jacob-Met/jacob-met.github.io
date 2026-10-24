"""Exact captured-public UI surface; no GPU module, imports, network or inline code."""
from pathlib import Path
import base64, hashlib, json, re, struct
FONT_FILES=('assets/fonts/space-grotesk.woff','assets/fonts/OFL.txt')
FONT_PROPERTIES={'font-family':'Space','src':"url('assets/fonts/space-grotesk.woff') format('woff')",'font-style':'normal','font-weight':'300 700','font-display':'swap'}
SCRIPT_FILES=('detail.js',)
EXPERIENCE_CSS='experience.css'
SCENE_ASSETS={'hamonCapture':('assets/scene/hamon-engine-study.webp',1280,720)}
SCENE_FILES=tuple(v[0] for v in SCENE_ASSETS.values())

def validate_fonts(root):
 folder=root/'assets/fonts'
 if not folder.is_dir() or folder.is_symlink():raise ValueError('Missing or symlinked font folder')
 paths=list(folder.rglob('*'))
 if any(p.is_symlink() or not p.is_file() for p in paths) or {p.relative_to(root).as_posix() for p in paths}!=set(FONT_FILES):raise ValueError('Unexpected local font surface')
 raw=(root/FONT_FILES[0]).read_bytes()
 if not 44<=len(raw)<=128000 or raw[:4]!=b'wOFF' or struct.unpack('>I',raw[8:12])[0]!=len(raw):raise ValueError('Invalid WOFF font')
 license=(root/FONT_FILES[1]).read_text()
 if 'SIL OPEN FONT LICENSE Version 1.1' not in license or 'Space Grotesk' not in license:raise ValueError('Original font license must accompany font')

def script_integrity(digest):return 'sha256-'+base64.b64encode(bytes.fromhex(digest)).decode('ascii')

def script_allowlist():
 p=json.loads(Path(__file__).with_name('script-allowlist.json').read_text())
 if set(p)!={'schema','entry','sha256'} or p['schema']!=1 or p['entry']!='detail.js' or set(p['sha256'])!=set(SCRIPT_FILES):raise ValueError('Unexpected captured UI script custody')
 if any(not isinstance(v,str) or not re.fullmatch('[a-f0-9]{64}',v) for v in p['sha256'].values()):raise ValueError('Invalid script checksum')
 return p['sha256']

def script_source_errors(source):
 patterns={'dynamic evaluation':r'\beval\s*\(|\b(?:new\s+)?Function\s*\(', 'module dependency':r'\bimport\b(?!-)', 'network/worker/WASM':r'\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|Worker|SharedWorker|importScripts)\s*\(|\bWebAssembly\b', 'beacon/service worker':r'\b(?:sendBeacon|serviceWorker)\b','document write/source map':r'\bdocument\s*\.\s*write\s*\(|sourceMappingURL|sourceURL'}
 return [k for k,v in patterns.items() if re.search(v,source)]

def audit_scripts(root,expected=None):
 hashes=script_allowlist() if expected is None else expected
 if set(hashes)!=set(SCRIPT_FILES):raise ValueError('Undeclared homepage script')
 for name,digest in hashes.items():
  p=root/name
  if not p.is_file() or p.is_symlink():raise ValueError('Missing or symlinked homepage script')
  raw=p.read_bytes()
  if hashlib.sha256(raw).hexdigest()!=digest:raise ValueError('Homepage script custody checksum differs')
  if script_source_errors(raw.decode()):raise ValueError('Script outside captured UI surface')
 return hashes

def script_element_errors(attrs,source,hashes):
 if attrs.get('src'):
  name=attrs['src']
  if set(attrs)!={'src','defer','integrity'} or name not in SCRIPT_FILES or name not in hashes or attrs.get('defer') not in (None,'') or attrs.get('integrity')!=script_integrity(hashes[name]) or source.strip():return ['script: outside exact deferred captured UI']
  return []
 if attrs!={'type':'application/ld+json'}:return ['script: inline executable or unapproved data forbidden']
 try:value=json.loads(source)
 except (ValueError,TypeError):return ['script: invalid JSON-LD']
 return [] if isinstance(value,dict) else ['script: JSON-LD must be an object']

def canvas_element_errors(attrs):return ['canvas: experimental renderer is not part of captured publication']
