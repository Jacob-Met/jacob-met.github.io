"""One explicit prerecorded native camera route, never a live-engine claim.

This policy is prepared independently of the renderer. Production loading rejects
private studies by default. It does not authorize scripts or widen other media.
"""
import hashlib
import json
import math
import re
import struct
from pathlib import Path

MANIFEST = 'lobby-manifest.json'
MEDIA={'entrance': 'assets/scene/forge-hifi-lobby-entrance.png', 'arrival': 'assets/scene/forge-hifi-engine-arrival.png', 'forward': 'assets/scene/forge-hifi-engine-forward.mp4', 'reverse': 'assets/scene/forge-hifi-engine-reverse.mp4'}
# Preserve the previous live URLs; new selected filenames avoid stale-clip caches.
RETAINED_ENGINE_MEDIA={'assets/scene/forge-engine-arrival.png': '18c5c569ef7207859d59c72320faac8445c1fe3afda45d7b87204a02de15b7ec', 'assets/scene/forge-engine-forward.mp4': '0c766fa5813f64ee9406ba26495aa056b8860e09dfcec64cfc8231a2a8817ca4', 'assets/scene/forge-engine-reverse.mp4': '092d64364e9ed8cba81025b5996055e9cfb8961cde912af212e6cf72cd62aa15', 'assets/scene/forge-workbench.png': '262459031987b79002205b2c9cadb2e5d2b7447b1cf5964384700e61a96c00d1', 'assets/scene/forge-lobby-entrance.png': 'e85274967a5e89dace34f1e008f37e12c1e043b72c05aa2c8515e6bf4c1a0818', 'assets/scene/forge-engine-wide-arrival.png': '999e219bd6339ce2f042dc2a174f11b58d07aa50a95d5ad9977ac8ee3b54c937', 'assets/scene/forge-engine-wide-forward.mp4': 'da905c2803187f8a1c90640efa95b6cc50a118e23f59dd454c59a9ac4811be2e', 'assets/scene/forge-engine-wide-reverse.mp4': 'fe6e4485565801ef6abe40f1b8576c964801d519e4df07665958450f3c5e63dd', 'assets/scene/forge-engine-wide-proof.png': 'eac784ac5a4fbe216abd35ff7e54fe620503f24dc2a6adfee6d4daed4c31acea', 'assets/scene/forge-warm-lobby-entrance.png': 'abf0b8efedf6391185af21d71fad774eba32b277f30af295bd6f53f13780e475', 'assets/scene/forge-warm-engine-arrival.png': '3c05c5cae6c242cad165de1ed166f27e6608a016e676dd2bbfd2180167c92492', 'assets/scene/forge-warm-engine-forward.mp4': '21fd1e60e08a269ec06613cb4e7b0b63b2286febff82577fe8fb4c824599172f', 'assets/scene/forge-warm-engine-reverse.mp4': '28c2b6bdb71c39d8ee7a1ea3296675e7220277ac560a93e63fa261fbb605605b', 'assets/scene/forge-warm-workbench.png': 'ea6026a6500226268c132c12775f5ce65f313aeb51c228b2e5ae2a2b59dec981', 'assets/scene/forge-tools-lobby-entrance.png': 'ada8aec066d8fa816e58001ebb9b31c186c52cf2e02a80d220a15e72f70d5f33', 'assets/scene/forge-tools-engine-arrival.png': 'aa45d0aaa579b9f0c821f4d821e084f593d410dfaf8552a2c85b3c290ad41638', 'assets/scene/forge-tools-engine-forward.mp4': 'e503c0c4da3dbb08dd74b58916f84bbd75f2894e8c1d161c6a6eee2de9299607', 'assets/scene/forge-tools-engine-reverse.mp4': 'ba2ce391ac36aa3446a6c0c4c6d637812b4c44a23187824e44631a78ad14a888', 'assets/scene/forge-tools-workbench.png': '148b8ff6254a4260f1fb8dd53d263811fa30b31e00625f5e0925f77ddc73d3df', 'assets/scene/forge-crafted-lobby-entrance.png': 'e1975996c68039ce9d8e395ff6d42e478502f51298ef48cc9bf0c97a1d7822b8', 'assets/scene/forge-crafted-engine-arrival.png': 'e2f6fc019b20ea03a7dfe01c4712249569dbf9a17e419d40d260d5af073b35a5', 'assets/scene/forge-crafted-engine-forward.mp4': '8b353e383780cb54e6cf727f64f175cafdb446246efd895f8e0754261bbfae56', 'assets/scene/forge-crafted-engine-reverse.mp4': '546646badd7a2c2b551b3e373c9bd778874386b9339d874dfbe0e0b3014eceab', 'assets/scene/forge-crafted-workbench.png': 'e2f6fc019b20ea03a7dfe01c4712249569dbf9a17e419d40d260d5af073b35a5'}
SHA = re.compile(r'[a-f0-9]{64}\Z')


def exact(value, fields):
    if not isinstance(value, dict) or set(value) != set(fields):
        raise ValueError('Unexpected recorded-route fields')


def boxes(raw, start=0, end=None):
    """Bounded ISO-BMFF box walk; reject truncation and zero-size ambiguity."""
    end = len(raw) if end is None else end
    while start < end:
        if end - start < 8:
            raise ValueError('Truncated media box')
        size, kind = struct.unpack_from('>I4s', raw, start)
        header = 8
        if size == 1:
            if end - start < 16:
                raise ValueError('Truncated extended media box')
            size = struct.unpack_from('>Q', raw, start + 8)[0]
            header = 16
        if size < header or size > end - start:
            raise ValueError('Invalid media box extent')
        yield kind, start + header, start + size
        start += size


def one(raw, parent, kind):
    found = [(a, b) for k, a, b in boxes(raw, *parent) if k == kind]
    if len(found) != 1:
        raise ValueError('Missing or duplicate required media box')
    return found[0]


def recorded_video(raw, fps=20):
    """Inspect the actual single-video-track duration, sample count and size.

    Decoded frame-to-native comparison remains separate receiving evidence;
    these checks prevent a manifest from merely asserting the media geometry.
    """
    root = (0, len(raw))
    one(raw, root, b'ftyp')
    one(raw, root, b'mdat')
    moov = one(raw, root, b'moov')
    tracks = [(a, b) for k, a, b in boxes(raw, *moov) if k == b'trak']
    if len(tracks) != 1:
        raise ValueError('Route must contain exactly one video track and no audio')
    mdia = one(raw, tracks[0], b'mdia')
    a, b = one(raw, mdia, b'hdlr')
    if b - a < 12 or raw[a + 8:a + 12] != b'vide':
        raise ValueError('Route track is not video')
    a, b = one(raw, mdia, b'mdhd')
    if b - a < 20 or raw[a] != 0:
        raise ValueError('Unexpected route media timing header')
    timescale, duration = struct.unpack_from('>II', raw, a + 12)
    if timescale == 0:
        raise ValueError('Zero media timescale')
    table = one(raw, one(raw, mdia, b'minf'), b'stbl')
    a, b = one(raw, table, b'stsd')
    if b - a < 8 or struct.unpack_from('>I', raw, a + 4)[0] != 1:
        raise ValueError('Unexpected route sample descriptions')
    samples = list(boxes(raw, a + 8, b))
    if len(samples) != 1 or samples[0][0] != b'avc1':
        raise ValueError('Route must use the reviewed AVC video format')
    _, a, b = samples[0]
    if b - a < 28:
        raise ValueError('Truncated visual sample')
    width, height = struct.unpack_from('>HH', raw, a + 24)
    a, b = one(raw, table, b'stsz')
    if b - a < 12:
        raise ValueError('Truncated sample sizes')
    sample_size, frames = struct.unpack_from('>II', raw, a + 4)
    if b - a != 12 + (4 * frames if sample_size == 0 else 0):
        raise ValueError('Invalid sample-size table')
    a, b = one(raw, table, b'stts')
    if b - a < 8:
        raise ValueError('Truncated sample timing')
    count = struct.unpack_from('>I', raw, a + 4)[0]
    if count < 1 or count > 120 or b - a != 8 + count * 8:
        raise ValueError('Invalid timing table')
    entries = [struct.unpack_from('>II', raw, a + 8 + i * 8) for i in range(count)]
    if sum(n for n, _ in entries) != frames or sum(n * dt for n, dt in entries) != duration:
        raise ValueError('Inconsistent sample timing')
    if any(n == 0 or dt == 0 or dt * fps != timescale for n, dt in entries):
        raise ValueError(f'Route is not constant {fps} fps')
    return width, height, frames, duration / timescale


def webp_dimensions(raw):
    """Pixel size of a single-image WebP (VP8, VP8L or VP8X); rejects anything else."""
    if len(raw) < 30 or raw[:4] != b'RIFF' or raw[8:12] != b'WEBP' or struct.unpack_from('<I', raw, 4)[0] != len(raw) - 8:
        raise ValueError('Not a WebP still')
    kind = raw[12:16]
    if kind == b'VP8 ':
        w, h = struct.unpack_from('<HH', raw, 26)
        return w & 0x3fff, h & 0x3fff
    if kind == b'VP8L':
        bits = int.from_bytes(raw[21:25], 'little')
        return (bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1
    if kind == b'VP8X':
        if raw[20] & 0x02:
            raise ValueError('Animated WebP is not a still')
        return int.from_bytes(raw[24:27], 'little') + 1, int.from_bytes(raw[27:30], 'little') + 1
    raise ValueError('Unknown WebP chunk')


def read_media(root, record, name):
    exact(record, {'src', 'sha256'})
    if record['src'] != name or not isinstance(record['sha256'], str) or not SHA.fullmatch(record['sha256']):
        raise ValueError('Unapproved recorded-route resource')
    path = root / name
    if any(p.is_symlink() for p in (path, *path.parents) if p != root.parent):
        raise ValueError('Symlinked recorded-route resource')
    if not path.is_file() or not path.resolve().is_relative_to(root.resolve()) or not 1 <= path.stat().st_size <= 12_000_000:
        raise ValueError('Missing or oversized recorded-route resource')
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != record['sha256']:
        raise ValueError('Recorded-route resource checksum differs')
    return raw


def validate_retained_engine_media(root):
    for name,digest in RETAINED_ENGINE_MEDIA.items():
        read_media(Path(root), {'src':name,'sha256':digest}, name)


def load_lobby(root, *, allow_private_preview=False):
    root = Path(root)
    path = root / MANIFEST
    if not path.is_file() or path.is_symlink() or path.stat().st_size > 10_000:
        raise ValueError('Missing recorded-route manifest')
    data = json.loads(path.read_text())
    exact(data, {'schema', 'visibility', 'route', 'media', 'provenance', 'proof'})
    permitted = {'public-captured'} | ({'local-preview'} if allow_private_preview else set())
    if type(data['schema']) is not int or data['schema'] != 1 or not isinstance(data['visibility'], str) or data['visibility'] not in permitted:
        raise ValueError('Recorded route lacks explicit publication projection')
    route = data['route']
    dimensions = (route.get('width'), route.get('height')) if isinstance(route, dict) else ()
    if dimensions not in ((800, 500), (640, 400), (1280, 800), (1920, 1200)):
        raise ValueError('Unreviewed recorded-route dimensions')
    # 1920x1200 high-fidelity captures play at 24 fps (96 frames); earlier ones at 20 fps (80).
    frames, fps, span = (96, 24, 3.958) if dimensions == (1920, 1200) else (80, 20, 3.95)
    expected = {'id': 'engine', 'mode': 'recorded-native', 'width': dimensions[0], 'height': dimensions[1],
                'frames': frames, 'playbackFps': fps, 'containerSeconds': 4, 'frameSpanSeconds': span}
    if route != expected or any(type(route.get(k)) is bool for k in expected):
        raise ValueError('Unexpected recorded-route contract')
    exact(data['media'], MEDIA)
    for key, name in MEDIA.items():
        raw = read_media(root, data['media'][key], name)
        if key in ('entrance', 'arrival'):
            if len(raw) < 33 or raw[:8] != b'\x89PNG\r\n\x1a\n' or raw[12:16] != b'IHDR' or struct.unpack_from('>II', raw, 16) != dimensions:
                raise ValueError('Route endpoint dimensions differ')
        elif recorded_video(raw, fps) != (*dimensions, frames, 4.0):
            raise ValueError('Actual route video differs from reviewed contract')
    proof = data['proof']
    exact(proof, {'src', 'sha256', 'width', 'height', 'alt', 'label'})
    if (proof['width'], proof['height']) != dimensions or any(type(proof[k]) is not int for k in ('width', 'height')):
        raise ValueError('Workbench proof must match route dimensions')
    for key in ('alt', 'label'):
        if not isinstance(proof[key], str) or not 1 <= len(proof[key]) <= 400 or any(c in proof[key] for c in '<>\x00'):
            raise ValueError('Invalid workbench proof text')
    raw = read_media(root, {k: proof[k] for k in ('src', 'sha256')}, 'assets/scene/forge-hifi-workbench.png')
    if len(raw) < 33 or raw[:8] != b'\x89PNG\r\n\x1a\n' or raw[12:16] != b'IHDR' or struct.unpack_from('>II', raw, 16) != dimensions:
        raise ValueError('Workbench proof must match route dimensions')
    p = data['provenance']
    exact(p, {'cameraSequenceSha256', 'nativeReceiptSha256', 'nativeJobSeconds'})
    if any(not isinstance(p[k], str) or not SHA.fullmatch(p[k]) for k in ('cameraSequenceSha256', 'nativeReceiptSha256')):
        raise ValueError('Invalid recorded-route provenance hash')
    seconds = p['nativeJobSeconds']
    if type(seconds) not in (int, float) or not math.isfinite(seconds) or not 1 <= seconds <= 3600:
        raise ValueError('Invalid native capture duration')
    return data


def lobby_files(data):
    return {MANIFEST, *(r['src'] for r in data['media'].values()), data['proof']['src'], *RETAINED_ENGINE_MEDIA}


def route_video_errors(attrs, data):
    allowed = {'id': ('route-forward', 'route-reverse'), 'muted': (None, ''),
               'playsinline': (None, ''), 'preload': ('none',), 'hidden': (None, '')}
    return [] if set(attrs) == set(allowed) and all(attrs[k] in v for k, v in allowed.items()) else ['video: outside exact click-driven recorded route']


def route_source_errors(attrs, data):
    return [] if set(attrs) == {'src', 'type'} and attrs['type'] == 'video/mp4' and attrs['src'] in {data['media'][k]['src'] for k in ('forward', 'reverse')} else ['source: outside exact declared route videos']
