import numpy as np
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
