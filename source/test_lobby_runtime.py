"""Exercise shipped helper/adapter, not a claim of native media or focus receiving."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT=Path(__file__).parent
class LobbyRuntime(unittest.TestCase):
    def run_contract(self,name,arg):
        node=shutil.which('node');self.assertIsNotNone(node)
        p=subprocess.run([node,str(ROOT/name),str(arg)],text=True,capture_output=True)
        self.assertEqual(p.returncode,0,p.stdout+p.stderr)
        return p.stdout
    def test_three_route_coordinator_oracle(self):
        d=json.loads(self.run_contract('lobby_multiroute_contract.cjs',ROOT/'lobby-journey.js'))
        self.assertEqual(d['failures'],[]);self.assertEqual(d['passed'],63)
    def test_three_route_adapter_media_and_focus(self):
        d=json.loads(self.run_contract('lobby_branch_adapter_contract.cjs',ROOT))
        self.assertEqual(d['failed'],0);self.assertEqual(d['passed'],19)
    def test_three_route_mixed_history_stress(self):
        d=json.loads(self.run_contract('lobby_branch_stress_contract.cjs',ROOT))
        self.assertEqual(d['failures'],[]);self.assertEqual(d['transitions'],4000)
    def test_decoded_scene_handoff_and_stale_image_callbacks(self):
        d=json.loads(self.run_contract('lobby_image_contract.cjs',ROOT))
        self.assertEqual(d['failed'],0);self.assertEqual(d['passed'],16)
    def test_landmarks_wait_for_actual_entrance_scene(self):
        d=json.loads(self.run_contract('lobby_landmark_scene_contract.cjs',ROOT))
        self.assertTrue(d['passed']);self.assertEqual(len(d['result']),4)
    def test_landmark_return_focus_and_hidden_fallback(self):
        d=json.loads(self.run_contract('lobby_landmark_focus_contract.cjs',ROOT))
        self.assertTrue(d['passed']);self.assertEqual(len(d['result']),6)
    def test_async_image_route_stress(self):
        d=json.loads(self.run_contract('lobby_image_stress_contract.cjs',ROOT))
        self.assertEqual(d['failures'],[]);self.assertEqual(d['transitions'],2000)
    def test_exact_helper(self):
        result=self.run_contract('lobby_journey_contract.cjs',ROOT/'lobby-journey.js')
        self.assertIn('PASS',result)
    def test_exact_adapter_history_media_races(self):
        result=self.run_contract('lobby_adapter_contract.cjs',ROOT)
        final=json.loads(result.strip().splitlines()[-1])
        self.assertEqual(final['failed'],0);self.assertEqual(final['passed'],15)
    def test_legacy_sections_focus_visibility_and_history(self):
        d=json.loads(self.run_contract('lobby_sections_contract.cjs',ROOT))
        self.assertEqual(d['researchEngineReturn'],dict(hash='#forge',phase='home',focused='researchLink'))
        self.assertEqual(d['projectEngineReturn'],dict(hash='#forge',phase='home',focused='projectLink'))
        self.assertEqual(d['researchReturn'],dict(focused='researchLink',hash='#forge'))
        self.assertEqual(d['branchRoute'],dict(returnFocused='projectLink',travelBeforeContent=True,arrivalFocused=True,escapeHash='#forge',escapePhase='home'))
        self.assertEqual(d['branchInterrupted'],dict(phase='home',hash='#research',focused='researchHeading'))
        self.assertEqual(d['branchToEngine'],dict(phase='arrived',projectsHidden=True,focused='heading'))
        self.assertEqual(d['initialHome'],dict(researchHidden=True,projectsHidden=True))
        self.assertEqual(d['sectionToSection'],dict(researchHidden=False,projectsHidden=True,focused='researchHeading'))
        self.assertEqual(d['directChild'],dict(hash='#captionverse',projectsVisible=True,ancestorOpen=True,focused='captionverse'))
        self.assertEqual(d['repeatedSection'],dict(historyWrites=1,hash='#research',focused='researchHeading'))
        self.assertEqual(d['engineToChild'],dict(hash='#captionverse',phase='arrived',ancestorOpen=True,focused='captionverse'))

if __name__=='__main__':unittest.main()
