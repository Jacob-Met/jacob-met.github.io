"""Wildside project page. The playable app itself is a separate static tree (docs/wildside/) that the build never touches."""
from __future__ import annotations
import html
from pathlib import Path

PAGE = 'wildside-project.html'
APP_DIR = 'wildside'                       # static deployed app; preserved, never generated or deleted
APP_URL = 'https://jacobmetoyer.com/wildside/'
HERO = 'assets/wildside/wildside-hero.webp'
HERO_SIZE = (1600, 900)
VIDEO = 'wildside-media/wildside-demo-1080.mp4'   # drop the file in source/ at this path and rebuild
VIDEO_SIZE = (1920, 1080)
MAX_VIDEO_BYTES = 50_000_000
FILES = (HERO,)
TITLE = 'Wildside · Step into the WildSide'
DESC = 'Wildside turns real places into living, painted worlds you explore at human, bird and insect scale, rendered live by the HAMON Engine in your browser. Made for MarinaHacks.'
HERO_ALT = 'An autumn lake at golden hour in Wildside: painted maple trees reflected in still water, a dirt path, wildflowers and a swing set.'
e = html.escape


def video_present(root: Path) -> bool:
    p = root / VIDEO
    if not p.exists():
        return False
    if p.is_symlink() or not p.is_file() or p.stat().st_size > MAX_VIDEO_BYTES:
        raise ValueError('Wildside demo video must be a regular file of at most 50 MB')
    return True


def video_files(root: Path) -> tuple[str, ...]:
    return (VIDEO,) if video_present(root) else ()


def card() -> str:
    """Featured card for the homepage Projects section."""
    return (f'<article class="wildside-card"><a class="wildside-card-image" href="{PAGE}" aria-label="Wildside project page">'
            f'<img loading="lazy" src="{HERO}" width="{HERO_SIZE[0]}" height="{HERO_SIZE[1]}" alt="{e(HERO_ALT)}"></a>'
            '<div><p class="section-context">FEATURED PROJECT · MARINAHACKS</p><h3>Wildside</h3><p><em>Step into the WildSide.</em></p>'
            '<p>Real places you care about, turned into living Violet Evergarden-style worlds you explore at human, bird and insect scale, rendered live by the HAMON Engine in your browser.</p>'
            f'<p><a class="public-action" href="{APP_URL}">Play Wildside ↗</a> <a class="public-action" href="{PAGE}">About the project</a></p>'
            '<p class="scope-copy">Best in desktop Chrome or Edge (WebGPU).</p></div></article>')


def body(has_video: bool) -> str:
    if has_video:
        w, h = VIDEO_SIZE
        demo = (f'<figure class="ws-video"><video controls playsinline preload="none" width="{w}" height="{h}" poster="{HERO}" id="wildside" data-wildside-demo '
                f'aria-label="Wildside demo video"><source src="{VIDEO}" type="video/mp4"></video>'
                '<figcaption>Wildside demo: captured from the live HAMON Engine view.</figcaption></figure>')
    else:
        demo = ('<figure class="ws-video ws-video-slot" data-wildside-video-placeholder><div role="img" aria-label="Demo video placeholder">'
                '<strong>Demo video coming soon</strong><span>Placeholder: this slot fills automatically when wildside-demo-1080.mp4 is added to source/wildside-media/ and the site is rebuilt.</span></div></figure>')
    return (f'<a class="skip" href="#main">Skip to content</a><header class="ws-top"><a class="identity" href="index.html">Jacob Metoyer</a>'
            '<nav aria-label="Site"><a href="index.html#projects">Projects</a><a href="index.html">Home</a></nav></header>'
            '<main id="main" class="ws-main">'
            f'<section class="ws-hero"><img src="{HERO}" width="{HERO_SIZE[0]}" height="{HERO_SIZE[1]}" alt="{e(HERO_ALT)}">'
            '<div class="ws-hero-copy"><p class="section-context">A MARINAHACKS PROJECT</p><h1>Wildside</h1><p class="ws-tagline">Step into the WildSide</p>'
            '<p class="ws-lede">Real places you care about, turned into living Violet Evergarden-style worlds you explore at human, bird and insect scale, rendered live by the HAMON Engine in your browser.</p>'
            f'<p><a class="ws-play" href="{APP_URL}">Play Wildside</a></p>'
            '<p class="ws-note">Works best in desktop Chrome or Edge, which provide WebGPU. Nothing to install and no account.</p></div></section>'
            f'<section class="ws-section"><h2>Watch</h2>{demo}</section>'
            '<section class="ws-section"><h2>What it is</h2>'
            '<p>Wildside is built around recognition: the tree you pass, the pond near school, the beach your family returns to. A place becomes a painted world you can walk through, see from a bird&#8217;s height or a beetle&#8217;s, and return to as the light and weather change.</p>'
            '<p>The look aims at the hand-painted warmth of Kyoto Animation&#8217;s <em>Violet Evergarden</em>. Everything is drawn live in your browser by the HAMON Engine, my Rust engine compiled to WebAssembly and rendered with WebGPU.</p>'
            '<p class="ws-honest">Honest scope: the places are interpreted, imagined worlds, not surveys, and the wildlife is simulated, not a live feed. This is a work in progress.</p></section>'
            '<section class="ws-section"><h2>Made for MarinaHacks</h2>'
            '<p>Wildside is my MarinaHacks project: a way to build emotional attachment to the living places around us, which is where caring for them starts. There are no quizzes, streaks or chores, only a world worth visiting.</p>'
            f'<p><a class="ws-play" href="{APP_URL}">Play Wildside</a> <a class="public-action" href="index.html#projects">Back to projects</a></p></section>'
            '</main>')
