"""Camera path graph for the real-cortex (v3) prerendered brain.
Same graph shape as gen/routes.py (so docs/brain/main.js plays it unchanged):
  orbit (96f loop) --click region--> dive_<r> (48f, starts on orbit frame hubs[r]); back = reversed dive
  orbit --click eye--> eye_<side>: V1 (calcarine, occipital pole) -> optic radiation incl. Meyer's loop
        -> LGN -> optic tract -> chiasm -> optic nerve -> out through the pupil.  No redirect: the clip ends
        filling the frame with the pupil light, then the page navigates.
All anatomy comes from the mesh sidecar (brain.bin.json: region centroids, eyes, chiasm, per-side pathway)
and from the mesh itself (surface points + normals for each region), so the camera follows the real subject.
"""
import json, struct, sys, numpy as np
from scipy.interpolate import CubicSpline
MESH = sys.argv[1]; OUT = sys.argv[2]
meta = json.load(open(MESH + '.json'))
# ---- read the mesh (pos + normal per kind) to place dive targets on the real surface
b = open(MESH, 'rb').read(); o = 4; KV = {}
for _ in range(struct.unpack_from('<I', b, 0)[0]):
    k, nv, ni = struct.unpack_from('<III', b, o); o += 12
    v = np.frombuffer(b, '<f4', nv * 12, o).reshape(nv, 12); o += nv * 48 + ni * 4
    KV.setdefault(k, []).append(v[:, :6].copy())
KV = {k: np.vstack(v) for k, v in KV.items()}
N_ORB = 96; R = 40.0; HY = 7.0; TGT = np.array([0, -0.5, 0.0]); FOV = 20.0
def orbit_eye(i):
    th = np.radians(35 + 360.0 * i / N_ORB)
    return np.array([R * np.sin(th), HY, R * np.cos(th)])
def ss(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
def unit(v): v = np.asarray(v, float); return v / np.linalg.norm(v)
frames = []; segs = {}
def F(eye, tgt, fov, **k):
    d = {'eye': [round(float(x), 4) for x in eye], 'target': [round(float(x), 4) for x in tgt], 'fov': round(float(fov), 3)}
    d.update(k); frames.append(d)
s0 = len(frames)
for i in range(N_ORB): F(orbit_eye(i), TGT, FOV)
segs['orbit'] = [s0, len(frames) - 1]
# region: (name, preferred outward view direction (left hemisphere, +x = subject's left), camera distance)
# the dive aims at the surface vertex of that region furthest along the direction, from its centroid side
REG = {
 1: ('frontal',     (0.40, 0.35, 0.85), 13),   # dorsolateral prefrontal
 7: ('motor',       (0.55, 0.83, 0.10), 13),   # precentral gyrus, lateral-dorsal
 2: ('parietal',    (0.50, 0.80, -0.35), 13),  # superior/inferior parietal lobule
 3: ('temporal',    (0.97, -0.20, 0.10), 12),  # lateral temporal gyri
 4: ('occipital',   (0.40, 0.10, -0.91), 12),  # occipital pole
 5: ('cerebellum',  (0.45, -0.45, -0.77), 12), # posterior-inferior cerebellar hemisphere
 6: ('brainstem',   (0.28, -0.50, 0.82), 11),  # ventral pons/medulla, seen from front-below between the temporal poles
 8: ('hippocampus', (0.95, 0.15, 0.25), 12),   # deep: left lateral cortex cut away
}
def surf_point(k, d):
    P = KV[k][:, :3]; N = KV[k][:, 3:6]
    c = np.array(meta['regions'][str(k)]); d = unit(d)
    side = P[:, 0] > 0.15 if k != 6 else np.ones(len(P), bool)
    sc = (P - c) @ d; sc[~side] = -1e9
    top = np.argsort(sc)[-200:]                      # a patch, not one vertex: averaged point + normal
    p = P[top].mean(0); n = unit(N[top].mean(0))
    if np.dot(n, d) < 0.3: n = unit(n + d)
    return p, n
def hub_for(d):
    d = unit(d); return max(range(N_ORB), key=lambda i: np.dot(unit(orbit_eye(i) - TGT) * [1, 0.3, 1], d))
hubs = {}; ND = 48; dive_pts = {}
for k, (name, d, dist) in REG.items():
    if k == 8:
        p = np.array(meta['regions']['8']); n = unit(d)  # hippocampus: deep centroid, view through the cut
    else:
        p, n = surf_point(k, d)
    dive_pts[name] = [round(float(x), 3) for x in p]
    h = hub_for(n); hubs[name] = h
    e0 = orbit_eye(h); e1 = p + n * dist
    s = len(frames)
    for j in range(ND):
        t = ss(j / (ND - 1))
        r0 = e0 - p; r1 = e1 - p
        dirv = unit((1 - t) * unit(r0) + t * unit(r1)); rad = (1 - t) * np.linalg.norm(r0) + t * np.linalg.norm(r1)
        kw = {'glow': {str(k): round((0.22 if k == 8 else 0.12) * ss((j - 18) / 28), 3)}}
        if k == 8 and j >= 16: kw['hide'] = 1
        F(p + dirv * rad, (1 - t) * TGT + t * p, FOV - 3 * t, **kw)
    segs['dive_' + name] = [s, len(frames) - 1]
# ---- eyes: retinotopic pathway run backwards (cortex -> eye), out through the pupil
def dedupe(P, eps=0.15):
    out = [P[0]]
    for q in P[1:]:
        if np.linalg.norm(np.array(q) - out[-1]) > eps: out.append(np.array(q, float))
    return np.array(out)
for s, name in ((1, 'spire'), (-1, 'hamon')):
    pa = meta['path'][str(s)]
    eyec = np.array(meta['eyes']['left_spire' if s > 0 else 'right_hamon']); er = meta['eye_r']
    P = dedupe([np.array(x) for x in pa['rad'][::-1] + pa['tract'][::-1] + [meta['chiasm']] + pa['nerve'][::-1]] + [eyec - np.array((0, 0, er))])
    L = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]; cs = CubicSpline(L / L[-1], P)
    v1 = P[0]
    h = hub_for((s * 0.45, 0.25, -0.86)); hubs['eye_' + name] = h
    e0 = orbit_eye(h); seg0 = len(frames)
    eA = v1 + unit((s * 0.55, 0.35, -0.75)) * 9.0
    NA = 36                                           # A: to the occipital pole (V1), calcarine glows
    for j in range(NA):
        t = ss(j / (NA - 1))
        F((1 - t) * e0 + t * eA, (1 - t) * TGT + t * v1, FOV - 4 * t, glow={'4': round(0.12 * t, 3)}, fibres=round(2.0 * t, 3))
    NB = 150                                          # B: lateral cortex of side s peels; ride beside the pathway
    def rail(tt):
        return cs(tt) + np.array((s * (6.5 - 3.0 * tt), 3.2 - 1.2 * tt, -1.4 + 0.4 * tt))
    for j in range(NB):
        tt = 0.97 * ss(j / (NB - 1)) ** 0.95; bl = ss(j / 18.0)
        cam = (1 - bl) * eA + bl * rail(tt); look = (1 - bl) * v1 + bl * cs(min(tt + 0.10, 1))
        F(cam, look, 26 + 6 * bl, hide=s, fibres=round(2.0 + 2.5 * ss(j / 40), 3),
          glow={'20' if s > 0 else '21': round(0.2 * ss((j - 80) / 50), 3), '22': round(0.15 * ss((j - 40) / 40), 3)})
    cam0 = np.array(frames[-1]['eye']); lk0 = np.array(frames[-1]['target'])
    NC = 54                                           # C: swing round the globe to the pupil and push out through it
    front = eyec + np.array((s * 0.6, 0.25, 4.6))
    for j in range(NC):
        t = ss(j / (NC - 1))
        if t < 0.6:
            a = ss(t / 0.6); r0 = cam0 - eyec; r1 = front - eyec
            dirv = unit((1 - a) * unit(r0) + a * unit(r1) + np.array((s * 0.9, 0.3, 0)) * np.sin(np.pi * a) * 0.6)
            cam = eyec + dirv * ((1 - a) * np.linalg.norm(r0) + a * np.linalg.norm(r1)); look = (1 - a) * lk0 + a * eyec; fov = 30
        else:
            a = ss((t - 0.6) / 0.4); cam = front + (eyec + np.array((0, 0, er + 2.1)) - front) * a; look = eyec; fov = 30 - 21 * a ** 1.3
        lc = (1.0, 0.62, 0.32) if s > 0 else (0.55, 0.72, 1.0)   # Spire: Geargrave weld heat; HAMON: cool steel
        lt = [{'pos': [float(x) for x in eyec + np.array((s * 2.0, 2.2, 5.5))], 'color': list(lc), 'i': round(90 * ss(j / 12), 2), 'range': 18}]
        F(cam, look, fov, hide=s, fibres=4.5, lights=lt, eyelight=round(0.15 + 3.0 * ss((j - 30) / 24) ** 2, 3), glow={'20' if s > 0 else '21': 0.2})
    segs['eye_' + name] = [seg0, len(frames) - 1]
xf = {}
for name, (a, bb) in segs.items():
    if name == 'orbit': continue
    idx = [i for i in range(a, bb + 1) if frames[i].get('hide')]
    if not idx: continue
    win = list(range(idx[0], min(idx[0] + 16, bb + 1))); tw = []
    for i in win:
        d = dict(frames[i]); d.pop('hide'); frames.append(d); tw.append(len(frames) - 1)
    xf[name] = {'frames': win, 'twins': tw}
json.dump({'frames': frames}, open(OUT + '/brain_all.json', 'w'))
json.dump({'segments': segs, 'hubs': hubs, 'xfade': xf, 'n_orbit': N_ORB, 'total': len(frames), 'dive_points': dive_pts}, open(OUT + '/brain_graph.json', 'w'), indent=1)
print(len(frames), segs, hubs, dive_pts)
