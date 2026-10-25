"""Exact controls-only native animation illustration; not an executable demo."""
import hashlib, struct
from lobby_policy import boxes, one

VIDEO = 'assets/scene/engine-follow-through.mp4'
POSTER = 'assets/scene/engine-follow-through.png'
FILES = (VIDEO, POSTER)
WIDTH, HEIGHT = 960, 386
HASHES = {
    VIDEO: '0f3a1eac90be4bcd82e2893a25a475a327eeeb791c8f79aacdb023bbb9ab555f',
    POSTER: 'e8a96e9441ead8fb29d8b2b3d73a184dfa3e5d25a92eba6d55952cf95c11d88b',
}
VIDEO_ID = 'engine-follow-through'
VIDEO_ATTRIBUTES = {'id': VIDEO_ID, 'controls': None, 'playsinline': None,
    'preload': 'none', 'width': str(WIDTH), 'height': str(HEIGHT), 'poster': POSTER,
    'aria-label': 'Recorded native HAMON Engine comparison: left without follow-through, right with authored lag and settling.'}
SOURCE_ATTRIBUTES = {'src': VIDEO, 'type': 'video/mp4'}

def video_errors(attrs):
    return [] if attrs == VIDEO_ATTRIBUTES else ['video: outside exact manually played animation study']

def source_errors(attrs):
    return [] if attrs == SOURCE_ATTRIBUTES else ['source: outside exact native animation study']

def validate_motion(root):
    received = {}
    for name in FILES:
        p = root / name
        if not p.is_file() or p.is_symlink() or not p.resolve().is_relative_to(root.resolve()):
            raise ValueError('Missing or unsafe native animation study')
        raw = p.read_bytes()
        if not 32 <= len(raw) <= 200000 or hashlib.sha256(raw).hexdigest() != HASHES[name]:
            raise ValueError('Native animation study checksum differs')
        received[name] = raw
    raw = received[POSTER]
    if raw[:8] != b'\x89PNG\r\n\x1a\n' or raw[12:16] != b'IHDR' or struct.unpack_from('>II', raw, 16) != (WIDTH, HEIGHT):
        raise ValueError('Native animation poster dimensions differ')
    raw = received[VIDEO]
    top = (0, len(raw)); one(raw, top, b'ftyp'); one(raw, top, b'mdat')
    moov = one(raw, top, b'moov')
    tracks = [(a,b) for kind,a,b in boxes(raw,*moov) if kind == b'trak']
    if len(tracks) != 1: raise ValueError('Animation study must have one video track and no audio')
    mdia = one(raw, tracks[0], b'mdia'); a,b = one(raw, mdia, b'hdlr')
    if raw[a+8:a+12] != b'vide': raise ValueError('Animation study is not a video track')
    a,b = one(raw, mdia, b'mdhd')
    if raw[a] != 0 or struct.unpack_from('>II', raw, a+12) != (1000,3000):
        raise ValueError('Animation study must retain its exact three-second timing')
    table = one(raw, one(raw, mdia, b'minf'), b'stbl')
    a,b = one(raw, table, b'stsd'); samples = list(boxes(raw,a+8,b))
    if len(samples) != 1 or samples[0][0] != b'avc1': raise ValueError('Animation study codec differs')
    _,a,b = samples[0]
    if struct.unpack_from('>HH', raw, a+24) != (WIDTH,HEIGHT): raise ValueError('Animation study dimensions differ')
    a,b = one(raw, table, b'stsz')
    if struct.unpack_from('>I', raw, a+8)[0] != 72: raise ValueError('Animation study frame count differs')
    a,b = one(raw, table, b'stts'); count = struct.unpack_from('>I', raw, a+4)[0]
    if b-a != 8+count*8: raise ValueError('Animation study timing table differs')
    durations = []
    for i in range(count):
        n,dt = struct.unpack_from('>II', raw, a+8+i*8)
        if not 1 <= n <= 72: raise ValueError('Animation study sample run differs')
        durations.extend([dt]*n)
    if durations != [40,40,40,40,40,50]*12:
        raise ValueError('Animation study must preserve every original frame duration')
