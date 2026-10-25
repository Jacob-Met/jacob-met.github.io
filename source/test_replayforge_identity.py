"""Keep two distinct ReplayForge projects and their public/private destinations separate."""
from pathlib import Path
import copy,json,unittest
import build
from experience_policy import validate_experience
ROOT=Path(__file__).resolve().parent
class ReplayForgeIdentity(unittest.TestCase):
 def setUp(self):
  self.data=json.loads((ROOT/'experience-content.json').read_text());self.entries=next(x for x in self.data['hamonBranches'] if x['id']=='hackathons')['entries']
 def test_distinct_scopes_and_exact_public_destination(self):
  validate_experience(self.data);court=next(x for x in self.entries if x['id']=='replay-forge');debug=next(x for x in self.entries if x['id']=='replayforge-debugging')
  self.assertIn('court reconstruction',court['name']);self.assertIn('basketball',court['purpose']);self.assertEqual(court['projectId'],'replay-forge');self.assertIsNone(court['publicUrl'])
  self.assertIn('replay debugging',debug['name']);self.assertIsNone(debug['projectId']);self.assertEqual(debug['publicUrl'],'https://devpost.com/software/replayforge-ypvoia');self.assertIn('synthetic',debug['limit']);self.assertIn('intentional',debug['limit'])
 def test_unreviewed_destination_and_identity_rejected(self):
  for key,value in [('publicUrl','https://devpost.com/software/unreviewed'),('projectId','replay-forge'),('id','replayforge')]:
   d=copy.deepcopy(self.data);entry=next(x for x in next(b for b in d['hamonBranches'] if b['id']=='hackathons')['entries'] if x['id']=='replayforge-debugging');entry[key]=value
   with self.assertRaises(ValueError):validate_experience(d)
 def test_public_entry_is_secondary_hackathon_work_not_a_relabelled_court(self):
  html=build.render_index(json.loads((ROOT/'content.json').read_text()),preview=True);hack=html.split('id="hackathons"',1)[1].split('</section>',1)[0];projects=html.split('id="projects"',1)[1].split('</section>',1)[0]
  self.assertIn('related-experiments',hack);self.assertIn('ReplayForge · replay debugging',hack);self.assertIn('https://devpost.com/software/replayforge-ypvoia',hack);self.assertNotIn('https://devpost.com/software/replayforge-ypvoia',projects);self.assertIn('Replay Forge · court reconstruction',projects);self.assertIn('id="replay-forge"',projects)
if __name__=='__main__':unittest.main()
