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
TITLE = 'HAMON · An AI-native creation engine and everything built on it'
DESC = ('HAMON is the name behind everything Jacob Metoyer builds: the HAMON Engine, an AI-native creation engine for games and worlds, video and film, '
        'animation, sculpting, physics and simulation, and science and engineering tools; plus the games, creation tools and instruments made with it.')
SOCIAL = ('assets/hamon/hamon-share.jpg', 1200, 630,
          'HAMON: engines, worlds and instruments. A painted autumn lake from Wildside, a world built on the HAMON Engine.')
FILES = ('assets/hamon/hamon-share.jpg', 'assets/games/first-game-toon.webp', 'assets/games/inkbound-combat.webp')
FIRST_IMG = ('assets/games/first-game-toon.webp', 320, 180, 'A small cel-shaded 3D scene from the first game: toon-lit stone drums, rocks and trees on bright green ground, drawn with dithered shading and outlines.')
INK_IMG = ('assets/games/inkbound-combat.webp', 320, 180, 'A frame from Inkbound\'s combat slice: ink-drawn fighters and a red ink trail across a cream manga page, with speed lines.')
e = html.escape


def wordmark(tag: str = 'span', extra: str = '') -> str:
    """The HAMON wordmark is plain type with a tempered-edge line (a hamon is the line on a blade): no logo artwork."""
    return f'<{tag} class="hamon-mark{extra}" aria-label="{BRAND}">{BRAND}</{tag}>'


def footer_line() -> str:
    legal = f' &copy; {e(HAMON_LEGAL_NAME)}.' if HAMON_LEGAL_NAME else ''
    return f'{BRAND}: engines, worlds and instruments, founded and built by {FOUNDER}.{legal}'


def _cards(items, cls):
    return f'<ul class="{cls}">' + ''.join(f'<li><h3>{e(t)}</h3><p>{e(d)}</p></li>' for t, d in items) + '</ul>'


def _games(items):
    out = []
    for g in items:
        name, kind, line = g[:3]
        img = g[3] if len(g) > 3 else None
        link = g[4] if len(g) > 4 else None
        pic = (f'<img class="px" loading="lazy" decoding="async" src="{img[0]}" width="{img[1]}" height="{img[2]}" alt="{e(img[3])}">' if img else '')
        title = f'<a href="{link}">{e(name)} &#8599;</a>' if link else e(name)
        out.append(f'<li>{pic}<div><p class="hamon-kind">{e(kind)}</p><h3>{title}</h3><p>{e(line)}</p></div></li>')
    return '<ul class="hamon-games">' + ''.join(out) + '</ul>'


ENGINE_AREAS = [
    ('Built for agents', 'One method table served as a command line, JSON-RPC and MCP, so AI agents and tools can build, inspect, step and test the engine with no window. Typed deterministic runtime commands, replay and SHA-256 experiment receipts make what an agent did checkable. The native editor is an optional client.'),
    ('Deterministic core', 'An archetype ECS with a work-stealing job system, a fixed timestep and seeded randomness, so a run replays exactly from its recorded input. Lockstep input-frame networking builds on the same replay model.'),
    ('A full physics engine', 'Rigid bodies with hinges, motors, capsules and triangle surfaces; elastic strands and soft membranes (XPBD, with tearing and plastic yield); deformable terrain driven by living state; and analytical engineering solvers for hydraulics, cross-sections and rods. Native C++ solver adapters cover a MuJoCo bridge, foot-lock IK, reachability analysis and system identification.'),
    ('Animation and characters', 'Skeletal animation with blending, IK, retargeting, morph targets, squash and stretch, and follow-through. Code-only sculpting from signed-distance shapes builds characters, creatures, birds, insects, trees, flowers and whole scenes, with no external modelling tools.'),
    ('Video and perception', 'Native C++ modules for media ingest, camera calibration, ONNX-based tracking and a world compiler, plus CUDA kernels for skinning and splat viewing. They power the video tools below.'),
    ('Rendering and style', 'A real-time forward PBR renderer with cascaded sun shadows, point lights and height fog, headless and hardware-qualified capture, and a style system with 17 selectable looks, from hand-painted luminous cel with ink line art to watercolor and graphic ink. Extruded 3D text from font outlines is built in.'),
    ('Assets, materials, audio and scripting', 'Diffable text scenes and memory-mapped cooked packs, glTF import and an asset journal; half-edge mesh authoring; node-graph materials that compile to WGSL; a deterministic audio mixer; sandboxed WebAssembly scripting; and HamonLang, an experimental systems language.'),
    ('Science and engineering tools', 'Content-addressed experiment history in Rust, TypeScript and Go, a Studio UI, an Innovation Lab integration, and runnable studies in surface diffusion, radiative cooling and electrical networks.'),
]
GAMES = [
    ('Lanternwake', 'Playable in your browser', 'A small 3D island: restore three lanterns, then return to the stone arch at dawn. A published snapshot of an earlier engine build.', None, 'https://jacobmetoyer.com/games/lanternwake/'),
    ('Aetherline', 'WebGPU browser game', 'Collect three relics, open the gate and reach it. Lives in the engine repository; not published on this site.'),
    ('The first game', 'Proving target', 'A small cel-shaded 3D scene driven by a deterministic input script, checked frame by frame against golden images on a software renderer.', FIRST_IMG),
    ('Inkbound', 'Action-adventure in development', 'A third-person game where the world is a living manga: panels decide causality and ink is the physics. Panels, combat and a final boss encounter exist as deterministic headless slices; art is still to come.', INK_IMG),
    ('Counterpoise', 'Physics puzzle', 'Plan three work orders on a hinged beam, release the load, and read the result from the real physics world. Playable in the terminal.'),
    ('Glasswake', 'Adventure core in development', 'A character crosses a cleft on a real physical rope with bounded reeling and release momentum. The simulation and input replays exist; the visuals are planned.'),
]
OTHER_WORLDS = [
    ('Spire of Octaves', 'A fiction world with its own site: stories, music, games and animation.'),
    ('Echo', 'A vertical slice of a game set in the Spire world, built in Godot. Private.'),
    ('Ashen Circuit', 'A realtime roguelike survivor prototype in Python. Private.'),
    ('Roblox Systems Foundry', 'Server-authoritative, deterministic Luau building blocks for a Roblox experience.'),
]
VIDEO = [
    ('Phantom Window', 'Walk a virtual camera through ordinary video. It estimates depth per frame, recovers the camera path, and renders new viewpoints on the GPU, marking which pixels were observed and which inferred.'),
    ('Replay Forge', 'A basketball replay studio: connect a discussion to the relevant possession, branch the replay, and keep every claim bound to the source video.'),
    ('Captionverse', 'Spatial, speaker-aware captions and sound cues for video, with hash-matched cue manifests and local speech recognition that produces reviewable drafts.'),
    ('Chronos Vision', 'A temporal observatory for video: color-track measurements, three contrasting future-trajectory hypotheses, and past forecasts replayed against later frames. An experimental first release.'),
    ('Mechanism', 'A motion lab for machinery. Track markers in real video, compare image-plane paths and fit constrained kinematic models recomputed from saved evidence.'),
]
INSTRUMENTS = [
    ('WorldLaw', 'Learns executable physical laws from observations and actively tests the resulting hypotheses.'),
    ('Afterimage', 'A physical-world evidence engine. It reconstructs what is known and what might be true from fragmentary media, keeps competing explanations, and says what to observe next.'),
    ('Synapse', 'A spatial observatory for real running computational systems. The first slice is a local, read-only browser instrument for a live process tree.'),
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
        + wildside_page.site_nav('hamon') + '</header>'
        '<main id="main" class="ws-main hamon-main">'
        f'<section class="hamon-hero"><img fetchpriority="high" decoding="async" src="{hero}" srcset="{wildside_page.HERO_SRCSET}" sizes="100vw" width="{hero_size[0]}" height="{hero_size[1]}" alt="{e(hero_alt)}">'
        '<div class="hamon-hero-copy">'
        f'<p class="section-context">FOUNDED AND BUILT BY {FOUNDER.upper()}</p><h1>{wordmark("span")}<span class="visually-hidden"> {e(TAGLINE)}</span></h1>'
        f'<p class="hamon-tagline">{e(TAGLINE)}</p>'
        '<p class="ws-lede">HAMON is the single name behind everything I build: an AI-native creation engine, and the games, worlds, video and film tools, physics and simulation, and science instruments made with it.</p>'
        f'<p class="hamon-actions"><a class="ws-play" href="{app}">Play Wildside</a><a class="hamon-secondary" href="#engine">Explore HAMON</a></p>'
        '<nav class="hamon-jump" aria-label="On this page"><a href="#engine">Engine</a><a href="#worlds">Games</a><a href="#video">Video &amp; film</a><a href="#instruments">Science</a><a href="#estate">Agents</a></nav></div></section>'
        '<section class="ws-section hamon-section" id="engine"><p class="section-context">01 · CORE TECHNOLOGY</p><h2>The HAMON Engine</h2>'
        '<p class="hamon-headline">An AI-native creation engine.</p>'
        '<p>One engine for games and worlds, video and film, animation, sculpting and characters, a full physics engine, and simulation, science and engineering tools, built so AI agents can drive it directly as well as people. It is a workspace of 27 Rust crates with native C++, CUDA, TypeScript and Go components, and it runs natively and in the browser through WebAssembly and WebGPU.</p>'
        f'{_cards(ENGINE_AREAS, "hamon-caps")}'
        '<p><strong>In progress.</strong> The AI-native authoring roadmap is open work: live authoring connected to rendering, material graphs executed in the scene renderer, procedural modeling that updates only the affected geometry, a high-quality final-image workflow, and discovery of tools and reusable assets.</p>'
        '<p class="ws-honest">The engine source is private; its work is published through the games and tools on this page.</p></section>'
        '<section class="ws-section hamon-section hamon-flagship" id="worlds"><p class="section-context">02 · GAMES AND WORLDS · FLAGSHIP</p><h2>Wildside</h2>'
        f'<a class="hamon-frame" href="{app}" aria-label="Play Wildside"><img loading="lazy" decoding="async" src="{wildside_page.CARD}" srcset="{wildside_page.HERO_SRCSET}" sizes="(max-width:960px) 92vw, 904px" width="{hero_size[0]}" height="{hero_size[1]}" alt="{e(hero_alt)}">'
        '<span class="hamon-frame-play"><span aria-hidden="true">&#9654;</span> Play Wildside</span></a>'
        '<p>Real places you care about, turned into living, hand-painted worlds you explore at human, bird and insect scale, rendered live by the HAMON Engine in your browser. Its default look is hand-painted, luminous cel shading with ink line art; the engine&#8217;s style system offers sixteen others.</p>'
        f'<p class="hamon-actions"><a class="ws-play" href="{app}">Play Wildside</a><a class="hamon-secondary" href="{ws}">Watch the demo and read more</a></p>'
        '<p class="ws-honest">The places are interpreted, imagined worlds, not surveys, and the wildlife is simulated. This is a work in progress, made for MarinaHacks.</p>'
        '<h3 class="hamon-subhead">More games built on the engine</h3>'
        f'{_games(GAMES)}'
        '<h3 class="hamon-subhead">Other worlds</h3>'
        f'{_cards(OTHER_WORLDS, "hamon-instruments hamon-compact")}'
        '<p class="hamon-actions"><a class="hamon-secondary" href="https://spireofoctaves.com/">Visit Spire of Octaves &#8599;</a><a class="hamon-secondary" href="index.html#forge">See the recorded forge</a></p></section>'
        '<section class="ws-section hamon-section" id="video"><p class="section-context">03 · VIDEO, FILM AND MOTION</p><h2>Tools for working with moving images</h2>'
        '<p>Creation and analysis tools for video, from new camera angles on ordinary footage to forecasts replayed against what actually happened. They are early and mostly private; each says plainly what it does not claim.</p>'
        f'{_cards(VIDEO, "hamon-instruments")}</section>'
        '<section class="ws-section hamon-section" id="instruments"><p class="section-context">04 · SCIENCE AND RESEARCH INSTRUMENTS</p><h2>Instruments for looking closely</h2>'
        '<p>Evidence-first tools that share one approach: show what was observed, keep the uncertainty, and refuse to overclaim. The repositories are private and have no public demo yet.</p>'
        f'{_cards(INSTRUMENTS, "hamon-instruments")}</section>'
        '<section class="ws-section hamon-section" id="estate"><p class="section-context">05 · AGENTS AND WORKSHOP</p><h2>The rest of the estate</h2>'
        '<p>The tooling that lets one person run all of this. Both are private and early.</p>'
        f'{_cards(ESTATE, "hamon-instruments")}</section>'
        '<section class="ws-section hamon-section hamon-founder" id="founder"><p class="section-context">FOUNDER</p><h2>Jacob Metoyer</h2>'
        '<p>I study computer science and physics at Cal State Long Beach, and I build HAMON. My research, writing and other work are on the main site.</p>'
        '<p class="hamon-actions"><a class="hamon-secondary" href="index.html">About me and my research</a><a class="hamon-secondary" href="https://github.com/Jacob-Met">GitHub &#8599;</a></p></section>'
        '</main>'
        f'<footer class="hamon-foot"><p>{footer_line()}</p></footer>')
