import json, numpy as np, colorsys
from PIL import Image
fr = json.load(open('gen/orbit.json'))['frames']
W, H = 240, 135
HUES = {1: 0, 2: 120, 3: 240, 4: 60, 5: 300, 6: 180, 7: 30, 8: 270}
EYES = {9: (3.2, -3.4, 9.7), 10: (-3.2, -3.4, 9.7)}   # 9 = Spire (left eye, x>0), 10 = HAMON (right eye)
atlas = np.zeros((H * 8, W * 12), np.uint8)
def proj(f, p):
    e = np.array(f['eye']); t = np.array(f['target']); fwd = (t - e) / np.linalg.norm(t - e)
    r = np.cross(fwd, [0, 1, 0]); r /= np.linalg.norm(r); u = np.cross(r, fwd)
    d = np.array(p) - e; z = d @ fwd; th = np.tan(np.radians(f['fov']) / 2)
    x = (d @ r) / (z * th * 16 / 9); y = (d @ u) / (z * th)
    return (x * 0.5 + 0.5) * W, (0.5 - y * 0.5) * H, z, 1.25 / (z * th) * H / 2
for i, f in enumerate(fr):
    im = np.asarray(Image.open(f'out/idpass/f{i:05d}.png').convert('RGB').resize((W, H), Image.NEAREST)).astype(float) / 255
    mx = im.max(2); mn = im.min(2); sat = (mx - mn) / (mx + 1e-6)
    hsv = np.array([[colorsys.rgb_to_hsv(*im[y, x])[0] * 360 for x in range(W)] for y in range(H)])
    lab = np.zeros((H, W), np.uint8)
    fg = (mx > 0.35)
    ks = np.array(list(HUES)); hs = np.array(list(HUES.values()))
    dh = np.abs(((hsv[..., None] - hs[None, None, :]) + 180) % 360 - 180)
    best = ks[np.argmin(dh, -1)]
    lab[fg & (sat > 0.07)] = best[fg & (sat > 0.07)]
    from scipy import ndimage
    body = ndimage.binary_closing(mx > 0.3, iterations=2)
    hole = body & (lab == 0)
    if hole.any() and (lab > 0).any():
        _, (iy, ix) = ndimage.distance_transform_edt(lab == 0, return_indices=True)
        lab[hole] = lab[iy[hole], ix[hole]]
    lab = ndimage.median_filter(lab, 3) * body + lab * 0
    yy, xx = np.mgrid[0:H, 0:W]
    # eyes: nearer eye drawn last
    order = sorted(EYES.items(), key=lambda kv: -proj(f, kv[1])[2])
    for k, c in order:
        px, py, z, rr = proj(f, c)
        m = ((xx - px) ** 2 + (yy - py) ** 2 < (rr * 1.05) ** 2) & fg
        lab[m] = k
    atlas[(i // 12) * H:(i // 12 + 1) * H, (i % 12) * W:(i % 12 + 1) * W] = lab
Image.fromarray(atlas * 20).save('out/labels_preview.png')
Image.fromarray(atlas, 'L').save('out/labels.png', optimize=True)
print('ok', np.bincount(atlas.ravel(), minlength=11))
