#!/usr/bin/env python3
"""Package exactly six qualified private-engine runtime inputs; no source export.

Build private hamon-web with the pinned wasm-bindgen version, then pass its runtime
folder and exact engine commit here. Writes a NEW output folder and NEW receipt.
"""
from pathlib import Path
import argparse, hashlib, json, re
from game_assets import GAME_CSP, audit_game_bundle
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--runtime', required=True, type=Path)
p.add_argument('--out', required=True, type=Path)
p.add_argument('--engine-commit', required=True)
p.add_argument('--receipt', required=True, type=Path)
a=p.parse_args(); source=a.runtime.resolve(); target=a.out.resolve(); commit=a.engine_commit; receipt_path=a.receipt.resolve()
if not re.fullmatch(r'[a-f0-9]{40}',commit): p.error('Exact 40-character engine commit required')
if target.exists() or receipt_path.exists(): p.error('Preserve existing output and receipts; choose new paths')
if source.is_symlink() or not source.is_dir(): p.error('Runtime must be a real directory')
for n in ['index.html','loader.js','hamon_web.js','hamon_web_bg.wasm','webgpu-compat.js','poster.svg']:
    f=source/n
    if f.is_symlink() or not f.is_file(): p.error('Missing or symlinked input: '+n)
receipt_path.parent.mkdir(parents=True,exist_ok=True)
selected=['index.html','loader.js','hamon_web.js','hamon_web_bg.wasm','webgpu-compat.js','poster.svg']
before={n:hashlib.sha256((source/n).read_bytes()).hexdigest() for n in selected}
target.mkdir(parents=True,exist_ok=True)
for n in selected: (target/n).write_bytes((source/n).read_bytes())
data=(target/'hamon_web_bg.wasm').read_bytes(); pos=8; output=bytearray(data[:8]); stripped=[]
assert data[:8]==b'\0asm\x01\0\0\0'
while pos<len(data):
    start=pos; kind=data[pos];pos+=1;size=0;shift=0
    while True:
        b=data[pos];pos+=1;size|=(b&127)<<shift;shift+=7
        if b<128:break
        assert shift<=35
    end=pos+size; assert end<=len(data)
    if kind==0: stripped.append(size)
    else:output.extend(data[start:end])
    pos=end
(target/'hamon_web_bg.wasm').write_bytes(output)
page=(target/'index.html').read_text();match=re.search(r'<style>(.*?)</style>',page,re.S)
if match is None: raise ValueError('Qualified engine shell must contain its stylesheet')
css=match.group(1)
css+='\nbutton{touch-action:none;min-width:60px;min-height:48px;padding:10px 14px;border:1px solid #376265;border-radius:8px;background:#12343a;color:#f0f3ee;font:inherit} button:focus-visible{outline:3px solid #f2b35c}.controls{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}#hud{min-height:24px;color:#f2b35c;font-weight:600} a{color:#62d6c6}\n'
(target/'style.css').write_text(css)
page=re.sub(r'<style>.*?</style>','<link rel="stylesheet" href="./style.css" /><link rel="icon" href="./poster.svg" type="image/svg+xml" />',page,flags=re.S)
page=page.replace('<meta charset="utf-8" />','<meta charset="utf-8" /><meta http-equiv="Content-Security-Policy" content="'+GAME_CSP+'" />')
page=page.replace('HEADLESS VERIFIED - BROWSER FRAME NOT YET VERIFIED','WebGPU required · keyboard and touch controls')
page=page.replace('Collect three relics and reach the gate.','Collect three relics to open the gate and win.')
page=page.replace('</main>','<p><a href="https://jacobmetoyer.com/">Back to Jacob Metoyer</a> · <a href="./evidence.json">Build verification</a></p></main>')
(target/'index.html').write_text(page)
loader=(target/'loader.js').read_text().replace('button.style.touchAction="none";','')
loader=loader.replace('controls.setAttribute("aria-label","Movement controls");','controls.setAttribute("aria-label","Movement controls"); controls.className="controls";')
loader=loader.replace('restart.onclick=() => { held.clear(); touches.clear(); reset(); };','restart.addEventListener("click", () => { held.clear(); touches.clear(); reset(); });')
loader=loader.replace('await start("webgpu"); installControls(input, reset, focus_lost);','installControls(input, reset, focus_lost); await start("webgpu");')
(target/'loader.js').write_text(loader)
(target/'build-info.json').write_text(json.dumps({'visibility':'public-runtime-only','engine_commit':commit,'name':'Aetherline: Relic Run','source_visibility':'private','runtime':'Rust / wasm-bindgen / WebGPU','audio':'No browser audio output in this build'},indent=2)+'\n')
assert before=={n:hashlib.sha256((source/n).read_bytes()).hexdigest() for n in selected}
receipt={'source_sha256':before,'runtime_sha256':audit_game_bundle(target),'wasm_input_bytes':len(data),'wasm_output_bytes':len(output),'stripped_custom_sections':stripped,'source_unchanged':True,'declared_copy_count':len(selected),'excluded_adjacent_files':sorted(p.name for p in source.iterdir() if p.name not in selected)}
receipt_path.write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
