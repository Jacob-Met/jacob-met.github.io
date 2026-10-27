"""Procedural, anatomically laid-out brain for the HAMON engine render.
Units: centimetres (rendered as metres). +z = anterior (frontal pole), +y = superior, +x = subject's LEFT.
Output: brain.bin  (meshes: u32 count; per mesh: u32 kind, u32 nv, u32 ni, f32[nv*12] (pos3 nrm3 col4 uv2), u32[ni])
"""
import numpy as np, struct, sys, json
from scipy import ndimage
from skimage import measure
rng = np.random.default_rng(7)
H = float(sys.argv[2]) if len(sys.argv) > 2 else 0.07
OUT = sys.argv[1] if len(sys.argv) > 1 else 'brain.bin'

def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)
def smax(a, b, k): return -smin(-a, -b, k)
def ell(X, Y, Z, c, r):
    # approx ellipsoid SDF
    px, py, pz = (X - c[0]) / r[0], (Y - c[1]) / r[1], (Z - c[2]) / r[2]
    k0 = np.sqrt(px * px + py * py + pz * pz)
    k1 = np.sqrt((px / r[0]) ** 2 + (py / r[1]) ** 2 + (pz / r[2]) ** 2)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)
def seg_dist(P, a, b):
    a = np.asarray(a, float); b = np.asarray(b, float)
    ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[..., None] * ab), axis=-1), t
def poly_dist(P, pts):
    best = np.full(P.shape[:-1], 1e9); tt = np.zeros(P.shape[:-1])
    L = 0; lens = [np.linalg.norm(np.subtract(pts[i + 1], pts[i])) for i in range(len(pts) - 1)]; tot = sum(lens)
    for i in range(len(pts) - 1):
        d, t = seg_dist(P, pts[i], pts[i + 1])
        m = d < best; best = np.where(m, d, best); tt = np.where(m, (L + t * lens[i]) / tot, tt); L += lens[i]
    return best, tt
def noise3(shape, sigma, seed):
    r = np.random.default_rng(seed).standard_normal(shape).astype(np.float32)
    n = ndimage.gaussian_filter(r, sigma, mode='wrap')
    return n / n.std()


def sh_labyrinth(V, F, lam, seed, steps=160, r=0.35, dt=1.0):
    """Swift-Hohenberg u_t = r u - (1 + k^-2 lap)^2 u - u^3 on a triangle mesh (uniform Laplacian)."""
    import scipy.sparse as sp, scipy.sparse.linalg as spl
    n = len(V)
    e = np.vstack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]); e = np.vstack([e, e[:, ::-1]])
    A = sp.coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n)).tocsr(); A.data[:] = 1.0
    deg = np.asarray(A.sum(1)).ravel()
    h2 = np.mean(np.sum((V[F[:, 0]] - V[F[:, 1]]) ** 2, 1))
    Lap = (A - sp.diags(deg)) * (4.0 / (deg.mean() * h2))
    k = 2 * np.pi / lam
    Op = sp.identity(n) + Lap / k ** 2
    M = ((1.0 / dt - r) * sp.identity(n) + Op @ Op).tocsr()
    u = np.random.default_rng(seed).normal(0, 0.1, n)
    for i in range(steps):
        rhs = u / dt - u ** 3
        u, _ = spl.cg(M, rhs, x0=u, rtol=1e-6, maxiter=200)
    print('sh', n, float(np.abs(u).max()), flush=True)
    return (u / (np.abs(u).max() + 1e-9)).astype(np.float32)

# landmark curves on the lateral surface (left hemisphere, x>0), cm
CENTRAL = [(0.6, 6.1, -0.9), (3.2, 5.0, 0.0), (5.1, 3.0, 1.2), (6.1, 0.9, 2.0)]
SYLVIAN = [(5.0, -2.3, 4.6), (6.4, -0.9, 2.2), (6.6, 0.1, -0.6), (6.0, 1.6, -2.6)]
PARIETO_OCC = [(0.4, 4.0, -5.6), (1.6, 3.2, -6.4)]
CALCARINE = [(0.4, 0.6, -8.3), (0.5, 1.4, -5.2)]

def hemisphere(side):
    xs = np.arange(-0.6, 8.0, H); ys = np.arange(-6.6, 6.9, H); zs = np.arange(-9.4, 9.0, H)
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij')
    X = X.astype(np.float32); Y = Y.astype(np.float32); Z = Z.astype(np.float32)
    # lobar volumes
    fr = ell(X, Y, Z, (3.1, 1.4, 3.3), (3.15, 4.4, 5.0))
    pa = ell(X, Y, Z, (3.3, 2.2, -2.6), (3.25, 4.1, 4.3))
    oc = ell(X, Y, Z, (2.7, 0.4, -5.9), (2.6, 3.4, 3.0))
    te = ell(X, Y, Z, (4.6, -2.3, 0.6), (2.45, 2.2, 4.6))
    d = smin(smin(fr, pa, 1.6), oc, 1.4)
    d = smin(d, te, 0.9)
    # orbital (inferior frontal) surface flattened, sitting over the orbits
    d = smax(d, -(Y + 2.0 - 0.18 * np.maximum(Z - 2, 0)) , 0.8) if False else smax(d, -(Y + 1.9 + 0.0 * Z) * np.where(Z > 2.5, 1, 0) - 9 * np.where(Z > 2.5, 0, 1), 0.6)
    # inferior flat floor (tentorium under occipital, middle fossa under temporal)
    d = smax(d, -(Y + 4.3), 0.6)
    d = smax(d, -(Y + 1.4 + 0.25 * (-Z - 4.0)) * np.where(Z < -4.0, 1, 0) - 9 * np.where(Z < -4.0, 0, 1), 0.7)
    # medial wall: flat, with a small gap at the longitudinal fissure
    d = smax(d, -(X - 0.12), 0.25)
    P = np.stack([X, Y, Z], -1)
    # Sylvian fissure (lateral sulcus): deep cleft separating temporal from frontal/parietal
    ds, ts = poly_dist(P, SYLVIAN)
    syl = np.clip(1 - ds / 0.55, 0, 1) ** 1.5 * (0.6 + 1.2 * np.sin(np.pi * np.clip(ts * 1.1, 0, 1)))
    # gyri: a Swift-Hohenberg labyrinth grown ON the smooth hull surface, so folds
    # have a near-constant width and run as continuous ridges, then splatted back to the grid
    hv, hf, hn, _ = measure.marching_cubes(d + 1.25 * syl, 0.0, spacing=(H, H, H), gradient_direction='ascent')
    hv += np.array([xs[0], ys[0], zs[0]])
    u = sh_labyrinth(hv, hf, lam=1.6, seed=31 + side)
    from scipy.spatial import cKDTree
    tree = cKDTree(hv)
    near = np.abs(d + 1.25 * syl) < 1.9
    _, nid = tree.query(np.stack([X[near], Y[near], Z[near]], -1), workers=-1)
    U = np.zeros(X.shape, np.float32); U[near] = u[nid]
    U = ndimage.gaussian_filter(U, 0.6)
    dc, tc = poly_dist(P, CENTRAL)
    sgn = np.sign((Z - (np.interp(Y, [0.9, 3.0, 5.0, 6.1], [2.0, 1.2, 0.0, -0.9]))) + 1e-6)
    band = np.clip(1 - dc / 3.0, 0, 1) ** 1.5 * (Y > -0.5)
    cstripe = np.cos((sgn * dc) * (2 * np.pi / 2.0))      # pre/postcentral gyri run parallel to the central sulcus
    t = U * (1 - band) + cstripe * band
    sulc = np.clip((-t - 0.15) / 0.75, 0, 1) ** 0.7
    crown = np.clip((t + 0.1) / 0.9, 0, 1)
    cs = np.clip(1 - dc / 0.30, 0, 1)
    po, _ = poly_dist(P, PARIETO_OCC); po = np.clip(1 - po / 0.35, 0, 1)
    ca, _ = poly_dist(P, CALCARINE); ca = np.clip(1 - ca / 0.35, 0, 1)
    depth = 0.85 * sulc - 0.12 * crown + 0.9 * cs + 0.7 * po + 0.7 * ca
    d2 = d + depth + 1.25 * syl
    verts, faces, nrm, _ = measure.marching_cubes(d2, 0.0, spacing=(H, H, H), gradient_direction='ascent')
    verts += np.array([xs[0], ys[0], zs[0]]); nrm = -nrm
    # sample fields at vertices
    idx = np.clip(np.round((verts - [xs[0], ys[0], zs[0]]) / H).astype(int), 0, np.array(X.shape) - 1)
    ii = tuple(idx.T)
    vs = sulc[ii]; vc = crown[ii]; vcs = cs[ii]; vsyl = syl[ii]
    # lobe classification
    x, y, z = verts.T
    cz = np.interp(y, [0.9, 3.0, 5.0, 6.1], [2.0, 1.2, 0.0, -0.9])
    syl_y = np.interp(z, [-2.6, -0.6, 2.2, 4.6], [1.6, 0.1, -0.9, -2.3])
    lobe = np.full(len(x), 2)                               # parietal
    lobe[(z > cz)] = 1                                      # frontal
    lobe[(z > cz) & (z < cz + 1.5) & (y > -0.6) & (x > 0.6)] = 7   # precentral (motor) gyrus
    lobe[(y < syl_y) & (z > -5.0) & (x > 2.2)] = 3          # temporal
    lobe[(z < -5.3 + 0.35 * np.maximum(y - 2, 0))] = 4      # occipital
    return verts, faces, nrm, vs, vc, vcs + vsyl, lobe

def cerebellum(side):
    xs = np.arange(-0.4, 5.6, H); ys = np.arange(-6.6, -1.8, H); zs = np.arange(-9.2, -2.6, H)
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij'); X = X.astype(np.float32); Y = Y.astype(np.float32); Z = Z.astype(np.float32)
    d = ell(X, Y, Z, (2.5, -4.6, -5.9), (2.6, 1.55, 2.4))
    d = smin(d, ell(X, Y, Z, (0.3, -4.4, -6.0), (0.9, 1.4, 2.2)), 0.6)   # vermis
    d = smax(d, -(X - 0.0), 0.2)
    # folia: thin parallel lamellae wrapping round a transverse axis
    ang = np.arctan2(Y + 4.4, Z + 5.4)
    rr = np.sqrt((Y + 4.4) ** 2 + (Z + 5.4) ** 2)
    f = np.cos(ang * rr * 3.4 + 0.6 * noise3(X.shape, 0.8 / H, 77 + side))
    fol = np.clip((-f - 0.2) / 0.8, 0, 1)
    horiz = np.clip(1 - np.abs(ang + 2.25) / 0.06, 0, 1)   # horizontal fissure
    d2 = d + 0.22 * fol + 0.4 * horiz
    verts, faces, nrm, _ = measure.marching_cubes(d2, 0.0, spacing=(H, H, H), gradient_direction='ascent')
    verts += np.array([xs[0], ys[0], zs[0]]); nrm = -nrm
    idx = np.clip(np.round((verts - [xs[0], ys[0], zs[0]]) / H).astype(int), 0, np.array(X.shape) - 1)
    return verts, faces, nrm, fol[tuple(idx.T)]

def tube(pts, radii, seg=28, n=120):
    from scipy.interpolate import CubicSpline
    pts = np.asarray(pts, float); t0 = np.linspace(0, 1, len(pts))
    cs = CubicSpline(t0, pts, axis=0); t = np.linspace(0, 1, n)
    C = cs(t); T = cs(t, 1); T /= np.linalg.norm(T, axis=1)[:, None]
    R = np.interp(t, np.linspace(0, 1, len(radii)), radii)
    up = np.array([0, 1, 0.0]); V = []; N = []
    for i in range(n):
        a = np.cross(T[i], up); a /= np.linalg.norm(a) + 1e-9; b = np.cross(T[i], a)
        for j in range(seg):
            th = 2 * np.pi * j / seg; nn = np.cos(th) * a + np.sin(th) * b
            V.append(C[i] + R[i] * nn); N.append(nn)
    F = []
    for i in range(n - 1):
        for j in range(seg):
            a0 = i * seg + j; a1 = i * seg + (j + 1) % seg; b0 = a0 + seg; b1 = a1 + seg
            F += [(a0, b0, a1), (a1, b0, b1)]
    return np.array(V), np.array(F), np.array(N), t.repeat(seg)

def sphere(c, r, nu=96, nv=64, scale=(1, 1, 1)):
    u = np.linspace(0, 2 * np.pi, nu + 1); v = np.linspace(0, np.pi, nv + 1)
    U, Vv = np.meshgrid(u, v, indexing='ij')
    n = np.stack([np.sin(Vv) * np.cos(U), np.cos(Vv), np.sin(Vv) * np.sin(U)], -1).reshape(-1, 3)
    p = np.asarray(c) + r * n * np.asarray(scale)
    F = []
    for i in range(nu):
        for j in range(nv):
            a = i * (nv + 1) + j; b = a + nv + 1
            F += [(a, a + 1, b), (b, a + 1, b + 1)]
    return p, np.array(F), n

meshes = []
def add(kind, V, F, N, C, UV=None):
    N = N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-9)
    if UV is None: UV = np.zeros((len(V), 2))
    meshes.append((kind, np.hstack([V, N, C, UV]).astype(np.float32), F.astype(np.uint32).ravel()))

def cortex_color(vs, vc, deep):
    base = np.array([0.74, 0.47, 0.44]); sul = np.array([0.30, 0.09, 0.10]); crn = np.array([0.86, 0.64, 0.60])
    c = base + (sul - base) * np.clip(vs + deep, 0, 1)[:, None] + (crn - base) * (0.5 * vc)[:, None]
    return np.hstack([c, (1 - 0.85 * np.clip(vs + deep, 0, 1))[:, None]])

regions_meta = {}
for side in (1, -1):
    V, F, N, vs, vc, deep, lobe = hemisphere(side)
    V = V * [side, 1, 1]; N = N * [side, 1, 1]
    if side > 0: F = F[:, ::-1]
    col = cortex_color(vs, vc, deep)
    # split by lobe so the harness can light a region; kind = 100*side_code + lobe
    for L in (1, 2, 3, 4, 7):
        m = lobe == L
        fm = m[F].all(1)
        if not fm.any(): continue
        used = np.unique(F[fm]); remap = -np.ones(len(V), int); remap[used] = np.arange(len(used))
        add(L, V[used], remap[F[fm]], N[used], col[used])
        regions_meta.setdefault(L, []).append(V[used].mean(0).tolist())
    # faces straddling lobes
    fm = ~np.array([(lobe[F] == L).all(1) for L in (1, 2, 3, 4, 7)]).any(0)
    used = np.unique(F[fm]); remap = -np.ones(len(V), int); remap[used] = np.arange(len(used))
    lb = np.bincount(lobe[F[fm]].ravel()).argmax() if fm.any() else 2
    if fm.any(): add(int(lobe[F[fm][:, 0]].min()), V[used], remap[F[fm]], N[used], col[used])
    V, F, N, fol = cerebellum(side)
    V = V * [side, 1, 1]; N = N * [side, 1, 1]
    if side > 0: F = F[:, ::-1]
    c = np.array([0.78, 0.58, 0.54]) + (np.array([0.40, 0.22, 0.22]) - [0.78, 0.58, 0.54]) * fol[:, None] * 0.9
    add(5, V, F, N, np.hstack([c, np.ones((len(c), 1))]))
    regions_meta.setdefault(5, []).append(V.mean(0).tolist())
# brainstem: midbrain -> pons -> medulla
V, F, N, _ = tube([(0, -1.6, -1.6), (0, -3.0, -2.2), (0, -4.6, -2.4), (0, -6.4, -3.0), (0, -8.6, -3.6)], [1.15, 1.35, 1.7, 1.05, 0.8], seg=48, n=90)
add(6, V, F, N, np.tile([0.86, 0.72, 0.66, 1], (len(V), 1)))
regions_meta[6] = [V.mean(0).tolist()]
# visual pathway: optic nerves -> chiasm -> optic tracts -> LGN -> radiation -> V1
EYE_C = {1: (3.2, -3.4, 9.7), -1: (-3.2, -3.4, 9.7)}
EYE_R = 1.25
for side in (1, -1):
    s = side
    nerve = [(s * 3.15, -3.45, 8.4), (s * 2.6, -3.4, 6.8), (s * 1.4, -3.15, 5.0), (s * 0.35, -3.2, 3.6)]
    V, F, N, t = tube(nerve, [0.32, 0.30, 0.27, 0.26], seg=24, n=80)
    add(20 + (0 if s > 0 else 1), V, F, N, np.tile([0.93, 0.90, 0.84, 1], (len(V), 1)))
    tract = [(s * 0.35, -3.2, 3.4), (s * 1.3, -3.0, 2.0), (s * 2.0, -2.2, 0.0), (s * 2.3, -1.8, -1.0)]
    V, F, N, t = tube(tract, [0.24, 0.24, 0.22, 0.4], seg=20, n=60)
    add(22, V, F, N, np.tile([0.92, 0.88, 0.82, 1], (len(V), 1)))
    # optic radiation (Meyer's loop sweeps forward into the temporal lobe), glowing fibres for the interior flight
    for k in range(18):
        j = rng.normal(0, 0.18, 3)
        rad = [(s * 2.3, -1.8, -1.0), (s * (3.2 + j[0]), -1.4 + j[1], 0.2 + j[2] * 2), (s * (3.4 + j[0]), -0.6 + j[1], -2.6), (s * (2.6 + j[0]), 0.2 + j[1], -5.4), (s * (0.8 + abs(j[0])), 0.8 + j[1] * 2, -7.6 + j[2])]
        V, F, N, t = tube(rad, [0.05, 0.04, 0.04, 0.035], seg=8, n=90)
        add(30, V, F, N, np.tile([1.0, 0.85, 0.55, 1], (len(V), 1)))
    # LGN knot
    V, F, N = sphere((s * 2.3, -1.8, -1.0), 0.42, 32, 20)
    add(31, V, F, N, np.tile([1.0, 0.8, 0.5, 1], (len(V), 1)))
    # eye: sclera, iris, cornea
    c = np.array(EYE_C[s])
    V, F, N = sphere(c, EYE_R, 128, 96)
    add(40 + (0 if s > 0 else 1), V, F, N, np.tile([0.94, 0.92, 0.9, 1], (len(V), 1)))
    # iris ring + pupil, facing +z
    th = np.linspace(0, 2 * np.pi, 160, endpoint=False); rings = np.linspace(0.18, 0.62, 14)
    IV = []; IC = []
    irc = np.array([0.32, 0.42, 0.62]) if s < 0 else np.array([0.70, 0.46, 0.18])   # subject's right eye (x<0) = HAMON steel, left = Spire brass
    for r in rings:
        for a in th:
            zz = np.sqrt(max(EYE_R ** 2 - r ** 2, 0)) * 0.985
            IV.append(c + [r * np.cos(a), r * np.sin(a), zz])
            f = (r - 0.18) / 0.44; streak = 0.75 + 0.25 * np.cos(a * 37 + r * 9)
            IC.append(list(np.clip(irc * streak * (0.55 + 0.6 * f), 0, 1)) + [1])
    IV = np.array(IV); nr = len(th); IF = []
    for i in range(len(rings) - 1):
        for j in range(nr):
            a0 = i * nr + j; a1 = i * nr + (j + 1) % nr; b0 = a0 + nr; b1 = a1 + nr
            IF += [(a0, a1, b0), (a1, b1, b0)]
    add(50 + (0 if s > 0 else 1), IV, np.array(IF), np.tile([0, 0, 1.0], (len(IV), 1)), np.array(IC))
    PV, PF, PN = sphere(c + [0, 0, EYE_R * 0.97], 0.19, 40, 20, scale=(1, 1, 0.15))
    add(52, PV, PF, PN, np.tile([0.01, 0.01, 0.012, 1], (len(PV), 1)))
# chiasm
V, F, N = sphere((0, -3.25, 3.5), 0.5, 40, 24, scale=(1.5, 0.45, 0.7))
add(22, V, F, N, np.tile([0.92, 0.88, 0.82, 1], (len(V), 1)))
# hippocampus (deep, medial temporal) - Wildside's place cells
hip = [(4.2, -3.2, 2.2), (3.5, -2.6, 0.6), (2.9, -1.7, -1.2), (2.2, -0.6, -2.6), (1.6, 0.4, -3.0)]
V, F, N, t = tube(hip, [0.55, 0.45, 0.35, 0.25, 0.18], seg=24, n=80)
add(8, V, F, N, np.tile([0.95, 0.70, 0.62, 1], (len(V), 1)))
regions_meta[8] = [np.mean(hip, 0).tolist()]

with open(OUT, 'wb') as fh:
    fh.write(struct.pack('<I', len(meshes)))
    for kind, vb, ib in meshes:
        fh.write(struct.pack('<III', kind, len(vb), len(ib))); fh.write(vb.tobytes()); fh.write(ib.tobytes())
tot = sum(len(ib) // 3 for _, _, ib in meshes)
json.dump({'regions': {k: np.mean(v, 0).tolist() for k, v in regions_meta.items()}, 'eyes': {'left_spire': EYE_C[1], 'right_hamon': EYE_C[-1]}, 'eye_r': EYE_R, 'tris': tot}, open(OUT + '.json', 'w'), indent=1)
print('meshes', len(meshes), 'tris', tot)
