"""Real Chromium input and pixels. No game-state writes, CSP bypass, or fault hook."""
from pathlib import Path
import argparse, datetime, hashlib, io, json, os, subprocess, sys, time, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url')
parser.add_argument('--root',type=Path,help='Serve a local runtime-only folder on loopback')
parser.add_argument('--out',required=True,type=Path)
parser.add_argument('--native-gpu',action='store_true',help='Require a hardware WebGPU adapter, no software launch flags')
parser.add_argument('--chrome',help='Native installed Chrome executable')
args=parser.parse_args()
if bool(args.url)==bool(args.root): parser.error('Choose exactly one of --url and --root')
url=args.url; out=args.out; out.mkdir(parents=True,exist_ok=False)
server=None; thread=None
if args.root:
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(args.root.resolve())))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    url='http://127.0.0.1:'+str(server.server_port)+'/'

def state(page): return json.loads(page.locator('#stage').get_attribute('data-state'))
def until(page,expression,timeout=15000):
    deadline=time.monotonic()+timeout/1000
    while time.monotonic()<deadline:
        if page.evaluate('() => {const s=JSON.parse(document.querySelector("#stage").dataset.state);return '+expression+';}'):return
        page.wait_for_timeout(40)
    raise AssertionError({'timed_out':expression,'state':state(page)})
def ready(page):
    deadline=time.monotonic()+60
    while time.monotonic()<deadline:
        if page.locator('#stage').get_attribute('data-rendered')=='true':return
        page.wait_for_timeout(50)
    raise AssertionError('No real frame rendered: '+page.locator('#status').inner_text())
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=False if args.native_gpu else not bool(os.environ.get('DISPLAY')),executable_path=args.chrome,args=[] if args.native_gpu else ['--enable-unsafe-webgpu','--use-angle=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface'])
    gpu_info=browser.new_browser_cdp_session().send('SystemInfo.getInfo')['gpu']
    try:
        for mode,size in [('desktop',{'width':1280,'height':900}),('mobile',{'width':390,'height':844})]:
            context=browser.new_context(viewport=size,has_touch=mode=='mobile',device_scale_factor=1)
            page=context.new_page(); cdp=context.new_cdp_session(page); errors=[];responses=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            page.on('response',lambda r:responses.append({'url':r.url,'status':r.status,'mime':r.headers.get('content-type')}))
            try:
                page.goto(url,wait_until='networkidle',timeout=60000);ready(page)
                adapter_info=page.evaluate('async () => { const a=await navigator.gpu.requestAdapter(); return a ? {vendor:a.info.vendor,architecture:a.info.architecture,device:a.info.device,description:a.info.description,isFallbackAdapter:a.isFallbackAdapter ?? a.info.isFallbackAdapter} : null; }')
                assert adapter_info,'No actual WebGPU adapter'
                if args.native_gpu:
                    identity=json.dumps([adapter_info,gpu_info.get("devices")]).lower()
                    assert not any(s in identity for s in ['swiftshader','llvmpipe','software rasterizer']),identity
                    assert adapter_info.get('isFallbackAdapter') is not True,adapter_info
                    assert any(s in identity for s in ['apple','nvidia','intel','amd','radeon']),identity
                initial=state(page);until(page,'s.frame > '+str(initial['frame']+10))
                pixels=page.locator('#stage').screenshot();image=Image.open(io.BytesIO(pixels)).convert('RGB');variance=ImageStat.Stat(image).var
                assert max(variance)>50,variance
                page.keyboard.down('w');until(page,'s.position[2] > 0.25');page.keyboard.up('w');moved=state(page)
                page.keyboard.down('Space');until(page,'s.position[1] > 0.05');page.keyboard.up('Space');jump=state(page)
                page.keyboard.down('d');until(page,'Math.abs(s.heading) > 0.05');page.keyboard.up('d');turned=state(page)
                page.keyboard.press('r');until(page,'s.score === 0 && s.position[2] === 0 && s.heading === 0');reset=state(page)
                page.keyboard.down('w');until(page,'s.position[2] > 0.15')
                focus={'tested':False,'reason':'Native GPU exercise does not automate desktop focus'};frozen1=None;frozen2=None
                if not args.native_gpu:
                    cdp.send('Emulation.setFocusEmulationEnabled', {'enabled':False})
                    probe=subprocess.Popen(['xmessage','-title','S08 focus probe','-buttons','OK:0','Native focus boundary'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                    try:
                        window=subprocess.check_output(['xdotool','search','--sync','--name','^S08 focus probe$'],text=True,timeout=5).splitlines()[-1]
                        subprocess.run(['xdotool','windowfocus','--sync',window],check=True,timeout=5)
                        page.wait_for_timeout(300)
                        focus=cdp.send('Runtime.evaluate', {'expression':'({focused:document.hasFocus(),hidden:document.hidden})','returnByValue':True,'userGesture':False})['result']['value']
                        assert not focus['focused'] or focus['hidden'],('Browser did not actually lose focus',focus)
                        frozen1=state(page);page.wait_for_timeout(350);frozen2=state(page)
                        assert abs(frozen2['position'][2]-frozen1['position'][2])<0.08,(frozen1,frozen2)
                    finally:
                        probe.terminate();probe.wait(timeout=5)
                    page.keyboard.up('w');page.bring_to_front()
                    game_window=subprocess.check_output(['xdotool','search','--onlyvisible','--name','Aetherline'],text=True,timeout=5).splitlines()[-1]
                    subprocess.run(['xdotool','windowfocus','--sync',game_window],check=True,timeout=5)
                    assert abs(frozen2['position'][2]-frozen1['position'][2])<0.08,(frozen1,frozen2)
                page.get_by_role('button',name='Restart (R)',exact=True).click();until(page,'s.position[2] === 0 && s.score === 0')
                forward=page.get_by_role('button',name='Forward',exact=True);box=forward.bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down()
                until(page,'s.position[2] > 0.25');page.mouse.up();pointer=state(page)
                page.get_by_role('button',name='Restart (R)',exact=True).click();until(page,'s.position[2] === 0 && s.score === 0')
                page.keyboard.down('w');until(page,'s.score === 3',timeout=30000);page.keyboard.up('w');until(page,'s.won === true',timeout=15000);victory=state(page)
                assert 'Victory!' in page.locator('#hud').inner_text()
                page.screenshot(path=str(out/(mode+'.png')),full_page=True)
                page.get_by_role('button',name='Restart (R)',exact=True).click();until(page,'s.score === 0 && !s.won')
                box=forward.bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();until(page,'s.score === 3',30000);page.mouse.up();until(page,'s.won',15000)
                pointer_victory=state(page)
                touch_victory=None
                if mode=='mobile':
                    page.get_by_role('button',name='Restart (R)',exact=True).click();until(page,'s.score === 0 && !s.won')
                    box=forward.bounding_box()
                    cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':1}]})
                    try:
                        until(page,'s.score === 3',30000);until(page,'s.won',15000);touch_victory=state(page)
                    finally:cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
                assert not errors,errors
                assert not page.evaluate('() => document.documentElement.scrollWidth > window.innerWidth'),'horizontal overflow'
                results.append({'mode':mode,'viewport':size,'initial':initial,'movement':moved,'jump':jump,'turn':turned,'keyboard_reset':reset,'actual_focus_loss':focus,'focus_release':[frozen1,frozen2],'pointer_movement':pointer,'keyboard_victory':victory,'pointer_victory':pointer_victory,'touch_victory':touch_victory,'pixel_variance':variance,'backend':page.locator('#stage').get_attribute('data-backend'),'adapter':page.locator('#stage').get_attribute('data-adapter'),'device_type':page.locator('#stage').get_attribute('data-device-type'),'webgpu_adapter':adapter_info,'runtime_errors':errors,'responses':responses,'screenshot_sha256':hashlib.sha256((out/(mode+'.png')).read_bytes()).hexdigest()})
            except Exception as exc:
                (out/'failure.json').write_text(json.dumps({'error':str(exc),'webgpu_adapter':adapter_info,'runtime_errors':errors,'responses':responses,'status':page.locator('#status').inner_text(),'state':page.locator('#stage').get_attribute('data-state')},indent=2)+'\n')
                page.screenshot(path=str(out/'failure.png'),full_page=True)
                raise
            finally:context.close()
    finally:
        browser.close()
        if server:
            server.shutdown();server.server_close();thread.join(timeout=5)
receipt={'schema':'s08.browser-runtime.v1','verified_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':url,'browser':'Native Chrome headed' if args.native_gpu else ('Chromium Playwright under Xvfb' if os.environ.get('DISPLAY') else 'Chromium Playwright headless'),'gpu':'hardware WebGPU required' if args.native_gpu else 'software WebGPU SwiftShader','gpu_info':gpu_info,'physical_desktop_gpu_test':args.native_gpu,'physical_phone_test':False,'passed':True,'tests':results}
(out/'evidence.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
