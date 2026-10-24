"""Explicit public captured presentation, not the experimental engine source bundle."""
import hashlib,json,re,struct
from pathlib import Path
CAPTURE_MANIFEST='capture-manifest.json'
CAPTURE_FILE='assets/scene/forge-native.png'
RECORDING_FILE='assets/scene/forge-native-motion.mp4'
PROOF_FILE='assets/scene/hamon-engine-study.webp'
CAPTURE_FILES=(CAPTURE_MANIFEST,CAPTURE_FILE,RECORDING_FILE)

def exact(obj,fields):
 if not isinstance(obj,dict) or set(obj)!=set(fields):raise ValueError('Unexpected captured-public fields')

def plain(s,n=400):
 if not isinstance(s,str) or not 1<=len(s)<=n or '<' in s or '>' in s:raise ValueError('Unsafe captured-public text')

def checked(root,record,name,max_bytes):
 if record.get('src')!=name or not isinstance(record.get('sha256'),str) or not re.fullmatch('[a-f0-9]{64}',record['sha256']):raise ValueError('Unapproved captured resource')
 p=root/name
 if not p.is_file() or p.is_symlink() or not p.resolve().is_relative_to(root.resolve()) or not 1<=p.stat().st_size<=max_bytes:raise ValueError('Missing or unsafe captured resource')
 raw=p.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=record['sha256']:raise ValueError('Captured resource checksum differs')
 return raw

def load_capture(root):
 p=root/CAPTURE_MANIFEST
 if p.is_symlink() or not p.is_file() or p.stat().st_size>10000:raise ValueError('Missing public capture manifest')
 m=json.loads(p.read_text());exact(m,{'schema','visibility','capture','recording','engineProof'})
 if m['schema']!=1 or m['visibility']!='public-captured':raise ValueError('Only explicitly approved captured-public projection may publish')
 for key in ('capture','engineProof'):
  r=m[key];exact(r,{'src','width','height','sha256','alt','label'});plain(r['alt']);plain(r['label'])
 r=m['capture'];raw=checked(root,r,CAPTURE_FILE,1500000)
 if raw[:8]!=b'\x89PNG\r\n\x1a\n' or raw[12:16]!=b'IHDR' or struct.unpack('>II',raw[16:24])!=(800,500) or (r['width'],r['height'])!=(800,500):raise ValueError('Native capture dimensions differ')
 r=m['engineProof'];raw=checked(root,r,PROOF_FILE,1500000)
 if raw[:4]!=b'RIFF' or raw[8:12]!=b'WEBP' or (r['width'],r['height'])!=(1280,720):raise ValueError('Engine proof format differs')
 from build import webp_size
 if webp_size(root/PROOF_FILE)!=(1280,720):raise ValueError('Engine proof dimensions differ')
 r=m['recording'];exact(r,{'src','width','height','sha256','frames','playbackFps','nativeJobSeconds','receiptSha256','label'});raw=checked(root,r,RECORDING_FILE,1500000);plain(r['label'])
 if raw[4:8]!=b'ftyp' or (r['width'],r['height'],r['frames'],r['playbackFps'])!=(800,548,60,20):raise ValueError('Recorded native media differs')
 if type(r['nativeJobSeconds']) not in (int,float) or not 1<=r['nativeJobSeconds']<=3600 or not re.fullmatch('[a-f0-9]{64}',r['receiptSha256']):raise ValueError('Invalid native capture receipt')
 return m

def video_element_errors(attrs):
 expected={'controls':None,'playsinline':None,'preload':'none','width':'800','height':'548','poster':CAPTURE_FILE,'aria-label':'Recorded native HAMON Engine camera approach, not live browser rendering'}
 return [] if attrs==expected else ['video: outside explicitly recorded controls-only media']

def source_element_errors(attrs):
 return [] if attrs=={'src':RECORDING_FILE,'type':'video/mp4'} else ['source: outside declared native recording']
