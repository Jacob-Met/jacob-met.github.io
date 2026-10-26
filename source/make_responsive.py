#!/usr/bin/env python3
"""Regenerate the AVIF/WebP delivery derivatives declared in responsive-images.json.

Optional maintenance tool (needs Pillow with AVIF support). The builder never runs it:
it only copies the checked-in derivatives and verifies their recorded hashes.
Each derivative is a resize or crop of an already-published original; no new imagery.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
OUT = 'assets/derived'
# key: (original, crop box or None, [(width, formats)], fallback for <img>)
PLAN = {
    'lanternwake-island': ('games/lanternwake/desktop.png', (270, 255, 1030, 715), [(760, ('avif', 'webp')), (380, ('avif', 'webp'))]),
    'hamon-engine-study': ('assets/scene/hamon-engine-study.webp', None, [(1280, ('avif',)), (640, ('avif', 'webp'))]),
    'wildside-hero': ('assets/wildside/wildside-hero.webp', None, [(1600, ('avif',)), (800, ('avif',))]),
    'captionverse-desktop': ('assets/demos/captionverse-reading-desktop.png', None, [(1440, ('avif', 'webp'))]),
    'captionverse-phone': ('assets/demos/captionverse-reading-phone.png', None, [(390, ('avif', 'webp'))]),
}
QUALITY = {'avif': 58, 'webp': 82}


def main() -> None:
    manifest = {'schema': 1, 'images': {}}
    (ROOT / OUT).mkdir(parents=True, exist_ok=True)
    for key, (original, crop, widths) in PLAN.items():
        image = Image.open(ROOT / original).convert('RGB')
        if crop:
            image = image.crop(crop)
        variants = []
        for width, formats in widths:
            height = round(image.height * width / image.width)
            sized = image if width == image.width else image.resize((width, height), Image.LANCZOS)
            for fmt in formats:
                rel = f'{OUT}/{key}-{width}.{fmt}'
                options = {'quality': QUALITY[fmt]}
                if fmt == 'avif': options['speed'] = 4
                if fmt == 'webp': options['method'] = 6
                sized.save(ROOT / rel, fmt.upper(), **options)
                raw = (ROOT / rel).read_bytes()
                variants.append({'src': rel, 'type': f'image/{fmt}', 'width': width, 'height': height,
                                 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
        manifest['images'][key] = {'original': original, 'crop': list(crop) if crop else None, 'variants': variants}
    (ROOT / 'responsive-images.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    for key, record in manifest['images'].items():
        print(key, [(v['src'].rsplit('/', 1)[1], v['bytes']) for v in record['variants']])


if __name__ == '__main__':
    main()
