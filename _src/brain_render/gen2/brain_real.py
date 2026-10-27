"""Anatomical brain for the prerender, built from real reference anatomy:
 - cerebral cortex: FreeSurfer fsaverage pial surfaces (163,842 vertices / hemisphere), lobes from the
   Destrieux parcellation, sulcal depth from fsaverage `sulc`;
 - cerebellum: AAL cerebellum + vermis labels (MNI), marching cubes, transverse folia;
 - brainstem + hippocampus: Harvard-Oxford subcortical atlas (MNI 1 mm);
 - eyes / optic nerves / chiasm / tracts / LGN / optic radiation placed at MNI coordinates.
Engine frame: E = S * (-x, z, y + 18) + (0, -0.6, 0)   (x subject-right -> engine -x; y anterior -> engine +z; z up -> engine +y)
"""
import numpy as np, struct, json, sys, gzip
import nibabel as nb
from scipy import ndimage
from scipy.spatial import cKDTree
from skimage import measure
from nilearn import datasets, surface, image
sys.path.insert(0, '/workspace/brain_render/gen2')
OUT = sys.argv[1] if len(sys.argv) > 1 else 'brain_real.bin'
S = 0.09
def E(p):
    p = np.asarray(p, float); return np.stack([-p[..., 0], p[..., 2], p[..., 1] + 18.0], -1) * S + np.array([0, -0.6, 0])
rng = np.random.default_rng(3)

def vnormals(V, F):
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    N = np.zeros_like(V)
    for k in range(3): np.add.at(N, F[:, k], fn)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)
def signed_vol(V, F): return np.einsum('ij,ij->i', V[F[:, 0]], np.cross(V[F[:, 1]], V[F[:, 2]])).sum() / 6
def orient_out(V, F):  # engine convention = same as gen/brain_geo.sphere() (checked below)
    return F if (signed_vol(V - V.mean(0), F) > 0) == WANT_POS else F[:, ::-1]
def adjacency_smooth(vals, F, n, iters):
    # mean over 1-ring, `iters` times (vals: (n, k))
    I = np.concatenate([F[:, 0], F[:, 1], F[:, 2], F[:, 1], F[:, 2], F[:, 0]])
    J = np.concatenate([F[:, 1], F[:, 2], F[:, 0], F[:, 0], F[:, 1], F[:, 2]])
    from scipy.sparse import coo_matrix
    A = coo_matrix((np.ones(len(I)), (I, J)), shape=(n, n)).tocsr(); A.data[:] = 1
    d = np.asarray(A.sum(1)).ravel()
    for _ in range(iters): vals = (A @ vals + vals) / (d + 1)[:, None]
    return vals

from brain_geo_funcs import tube, sphere
def taubin(V, F, iters=20, lam=0.5, mu=-0.53):
    from scipy.sparse import coo_matrix
    n = len(V); I = np.concatenate([F[:, 0], F[:, 1], F[:, 2], F[:, 1], F[:, 2], F[:, 0]]); J = np.concatenate([F[:, 1], F[:, 2], F[:, 0], F[:, 0], F[:, 1], F[:, 2]])
    A = coo_matrix((np.ones(len(I)), (I, J)), shape=(n, n)).tocsr(); A.data[:] = 1; d = np.asarray(A.sum(1)).ravel()[:, None] + 1e-9
    V = V.copy()
    for _ in range(iters):
        for f in (lam, mu): V = V + f * (A @ V / d - V)
    return V
sv, sf, sn = sphere((0, 0, 0), 1, 16, 12)
WANT_POS = signed_vol(sv, sf) > 0

meshes = []; meta = {'regions': {}, 'regions_n': {}}
def add(kind, V, F, N, C):
    N = N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-9)
    if C.shape[1] == 3: C = np.hstack([C, np.ones((len(C), 1))])
    meshes.append((kind, np.hstack([V, N, C, np.zeros((len(V), 2))]).astype(np.float32), np.asarray(F, np.uint32).ravel()))

# ---------------- palette: natural tissue, clearly separated lobes
PAL = {
 1: (0.80, 0.38, 0.28),   # frontal: terracotta
 7: (0.90, 0.58, 0.20),   # motor strip (precentral): amber
 2: (0.26, 0.60, 0.56),   # parietal: teal
 3: (0.50, 0.38, 0.70),   # temporal: violet
 4: (0.86, 0.68, 0.26),   # occipital: ochre gold
 5: (0.48, 0.64, 0.30),   # cerebellum: olive green
 6: (0.48, 0.54, 0.70),   # brainstem: slate blue
 8: (0.86, 0.50, 0.56),   # hippocampus: rose
}
def lobe_of(name):
    n = name
    if n in ('Unknown', 'Medial_wall'): return 0
    if 'precentral' in n or 'paracentral' in n or n == 'S_central' or 'subcentral' in n: return 7
    if 'Pole_occipital' in n or 'occipital' in n or 'cuneus' in n and 'precuneus' not in n or 'calcarine' in n or 'Lingual' in n or 'S_oc_' in n or 'S_oc-' in n and 'temp' not in n or 'collat_transv_post' in n: return 4
    if 'pariet' in n or 'postcentral' in n or 'precuneus' in n or 'subparietal' in n or 'cingul-Post' in n or 'Mid-Post' in n or 'arginal' in n or 'Jensen' in n: return 2
    if 'tempor' in n or 'Temporal' in n or 'temp' in n or 'Parahip' in n or 'fusifor' in n or 'Lat_Fis-post' in n or 'insula' in n or 'Ins' in n or 'collat_transv_ant' in n or 'S_pericallosal' in n and False: return 3
    return 1

fs = datasets.fetch_surf_fsaverage('fsaverage')
des = datasets.fetch_atlas_surf_destrieux()
labels = [l.decode() if isinstance(l, bytes) else str(l) for l in des['labels']]
lobe_lut = np.array([lobe_of(l) for l in labels])
hemi_meta = {}
for hemi, sgn in (('left', 1), ('right', -1)):
    V, F = surface.load_surf_mesh(fs['pial_' + hemi]); V = np.array(V, float); F = np.array(F)
    V[:, 0] += -1.6 if hemi == 'left' else 1.6          # open the longitudinal fissure a touch
    sulc = np.asarray(surface.load_surf_data(fs['sulc_' + hemi]), float)
    sph, _ = surface.load_surf_mesh(fs['sphere_' + hemi]); sph = np.array(sph, float)
    m5 = np.asarray(des['map_' + hemi]); lob5 = lobe_lut[m5]
    # fsaverage5 = first 10242 vertices of fsaverage (icosahedral); label the rest by nearest on the sphere
    known = lob5 > 0
    tree = cKDTree(sph[:10242][known]); _, nn = tree.query(sph, k=1)
    lobe = lob5[known][nn]
    # colour
    base = np.array([PAL[int(l)] for l in lobe])
    base = adjacency_smooth(base, F, len(V), 3)            # soft lobe borders, still clearly separated
    deep = np.clip((sulc + 0.1) / 1.0, 0, 1)             # fsaverage sulc: + = sulcal fundus
    crown = np.clip(-sulc / 1.2, 0, 1)
    tone = base * (0.80 + 0.22 * crown)[:, None]
    dark = base * 0.22 + np.array([0.05, 0.015, 0.02])
    col = tone * (1 - deep[:, None] ** 1.2) + dark * (deep[:, None] ** 1.2)
    col *= (1 + 0.035 * rng.standard_normal(len(V)))[:, None]   # faint mottling
    vis = (1 - 0.8 * deep)                                   # alpha channel used as cavity hint
    VE = E(V); FE = orient_out(VE, F); NE = vnormals(VE, FE)
    for L in (1, 7, 2, 3, 4):
        fm = (lobe[F] == L).sum(1) >= 2
        used = np.unique(F[fm]); remap = -np.ones(len(V), int); remap[used] = np.arange(len(used))
        add(L, VE[used], remap[FE[fm]], NE[used], np.hstack([np.clip(col[used], 0, 1), vis[used, None]]))
        if sgn > 0:
            meta['regions'][str(L)] = VE[used].mean(0).tolist()
    # faces with no lobe majority (medial wall seams) -> frontal kind but medial colour
    fm = ~np.array([(lobe[F] == L).sum(1) >= 2 for L in (1, 7, 2, 3, 4)]).any(0)
    if fm.any():
        used = np.unique(F[fm]); remap = -np.ones(len(V), int); remap[used] = np.arange(len(used))
        add(1, VE[used], remap[FE[fm]], NE[used], np.hstack([np.clip(col[used], 0, 1), vis[used, None]]))
    hemi_meta[hemi] = {'lobe': lobe, 'V': VE}

# ---------------- volumes (MNI 1 mm)
def iso(mask_or_field, affine, level, sigma, step=1):
    f = ndimage.gaussian_filter(mask_or_field.astype(float), sigma)
    v, fc, n, _ = measure.marching_cubes(f, level, step_size=step)
    v = nb.affines.apply_affine(affine, v)
    return v, fc
ho = datasets.fetch_atlas_harvard_oxford('sub-maxprob-thr25-1mm')
hoimg = image.load_img(ho.maps); hod = np.asarray(hoimg.get_fdata()).astype(int); hl = list(ho.labels)
def homask(name): return hod == hl.index(name)
aal = datasets.fetch_atlas_aal()
aimg = image.resample_to_img(image.load_img(aal.maps), hoimg, interpolation='nearest'); ad = np.asarray(aimg.get_fdata()).astype(int)
cer_codes = [int(c) for c, l in zip(aal.indices, aal.labels) if 'Cerebel' in l or 'Vermis' in l]
cer = np.isin(ad, cer_codes)
# upsample for smoothness
def up(mask, z=2):
    return ndimage.zoom(mask.astype(np.float32), z, order=1)
A2 = hoimg.affine.copy(); A2[:3, :3] /= 2.0
# cerebellum: smooth body + transverse folia (concentric about the left-right axis through the 4th ventricle)
cv, cf = iso(up(cer), A2, 0.5, 2.6)
cv = np.asarray(cv); cf = np.asarray(cf); cv = taubin(cv, cf, 30)
cen = np.array([0.0, -52.0, -30.0])
cn = vnormals(cv, cf)
rel = cv - cen; phi = np.arctan2(rel[:, 2], -rel[:, 1])           # angle in the sagittal plane
r = np.hypot(rel[:, 1], rel[:, 2])
fol = np.abs(np.sin(phi * 46 + 0.05 * r + 0.5 * np.sin(rel[:, 0] * 0.07) + 0.25 * np.sin(rel[:, 0] * 0.21 + phi * 3)))
fis = np.abs(np.sin(phi * 4.2 + 0.5))                               # a few deep fissures (primary, horizontal...)
disp = -0.9 * (1 - fol) ** 3 - 2.0 * (1 - fis) ** 12
cv2 = cv + cn * disp[:, None]
CE = E(cv2); CF = orient_out(CE, cf); CN = vnormals(CE, CF)
d01 = np.clip(-disp / 1.2, 0, 1)
cc = np.array(PAL[5]) * (0.82 + 0.16 * fol[:, None] ** 3) * (1 - 0.55 * d01[:, None]) + np.array([0.04, 0.02, 0.02]) * d01[:, None]
add(5, CE, CF, CN, np.hstack([np.clip(cc, 0, 1), (1 - 0.8 * d01)[:, None]]))
meta['regions']['5'] = CE[CE[:, 0] > 0].mean(0).tolist()
# brainstem
bs = homask('Brain-Stem')
bv, bf = iso(up(bs), A2, 0.5, 2.6); bv = taubin(np.asarray(bv), np.asarray(bf), 30)
BE = E(bv); BF = orient_out(BE, bf); BN = vnormals(BE, BF)
yy = (BE[:, 1] - BE[:, 1].min()) / np.ptp(BE[:, 1])
bc = np.array(PAL[6]) * (0.85 + 0.15 * np.sin(BE[:, 0] * 30 + BE[:, 1] * 6)[:, None] * 0.2)
add(6, BE, BF, BN, np.clip(bc, 0, 1))
meta['regions']['6'] = BE.mean(0).tolist()
# hippocampi
for nm, sg in (('Left Hippocampus', 1), ('Right Hippocampus', -1)):
    hv, hf = iso(up(homask(nm)), A2, 0.5, 2.2); hv = taubin(np.asarray(hv), np.asarray(hf), 20)
    HE = E(hv); HF = orient_out(HE, hf); HN = vnormals(HE, HF)
    add(8, HE, HF, HN, np.tile(PAL[8], (len(HE), 1)))
    if sg > 0: meta['regions']['8'] = HE.mean(0).tolist()

# ---------------- visual pathway (MNI mm), then the eyes
EYE_R_MM = 12.0
EYEC = {1: np.array([-32.0, 54.0, -38.0]), -1: np.array([32.0, 54.0, -38.0])}   # engine side +1 = subject left (Spire)
CHI = np.array([0.0, 4.0, -17.0])
def pts_mm(s):
    x = -s  # subject-space sign for engine side s
    nerve = [EYEC[s] + [0, -EYE_R_MM + 1, 0], [x * 26, 36, -33], [x * 14, 22, -24], [x * 5, 8, -18]]
    tract = [[x * 5, 2, -17], [x * 13, -6, -14], [x * 20, -16, -9], [x * 23, -25, -5]]
    lgn = np.array([x * 23, -25, -5])
    rad = [[x * 23, -25, -5], [x * 29, -18, -9], [x * 30, -34, 0], [x * 27, -58, 4], [x * 16, -80, 6], [x * 9, -88, 6]]
    return nerve, tract, lgn, rad
path = {}
for s in (1, -1):
    nerve, tract, lgn, rad = pts_mm(s)
    V, F, N, _ = tube(E(np.array(nerve)), [0.30, 0.30, 0.28, 0.26], seg=28, n=90)
    add(20 if s > 0 else 21, V, F, N, np.tile([0.90, 0.86, 0.78], (len(V), 1)))
    V, F, N, _ = tube(E(np.array(tract)), [0.22, 0.22, 0.21, 0.30], seg=22, n=70)
    add(22, V, F, N, np.tile([0.88, 0.84, 0.76], (len(V), 1)))
    for k in range(18):
        j = rng.normal(0, 2.0, (len(rad), 3)); j[0] = 0; j[-1] *= 0.5
        V, F, N, _ = tube(E(np.array(rad) + j), [0.05, 0.04, 0.04, 0.04, 0.035, 0.03], seg=8, n=110)
        add(30, V, F, N, np.tile([1.0, 0.85, 0.55], (len(V), 1)))
    V, F, N = sphere(E(lgn), 0.42, 32, 20)
    add(31, V, F, N, np.tile([1.0, 0.8, 0.5], (len(V), 1)))
    c = E(EYEC[s]); R = EYE_R_MM * S
    V, F, N = sphere(c, R, 128, 96)
    add(40 if s > 0 else 41, V, F, N, np.tile([0.94, 0.92, 0.9], (len(V), 1)))
    path[s] = {'nerve': E(np.array(nerve)).tolist(), 'tract': E(np.array(tract)).tolist(), 'lgn': E(lgn).tolist(), 'rad': E(np.array(rad)).tolist(), 'eye': c.tolist()}
V, F, N = sphere(E(CHI), 0.5, 40, 24, scale=(1.5, 0.45, 0.7))
add(22, V, F, N, np.tile([0.88, 0.84, 0.76], (len(V), 1)))

with open(OUT, 'wb') as fh:
    fh.write(struct.pack('<I', len(meshes)))
    for kind, vb, ib in meshes:
        fh.write(struct.pack('<III', kind, len(vb), len(ib))); fh.write(vb.tobytes()); fh.write(ib.tobytes())
tot = sum(len(ib) // 3 for _, _, ib in meshes)
allv = np.concatenate([vb[:, :3] for k, vb, _ in meshes if k in (1, 2, 3, 4, 5, 6, 7)])
meta.update({'eyes': {'left_spire': path[1]['eye'], 'right_hamon': path[-1]['eye']}, 'eye_r': EYE_R_MM * S, 'chiasm': E(CHI).tolist(), 'path': {str(k): v for k, v in path.items()}, 'tris': tot, 'bbox': [allv.min(0).tolist(), allv.max(0).tolist()], 'want_pos': bool(WANT_POS)})
json.dump(meta, open(OUT + '.json', 'w'), indent=1)
print('meshes', len(meshes), 'tris', tot, 'bbox', allv.min(0).round(2), allv.max(0).round(2))
