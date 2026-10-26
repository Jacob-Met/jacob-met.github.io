"""Narrow route-media validator tests; fixtures are metadata, not render proof."""
import copy
import hashlib
import json
from pathlib import Path
import struct
import tempfile
import unittest

from lobby_policy import MEDIA, load_lobby, recorded_video


def box(kind, data):
    return struct.pack('>I4s', len(data) + 8, kind) + data


def video(*, width=800, height=500, frames=80, fps=20, audio=False):
    sample = bytearray(78)
    struct.pack_into('>HH', sample, 24, width, height)
    stsd = box(b'stsd', b'\0' * 4 + struct.pack('>I', 1) + box(b'avc1', sample))
    stsz = box(b'stsz', b'\0' * 4 + struct.pack('>II', 1, frames))
    stts = box(b'stts', b'\0' * 4 + struct.pack('>III', 1, frames, 100))
    mdhd = box(b'mdhd', b'\0' * 12 + struct.pack('>II', fps * 100, frames * 100))
    hdlr = box(b'hdlr', b'\0' * 8 + (b'soun' if audio else b'vide'))
    return box(b'ftyp', b'isom') + box(b'mdat', bytes(frames)) + box(b'moov', box(b'trak', box(b'mdia', mdhd + hdlr + box(b'minf', box(b'stbl', stsd + stsz + stts)))))


class LobbyPolicy(unittest.TestCase):
    def fixture(self, root):
        png = b'\x89PNG\r\n\x1a\n' + struct.pack('>I4sII', 13, b'IHDR', 800, 500) + b'\0' * 9
        data = {'schema': 1, 'visibility': 'public-captured', 'route': {
            'id': 'engine', 'mode': 'recorded-native', 'width': 800, 'height': 500,
            'frames': 80, 'playbackFps': 20, 'containerSeconds': 4, 'frameSpanSeconds': 3.95},
            'media': {}, 'provenance': {'cameraSequenceSha256': 'a' * 64,
            'nativeReceiptSha256': 'b' * 64, 'nativeJobSeconds': 90.98}}
        for key, name in MEDIA.items():
            raw = png if key in ('entrance', 'arrival') else video()
            p = root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(raw)
            data['media'][key] = {'src': name, 'sha256': hashlib.sha256(raw).hexdigest()}
        name = 'assets/scene/forge-hifi-workbench.png'
        (root / name).write_bytes(png)
        data['proof'] = {'src': name, 'sha256': hashlib.sha256(png).hexdigest(),
                         'width': 800, 'height': 500, 'alt': 'Native rendered workbench.',
                         'label': 'Native HAMON Engine render'}
        return data

    def write(self, root, data):
        (root / 'lobby-manifest.json').write_text(json.dumps(data))

    def test_exact_recorded_track_contract(self):
        self.assertEqual(recorded_video(video()), (800, 500, 80, 4.0))

    def test_malformed_or_nonvideo_tracks_rejected(self):
        for raw in (b'', video()[:-1], video(audio=True), video(fps=25),
                    b'\0' * 8 + video(), video() + b'truncated'):
            with self.subTest(length=len(raw)), self.assertRaises(ValueError):
                recorded_video(raw)

    def test_manifest_checks_actual_bytes_not_only_declared_dimensions(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = self.fixture(root)
            self.write(root, data)
            self.assertEqual(load_lobby(root), data)
            for raw in (video(width=640), video(frames=60)):
                (root / MEDIA['forward']).write_bytes(raw)
                data['media']['forward']['sha256'] = hashlib.sha256(raw).hexdigest()
                self.write(root, data)
                with self.assertRaises(ValueError):
                    load_lobby(root)

    def test_private_preview_is_explicit_and_never_default_publishable(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = self.fixture(root)
            data['visibility'] = 'local-preview'
            self.write(root, data)
            with self.assertRaises(ValueError):
                load_lobby(root)
            self.assertEqual(load_lobby(root, allow_private_preview=True), data)

    def test_640_route_requires_all_endpoints_and_both_clips_to_match(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = self.fixture(root)
            data['route'].update(width=640, height=400)
            for key, name in MEDIA.items():
                raw = (b'\x89PNG\r\n\x1a\n' + struct.pack('>I4sII', 13, b'IHDR', 640, 400) + b'\0' * 9
                       if key in ('entrance', 'arrival') else video(width=640, height=400))
                (root / name).write_bytes(raw)
                data['media'][key]['sha256'] = hashlib.sha256(raw).hexdigest()
            raw = (root / MEDIA['entrance']).read_bytes()
            (root / data['proof']['src']).write_bytes(raw)
            data['proof'].update(width=640, height=400, sha256=hashlib.sha256(raw).hexdigest())
            self.write(root, data)
            self.assertEqual(load_lobby(root), data)
            raw = video()
            (root / MEDIA['reverse']).write_bytes(raw)
            data['media']['reverse']['sha256'] = hashlib.sha256(raw).hexdigest()
            self.write(root, data)
            with self.assertRaises(ValueError):
                load_lobby(root)

    def test_unreviewed_fields_routes_capabilities_and_paths_rejected(self):
        mutations = [lambda d: d.update(sceneText='private'), lambda d: d.update(schema=True),
                     lambda d: d.update(visibility='private'), lambda d: d['route'].update(mode='live'),
                     lambda d: d['route'].update(id='other'), lambda d: d['route'].update(frameSpanSeconds=4),
                     lambda d: d['media']['forward'].update(src='https://example.com/x.mp4'),
                     lambda d: d['media']['arrival'].update(src='../private.png'),
                     lambda d: d['media']['reverse'].update(sha256='0' * 64),
                     lambda d: d['provenance'].update(privateSourceUrl='private'),
                     lambda d: d.pop('proof'), lambda d: d['proof'].update(width=640),
                     lambda d: d['proof'].update(alt='<script>'),
                     lambda d: d['provenance'].update(nativeJobSeconds=float('nan'))]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            base = self.fixture(root)
            for mutate in mutations:
                data = copy.deepcopy(base)
                mutate(data)
                self.write(root, data)
                with self.assertRaises(ValueError):
                    load_lobby(root)

    def test_symlink_media_rejected_even_inside_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = self.fixture(root)
            target = root / MEDIA['arrival']
            original = target.with_suffix('.original')
            target.rename(original)
            target.symlink_to(original)
            self.write(root, data)
            with self.assertRaises(ValueError):
                load_lobby(root)


if __name__ == '__main__':
    unittest.main()
