"""Exact captured-public UI surface; no GPU module, imports, network or inline code."""
from pathlib import Path
import base64, hashlib, json, re, struct
FONT_FILES=('assets/fonts/space-grotesk.woff','assets/fonts/OFL.txt')
FONT_PROPERTIES={'font-family':'Space','src':"url('assets/fonts/space-grotesk.woff') format('woff')",'font-style':'normal','font-weight':'300 700','font-display':'swap'}
LOADED_SCRIPT_FILES=('lobby-journey.js','scene-handoff.js','lobby.js')
SCRIPT_FILES=('detail.js',*LOADED_SCRIPT_FILES)
EXPERIENCE_CSS='experience.css'
SCENE_ASSETS={'hamonCapture':('assets/scene/hamon-engine-study.webp',1280,720)}
SCENE_FILES=tuple(v[0] for v in SCENE_ASSETS.values())
ART_ASSETS={'assets/scene/research-observatory.svg': {'width':860,'height':720,'sha256':'7dd1c072fd7545cda6f55180ef84e1c9f6344e0da82076f21cc288e00215873c'}}
ART_FILES=tuple(ART_ASSETS)
EDITORIAL_ART={'assets/editorial/spire-world.webp': {'width':1200,'height':675,'sha256':'0e30e92a60c4a8f702a5fa806b5bd0b28e6a017110341f84474101cbb9e22696','sourceUrl':'https://spireofoctaves.com/assets/hero-1200.webp'}}
EDITORIAL_FILES=tuple(EDITORIAL_ART)
PRESENTATION_STILLS={'entrance': {'src': 'assets/scene/forge-tools-entrance-1280.png', 'sha256': 'fab0b9626366b1bbb2f259d9b90eb9fcf8a5d0b72039ceb38d6f4f6fbe6e42b9', 'width': 1280, 'height': 800}, 'arrival': {'src': 'assets/scene/forge-tools-arrival-960.png', 'sha256': '41243ff04b170be7c9c86abe7a5e0658650a1c137e0ceaab7da45fa50f3dd06a', 'width': 960, 'height': 600}}
# Existing public URL remains exact; it is no longer the selected Engine view.
RETAINED_PRESENTATION_STILLS={'previous-arrival': {'src': 'assets/scene/forge-arrival-1280.png', 'width': 1280, 'height': 800, 'sha256': '37f712ef3718d7d02faffc6952a363906e34a9e921623d16470e425bcd8ec9dd'}, 'prior-selected-entrance': {'src': 'assets/scene/forge-entrance-1280.png', 'width': 1280, 'height': 800, 'sha256': '5289a46ef28008084a794c3d85040fb577c927126cdf3b87720dba4ef3d077d2'}, 'prior-selected-arrival': {'src': 'assets/scene/forge-arrival-960.png', 'width': 960, 'height': 600, 'sha256': '7f510954f85e241920f75fd32c007d428930adf40b207b7d5f041d46f642b24a'}, 'warm53-entrance': {'src': 'assets/scene/forge-warm-entrance-1280.png', 'sha256': 'aa98b75fd837beb69d5c83dcaf20879ec7b228bab7d8c83bf569d1e5b928f5df', 'width': 1280, 'height': 800}, 'warm53-arrival': {'src': 'assets/scene/forge-warm-arrival-960.png', 'sha256': 'cfdb06e0f6244e0a3ee4c443057704568faa2853bdc0ce58cae246a56e9a0343', 'width': 960, 'height': 600}}
# Delivery derivative only: original PNGs remain the native provenance/compatibility URLs.
LOSSLESS_ENTRANCE={'src': 'assets/scene/forge-tools-entrance-1280.webp', 'sha256': '709f23f6666e7ae34d1971c20539297d226913a4b26e6b33e90c554b42ada971', 'width': 1280, 'height': 800, 'rgbaSha256': 'd403504d08e73fcde247361eb792c13984f701526311174ff28c16e663da70e3'}
RETAINED_LOSSLESS_ENTRANCES={'prior-selected-entrance': {'src': 'assets/scene/forge-entrance-1280.webp', 'width': 1280, 'height': 800, 'sha256': '0e3c6614e72335640a8aa068902e0f8bf510bdbd1a74b7b7ff5c87347dcb21b8', 'rgbaSha256': '4e8d2b4c9980bc5b1de739aa52e1db1dc6040ac96460624c147106bbda8aa602'}, 'warm53-entrance': {'src': 'assets/scene/forge-warm-entrance-1280.webp', 'sha256': '6902ff1655f997b5a80f009f00677158a7658fad03553e2b98e93918601f5f41', 'width': 1280, 'height': 800, 'rgbaSha256': 'f1a01579785b92235fe2ce69ff6f7ab7f60a60e589b46810b25712c5628d03de'}}
DELIVERY_STILLS={**PRESENTATION_STILLS,'entrance':LOSSLESS_ENTRANCE}
PRESENTATION_FILES=(*[v['src'] for v in PRESENTATION_STILLS.values()],*[v['src'] for v in RETAINED_PRESENTATION_STILLS.values()],LOSSLESS_ENTRANCE['src'],*[v['src'] for v in RETAINED_LOSSLESS_ENTRANCES.values()])

def lossless_webp_dimensions(raw):
 # The entrance delivery derivative is one lossy VP8 (or lossless VP8L) chunk with no ICC/EXIF/XMP/animation.
 if len(raw)<30 or raw[:4]!=b'RIFF' or raw[8:12]!=b'WEBP' or int.from_bytes(raw[4:8],'little')!=len(raw)-8:raise ValueError('Entrance WebP container differs')
 kind=raw[12:16]
 if kind==b'VP8 ':
  if raw[23:26]!=b'\x9d\x01\x2a':raise ValueError('Entrance WebP frame header differs')
  return (int.from_bytes(raw[26:28],'little')&0x3fff,int.from_bytes(raw[28:30],'little')&0x3fff)
 if kind==b'VP8L':
  bits=int.from_bytes(raw[21:25],'little')
  if raw[20]!=0x2f or bits>>28:raise ValueError('Entrance WebP lossless header differs')
  return ((bits&0x3fff)+1,((bits>>14)&0x3fff)+1)
 raise ValueError('Entrance WebP chunk differs')

def validate_lossless_entrance(root):
 for record in (LOSSLESS_ENTRANCE,*RETAINED_LOSSLESS_ENTRANCES.values()):
  path=root/record['src']
  if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(root.resolve()):raise ValueError('Missing lossless entrance delivery asset')
  raw=path.read_bytes()
  if hashlib.sha256(raw).hexdigest()!=record['sha256']:raise ValueError('Lossless entrance delivery checksum differs')
  if lossless_webp_dimensions(raw)!=(record['width'],record['height']):raise ValueError('Lossless entrance delivery dimensions differ')


def validate_presentation_stills(root):
 for record in (*PRESENTATION_STILLS.values(),*RETAINED_PRESENTATION_STILLS.values()):
  path=root/record['src']
  if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(root.resolve()):raise ValueError('Missing native presentation still')
  raw=path.read_bytes()
  if not 33<=len(raw)<=2000000 or hashlib.sha256(raw).hexdigest()!=record['sha256']:raise ValueError('Native presentation still checksum differs')
  if raw[:8]!=b'\x89PNG\r\n\x1a\n' or raw[12:16]!=b'IHDR' or struct.unpack_from('>II',raw,16)!=(record['width'],record['height']):raise ValueError('Native presentation still dimensions differ')
 validate_lossless_entrance(root)


def validate_art(root):
 from figure_policy import resource
 for path,record in ART_ASSETS.items():
  resource(root,{'src':path,**record},path)


def validate_editorial(root):
 for name,record in EDITORIAL_ART.items():
  path=root/name
  if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(root.resolve()):raise ValueError('Missing editorial artwork')
  raw=path.read_bytes()
  if not 30<=len(raw)<=100000 or hashlib.sha256(raw).hexdigest()!=record['sha256']:raise ValueError('Editorial artwork checksum differs')
  if raw[:4]!=b'RIFF' or raw[8:12]!=b'WEBP' or struct.unpack_from('<I',raw,4)[0]!=len(raw)-8:raise ValueError('Editorial artwork format differs')
  kind=raw[12:16]
  if kind==b'VP8 ':w,h=struct.unpack_from('<HH',raw,26);size=(w&0x3fff,h&0x3fff)
  elif kind==b'VP8L':
   bits=int.from_bytes(raw[21:25],'little');size=((bits&0x3fff)+1,((bits>>14)&0x3fff)+1)
  elif kind==b'VP8X':size=(int.from_bytes(raw[24:27],'little')+1,int.from_bytes(raw[27:30],'little')+1)
  else:raise ValueError('Editorial artwork WebP chunk differs')
  if size!=(record['width'],record['height']):raise ValueError('Editorial artwork dimensions differ')


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
 if set(p)!={'schema','entries','compatibility','sha256'} or p['schema']!=2 or p['entries']!=list(LOADED_SCRIPT_FILES) or p['compatibility']!=['detail.js'] or set(p['sha256'])!=set(SCRIPT_FILES):raise ValueError('Unexpected captured UI script custody')
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
  if set(attrs)!={'src','defer','integrity'} or name not in LOADED_SCRIPT_FILES or name not in hashes or attrs.get('defer') not in (None,'') or attrs.get('integrity')!=script_integrity(hashes[name]) or source.strip():return ['script: outside exact deferred recorded-route UI']
  return []
 if attrs!={'type':'application/ld+json'}:return ['script: inline executable or unapproved data forbidden']
 try:value=json.loads(source)
 except (ValueError,TypeError):return ['script: invalid JSON-LD']
 return [] if isinstance(value,dict) else ['script: JSON-LD must be an object']

def canvas_element_errors(attrs):return ['canvas: experimental renderer is not part of captured publication']
