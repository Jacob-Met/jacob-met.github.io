"""HAMON page: what HAMON is, its core engine, and the worlds and instruments built on it.
Static HTML only. Copy here must stay within what the repositories and the existing site actually show."""
from __future__ import annotations
import html

PAGE = 'hamon.html'
BRAND = 'HAMON'
# Single place for the company's legal name. Leave None until it is registered; when set it appears in the footer.
HAMON_LEGAL_NAME: str | None = None
TAGLINE = 'Engines, worlds and instruments.'
FOUNDER = 'Jacob Metoyer'
TITLE = 'HAMON · Engines, worlds and instruments'
DESC = ('HAMON is the name behind everything Jacob Metoyer builds: the HAMON Engine, an AI-native engine for everything, built in Rust and wgpu for native and browser; '
        'worlds and games such as Wildside and Lanternwake; research instruments; and agent tooling.')
SOCIAL = ('assets/hamon/hamon-share.jpg', 1200, 630,
          'HAMON: engines, worlds and instruments. A painted autumn lake from Wildside, a world built on the HAMON Engine.')
FILES = ('assets/hamon/hamon-share.jpg',)
e = html.escape


def wordmark(tag: str = 'span', extra: str = '') -> str:
    """The HAMON wordmark is plain type with a tempered-edge line (a hamon is the line on a blade): no logo artwork."""
    return f'<{tag} class="hamon-mark{extra}" aria-label="{BRAND}">{BRAND}</{tag}>'


def footer_line() -> str:
    legal = f' &copy; {e(HAMON_LEGAL_NAME)}.' if HAMON_LEGAL_NAME else ''
    return f'{BRAND}: engines, worlds and instruments, founded and built by {FOUNDER}.{legal}'


def _cards(items, cls):
    return f'<ul class="{cls}">' + ''.join(f'<li><h3>{e(t)}</h3><p>{e(d)}</p></li>' for t, d in items) + '</ul>'


ENGINE_AREAS = [
    ('Built for agents', 'One method table served as a command line, JSON-RPC and MCP, so AI agents and tools can build, inspect, step and test the engine with no window. Typed deterministic runtime commands, replay, and SHA-256 experiment receipts make what an agent did checkable. The native editor and inspectors are optional clients.'),
    ('Deterministic runtime', 'An archetype ECS with a work-stealing job system, a fixed timestep and seeded randomness, so a run can be replayed from its recorded input. A typed CPU runtime sits on top.'),
    ('Physics and animation', 'Deterministic rigid-body physics with hinges, capsules and triangle surfaces. Skeletal animation with blending, IK, retargeting and skinning.'),
    ('Audio, input, scripting and networking', 'A deterministic audio mixer and cue format, backend-neutral input mapping, a sandboxed WebAssembly scripting host, HamonLang (an experimental systems language with a static access checker) and lockstep input-frame networking.'),
    ('Assets and authoring', 'Diffable text scenes and memory-mapped cooked packs, glTF import and an asset journal. Editable half-edge mesh authoring and node-graph materials that compile to WGSL.'),
    ('Procedural worlds and creatures', 'Code-only sculpting from signed-distance shapes: characters, birds, insects, trees, flowers, rocks and whole scenes, with no external modelling tools.'),
    ('Rendering and style', 'A forward PBR real-time renderer with cascaded sun shadows, point lights and height fog, plus headless and hardware-qualified capture. A style system with 17 selectable looks, from hand-painted luminous cel with ink line art to watercolor and graphic ink.'),
]
WORLDS = [
    ('Lanternwake', 'A small playable island: restore three lanterns, then return to the stone arch at dawn. Published as a browser snapshot of an earlier engine build.'),
    ('Aetherline', 'A small WebGPU browser game: collect three relics, open the gate and reach it. It lives in the engine repository and is not published on this site.'),
]
INSTRUMENTS = [
    ('Afterimage', 'A physical-world evidence engine. It reconstructs what is known and what might be true from fragmentary media, keeps competing explanations, and says what to observe next.'),
    ('Mechanism', 'A motion lab for machinery. Track markers in real video, compare image-plane paths, and fit constrained kinematic models recomputed from saved evidence.'),
    ('Synapse', 'A spatial observatory for real running computational systems. The first slice is a local, read-only browser instrument for a live process tree.'),
    ('Chronos Vision', 'A temporal observatory for video. It contrasts uncalibrated future-trajectory hypotheses and replays past forecasts against later frames. An experimental first release.'),
    ('Microverse', 'An early investigator for microscopic life: follow individuals through supplied detections and keep competing explanations of an encounter.'),
    ('MATERIALTRUTH', 'A photometric inspection desk for surfaces. It infers relative albedo and normals from multi-illumination images and refuses where the data cannot support a result.'),
]
ESTATE = [
    ('HAMON agent platform', 'Early work on a supervised agent runtime: durable claims, recovery and replay, and memory with explicit rights. Built as deterministic fixtures; not a deployed product.'),
    ('HAMON Workshop', 'A simulated workshop operated through MCP: discover, reserve and run a virtual workcell, keep failed actions, and recover from the last committed pose. A software foundation for physical capability, not hardware yet.'),
]


def body(wildside_page) -> str:
    app, ws = wildside_page.APP_URL, wildside_page.PAGE
    hero, hero_size, hero_alt = wildside_page.HERO, wildside_page.HERO_SIZE, wildside_page.HERO_ALT
    return (
        '<a class="skip" href="#main">Skip to content</a>'
        '<header class="ws-top hamon-top"><a class="identity" href="index.html" aria-label="Jacob Metoyer, home">Jacob Metoyer</a>'
        f'<nav aria-label="Site"><a href="#engine">Engine</a><a href="{ws}">Wildside</a><a href="index.html">Home</a></nav></header>'
        '<main id="main" class="ws-main hamon-main">'
        f'<section class="hamon-hero"><img fetchpriority="high" decoding="async" src="{hero}" width="{hero_size[0]}" height="{hero_size[1]}" alt="{e(hero_alt)}">'
        '<div class="hamon-hero-copy">'
        f'<p class="section-context">FOUNDED AND BUILT BY {FOUNDER.upper()}</p><h1>{wordmark("span")}<span class="visually-hidden"> {e(TAGLINE)}</span></h1>'
        f'<p class="hamon-tagline">{e(TAGLINE)}</p>'
        '<p class="ws-lede">HAMON is the single name behind everything I build: an AI-native engine, the worlds and games that run on it, research instruments, and the agent tooling that supports them.</p>'
        f'<p class="hamon-actions"><a class="ws-play" href="{app}">Play Wildside</a><a class="hamon-secondary" href="#engine">Explore HAMON</a></p>'
        '<p class="ws-note">Wildside needs a browser with WebGPU. Nothing to install and no account.</p></div></section>'
        '<section class="ws-section hamon-section" id="engine"><p class="section-context">01 · CORE TECHNOLOGY</p><h2>The HAMON Engine</h2>'
        '<p class="hamon-headline">An AI-native engine for everything.</p>'
        '<p>The HAMON Engine is meant to cover games and worlds, simulation, authoring, rendering, and science and engineering tools, and to be driven directly by AI agents as well as by hand. It is a Rust and wgpu workspace of 27 crates that runs natively and in the browser through WebAssembly and WebGPU.</p>'
        f'{_cards(ENGINE_AREAS, "hamon-caps")}'
        '<p><strong>In progress.</strong> The engine&#8217;s AI-native authoring roadmap is open work, not shipped: live authoring connected to rendering, material graphs executed in the scene renderer, procedural modeling that updates only the affected geometry, a high-quality final-image workflow, and discovery of tools and reusable assets.</p>'
        '<p class="ws-honest">The engine repository is private. The native editor is a prototype, and larger renderer goals such as global illumination are planned, not done. What you can see today is published through Wildside, Lanternwake and the recorded forge on the homepage; those are snapshots, not the whole engine.</p></section>'
        '<section class="ws-section hamon-section hamon-flagship" id="worlds"><p class="section-context">02 · WORLDS AND GAMES · FLAGSHIP</p><h2>Wildside</h2>'
        f'<a class="hamon-frame" href="{app}" aria-label="Play Wildside"><img loading="lazy" decoding="async" src="{hero}" width="{hero_size[0]}" height="{hero_size[1]}" alt="{e(hero_alt)}">'
        '<span class="hamon-frame-play"><span aria-hidden="true">&#9654;</span> Play Wildside</span></a>'
        '<p>Real places you care about, turned into living, hand-painted worlds you explore at human, bird and insect scale, rendered live by the HAMON Engine in your browser. Its default look is hand-painted, luminous cel shading with ink line art; the engine&#8217;s style system offers sixteen others.</p>'
        f'<p class="hamon-actions"><a class="ws-play" href="{app}">Play Wildside</a><a class="hamon-secondary" href="{ws}">Watch the demo and read more</a></p>'
        '<p class="ws-honest">The places are interpreted, imagined worlds, not surveys, and the wildlife is simulated. This is a work in progress, made for MarinaHacks.</p>'
        '<a class="hamon-frame hamon-frame-small" href="https://jacobmetoyer.com/games/lanternwake/" aria-label="Play Lanternwake"><img loading="lazy" decoding="async" src="games/lanternwake/desktop.png" width="1280" height="1046" alt="Lanternwake\'s small illuminated island in the published browser game."></a>'
        f'{_cards(WORLDS, "hamon-instruments")}'
        '<p class="hamon-actions"><a class="hamon-secondary" href="https://jacobmetoyer.com/games/lanternwake/">Play Lanternwake &#8599;</a><a class="hamon-secondary" href="index.html#forge">See the recorded forge</a></p></section>'
        '<section class="ws-section hamon-section" id="instruments"><p class="section-context">03 · RESEARCH INSTRUMENTS</p><h2>Instruments for looking closely</h2>'
        '<p>Evidence-first tools that share one approach: show what was observed, keep the uncertainty, and refuse to overclaim. These are early. The repositories are private and have no public demo yet.</p>'
        f'{_cards(INSTRUMENTS, "hamon-instruments")}</section>'
        '<section class="ws-section hamon-section" id="estate"><p class="section-context">04 · AGENTS AND WORKSHOP</p><h2>The rest of the estate</h2>'
        '<p>The tooling that lets one person run all of this. Both are private and early.</p>'
        f'{_cards(ESTATE, "hamon-instruments")}</section>'
        '<section class="ws-section hamon-section hamon-founder" id="founder"><p class="section-context">FOUNDER</p><h2>Jacob Metoyer</h2>'
        '<p>I study computer science and physics at Cal State Long Beach, and I build HAMON. My research, writing and other work are on the main site.</p>'
        '<p class="hamon-actions"><a class="hamon-secondary" href="index.html">About me and my research</a><a class="hamon-secondary" href="https://github.com/Jacob-Met">GitHub &#8599;</a></p></section>'
        '</main>'
        f'<footer class="hamon-foot"><p>{footer_line()}</p></footer>')
