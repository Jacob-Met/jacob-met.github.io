#!/usr/bin/env python3
"""Regenerate identity-only metadata artwork and icons using local fonts.

Optional authoring dependency: Pillow. The site builder only copies committed
files and does not need Pillow or a network. Project captures are not generated.
"""
from __future__ import annotations
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PAPER, INK, MUTED = '#060c17', '#e3f3f8', '#92aebb'
SANS_CANDIDATES = [
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    'C:/Windows/Fonts/arial.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
]


def font(size: int) -> ImageFont.FreeTypeFont:
    for path in SANS_CANDIDATES:
        if Path(path).is_file():
            return ImageFont.truetype(path, size)
    raise SystemExit('A local sans-serif TTF font is required')


def monogram(size: int) -> Image.Image:
    scale = size * 4
    result = Image.new('RGB', (scale, scale), PAPER)
    draw = ImageDraw.Draw(result)
    draw.text((scale / 2, scale / 2), 'jm', fill=INK, font=font(round(scale * .6)), anchor='mm')
    return result.resize((size, size), Image.Resampling.LANCZOS)


def share_card() -> Image.Image:
    result = Image.new('RGB', (1200, 630), PAPER)
    draw = ImageDraw.Draw(result)
    draw.text((80, 100), 'Jacob Metoyer', font=font(106), fill=INK)
    draw.text((86, 284), 'Computer science + physics', font=font(34), fill=INK)
    draw.text((86, 337), 'Cal State Long Beach', font=font(29), fill=MUTED)
    draw.line((86, 476, 1114, 476), fill='#85e8f0', width=2)
    draw.text((86, 521), 'jacobmetoyer.com', font=font(25), fill=MUTED)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, default=ROOT / 'assets')
    out = parser.parse_args().out; out.mkdir(parents=True, exist_ok=True)
    share_card().save(out / 'og-card.png', optimize=True)
    monogram(180).save(out / 'apple-touch-icon.png', optimize=True)
    monogram(48).save(out / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    for name in ('og-card.png', 'apple-touch-icon.png', 'favicon.ico'):
        print(name, (out / name).stat().st_size)


if __name__ == '__main__':
    main()
