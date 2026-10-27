import json, numpy as np, sys
TGT = np.array([0, -0.5, 0.0])
def ov(deg, el=10, R=40):
    th = np.radians(deg); e = np.radians(el)
    return (TGT + R * np.array([np.sin(th) * np.cos(e), np.sin(e), np.cos(th) * np.cos(e)])).tolist()
fr = [
 {'eye': ov(60, 12), 'target': TGT.tolist(), 'fov': 22},      # left lateral 3/4 front
 {'eye': ov(90, 5), 'target': TGT.tolist(), 'fov': 22},       # pure left lateral
 {'eye': ov(150, 20), 'target': TGT.tolist(), 'fov': 22},     # left posterior: occipital + cerebellum
 {'eye': ov(20, 55), 'target': TGT.tolist(), 'fov': 22},      # top front: fissure
 {'eye': ov(0, -8), 'target': TGT.tolist(), 'fov': 22},       # front: eyes
]
json.dump({'frames': fr}, open('preview.json', 'w'))
