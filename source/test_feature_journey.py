import copy,importlib.util,json,unittest
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).parent
import portfolio as module
class Links(HTMLParser):
 def __init__(self,text):super().__init__();self.links=[];self.current=None;self.feed(text)
 def handle_starttag(self,t,attrs):
  if t=='a':self.current={'attrs':dict(attrs),'text':''};self.links.append(self.current)
 def handle_data(self,text):
  if self.current is not None:self.current['text']+=text
 def handle_endtag(self,t):
  if t=='a':self.current=None
class Journey(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.data=json.loads((ROOT/'content.json').read_text());cls.recall=next(d for d in cls.data['demos'] if d['id']=='recallweave')
 def test_primary_action_reaches_the_illustrated_experiment(self):
  markup=module.public_demo(self.recall);links=Links(markup).links;primary=[a for a in links if a['attrs'].get('class')=='feature-action'];self.assertEqual(len(primary),1);self.assertEqual(primary[0]['attrs']['href'],'https://jacobmetoyer.com/RecallWeave/courses/feedback-control-lab.html');self.assertIn('Try the feedback experiment',primary[0]['text']);self.assertIn('A flat run can hide instability',markup)
 def test_toolkit_source_and_exact_captures_remain_available(self):
  links=Links(module.public_demo(self.recall)).links;urls=[a['attrs']['href'] for a in links];self.assertIn(self.recall['play']['url'],urls);self.assertIn(self.recall['repo'],urls)
  for shot in self.recall['shots'].values():self.assertIn(shot['src'],urls)
 def test_other_project_keeps_its_approved_primary_action(self):
  for d in self.data['demos']:
   if d['id']=='recallweave':continue
   a=next(a for a in Links(module.public_demo(d)).links if a['attrs'].get('class')=='feature-action');self.assertEqual(a['attrs']['href'],d['play']['url']);self.assertIn(d['play']['label'],a['text'])
 def test_directory_follows_approved_changed_record(self):
  d=copy.deepcopy(self.recall);d['play']['url']='https://jacobmetoyer.com/RecallWeave/explore.html#courses';self.assertIn(d['play']['url'],[a['attrs']['href'] for a in Links(module.public_demo(d)).links])
 def test_no_new_script_or_local_candidate_promotion(self):
  m=module.public_demo(self.recall);self.assertNotIn('<script',m);self.assertNotIn('localhost',m);self.assertNotIn('127.0.0.1',m);self.assertNotIn('recallweave-feedback-20261024',m)
 def test_data_markup_is_escaped(self):
  d=copy.deepcopy(self.recall);d['name']='Research <script> example';m=module.public_demo(d);self.assertIn('Research &lt;script&gt; example',m);self.assertNotIn('Research <script>',m)
if __name__=='__main__':unittest.main(verbosity=2)
