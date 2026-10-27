import numpy as np
from PIL import Image
W, H = 240, 135
atlas = np.zeros((H * 8, W * 12), np.uint8)
for i in range(96):
    best = np.zeros((H, W)); lab = np.zeros((H, W), np.uint8)
    for k in range(1, 11):
        im = np.asarray(Image.open(f'out/id_{k}/f{i:05d}.png').convert('L').resize((W, H), Image.BILINEAR)).astype(float)
        m = im > np.maximum(best, 90); lab[m] = k; best = np.maximum(best, im)
    atlas[(i // 12) * H:(i // 12 + 1) * H, (i % 12) * W:(i % 12 + 1) * W] = lab
Image.fromarray(atlas, 'L').save('out/labels.png', optimize=True)
print(np.bincount(atlas.ravel(), minlength=11))
pal = np.array([[0,0,0],[255,0,0],[0,255,0],[0,0,255],[255,255,0],[255,0,255],[0,255,255],[255,128,0],[128,0,255],[255,255,255],[128,128,128]], np.uint8)
a = atlas
Image.fromarray(np.vstack([np.hstack([pal[a[r*135:(r+1)*135, c*240:(c+1)*240]] for c in (0, 3, 6, 9)]) for r in (0, 3, 6)])).resize((1920, 810), 0).save('out/lab_check.png')
