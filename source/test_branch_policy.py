"""Declared three-second branch media contracts; synthetic fixtures are not render proof."""
import copy,hashlib,json,struct,tempfile,unittest
from pathlib import Path
from branch_policy import load_branches,branch_video_errors,branch_source_errors
from test_lobby_policy import video

class BranchPolicy(unittest.TestCase):
    def fixture(self,root):
        data={'schema':1,'visibility':'local-preview','routes':{}}
        def png(w,h):return b'\x89PNG\r\n\x1a\n'+struct.pack('>I4sII',13,b'IHDR',w,h)+b'\0'*9
        def put(name,raw):
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
            return {'src':name,'sha256':hashlib.sha256(raw).hexdigest()}
        for key in ('hackathons','projects'):
            media={}
            for direction in ('forward','reverse'):media[direction]=put(f'assets/scene/forge-warm-{key}-{direction}.mp4',video(width=640,height=400,frames=60))
            media['endpoint']=put(f'assets/scene/forge-warm-{key}-endpoint.png',png(640,400))
            still={**put(f'assets/scene/forge-warm-{key}-1280.png',png(1280,800)),'width':1280,'height':800,'alt':'A native view of this distinct forge destination.'}
            data['routes'][key]={'mode':'recorded-native','width':640,'height':400,'frames':60,'playbackFps':20,'containerSeconds':3,'label':key,'location':'The forge','media':media,'still':still,'provenance':{'cameraSequenceSha256':'a'*64,'nativeReceiptSha256':'b'*64,'nativeJobSeconds':75.5}}
        return data
    def write(self,root,data):(root/'branch-routes.json').write_text(json.dumps(data))
    def test_preview_gate_and_optional_absence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);self.assertEqual(load_branches(root),{})
            d=self.fixture(root);self.write(root,d)
            with self.assertRaises(ValueError):load_branches(root)
            self.assertEqual(load_branches(root,allow_private_preview=True),d['routes'])
    def test_unreviewed_contract_and_paths_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);base=self.fixture(root)
            for field,value in [('mode','live'),('frames',80),('width',1280),('playbackFps',30),('label','<script>')]:
                d=copy.deepcopy(base);d['routes']['projects'][field]=value;self.write(root,d)
                with self.subTest(field=field),self.assertRaises(ValueError):load_branches(root,allow_private_preview=True)
            d=copy.deepcopy(base);d['routes']['projects']['media']['forward']['src']='https://example.org/movie.mp4';self.write(root,d)
            with self.assertRaises(ValueError):load_branches(root,allow_private_preview=True)
    def test_actual_track_timing_and_endpoint_bytes_checked(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);base=self.fixture(root)
            for raw in [video(width=640,height=400,frames=80),video(width=800,height=500,frames=60)]:
                d=copy.deepcopy(base);r=d['routes']['projects']['media']['forward'];(root/r['src']).write_bytes(raw);r['sha256']=hashlib.sha256(raw).hexdigest();self.write(root,d)
                with self.assertRaises(ValueError):load_branches(root,allow_private_preview=True)
    def test_source_and_video_attributes_bind_exact_route(self):
        routes={'projects':{'media':{'forward':{'src':'assets/scene/forge-warm-projects-forward.mp4'}}}}
        attrs={'id':'route-projects-forward','data-route':'projects','data-direction':'forward','muted':None,'playsinline':None,'preload':'none','hidden':None}
        self.assertEqual(branch_video_errors(attrs,routes),[])
        self.assertTrue(branch_video_errors({**attrs,'autoplay':None},routes))
        self.assertTrue(branch_video_errors({**attrs,'data-route':'hackathons'},routes))
        source={'src':'assets/scene/forge-warm-projects-forward.mp4','type':'video/mp4'}
        self.assertEqual(branch_source_errors(source,'route-projects-forward',routes),[])
        self.assertTrue(branch_source_errors({**source,'src':'assets/scene/forge-warm-hackathons-forward.mp4'},'route-projects-forward',routes))
