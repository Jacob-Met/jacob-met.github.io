import numpy as np, sys
from PIL import Image
def render(V,F,N,view=np.array([-1,0,0.]),up=np.array([0,0,1.]),W=700,col=None):
    view=view/np.linalg.norm(view); r=np.cross(up,view); r/=np.linalg.norm(r); u=np.cross(view,r)
    c=V.mean(0); P=V-c; x=P@r; y=P@u; z=P@view
    s=(W*0.45)/max(np.abs(x).max(),np.abs(y).max())
    H=W
    img=np.zeros((H,W,3)); zb=np.full((H,W),-1e9)
    bary=np.array([[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6],[.45,.45,.1],[.1,.45,.45],[.45,.1,.45],[.8,.1,.1],[.1,.8,.1],[.1,.1,.8]])
    L=np.array([0.5,0.6,0.8]); L=L/np.linalg.norm(L); Lw = -view*0.7 + u*0.5 + r*0.3; Lw/=np.linalg.norm(Lw)
    AX=[];AY=[];AZ=[];AC=[]
    for b in bary:
        px=(x[F]*b).sum(1); py=(y[F]*b).sum(1); pz=(z[F]*b).sum(1)
        n=(N[F]*b[None,:,None]).sum(1); n/=np.linalg.norm(n,axis=1,keepdims=True)
        sh=np.clip(n@Lw,0,1)*0.8+0.2
        cc = (col[F]*b[None,:,None]).sum(1) if col is not None else np.ones((len(F),3))*0.85
        ix=(px*s+W/2).astype(int); iy=(H/2-py*s).astype(int)
        ok=(ix>=0)&(ix<W)&(iy>=0)&(iy<H)
        ix,iy,pz,sh,cc=ix[ok],iy[ok],pz[ok],sh[ok],cc[ok]
        AX.append(ix);AY.append(iy);AZ.append(pz);AC.append(cc*sh[:,None])
    ix=np.concatenate(AX);iy=np.concatenate(AY);pz=np.concatenate(AZ);cc=np.concatenate(AC)
    o=np.argsort(pz); img[iy[o],ix[o]]=cc[o]
    return Image.fromarray((np.clip(img,0,1)*255).astype(np.uint8))
