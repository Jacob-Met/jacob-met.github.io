"""Real Git index + real candidate hook; tiny builder fixture tests hook protocol only.
Full production-builder and deployment-policy qualification is deliberately separate.
"""
from pathlib import Path
import json,shutil,subprocess,sys,tempfile,unittest
HOOK=Path(__file__).resolve().parent.parent/'.githooks/pre-commit'
BUILDER='''from pathlib import Path
import argparse,json,sys
p=argparse.ArgumentParser();p.add_argument('--preview',action='store_true');p.add_argument('--out',required=True);a=p.parse_args()
r=Path(__file__).resolve().parent
vs=[json.loads((r/n).read_text())['visibility'] for n in ['lobby-manifest.json','branch-routes.json']]
if any(v not in ['local-preview','public-captured'] for v in vs):raise SystemExit('unknown visibility')
if 'local-preview' in vs and not a.preview:raise SystemExit('preview rejected by default production builder')
o=Path(a.out);o.mkdir(parents=True,exist_ok=True)
(o/'index.html').write_text((r/'message.txt').read_text())
(o/'build-manifest.json').write_text(json.dumps({'publication':'local-preview' if a.preview else 'public-captured'}))
'''
class ActualIndexReview(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='small-index-review-');self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name);(self.root/'source').mkdir();(self.root/'.githooks').mkdir();shutil.copyfile(HOOK,self.root/'.githooks/pre-commit');(self.root/'source/build.py').write_text(BUILDER);(self.root/'source/message.txt').write_text('baseline');self.mode('local-preview');self.git('init','-q');self.git('config','user.email','index-fixture@example.invalid');self.git('config','user.name','Local index fixture');self.build(True);self.git('add','-A');self.git('commit','-qm','fixture baseline')
 def git(self,*args):return subprocess.run(['git',*args],cwd=self.root,check=True,capture_output=True,text=True)
 def mode(self,value):
  for p in ['lobby-manifest.json','branch-routes.json']:(self.root/'source'/p).write_text(json.dumps({'visibility':value}))
 def build(self,preview):
  args=[sys.executable,'source/build.py','--out','docs'];args+=['--preview'] if preview else [];subprocess.run(args,cwd=self.root,check=True,capture_output=True,text=True)
 def edit(self):(self.root/'source/message.txt').write_text('a changed story')
 def hook(self):return subprocess.run(['sh','.githooks/pre-commit'],cwd=self.root,capture_output=True,text=True)
 def test_staged_preview_pair_passes(self):
  self.edit();self.build(True);self.git('add','source','docs');r=self.hook();self.assertEqual(r.returncode,0,r.stderr);self.assertIn('review only, not production eligibility',r.stderr)
 def test_staged_source_only_rejects_despite_rebuilt_worktree(self):
  self.edit();self.build(True);self.git('add','source/message.txt');r=self.hook();self.assertNotEqual(r.returncode,0);self.assertIn('staged docs',r.stderr)
 def test_staged_docs_only_rejects_unstaged_source(self):
  self.edit();self.build(True);self.git('add','docs');r=self.hook();self.assertNotEqual(r.returncode,0);self.assertIn('staged docs',r.stderr)
 def test_unstaged_content_docs_and_mode_do_not_override_staged_preview(self):
  self.edit();self.build(True);self.git('add','source','docs');(self.root/'source/message.txt').write_text('unstaged');(self.root/'docs/index.html').write_text('unstaged');self.mode('public-captured');r=self.hook();self.assertEqual(r.returncode,0,r.stderr)
 def test_public_staged_pair_uses_default_lane_despite_unstaged_preview(self):
  self.mode('public-captured');self.edit();self.build(False);self.git('add','source','docs');self.mode('local-preview');r=self.hook();self.assertEqual(r.returncode,0,r.stderr)
if __name__=='__main__':unittest.main(verbosity=2)
