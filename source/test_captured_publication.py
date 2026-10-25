"""Captured release custody: only reviewed local media and the small UI enhancement."""
import copy,hashlib,json,shutil,subprocess,tempfile,unittest
from pathlib import Path
import build
from capture_policy import load_capture,video_element_errors,source_element_errors
from experience_policy import load_experience,validate_experience
from source_policy import validate_source_publication,reject_private_ledgers
from site_policy import audit_scripts,script_source_errors,script_integrity,script_element_errors,SCRIPT_FILES,LOADED_SCRIPT_FILES,PRESENTATION_STILLS,PRESENTATION_FILES,validate_presentation_stills,validate_art
from lobby_policy import MEDIA,load_lobby,lobby_files,validate_retained_engine_media,RETAINED_ENGINE_MEDIA
from branch_policy import branch_files,load_branches

class CapturedPublication(unittest.TestCase):
    def test_genuine_native_presentation_stills_and_authored_art(self):
        validate_presentation_stills(build.ROOT); validate_art(build.ROOT)
        self.assertEqual(set(PRESENTATION_STILLS), {'entrance','arrival'})
        self.assertEqual((PRESENTATION_STILLS['entrance']['width'],PRESENTATION_STILLS['entrance']['height']),(1280,800))
        self.assertEqual((PRESENTATION_STILLS['arrival']['width'],PRESENTATION_STILLS['arrival']['height']),(960,600))
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for name in PRESENTATION_FILES:
                p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(build.ROOT/name,p)
            validate_presentation_stills(root)
            p=root/PRESENTATION_STILLS['arrival']['src']
            p.write_bytes(p.read_bytes()+b'changed')
            with self.assertRaises(ValueError): validate_presentation_stills(root)
    def test_semantic_room_maps_and_content_are_not_javascript_only(self):
        record=json.loads((build.ROOT/'content.json').read_text())
        markup=build.render_index(record,preview=True)
        self.assertEqual(markup.count('class="room-nav"'),5)
        self.assertEqual(markup.count('class="scene-beacon '),3)
        self.assertEqual(markup.count('class="branch-arrival"'),2)
        self.assertIn('Explore the Engine',markup)
        self.assertIn('Destinations in the forge',markup)
        for room in ('research','hackathons','projects','engine'):
            self.assertIn(f'href="#{room}"',markup)
        self.assertIn('Conceptual illustration · not experimental data',markup)
        self.assertIn('assets/figures/worldlaw-computed.svg',markup)
        self.assertIn('assets/figures/worldlaw-computed-mobile.svg',markup)
        self.assertIn('Computed model predictions, not measurements.',markup)
        self.assertIn('loading="lazy" src="assets/scene/forge-arrival-960.png"',markup)
        self.assertIn('src="assets/scene/forge-arrival-960.png" width="960" height="600"',markup)
    def test_all_loaded_scripts_parse(self):
        node=shutil.which('node');self.assertIsNotNone(node)
        for name in LOADED_SCRIPT_FILES:
            result=subprocess.run([node,'--check',str(build.ROOT/name)],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
    def test_exact_source_inventory(self): validate_source_publication(build.ROOT)
    def test_detail_behavior_exact_shipped_bytes(self):
        node=shutil.which('node')
        self.assertIsNotNone(node,'Node is required for the actual UI contract tests')
        result=subprocess.run([node,str(build.ROOT/'detail_contract.cjs'),str(build.ROOT/'detail.js')],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr+result.stdout)
        self.assertEqual(result.stdout.count('PASS '),14,result.stdout)
    def test_no_experimental_homepage_inputs(self):
        names={p.relative_to(build.ROOT).as_posix() for p in build.ROOT.rglob('*') if p.is_file() and '__pycache__' not in p.parts}
        for name in names:
            if name.startswith('games/'): continue
            self.assertFalse(name.endswith(('.wasm','.blend','.glb')),name)
            self.assertFalse(name.startswith('engine/'),name)
        for name in ('scene-mesh.json','experience.js','room.js','forge-walk.js','engine-manifest.json'):
            self.assertNotIn(name,names)
        self.assertEqual({p.name for p in (build.ROOT/'assets/scene').iterdir()}, {*(Path(p).name for p in branch_files(load_branches(build.ROOT,allow_private_preview=True)) if p.startswith('assets/scene/')),'forge-entrance-1280.png','forge-entrance-1280.webp','forge-arrival-1280.png','forge-arrival-960.png','research-observatory.svg','forge-native.png','forge-native-motion.mp4','hamon-engine-study.webp','forge-workbench.png',*(Path(p).name for p in lobby_files(load_lobby(build.ROOT,allow_private_preview=True)) if p.startswith('assets/scene/'))})
    def test_previous_engine_media_urls_are_still_exact(self):
        validate_retained_engine_media(build.ROOT)
        self.assertEqual(len(RETAINED_ENGINE_MEDIA),4)
        selected=load_lobby(build.ROOT)
        self.assertTrue(all(selected['media'][k]['src'] not in RETAINED_ENGINE_MEDIA for k in ('forward','reverse','arrival')))
    def test_homepage_remains_prerendered_not_live_three_d(self):
        markup=build.render_index(json.loads((build.ROOT/'content.json').read_text()))
        self.assertNotIn('<canvas',markup);self.assertNotIn('WebAssembly',markup)
        self.assertEqual(markup.count('<video id="route-'),6)
    def test_exact_script_integrity(self):
        hashes=audit_scripts(build.ROOT);name='lobby.js'
        self.assertEqual(set(hashes),set(SCRIPT_FILES))
        self.assertTrue(script_element_errors({'src':'detail.js','defer':None,'integrity':script_integrity(hashes['detail.js'])},'',hashes))
        self.assertEqual(script_element_errors({'src':name,'defer':None,'integrity':script_integrity(hashes[name])},'',hashes),[])
        self.assertTrue(script_element_errors({'src':name,'defer':None,'integrity':'sha256-wrong'},'',hashes))
        self.assertTrue(script_element_errors({},'alert(1)',hashes))
    def test_script_checksum_not_self_authorizing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for name in SCRIPT_FILES:shutil.copyfile(build.ROOT/name,root/name)
            with (root/'detail.js').open('a') as f:f.write('\n// changed\n')
            with self.assertRaises(ValueError):audit_scripts(root)
    def test_forbidden_script_capabilities(self):
        for snippet in ('eval("x")','new Function("x")','import x from "x"','fetch("x")','new Worker("x")','WebAssembly.instantiate(x)','navigator.sendBeacon("x")','document.write("x")'):
            with self.subTest(snippet=snippet):self.assertTrue(script_source_errors(snippet))
    def test_public_captured_projection_uses_default_build_and_check(self):
        # Public disclosure/build eligibility is not a universal browser claim.
        # Synthetic local-preview rejection remains tested in both route policies.
        self.assertEqual(load_lobby(build.ROOT)['visibility'],'public-captured')
        self.assertEqual(set(load_branches(build.ROOT)),{'hackathons','projects'})
        from check import check
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'out'
            summary=build.build(out)
            self.assertEqual(summary['publication'],'public-captured')
            self.assertTrue(check(out)['passed'])

    def test_capture_is_explicitly_public_and_byte_pinned(self):
        data=load_capture(build.ROOT)
        self.assertEqual(data['visibility'],'public-captured')
        for kind in ('capture','recording','engineProof'):
            item=data[kind];self.assertEqual(item['sha256'],hashlib.sha256((build.ROOT/item['src']).read_bytes()).hexdigest())
        self.assertGreater(data['recording']['nativeJobSeconds'],data['recording']['frames']/data['recording']['playbackFps'])
    def test_capture_denies_private_projection_and_extra_engine_inputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);shutil.copytree(build.ROOT/'assets',root/'assets')
            data=load_capture(build.ROOT)
            for mutation in (lambda m:m.update(visibility='local-preview'),lambda m:m.update(sceneText='private'),lambda m:m['capture'].update(src='../private.png'),lambda m:m['recording'].update(sha256='0'*64)):
                copy_data=copy.deepcopy(data);mutation(copy_data)
                (root/'capture-manifest.json').write_text(json.dumps(copy_data))
                with self.assertRaises(ValueError):load_capture(root)
    def test_controls_only_local_recording(self):
        attrs={'controls':None,'playsinline':None,'preload':'none','width':'800','height':'548','poster':'assets/scene/forge-native.png','aria-label':'Recorded native HAMON Engine camera approach, not live browser rendering'}
        self.assertEqual(video_element_errors(attrs),[])
        for key in ('autoplay','loop','onplay'):
            self.assertTrue(video_element_errors({**attrs,key:''}))
        self.assertTrue(source_element_errors({'src':'https://example.com/v.mp4','type':'video/mp4'}))
    def test_reviewed_identity_research_and_public_destinations(self):
        data=load_experience(build.ROOT);self.assertEqual(data['visibility'],'public-captured')
        self.assertEqual(len(data['researchWork']['academic']),4)
        self.assertEqual(len(data['researchWork']['independent']),3)
        self.assertEqual([p['id'] for p in data['hierarchy']['pillars']],['research','hamon','spire'])
        for change in ('local-preview','private'):
            bad=copy.deepcopy(data);bad['visibility']=change
            with self.assertRaises(ValueError):validate_experience(bad)
    def test_unreviewed_source_and_private_ledger_rejected(self):
        for key in ('internalEvidence','privateSourceUrl','rawEvidence'):
            with self.assertRaises(ValueError):reject_private_ledgers({'nested':[{key:'private'}]})
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'source-allowlist.json').write_text('{"schema":1,"files":["source-allowlist.json"]}')
            (root/'unreviewed.txt').write_text('unreviewed')
            with self.assertRaises(ValueError):validate_source_publication(root)
