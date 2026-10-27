import json, os, subprocess, sys, numpy as np, shutil
from PIL import Image
FR = sys.argv[1]; OUT = sys.argv[2]
g = json.load(open('/workspace/brain_render/gen/brain_graph.json'))
os.makedirs(OUT + '/orbit', exist_ok=True); os.makedirs(OUT + '/seg', exist_ok=True)
fp = lambda i: f'{FR}/f{i:05d}.png'
a, b = g['segments']['orbit']
for i in range(a, b + 1):
    im = Image.open(fp(i)).convert('RGB')
    im.save(f'{OUT}/orbit/o{i - a:02d}-1280.webp', quality=74, method=6)
    im.resize((640, 360), Image.LANCZOS).save(f'{OUT}/orbit/o{i - a:02d}-640.webp', quality=72, method=6)
tmp = '/workspace/brain_render/tmp_enc'
for name, (s, e) in g['segments'].items():
    if name == 'orbit': continue
    shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    xf = g['xfade'].get(name)
    tw = dict(zip(xf['frames'], xf['twins'])) if xf else {}
    n = len(tw)
    for k, i in enumerate(range(s, e + 1)):
        im = Image.open(fp(i)).convert('RGB')
        if i in tw:
            j = xf['frames'].index(i); al = (j + 1) / (n + 1)
            im = Image.blend(Image.open(fp(tw[i])).convert('RGB'), im, al)
        im.save(f'{tmp}/{k:04d}.png')
        last = im
    last.save(f'{OUT}/seg/{name}-end.webp', quality=78, method=6)
    fps = '30' if name.startswith('eye') else '24'
    common = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an']
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', fps, '-i', f'{tmp}/%04d.png'] + common + [f'{OUT}/seg/{name}.mp4'], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', fps, '-i', f'{tmp}/%04d.png', '-vf', 'reverse'] + common + [f'{OUT}/seg/{name}-rev.mp4'], check=True)
    print(name, os.path.getsize(f'{OUT}/seg/{name}.mp4') // 1024, 'KB', flush=True)
shutil.rmtree(tmp, ignore_errors=True)
