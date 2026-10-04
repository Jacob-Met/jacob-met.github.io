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
BLUE, PAPER, ACCENT, SOFT, INK, RULE = '#183be5', '#f5f5ef', '#b93819', '#595447', '#20252c', '#b7bac2'
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
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=round(s * radius_ratio), fill=BLUE)
    f = font(SERIF_CANDIDATES, round(s * 33 / 64))
    # SVG places the baseline at y=44/64 with the text centred horizontally.
    d.text((s / 2, s * 44 / 64), 'JM', font=f, fill=PAPER, anchor='ms')
    return img.resize((size, size), Image.Resampling.LANCZOS)


def share_card() -> Image.Image:
    """Share card repeats the approved tagline and the docket-spine motif."""
    w, h = 1200, 630
    img = Image.new('RGB', (w, h), PAPER)
    d = ImageDraw.Draw(img)
    rail = 190
    d.rectangle((0, 0, rail, h), fill=BLUE)
    d.line((rail - 3, 0, rail - 3, h), fill=ACCENT, width=6)
    # Perforations echo the docket spine used by the page layout.
    for y in range(48, h - 24, 48):
        d.ellipse((34, y, 50, y + 16), fill=PAPER)
    x = 270
    d.text((x, 108), 'Jacob Metoyer', font=font(SERIF_CANDIDATES, 62), fill=INK)
    d.rectangle((x, 205, x + 136, 213), fill=ACCENT)
    d.text((x, 260), 'Less hand-waving.', font=font(SERIF_CANDIDATES, 78), fill=BLUE)
    d.text((x, 355), 'More receipts.', font=font(SERIF_CANDIDATES, 78), fill=INK)
    d.line((x, 492, w - 88, 492), fill=RULE, width=2)
    d.text((x, 548), 'jacobmetoyer.com', font=font(SANS_CANDIDATES, 28), fill=SOFT, anchor='ls')
    mark = monogram(104, radius_ratio=0.14)
    frame = Image.new('RGBA', (116, 116), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle((0, 0, 115, 115), radius=18, fill=PAPER)
    frame.alpha_composite(mark, (6, 6))
    img.paste(frame, (w - 88 - 116, 48), frame)
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
