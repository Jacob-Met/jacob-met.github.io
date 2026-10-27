"""Camera path graph for the prerendered brain.
orbit (96f loop) --click region r--> dive_r (48f, starts on orbit frame hub[r]) ; back = reversed dive
orbit --click eye--> eye_<side> (cortex V1 -> radiation -> LGN -> tract -> chiasm -> nerve -> pupil), starts on hub frame.
Cutaways (hide hemisphere cortex) crossfade in post: the route carries 'xf' pairs (same camera, hide off) for the fade window.
"""
import json, numpy as np
N_ORB = 96; R = 40.0; HY = 7.5; TGT = np.array([0, -0.8, 0.3]); FOV = 30.0
def orbit_eye(i):
    th = np.radians(35 + 360.0 * i / N_ORB)
    return np.array([R * np.sin(th), HY, R * np.cos(th)])
def ss(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
def unit(v): v = np.asarray(v, float); return v / np.linalg.norm(v)
frames = []; segs = {}
def F(eye, tgt, fov, **k):
    d = {'eye': [round(float(x), 4) for x in eye], 'target': [round(float(x), 4) for x in tgt], 'fov': round(float(fov), 3)}
    d.update(k); frames.append(d)
# --- orbit
s0 = len(frames)
for i in range(N_ORB): F(orbit_eye(i), TGT, FOV)
segs['orbit'] = [s0, len(frames) - 1]
# --- regions: surface point + outward direction (left hemisphere, x>0)
REG = {
 1: ('frontal',     (4.2, 3.2, 6.6),  (0.45, 0.35, 0.82), 15),
 2: ('parietal',    (4.0, 5.2, -2.6), (0.45, 0.85, -0.3), 15),
 3: ('temporal',    (6.0, -2.6, 1.2), (0.96, -0.2, 0.2), 14),
 4: ('occipital',   (3.0, 1.2, -7.8), (0.35, 0.15, -0.92), 14),
 5: ('cerebellum',  (3.2, -4.6, -6.6), (0.45, -0.3, -0.84), 14),
 6: ('brainstem',   (0.8, -6.0, -2.4), (0.75, -0.35, 0.55), 13),
 7: ('motor',       (3.8, 6.2, 1.4),  (0.42, 0.9, 0.12), 15),
 8: ('hippocampus', (2.9, -1.5, -0.8), (0.9, 0.3, 0.3), 15),
}
def hub_for(d):
    d = unit(d); best = max(range(N_ORB), key=lambda i: np.dot(unit(orbit_eye(i) - TGT) * [1, 0.3, 1], d)); return best
hubs = {}
ND = 48
for k, (name, p, n, dist) in REG.items():
    h = hub_for(n); hubs[name] = h
    e0 = orbit_eye(h); e1 = np.array(p) + unit(n) * dist
    s = len(frames); hide = 1 if k == 8 else 0
    for j in range(ND):
        t = ss(j / (ND - 1))
        # arc: interpolate direction + radius about the region point so the camera swings, not slides
        r0 = e0 - np.array(p); r1 = e1 - np.array(p)
        dirv = unit((1 - t) * unit(r0) + t * unit(r1)); rad = (1 - t) * np.linalg.norm(r0) + t * np.linalg.norm(r1)
        eye = np.array(p) + dirv * rad
        tgt = (1 - t) * TGT + t * np.array(p)
        g = {str(k): round((0.22 if k == 8 else 0.12) * ss((j - 18) / 28), 3)}
        kw = {'glow': g}
        if hide and j >= 16: kw['hide'] = 1
        F(eye, tgt, FOV - 4 * t, **kw)
    segs['dive_' + name] = [s, len(frames) - 1]
# --- eyes: anatomical visual pathway, cortex -> deep -> nerve -> eye
def pathway(s):
    v1 = (s * 1.2, 0.9, -7.6)
    rad = [(s * 2.6, 0.2, -5.4), (s * 3.4, -0.6, -2.6), (s * 3.2, -1.4, 0.2)]
    lgn = (s * 2.3, -1.8, -1.0)
    tract = [(s * 2.0, -2.2, 0.0), (s * 1.3, -3.0, 2.0)]
    chi = (0.0, -3.25, 3.5)
    nerve = [(s * 1.4, -3.15, 5.0), (s * 2.6, -3.4, 6.8), (s * 3.15, -3.45, 8.4)]
    return [v1] + rad + [lgn] + tract + [chi] + nerve
from scipy.interpolate import CubicSpline
for s, name in ((1, 'spire'), (-1, 'hamon')):
    eyec = np.array((s * 3.2, -3.4, 9.7))
    h = hub_for((s * 0.45, 0.25, -0.86)); hubs['eye_' + name] = h
    e0 = orbit_eye(h)
    seg0 = len(frames)
    # A: approach the occipital pole / V1 (0..35); cortex of side s, calcarine glow
    v1 = np.array((s * 2.6, 1.0, -7.9)); eA = v1 + unit((s * 0.55, 0.35, -0.75)) * 9.0
    NA = 36
    for j in range(NA):
        t = ss(j / (NA - 1))
        F((1 - t) * e0 + t * eA, (1 - t) * TGT + t * v1, FOV - 6 * t, glow={'4': round(0.12 * t, 3)}, fibres=round(2.0 * t, 3))
    # B: cutaway crossfade (36..51): hemisphere peels, radiation glows; camera starts following the pathway
    P = np.array(pathway(s)); u = np.linspace(0, 1, len(P)); cs = CubicSpline(u, P)
    NB = 150
    # camera rides an offset rail beside the pathway: lateral + up, shrinking as it nears the nerve
    def rail(tt):
        q = cs(tt); off = np.array((s * (7.5 - 3.5 * tt), 3.6 - 1.4 * tt, -1.6 + 0.6 * tt)); return q + off
    for j in range(NB):
        tt = 0.98 * ss(j / (NB - 1)) ** 0.95
        bl = ss(j / 18.0)
        cam = (1 - bl) * eA + bl * rail(tt)
        look = (1 - bl) * v1 + bl * cs(min(tt + 0.10, 1))
        kw = {'hide': s, 'fibres': round(2.0 + 2.5 * ss(j / 40), 3), 'glow': {'20' if s > 0 else '21': round(0.2 * ss((j - 80) / 50), 3), '22': round(0.15 * ss((j - 40) / 40), 3)}}
        F(cam, look, 26 + 8 * bl, **kw)
    # C: swing around the globe to face the pupil, then push in; the pupil light swells to white
    cam0 = np.array(frames[-1]['eye']); lk0 = np.array(frames[-1]['target'])
    NC = 54
    front = eyec + np.array((s * 0.6, 0.25, 4.6))
    for j in range(NC):
        t = ss(j / (NC - 1))
        if t < 0.6:
            a = ss(t / 0.6)
            # arc around the eye centre from behind-side to front
            r0 = cam0 - eyec; r1 = front - eyec
            dirv = unit((1 - a) * unit(r0) + a * unit(r1) + np.array((s * 0.9, 0.3, 0)) * np.sin(np.pi * a) * 0.6)
            cam = eyec + dirv * ((1 - a) * np.linalg.norm(r0) + a * np.linalg.norm(r1))
            look = (1 - a) * lk0 + a * eyec
            fov = 30
        else:
            a = ss((t - 0.6) / 0.4)
            cam = front + (eyec + np.array((0, 0, 3.2)) - front) * a
            look = eyec; fov = 30 - 21 * a ** 1.3
        lc = (1.0, 0.78, 0.5) if s > 0 else (0.6, 0.75, 1.0)
        lt = [{'pos': [float(x) for x in eyec + np.array((s * 2.0, 2.2, 5.5))], 'color': list(lc), 'i': round(90 * ss(j / 12), 2), 'range': 18}]
        F(cam, look, fov, hide=s, fibres=4.5, lights=lt, eyelight=round(0.15 + 3.0 * ss((j - 30) / 24) ** 2, 3), glow={'20' if s > 0 else '21': 0.2})
    segs['eye_' + name] = [seg0, len(frames) - 1]
# crossfade twins: same cameras with hide removed, for the first frames of each cutaway
xf = {}
for name, (a, b) in segs.items():
    if name == 'orbit': continue
    idx = [i for i in range(a, b + 1) if frames[i].get('hide')]
    if not idx: continue
    first = idx[0]; win = list(range(first, min(first + 16, b + 1)))
    tw = []
    for i in win:
        d = dict(frames[i]); d.pop('hide'); frames.append(d); tw.append(len(frames) - 1)
    xf[name] = {'frames': win, 'twins': tw}
json.dump({'frames': frames}, open('brain_all.json', 'w'))
json.dump({'segments': segs, 'hubs': hubs, 'xfade': xf, 'n_orbit': N_ORB, 'total': len(frames)}, open('brain_graph.json', 'w'), indent=1)
print(len(frames), segs, hubs)
