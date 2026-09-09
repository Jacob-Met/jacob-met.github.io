#!/usr/bin/env python3
"""Offline integrity and link checks for the generated public site."""
from __future__ import annotations
import argparse, hashlib, json, re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote,urlsplit

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[];self.links=[];self.images=[];self.h1=0;self.forms=0;self.frames=0;self.lang=None;self.scripts=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='html':self.lang=a.get('lang')
        if tag=='h1':self.h1+=1
        if tag=='form':self.forms+=1
        if tag=='iframe':self.frames+=1
        if tag in ('a','link') and a.get('href'):self.links.append(a['href'])
        if tag=='script':
            self.scripts.append(a)
            if a.get('src'):self.links.append(a['src'])
        if tag=='img':
            self.images.append(a)
            if a.get('src'):self.links.append(a['src'])

def check(root: Path,allow_missing_images: bool=False) -> dict:
    root=root.resolve();failures=[];parsed={}
    for f in root.glob('*.html'):
        p=Page();p.feed(f.read_text(encoding='utf-8'));parsed[f.name]=p
    if len(parsed)!=12:failures.append('Expected twelve HTML routes')
    for name,p in parsed.items():
        if p.h1!=1:failures.append(f'{name}: expected one h1')
        if p.lang!='en':failures.append(f'{name}: missing language')
        if p.forms or p.frames:failures.append(f'{name}: unexpected collection or embed')
        if len(p.ids)!=len(set(p.ids)):failures.append(f'{name}: duplicate ids')
        for img in p.images:
            if not img.get('alt') or not img.get('width') or not img.get('height'):failures.append(f'{name}: image needs alt/dimensions')
        for u in p.links:
            ref=urlsplit(u)
            if ref.scheme:
                if ref.scheme!='https':failures.append(f'{name}: non-HTTPS link')
                continue
            if ref.netloc:failures.append(f'{name}: scheme-relative URL');continue
            path=unquote(ref.path)
            target=(root/(path or name)).resolve()
            if not target.is_relative_to(root):failures.append(f'{name}: escaped path');continue
            if not target.exists():
                if not (allow_missing_images and target.suffix=='.webp'):failures.append(f'{name}: missing {path}')
            if ref.fragment and target.name in parsed and ref.fragment not in parsed[target.name].ids:
                failures.append(f'{name}: missing anchor {u}')
        for s in p.scripts:
            if s.get('src') and s['src']!='site.js':failures.append(f'{name}: unapproved executable script')
            if not s.get('src') and s.get('type')!='application/ld+json':failures.append(f'{name}: inline executable script')
    manifest=json.loads((root/'build-manifest.json').read_text())['sha256']
    for name,sha in manifest.items():
        f=(root/name)
        if not f.is_file() or hashlib.sha256(f.read_bytes()).hexdigest()!=sha:failures.append(f'Hash mismatch {name}')
    actual={str(f.relative_to(root)).replace('\\','/') for f in root.rglob('*') if f.is_file()}
    if actual!=set(manifest)|{'build-manifest.json'}:failures.append('Manifest does not cover all files')
    result={'passed':not failures,'html_pages':len(parsed),'files':len(actual),'image_files_present':all((root/'assets'/n).exists() for n in ['spire-hero.webp','seamwork.webp','reminder.webp']),'failures':failures}
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('root',type=Path);p.add_argument('--allow-missing-images',action='store_true');a=p.parse_args();r=check(a.root,a.allow_missing_images);print(json.dumps(r,indent=2));raise SystemExit(0 if r['passed'] else 1)
