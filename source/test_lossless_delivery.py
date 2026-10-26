"""Exact delivery custody; RGBA equality was separately received with two decoders."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,json,shutil,subprocess,tempfile,unittest
import build
from site_policy import (PRESENTATION_STILLS,PRESENTATION_FILES,DELIVERY_STILLS,
                         LOSSLESS_ENTRANCE,LOSSLESS_ARRIVAL,lossless_webp_dimensions,validate_lossless_entrance)
ROOT=Path(__file__).parent
class Nodes(HTMLParser):
 def __init__(self,text):super().__init__();self.nodes=[];self.feed(text)
 def handle_starttag(self,tag,attrs):self.nodes.append((tag,dict(attrs)))
class LosslessDelivery(unittest.TestCase):
 def test_exact_opaque_lossless_bytes_and_dimensions(self):
  validate_lossless_entrance(ROOT)
  raw=(ROOT/LOSSLESS_ENTRANCE['src']).read_bytes()
  self.assertEqual(len(raw),355478);self.assertEqual(lossless_webp_dimensions(raw),(1280,800))
  self.assertEqual(LOSSLESS_ENTRANCE['rgbaSha256'],'b5f342474721a38466323abf8c4710ada8311b9079994a0d26a7554e3b8e3457')
 def test_arrival_rgba_identical_and_smaller_than_native_png(self):
  original=ROOT/PRESENTATION_STILLS['arrival']['src'];derivative=ROOT/LOSSLESS_ARRIVAL['src']
  self.assertEqual(hashlib.sha256(original.read_bytes()).hexdigest(),PRESENTATION_STILLS['arrival']['sha256'])
  self.assertEqual(hashlib.sha256(derivative.read_bytes()).hexdigest(),LOSSLESS_ARRIVAL['sha256'])
  self.assertEqual(lossless_webp_dimensions(derivative.read_bytes()),(1280,800))
  self.assertEqual(LOSSLESS_ARRIVAL['rgbaSha256'],'9a8a30db738a1e30d8df1fe9ac4dc6b6811c56b67587aca8d77cf096f9d4f21a')
  self.assertEqual(original.stat().st_size,693392)
  self.assertEqual(derivative.stat().st_size,432184)
  self.assertLess(derivative.stat().st_size,original.stat().st_size)
  self.assertIn(LOSSLESS_ARRIVAL['src'],PRESENTATION_FILES)
 def test_selected_native_png_and_previous_public_urls_remain_exact(self):
  source=PRESENTATION_STILLS['entrance'];raw=(ROOT/source['src']).read_bytes()
  self.assertEqual(source['src'],'assets/scene/forge-crafted-entrance-1280.png')
  self.assertEqual(hashlib.sha256(raw).hexdigest(),'e1975996c68039ce9d8e395ff6d42e478502f51298ef48cc9bf0c97a1d7822b8')
  self.assertIn(source['src'],PRESENTATION_FILES);self.assertIn(LOSSLESS_ENTRANCE['src'],PRESENTATION_FILES)
  self.assertEqual(len(raw)-len((ROOT/LOSSLESS_ENTRANCE['src']).read_bytes()),221561)
  for name,digest in [('forge-entrance-1280.png','5289a46ef28008084a794c3d85040fb577c927126cdf3b87720dba4ef3d077d2'),('forge-entrance-1280.webp','0e3c6614e72335640a8aa068902e0f8bf510bdbd1a74b7b7ff5c87347dcb21b8'),('forge-warm-entrance-1280.png','aa98b75fd837beb69d5c83dcaf20879ec7b228bab7d8c83bf569d1e5b928f5df'),('forge-warm-entrance-1280.webp','6902ff1655f997b5a80f009f00677158a7658fad03553e2b98e93918601f5f41')]:
   self.assertEqual(hashlib.sha256((ROOT/'assets/scene'/name).read_bytes()).hexdigest(),digest)
   self.assertIn('assets/scene/'+name,PRESENTATION_FILES)
 def test_only_lossless_delivery_derivatives_change(self):
  self.assertEqual(DELIVERY_STILLS['arrival'],LOSSLESS_ARRIVAL)
  self.assertEqual(set(DELIVERY_STILLS),set(PRESENTATION_STILLS))
  for key in DELIVERY_STILLS:
   self.assertEqual((DELIVERY_STILLS[key]['width'],DELIVERY_STILLS[key]['height']),(PRESENTATION_STILLS[key]['width'],PRESENTATION_STILLS[key]['height']))
 def test_initial_buffer_and_dynamic_return_use_same_derivative(self):
  markup=build.render_index(json.loads((ROOT/'content.json').read_text()))
  nodes=Nodes(markup).nodes;images={a.get('id'):a for t,a in nodes if t=='img' and a.get('id') in ('scene-still','scene-buffer')}
  self.assertEqual(set(images),{'scene-still','scene-buffer'})
  for a in images.values():self.assertEqual(a['src'],LOSSLESS_ENTRANCE['src']);self.assertNotIn('srcset',a)
  self.assertEqual(images['scene-still']['data-entrance-src'],LOSSLESS_ENTRANCE['src'])
  self.assertEqual(images['scene-still']['data-arrival-src'],LOSSLESS_ARRIVAL['src'])
  self.assertFalse(any(t=='source' and LOSSLESS_ENTRANCE['src'] in a.get('srcset','') for t,a in nodes))
 def test_metadata_animation_alpha_and_truncation_are_not_admitted(self):
  raw=(ROOT/LOSSLESS_ENTRANCE['src']).read_bytes()
  variants=[b'BAD!'+raw[4:],raw[:-1],raw+b'ICCP',raw[:12]+b'VP8X'+raw[16:],raw[:20]+b'\x00'+raw[21:]]
  for mask in [1<<28,1<<29]:
   value=int.from_bytes(raw[21:25],'little')|mask;variants.append(raw[:21]+value.to_bytes(4,'little')+raw[25:])
  for bad in variants:
   with self.subTest(prefix=bad[:25]):
    with self.assertRaises(ValueError):lossless_webp_dimensions(bad)
 def test_tampered_or_symlink_delivery_rejected(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);p=root/LOSSLESS_ENTRANCE['src'];p.parent.mkdir(parents=True);p.write_bytes((ROOT/LOSSLESS_ENTRANCE['src']).read_bytes()+b'x')
   with self.assertRaises(ValueError):validate_lossless_entrance(root)
   p.unlink();p.symlink_to(ROOT/LOSSLESS_ENTRANCE['src'])
   with self.assertRaises(ValueError):validate_lossless_entrance(root)
 def test_arrival_corruption_and_metadata_refused(self):
  from tempfile import TemporaryDirectory
  with TemporaryDirectory() as tmp:
   root=Path(tmp)
   for record in (LOSSLESS_ARRIVAL,LOSSLESS_ENTRANCE,*__import__('site_policy').RETAINED_LOSSLESS_ENTRANCES.values()):
    p=root/record['src'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((ROOT/record['src']).read_bytes())
   validate_lossless_entrance(root)
   p=root/LOSSLESS_ARRIVAL['src'];raw=p.read_bytes();p.write_bytes(raw[:-1])
   with self.assertRaises(ValueError):validate_lossless_entrance(root)
   p.write_bytes(raw[:12]+b'VP8X'+raw[16:])
   with self.assertRaises(ValueError):validate_lossless_entrance(root)
 def test_existing_async_adapter_contract_with_webp_entrance(self):
  # Same shipped runtime; only the test fixture's entrance URL changes.
  node=shutil.which('node');self.assertIsNotNone(node)
  contract=(ROOT/'lobby_image_contract.cjs').read_text();self.assertIn('forge-entrance.png',contract)
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp)/'lossless-entrance-contract.cjs';p.write_text(contract.replace('forge-entrance.png',LOSSLESS_ENTRANCE['src']))
   result=subprocess.run([node,str(p),str(ROOT)],text=True,capture_output=True)
   self.assertEqual(result.returncode,0,result.stdout+result.stderr);r=json.loads(result.stdout)
   self.assertEqual(r['failed'],0);self.assertEqual(r['passed'],16)
if __name__=='__main__':unittest.main(verbosity=2)
