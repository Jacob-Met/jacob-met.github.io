from pathlib import Path
from html.parser import HTMLParser
import importlib.util,json,math,re,unittest
B=Path(__file__).resolve().parent
import portfolio as m
f=json.loads((B/'project-figures.json').read_text())['figures']['worldlaw'];html=m.worldlaw_experiment(f);css=(B/'experience.css').read_text().split('/* A selected question on the existing WORLDLAW plot, not another dashboard. */',1)[1]
class P(HTMLParser):
 def __init__(self,h):super().__init__();self.nodes=[];self.labels={};self.label=None;self.feed(h)
 def handle_starttag(self,t,a):
  a=dict(a);self.nodes.append((t,a))
  if t=='label':self.label=a['for'];self.labels[self.label]=''
 def handle_endtag(self,t):
  if t=='label':self.label=None
 def handle_data(self,d):
  if self.label:self.labels[self.label]+=d
p=P(html)
class Probe(unittest.TestCase):
 def test_four_native_choices_and_exact_accessible_values(self):
  inputs=[a for t,a in p.nodes if t=='input'];self.assertEqual(len(inputs),4);self.assertEqual([a['value'] for a in inputs],['5','30','60','90']);self.assertEqual([a['value'] for a in inputs if 'checked' in a],['90'])
  for a in inputs:
   self.assertEqual(a['type'],'radio');self.assertEqual(a['name'],'worldlaw-angle');d=int(a['value']);r=math.radians(d);g=math.sin(r);label=p.labels[a['id']]
   self.assertIn(f'{d}°',label)
   for value in [r,g,r-g]:self.assertIn(f'{value:.4f}',label)
   self.assertIn('Normalized torque magnitude.',label)
 def test_current_exact_static_chart_remains(self):
  image=[a for t,a in p.nodes if t=='img'];source=[a for t,a in p.nodes if t=='source'];self.assertEqual(len(image),1);self.assertEqual(image[0]['src'],f['src']);self.assertEqual(image[0]['alt'],f['alt']);self.assertEqual(source[0]['srcset'],f['mobile']['src']);self.assertEqual(source[0]['media'],'(max-width: 800px)')
 def test_all_probe_coordinates_follow_same_curves(self):
  desktop=css.split('@media(max-width:800px)')[0];mobile=css.split('@media(max-width:800px){')[1].split('\n}')[0]
  for block,w,h,left,right,top,bottom in [(desktop,960,460,80,696,112,354),(mobile,600,620,72,538,190,478)]:
   for d in [5,30,60,90]:
    actual=re.search(r'\.worldlaw-probe-'+str(d)+r'\{left:([0-9.]+)%;--spring-y:([0-9.]+)%;--gravity-y:([0-9.]+)%\}',block)
    self.assertIsNotNone(actual);r=math.radians(d);want=[100*(left+(right-left)*d/90)/w,100*(bottom-(bottom-top)*r/1.8)/h,100*(bottom-(bottom-top)*math.sin(r)/1.8)/h]
    for a,b in zip(map(float,actual.groups()),want):self.assertLess(abs(a-b),0.00000051)
 def test_no_new_runtime_or_observation_claim(self):
  self.assertFalse(any(t in ['script','form','iframe','video'] for t,a in p.nodes));self.assertNotIn(':has',css);self.assertNotIn('animation:',css);self.assertIn('not measurements',html);self.assertIn('formulas use radians',html)
  for d in [5,30,60,90]:
   self.assertIn(f'#worldlaw-angle-{d}:checked~.worldlaw-stage .worldlaw-probe-{d}',css);self.assertIn(f'#worldlaw-angle-{d}:checked~.worldlaw-readings .worldlaw-reading-{d}',css)
 def test_keyboard_focus_and_noncolor_distinction(self):
  self.assertIn('.worldlaw-choice:focus-visible+label',css);self.assertIn('@media(forced-colors:active)',css);self.assertNotRegex(css,r'\.worldlaw-choice\s*\{[^}]*display\s*:\s*none');self.assertIn('.worldlaw-spring{',css);self.assertIn('.worldlaw-gravity{',css)
 def test_absent_optional_figure_keeps_existing_fallback(self):
  self.assertEqual(m.worldlaw_experiment(None),'')
if __name__=='__main__':unittest.main(verbosity=2)
