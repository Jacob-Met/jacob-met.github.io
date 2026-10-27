import json, math
fr=[]
def p(eye,tgt,fov=30,**k): d=dict(eye=eye,target=tgt,fov=fov); d.update(k); fr.append(d)
p([30,14,30],[0,-0.5,0.5])
p([42,6,4],[0,-0.5,0.5])
p([-14,10,44],[0,-1,2])
p([0,46,2],[0,0,0])
json.dump({'frames':fr},open('test_route.json','w'))
