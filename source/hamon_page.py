"""HAMON page: what HAMON is, its core engine, and the worlds and instruments built on it.
Static HTML only. Copy here must stay within what the repositories and the existing site actually show."""
from __future__ import annotations
import html

PAGE = 'hamon.html'
BRAND = 'HAMON'
# Single place for the company's legal name. Leave None until it is registered; when set it appears in the footer.
HAMON_LEGAL_NAME: str | None = None
TAGLINE = 'A studio for living worlds.'
FOUNDER = 'Jacob Metoyer'
TITLE = 'HAMON · A studio for living worlds'
DESC = ('HAMON is a studio for living worlds, founded by Jacob Metoyer. Its core technology is the HAMON Engine, a real-time painterly renderer '
        'in Rust and wgpu that runs natively and in the browser. Wildside is its flagship world.')
SOCIAL = ('assets/hamon/hamon-share.jpg', 1200, 630,
          'HAMON, a studio for living worlds. A painted autumn lake from Wildside, rendered by the HAMON Engine.')
FILES = ('assets/hamon/hamon-share.jpg',)
e = html.escape


def wordmark(tag: str = 'span', extra: str = '') -> str:
    """The HAMON wordmark is plain type with a tempered-edge line (a hamon is the line on a blade): no logo artwork."""
    return f'<{tag} class="hamon-mark{extra}" aria-label="{BRAND}">{BRAND}</{tag}>'


def footer_line() -> str:
    legal = f' &copy; {e(HAMON_LEGAL_NAME)}.' if HAMON_LEGAL_NAME else ''
    return f'{BRAND} is a studio for living worlds, founded and built by {FOUNDER}.{legal}'


def body(wildside_page) -> str:
    app, ws = wildside_page.APP_URL, wildside_page.PAGE
    hero, hero_size, hero_alt = wildside_page.HERO, wildside_page.HERO_SIZE, wildside_page.HERO_ALT
    caps = [('Cel and line art', 'A hand-painted, Violet Evergarden-style look: flat cel colour, ink line art and painted shapes instead of photorealism.'),
            ('Painted skies', 'Skies that move through time of day and weather, so the same place feels different when you return to it.'),
            ('Living creatures', 'Simulated animals that move through the world, such as the robin. The wildlife is simulated, not a live feed.'),
            ('Multi-scale worlds', 'One place explored at human, bird and insect scale, from the path under your feet to the canopy overhead.')]
    cap_html = ''.join(f'<li><h3>{e(t)}</h3><p>{e(d)}</p></li>' for t, d in caps)
    instruments = [('Afterimage', 'A physical-world evidence engine. It reconstructs what is known and what might be true from fragmentary media, keeps competing explanations, and says what to observe next.'),
                   ('Mechanism', 'A motion lab for machinery. Track markers in real video, compare image-plane paths, and fit constrained kinematic models that are recomputed from the saved evidence.'),
                   ('Synapse', 'A spatial observatory for real running computational systems. The first slice is a local, read-only browser instrument for a live process tree.')]
    inst_html = ''.join(f'<li><h3>{e(n)}</h3><p>{e(d)}</p></li>' for n, d in instruments)
    return (
        '<a class="skip" href="#main">Skip to content</a>'
        '<header class="ws-top hamon-top"><a class="identity" href="index.html" aria-label="Jacob Metoyer, home">Jacob Metoyer</a>'
        f'<nav aria-label="Site"><a href="{ws}">Wildside</a><a href="index.html#projects">Projects</a><a href="index.html">Home</a></nav></header>'
        '<main id="main" class="ws-main hamon-main">'
        f'<section class="hamon-hero"><img fetchpriority="high" decoding="async" src="{hero}" width="{hero_size[0]}" height="{hero_size[1]}" alt="{e(hero_alt)}">'
        '<div class="hamon-hero-copy">'
        f'<p class="section-context">FOUNDED AND BUILT BY {FOUNDER.upper()}</p><h1>{wordmark("span")}<span class="visually-hidden"> {e(TAGLINE)}</span></h1>'
        f'<p class="hamon-tagline">{e(TAGLINE)}</p>'
        '<p class="ws-lede">HAMON builds a real-time painterly engine and the worlds that run on it. The engine is the core technology; Wildside is the first world you can step into.</p>'
        f'<p class="hamon-actions"><a class="ws-play" href="{app}">Play Wildside</a><a class="hamon-secondary" href="#engine">How it works</a></p>'
        '<p class="ws-note">Best in a browser with WebGPU. Nothing to install and no account.</p></div></section>'
        '<section class="ws-section hamon-section" id="engine"><p class="section-context">CORE TECHNOLOGY</p><h2>The HAMON Engine</h2>'
        '<p>A real-time renderer written in Rust on wgpu, built around painterly art direction. It runs natively and in the browser, compiled to WebAssembly and drawn with WebGPU.</p>'
        f'<ul class="hamon-caps">{cap_html}</ul>'
        '<p class="ws-honest">The engine repository is private. What you can see today is published through Wildside, Lanternwake and the recorded forge on the homepage; those are snapshots of the work, not the whole engine.</p></section>'
        '<section class="ws-section hamon-section hamon-flagship" id="wildside"><p class="section-context">FLAGSHIP · MADE FOR MARINAHACKS</p><h2>Wildside</h2>'
        f'<a class="hamon-frame" href="{app}" aria-label="Play Wildside"><img loading="lazy" decoding="async" src="{hero}" width="{hero_size[0]}" height="{hero_size[1]}" alt="{e(hero_alt)}">'
        '<span class="hamon-frame-play"><span aria-hidden="true">&#9654;</span> Play Wildside</span></a>'
        '<p>Real places you care about, turned into living Violet Evergarden-style worlds you explore at human, bird and insect scale, rendered live by the HAMON Engine in your browser.</p>'
        f'<p class="hamon-actions"><a class="ws-play" href="{app}">Play Wildside</a><a class="hamon-secondary" href="{ws}">Watch the demo and read more</a></p>'
        '<p class="ws-honest">The places are interpreted, imagined worlds, not surveys. This is a work in progress.</p></section>'
        '<section class="ws-section hamon-section" id="more"><p class="section-context">ALSO BUILT ON HAMON</p><h2>Lanternwake</h2>'
        '<a class="hamon-frame hamon-frame-small" href="https://jacobmetoyer.com/games/lanternwake/" aria-label="Play Lanternwake"><img loading="lazy" src="games/lanternwake/desktop.png" width="1280" height="1046" alt="Lanternwake\'s small illuminated island in the published browser game."></a>'
        '<p>A small playable world: restore three lanterns on an island, then return to the stone arch at dawn. It is a published browser snapshot of an earlier engine build.</p>'
        '<p class="hamon-actions"><a class="hamon-secondary" href="https://jacobmetoyer.com/games/lanternwake/">Play Lanternwake &#8599;</a><a class="hamon-secondary" href="index.html#forge">See the recorded forge</a></p>'
        '<p class="ws-honest">WebGPU required.</p></section>'
        '<section class="ws-section hamon-section" id="instruments"><p class="section-context">IN DEVELOPMENT</p><h2>Instruments for looking closely</h2>'
        '<p>Early, evidence-first tools that share HAMON&#8217;s approach: show what was observed, keep the uncertainty, and refuse to overclaim. These repositories are private and have no public demo yet.</p>'
        f'<ul class="hamon-instruments">{inst_html}</ul></section>'
        '<section class="ws-section hamon-section hamon-founder" id="founder"><p class="section-context">FOUNDER</p><h2>Jacob Metoyer</h2>'
        '<p>I study computer science and physics at Cal State Long Beach, and I build HAMON: the engine, the worlds and the tools around them. My research, writing and other work are on the main site.</p>'
        '<p class="hamon-actions"><a class="hamon-secondary" href="index.html">About me and my research</a><a class="hamon-secondary" href="https://github.com/Jacob-Met">GitHub &#8599;</a></p></section>'
        '</main>'
        f'<footer class="hamon-foot"><p>{footer_line()}</p></footer>')
