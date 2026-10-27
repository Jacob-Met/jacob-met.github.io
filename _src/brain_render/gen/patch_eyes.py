import struct, numpy as np, sys
src, dst = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read(); n = struct.unpack_from('<I', b, 0)[0]; o = 4; meshes = []
for _ in range(n):
    k, nv, ni = struct.unpack_from('<III', b, o); o += 12
    vb = np.frombuffer(b, np.float32, nv * 12, o).reshape(nv, 12).copy(); o += nv * 48
    ib = np.frombuffer(b, np.uint32, ni, o).copy(); o += ni * 4
    meshes.append([k, vb, ib])
EYE_R = 1.25
def iris(s):
    c = np.array((s * 3.2, -3.4, 9.7)); irc = np.array([0.32, 0.42, 0.62]) if s < 0 else np.array([0.74, 0.48, 0.16])
    th = np.linspace(0, 2 * np.pi, 240, endpoint=False); rings = np.linspace(0.17, 0.64, 24)
    V = []
    rng = np.random.default_rng(7 + s)
    ph = rng.uniform(0, 6.28, 6)
    for r in rings:
        f = (r - 0.17) / 0.47
        for a in th:
            zz = np.sqrt(max(EYE_R ** 2 - r ** 2, 0)) + 0.012 - 0.03 * np.exp(-((f - 0.45) / 0.2) ** 2)
            p = c + [r * np.cos(a), r * np.sin(a), zz]; nn = (p - c) / np.linalg.norm(p - c)
            streak = 0.7 + 0.18 * np.cos(a * 41 + r * 13 + ph[0]) + 0.12 * np.cos(a * 17 + ph[1])
            col = irc * streak * (0.34 + 0.56 * f) * (1.25 if 0.25 < f < 0.4 else 1.0)
            if f > 0.9: col = col * 0.35   # limbal ring
            if f < 0.08: col = col * 0.6 + np.array([0.12, 0.07, 0.03])   # collarette
            V.append(list(p) + list(nn) + list(np.clip(col, 0, 1)) + [1.0, 0, 0])
    V = np.array(V, np.float32); nr = len(th); F = []
    for i in range(len(rings) - 1):
        for j in range(nr):
            a0 = i * nr + j; a1 = i * nr + (j + 1) % nr; b0 = a0 + nr; b1 = a1 + nr
            F += [a0, b0, a1, a1, b0, b1]
    # pupil disc, just above the inner iris edge
    pc = len(V); P = [list(c + [0, 0, EYE_R + 0.004]) + [0, 0, 1, 0.01, 0.01, 0.012, 1, 0, 0]]
    for a in th: P.append(list(c + [0.175 * np.cos(a), 0.175 * np.sin(a), np.sqrt(EYE_R ** 2 - 0.175 ** 2) + 0.006]) + [0, 0, 1, 0.01, 0.01, 0.012, 1, 0, 0])
    PF = []
    for j in range(nr): PF += [0, 1 + j, 1 + (j + 1) % nr]
    return V, np.array(F, np.uint32), np.array(P, np.float32), np.array(PF, np.uint32)
out = [m for m in meshes if m[0] not in (50, 51, 52)]
for s in (1, -1):
    V, F, P, PF = iris(s)
    out.append([50 if s > 0 else 51, V, F]); out.append([52, P, PF])
with open(dst, 'wb') as fh:
    fh.write(struct.pack('<I', len(out)))
    for k, vb, ib in out:
        fh.write(struct.pack('<III', k, len(vb), len(ib))); fh.write(vb.astype(np.float32).tobytes()); fh.write(ib.astype(np.uint32).tobytes())
print(len(out))
