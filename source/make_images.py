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


SITE_FONT = ROOT / 'assets' / 'fonts' / 'space-grotesk.woff'


def font(size: int, weight: int | None = None) -> ImageFont.FreeTypeFont:
    """Prefer the site's own Space Grotesk so share art matches the pages."""
    if SITE_FONT.is_file():
        try:
            f = ImageFont.truetype(str(SITE_FONT), size)
            if weight:
                f.set_variation_by_axes([weight])
            return f
        except (OSError, AttributeError):
            pass
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


def spaced(draw, xy, text, fnt, fill, tracking):
    """Letter-spaced text, used for the type-built HAMON wordmark."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking
    return x


def share_card() -> Image.Image:
    result = Image.new('RGB', (1200, 630), PAPER)
    draw = ImageDraw.Draw(result)
    draw.text((80, 96), 'Jacob Metoyer', font=font(112, 500), fill=INK)
    draw.text((86, 272), 'Founder of HAMON: engines, worlds and instruments.', font=font(36, 400), fill=INK)
    draw.text((86, 332), 'Computer science + physics, Cal State Long Beach', font=font(28, 400), fill=MUTED)
    draw.line((86, 476, 1114, 476), fill='#85e8f0', width=2)
    draw.text((86, 521), 'jacobmetoyer.com', font=font(25, 400), fill=MUTED)
    return result


def hamon_card(frame: Path) -> Image.Image:
    """HAMON share image: a real Wildside frame under a type-built wordmark."""
    art = Image.open(frame).convert('RGB')
    w, h = art.size
    side = round(h * 1200 / 630)
    art = art.crop(((w - side) // 2 + round(w * .08), 0, (w - side) // 2 + round(w * .08) + side, h)).resize((1200, 630), Image.Resampling.LANCZOS)
    shade = Image.new('L', (1200, 630))
    px = shade.load()
    for x in range(1200):
        a = max(0, min(255, round(235 * (1 - x / 900)))) if x < 900 else 0
        for y in range(630):
            px[x, y] = a
    art.paste(Image.new('RGB', (1200, 630), PAPER), (0, 0), shade)
    draw = ImageDraw.Draw(art)
    end = spaced(draw, (76, 190), 'HAMON', font(132, 500), INK, 22)
    draw.line((80, 352, 80 + 520, 352), fill='#ffcf8a', width=3)
    draw.text((82, 388), 'Engines, worlds and instruments.', font=font(38, 400), fill=INK)
    draw.text((82, 450), 'Founded by Jacob Metoyer', font=font(26, 400), fill=MUTED)
    draw.text((82, 556), 'jacobmetoyer.com/hamon.html', font=font(22, 400), fill=MUTED)
    return art


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, default=ROOT / 'assets')
    parser.add_argument('--frame', type=Path, help='Real Wildside frame for the HAMON share image')
    out = parser.parse_args().out; out.mkdir(parents=True, exist_ok=True)
    share_card().save(out / 'og-card.png', optimize=True)
    monogram(180).save(out / 'apple-touch-icon.png', optimize=True)
    monogram(48).save(out / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    frame = parser.parse_args().frame
    if frame:
        (out / 'hamon').mkdir(parents=True, exist_ok=True)
        hamon_card(frame).save(out / 'hamon' / 'hamon-share.jpg', quality=86, optimize=True, progressive=True)
        print('hamon/hamon-share.jpg', (out / 'hamon' / 'hamon-share.jpg').stat().st_size)
    for name in ('og-card.png', 'apple-touch-icon.png', 'favicon.ico'):
        print(name, (out / name).stat().st_size)


if __name__ == '__main__':
    main()
