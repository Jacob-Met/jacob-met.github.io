#!/usr/bin/env python3
"""Regenerate the raster share card and icons in source/assets/ (W-10).

Not part of the CI build: build.py only copies the committed PNG/ICO files, so the
site still builds with the standard library alone. Run this by hand (needs Pillow and
a serif TTF, e.g. Debian's fonts-liberation) when the mark or card copy changes, then
rebuild and commit the results. Colours and the "JM" monogram follow assets/mark.svg.
"""
from __future__ import annotations
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
GREEN, PAPER, ACCENT, SOFT = '#183c31', '#f6f3eb', '#955235', '#b9c6bd'
SERIF_CANDIDATES = [
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
    'C:/Windows/Fonts/georgia.ttf',
    '/System/Library/Fonts/Supplemental/Georgia.ttf',
]
SANS_CANDIDATES = [
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    'C:/Windows/Fonts/segoeui.ttf',
]


def font(candidates: list[str], size: int) -> ImageFont.FreeTypeFont:
    for c in candidates:
        if Path(c).is_file():
            return ImageFont.truetype(c, size)
    raise SystemExit(f'No usable font among {candidates}')


def monogram(size: int, radius_ratio: float = 8 / 64) -> Image.Image:
    """Raster version of assets/mark.svg, drawn at 4x and downsampled for clean edges."""
    s = size * 4
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=round(s * radius_ratio), fill=GREEN)
    f = font(SERIF_CANDIDATES, round(s * 33 / 64))
    # SVG places the baseline at y=44/64 with the text centred horizontally.
    d.text((s / 2, s * 44 / 64), 'JM', font=f, fill=PAPER, anchor='ms')
    return img.resize((size, size), Image.Resampling.LANCZOS)


def share_card() -> Image.Image:
    w, h = 1200, 630
    img = Image.new('RGB', (w, h), GREEN)
    d = ImageDraw.Draw(img)
    pad = 88
    d.rectangle((pad, pad, pad + 64, pad + 6), fill=ACCENT)
    d.text((pad, 150), 'RESEARCH / SOFTWARE', font=font(SANS_CANDIDATES, 28), fill=SOFT)
    d.text((pad, 205), 'Jacob Metoyer', font=font(SERIF_CANDIDATES, 112), fill=PAPER)
    body = font(SANS_CANDIDATES, 34)
    d.text((pad, 360), 'Undergraduate researcher, Cal State Long Beach.', font=body, fill=PAPER)
    d.text((pad, 408), 'Computer science and physics. Research data and research software.', font=body, fill=PAPER)
    d.line((pad, h - pad - 40, w - pad, h - pad - 40), fill='#2f5a4b', width=2)
    d.text((pad, h - pad), 'jacobmetoyer.com', font=font(SANS_CANDIDATES, 30), fill=SOFT, anchor='ls')
    mark = monogram(120, radius_ratio=0.14)
    # Paper-coloured frame so the mark reads against the same green background.
    frame = Image.new('RGBA', (132, 132), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle((0, 0, 131, 131), radius=20, fill=PAPER)
    frame.alpha_composite(mark, (6, 6))
    img.paste(frame, (w - pad - 132, pad), frame)
    return img


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--out', type=Path, default=ROOT / 'assets')
    out = p.parse_args().out
    out.mkdir(parents=True, exist_ok=True)
    share_card().save(out / 'og-card.png', optimize=True)
    # iOS applies its own corner mask, so the touch icon is a full-bleed square.
    monogram(180, radius_ratio=0).convert('RGB').save(out / 'apple-touch-icon.png', optimize=True)
    monogram(48).save(out / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    for name in ('og-card.png', 'apple-touch-icon.png', 'favicon.ico'):
        print(name, (out / name).stat().st_size, 'bytes')


if __name__ == '__main__':
    main()
