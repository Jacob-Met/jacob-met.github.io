"""Two exact recorded native branch routes; never a live-renderer claim."""
import json
import math
import struct
from pathlib import Path
from lobby_policy import exact, read_media, recorded_video, SHA

MANIFEST = 'branch-routes.json'
BRANCHES = ('hackathons', 'projects')
DIRECTIONS = ('forward', 'reverse')


def load_branches(root, *, allow_private_preview=False):
    root = Path(root)
    path = root / MANIFEST
    if not path.exists():
        return {}
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 20000:
        raise ValueError('Invalid branch route manifest')
    data = json.loads(path.read_text())
    exact(data, {'schema', 'visibility', 'routes'})
    permitted = {'public-captured'} | ({'local-preview'} if allow_private_preview else set())
    if type(data['schema']) is not int or data['schema'] != 1 or data['visibility'] not in permitted:
        raise ValueError('Branch routes lack explicit publication projection')
    exact(data['routes'], BRANCHES)
    for key, route in data['routes'].items():
        exact(route, {'mode', 'width', 'height', 'frames', 'playbackFps', 'containerSeconds',
                      'label', 'location', 'media', 'still', 'provenance'})
        contract = {'mode':'recorded-native', 'width':640, 'height':400,
                    'frames':60, 'playbackFps':20, 'containerSeconds':3}
        if any(route[k] != v or type(route[k]) is bool for k,v in contract.items()):
            raise ValueError('Unreviewed branch route contract')
        for field in ('label','location'):
            if not isinstance(route[field],str) or not 1 <= len(route[field]) <= 100 or any(c in route[field] for c in '<>\x00'):
                raise ValueError('Invalid branch route label')
        exact(route['media'], {'forward','reverse','endpoint'})
        for kind, record in route['media'].items():
            ext = 'png' if kind == 'endpoint' else 'mp4'
            raw = read_media(root, record, f'assets/scene/forge-{key}-{kind}.{ext}')
            if kind == 'endpoint':
                if len(raw)<33 or raw[:8]!=b'\x89PNG\r\n\x1a\n' or raw[12:16]!=b'IHDR' or struct.unpack_from('>II',raw,16)!=(640,400):
                    raise ValueError('Branch endpoint dimensions differ')
            elif recorded_video(raw)!=(640,400,60,3.0):
                raise ValueError('Actual branch clip differs from contract')
        still=route['still'];exact(still, {'src','sha256','width','height','alt'})
        if any(type(still[k]) is not int for k in ('width','height')) or (still['width'],still['height'])!=(1280,800):
            raise ValueError('Unreviewed branch still dimensions')
        if not isinstance(still['alt'],str) or not 20<=len(still['alt'])<=400 or any(c in still['alt'] for c in '<>\x00'):
            raise ValueError('Invalid branch still description')
        raw=read_media(root,{k:still[k] for k in ('src','sha256')},f'assets/scene/forge-{key}-1280.png')
        if len(raw)<33 or raw[:8]!=b'\x89PNG\r\n\x1a\n' or raw[12:16]!=b'IHDR' or struct.unpack_from('>II',raw,16)!=(1280,800):
            raise ValueError('Branch still bytes differ from declared dimensions')
        provenance=route['provenance'];exact(provenance,{'cameraSequenceSha256','nativeReceiptSha256','nativeJobSeconds'})
        if any(not isinstance(provenance[k],str) or not SHA.fullmatch(provenance[k]) for k in ('cameraSequenceSha256','nativeReceiptSha256')):
            raise ValueError('Invalid branch route provenance')
        sec=provenance['nativeJobSeconds']
        if type(sec) not in (int,float) or not math.isfinite(sec) or not 1<=sec<=3600:
            raise ValueError('Invalid branch native capture duration')
    return data['routes']


def branch_files(routes):
    return ({MANIFEST} | {v['src'] for r in routes.values() for v in r['media'].values()}
            | {r['still']['src'] for r in routes.values()}) if routes else set()


def branch_video_errors(attrs, routes):
    route=attrs.get('data-route');direction=attrs.get('data-direction')
    expected={'id':f'route-{route}-{direction}','data-route':route,'data-direction':direction,
              'muted':None,'playsinline':None,'preload':'none','hidden':None}
    normalized={k:None if k in ('muted','playsinline','hidden') and v=='' else v for k,v in attrs.items()}
    return [] if route in routes and direction in DIRECTIONS and normalized==expected else ['video: outside declared native branch route']


def branch_source_errors(attrs, video_id, routes):
    for key, route in routes.items():
        for direction in DIRECTIONS:
            if video_id==f'route-{key}-{direction}':
                return [] if attrs=={'src':route['media'][direction]['src'],'type':'video/mp4'} else ['source: mismatched native branch clip']
    return ['source: unknown native branch route']
