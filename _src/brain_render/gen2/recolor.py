# Deepen cortex albedo: saturate and slightly darken vertex colours of kinds 1-8 (no geometry change).
import sys, struct, numpy as np, colorsys
src, dst, SAT, VAL = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
b = open(src, 'rb').read(); o = 4; n = struct.unpack_from('<I', b, 0)[0]; out = bytearray(b[:4])
for _ in range(n):
    k, nv, ni = struct.unpack_from('<III', b, o); o += 12
    v = np.frombuffer(b, '<f4', nv * 12, o).reshape(nv, 12).copy(); o += nv * 48
    idx = b[o:o + ni * 4]; o += ni * 4
    if 1 <= k <= 8:
        c = v[:, 6:9]; mx = c.max(1, keepdims=True); mn = c.min(1, keepdims=True)
        grey = c.mean(1, keepdims=True)
        c = grey + (c - grey) * SAT          # push chroma away from the per-vertex grey
        v[:, 6:9] = np.clip(c * VAL, 0, 1)
    out += struct.pack('<III', k, nv, ni) + v.astype('<f4').tobytes() + idx
open(dst, 'wb').write(out)
