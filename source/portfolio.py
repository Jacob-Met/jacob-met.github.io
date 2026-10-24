"""Pure captured-production portfolio renderer with actual HAMON Engine imagery.
Build validation and ordered script/SRI insertion are owned by build.py.
"""
from html import escape


def e(value):
    return escape(str(value), quote=True)


def public_demo(d):
    captures = ''.join(
        f'<a class="screenshot-link" href="{e(s["src"])}" aria-label="{e(d["name"])}: full {"phone" if key == "mobile" else "desktop"} screenshot">{label}</a>'
        for key, label in [('desktop', 'Desktop capture'), ('mobile', 'Phone capture')]
        for s in [d['shots'][key]])
    return (f'<article class="research-entry" id="{e(d["id"])}"><h3>{e(d["name"])}</h3>'
            f'<p>{e(d["line"])}</p><div class="public-actions">'
            f'<a href="{e(d["play"]["url"])}">{e(d["play"]["label"])} ↗</a>'
            f'<a href="{e(d["repo"])}" aria-label="{e(d["name"])} public source">Public source ↗</a>{captures}</div>'
            f'<details><summary>Current scope</summary><p>{e(d["detail"])}</p></details></article>')


def research_section(experience):
    bio = experience['publicBio']; work = experience['researchWork']; resource = bio['researchResource']
    academic = ''.join(f'<div><dt>{e(x["name"])}</dt><dd>{e(x["focus"])}</dd></div>' for x in work['academic'])
    independent = ''.join(
        f'<article class="research-entry" id="{e(x["id"])}"><p class="section-context">{e(x["name"])}</p>'
        f'<h3>{e(x["question"])}</h3><p>{e(x["output"])}</p><details><summary>Inside the study</summary>'
        f'<p>{e(x["detail"])}</p><p class="scope-copy">{e(x["limit"])}</p></details></article>'
        for x in work['independent'])
    return (f'<section class="notes" id="research" tabindex="-1"><span id="about" class="section-alias"></span>'
            f'<p class="section-context">Research</p><h2>{e(bio["researchHeading"])}</h2>'
            f'<p>{e(bio["researchLead"])}</p><h3>Academic collaboration</h3><p>{e(bio["research"])}</p>'
            f'<dl class="academic-list">{academic}</dl><h3>Independent investigations</h3>{independent}'
            f'<article class="research-entry"><h3>{e(resource["name"])}</h3><p>{e(resource["description"])}</p>'
            f'<a class="public-action" href="{e(resource["url"])}">{e(resource["actionLabel"])} ↗</a>'
            f'<details><summary>Example scope</summary><p>{e(resource["limit"])}</p></details></article>'
            '<a href="#forge" class="return-link">← Return to the forge</a></section>')


def hackathon_section(experience):
    branch = next(x for x in experience['hamonBranches'] if x['id'] == 'hackathons')
    entries = []
    for x in branch['entries']:
        link = (f'<a class="public-action" href="{e(x["publicUrl"])}">View the public entry ↗</a>'
                if x.get('publicUrl') else f'<a class="public-action" href="#{e(x["projectId"])}">Explore the project ↓</a>')
        entries.append(f'<article class="research-entry"><h3>{e(x["name"])}</h3><p>{e(x["purpose"])}</p>{link}'
                       f'<details><summary>Project status</summary><p>{e(x["status"])}</p><p>{e(x["limit"])}</p></details></article>')
    return ('<section class="notes" id="hackathons" tabindex="-1"><p class="section-context">HAMON</p>'
            f'<h2>{e(branch["title"])}</h2><p>{e(branch["lead"])}</p>{"".join(entries)}'
            '<a href="#forge" class="return-link">← Return to the forge</a></section>')


def projects_section(data, legacy, experience):
    stories = {s['projectId']: s for s in experience['projectStories']}
    branch = next(x for x in experience['hamonBranches'] if x['id'] == 'projects')
    names = {x['projectId']: x['name'] for b in experience['hamonBranches'] for x in b['entries'] if x.get('projectId')}; names['captionverse'] = 'Captionverse'; entries = []
    game = next(g for g in legacy['games'] if g['id'] == 'lanternwake')
    for pid in branch['projectIds']:
        story = stories[pid]; name = game['name'] if pid == 'lanternwake' else names[pid]
        proof = (f'<details><summary>Current scope</summary><p>{e(story["capability"])}</p><p>{e(story["limit"])}</p></details>' if pid != 'lanternwake' else '')
        if pid == 'lanternwake':
            proof = (f'<a class="public-action" href="{e(game["build"]["play_url"])}">Play the published snapshot ↗</a>'
                     '<p class="scope-copy">WebGPU required. The published game is a snapshot, not the whole current engine.</p>'
                     if game.get('build') else '<p class="scope-copy">No verified playable build is currently listed.</p>')
        entries.append(f'<article class="research-entry" id="{e(pid)}" tabindex="-1"><h3>{e(name)}</h3>'
                       f'<p>{e(story["question"])}</p><p>{e(story["opening"])}</p>{proof}</article>')
    sources = ''.join(f'<article class="research-entry"><h3>{e(p["name"])}</h3><p>{e(p["line"])}</p><a class="public-action" href="{e(p["url"])}">Public source ↗</a></article>' for p in legacy['projects'] if p['name'] != 'CaptureSuite')
    related = ''.join(f'<article class="research-entry"><h3>{e(r["name"])}</h3><p>{e(r["question"])}</p>'
                      f'<p>{e(r["description"])}</p><details><summary>Current scope</summary>'
                      f'<p>{e(r["stage"])}. {e(r["limit"])}</p></details></article>' for r in experience['relatedWork'])
    return ('<section class="notes" id="projects" tabindex="-1"><span id="work" class="section-alias"></span>'
            f'<p class="section-context">HAMON</p><h2>{e(branch["title"])}</h2><p>{e(branch["lead"])}</p>'
            + ''.join(entries) + '<h3>Try the public work</h3>' + ''.join(public_demo(d) for d in legacy['demos'])
            + f'<details class="related-experiments"><summary>More experiments</summary>{related}</details><details class="related-experiments"><summary>More public source</summary>{sources}</details>'
            '<a href="#forge" class="return-link">← Return to the forge</a></section>')


def recording_figure(forge):
    rec = forge.get('recording')
    if not rec:
        return ''
    return (f'<figure class="recorded-room"><video controls playsinline preload="none" width="{rec["width"]}" '
            f'height="{rec["height"]}" poster="{e(forge["capture"]["src"])}" aria-label="{e(rec["label"])}">'
            f'<source src="{e(rec["src"])}" type="video/mp4"><a href="{e(rec["src"])}">Download the recorded approach</a></video>'
            '<figcaption>A prerecorded camera move from the entrance toward the workbench. Rendered natively by HAMON Engine—not live browser performance.</figcaption></figure>')


def render(data, legacy, experience_content, forge_bundle):
    """Return captured-production semantic body; no engine module, scene data or file reads."""
    experience = experience_content; capture = forge_bundle['capture']
    game = next(g for g in legacy['games'] if g['id'] == 'lanternwake')
    if game.get('build'):
        play = (f'<div class="engine-play"><div><p class="context">A SMALL PUBLIC EXAMPLE</p><h3>Lanternwake</h3>'
                '<p>Restore three lanterns on a small 3D island, then return to the stone arch at dawn.</p></div>'
                f'<a href="{e(game["build"]["play_url"])}">Play the published game <span aria-hidden="true">↗</span></a></div>')
        game_scope = 'Lanternwake is a published browser-game snapshot, not the whole current engine. It requires WebGPU; physical-phone and Safari behavior have not been verified.'
    else:
        play = '<div class="engine-play"><div><h3>Lanternwake</h3><p>No verified playable build is currently listed.</p></div></div>'
        game_scope = 'No verified playable browser build is currently listed.'
    values = {'NAME': e(data['name']), 'GITHUB': e(data['github']), 'LINKEDIN': e(data['linkedin']),
              'CAPTURE_SRC': e(capture['src']), 'CAPTURE_ALT': e(capture['alt']),
              'CAPTURE_WIDTH': str(capture['width']), 'CAPTURE_HEIGHT': str(capture['height']),
              'ENGINE_IMAGE': e(forge_bundle['engineProof']['src']), 'ENGINE_ALT': e(forge_bundle['engineProof']['alt']),
              'ENGINE_WIDTH': str(forge_bundle['engineProof']['width']), 'ENGINE_HEIGHT': str(forge_bundle['engineProof']['height']),
              'RESEARCH': research_section(experience), 'HACKATHONS': hackathon_section(experience),
              'PROJECTS': projects_section(data, legacy, experience), 'RECORDING': recording_figure(forge_bundle),
              'GAME_PANEL': play, 'GAME_SCOPE': e(game_scope)}
    body = TEMPLATE
    for key, value in values.items():
        body = body.replace('__'+key+'__', value)
    return body


TEMPLATE = '\n<a class="skip" href="#projects">Skip to projects</a><main id="main"><section class="threshold" id="forge">\n<div class="environment"><img class="room-fallback" src="__CAPTURE_SRC__" width="__CAPTURE_WIDTH__" height="__CAPTURE_HEIGHT__" alt="__CAPTURE_ALT__"></div>\n<div class="veil" aria-hidden="true"></div>\n<header><h1><a class="identity" href="#intro">__NAME__<span class="identity-dot" aria-hidden="true">.</span></a></h1><nav aria-label="Elsewhere"><a href="__GITHUB__">GitHub ↗</a><a href="__LINKEDIN__">LinkedIn ↗</a></nav></header>\n<section class="introduction" id="intro"><p>Computer science &amp; physics at CSULB.<br>Neuroscience, engineering,<br>and an original universe.</p></section>\n<nav class="worlds" aria-label="Explore my work">\n<a class="world research" href="#research"><span class="point" aria-hidden="true"></span><span class="world-label">Research</span><span class="world-note">Academic &amp; independent inquiry</span><span class="arrow" aria-hidden="true">↗</span></a>\n<div id="hamon" class="world selected" aria-current="location"><span class="point" aria-hidden="true"></span><span class="world-label">HAMON</span><span class="world-note">Engine, applications, and experiments.</span><div class="forge-links"><a href="#engine" data-engine>Engine<span>↗</span></a><a href="#hackathons">Hackathons<span>↗</span></a><a href="#projects">Projects<span>↗</span></a></div></div>\n<a class="world spire" href="https://spireofoctaves.com/"><span class="point" aria-hidden="true"></span><span class="world-label">Spire of Octaves</span><span class="world-note">An original multimedia universe</span><span class="arrow" aria-hidden="true">↗</span></a>\n</nav>\n<div class="scene-title"><span class="title-rule" aria-hidden="true"></span><a class="scene-direct" href="#engine" data-engine>Explore <br><em>Hamon Engine.</em><span aria-hidden="true"> ↗</span></a></div>\n\n\n<footer><span>Captured HAMON Engine view</span><a href="#about-art">About this scene <span aria-hidden="true">+</span></a></footer>\n</section>\n<section class="engine-view" id="engine" aria-labelledby="engine-heading"><span id="hamon-engine" class="section-alias"></span>\n<a class="back-to-forge" href="#forge" data-forge>← Back to the forge</a>\n<div class="engine-heading"><p class="context">HAMON / ENGINE</p><h2 id="engine-heading" tabindex="-1">The machinery<br>for making worlds.</h2><p class="engine-lead">A custom Rust + wgpu engine. Rendering, simulation, content tools, and programmable control—built as one engineering project.</p></div>\n<figure class="engine-output"><img src="__ENGINE_IMAGE__" width="__ENGINE_WIDTH__" height="__ENGINE_HEIGHT__" alt="__ENGINE_ALT__"><figcaption><span>Actual Hamon Engine output</span><span>Captured stylized rendering study</span></figcaption></figure>\n<div class="systems" aria-label="Explore engine systems">\n<div class="system-tabs" role="tablist" aria-label="Engine systems"><button id="rendering-tab" type="button" role="tab" aria-selected="true" aria-controls="rendering-panel" tabindex="0">Rendering</button><button id="simulation-tab" type="button" role="tab" aria-selected="false" aria-controls="simulation-panel" tabindex="-1">Simulation</button><button id="tools-tab" type="button" role="tab" aria-selected="false" aria-controls="tools-panel" tabindex="-1">Tools</button></div>\n<section id="rendering-panel" class="system-panel" role="tabpanel" aria-labelledby="rendering-tab" tabindex="0"><h3>Give a world its own visual language.</h3><p>Physically based lighting and stylized rendering live in the same workspace, alongside skeletal animation. Hamon also renders the original forge built for this portfolio. The image above is another actual recorded engine output.</p></section>\n<section id="simulation-panel" class="system-panel" role="tabpanel" aria-labelledby="simulation-tab" tabindex="0"><h3>Make the world respond.</h3><p>Rigid-body and hinge physics sit alongside replayable CPU simulation. Rendering and simulation are parts of the engineering project, not a claim that every subsystem is unified in one native editor.</p></section>\n<section id="tools-panel" class="system-panel" role="tabpanel" aria-labelledby="tools-tab" tabindex="0"><h3>Turn editable ideas into runtime assets.</h3><p>Mesh recipes, editable assets and cooked packs connect the content workflow. CLI, JSON-RPC and MCP interfaces make the engine programmable as well as visual.</p></section>\n</div>\n__GAME_PANEL__\n<details class="engine-scope"><summary>Build scope &amp; access</summary><p>The engine source is private. __GAME_SCOPE__</p><a href="https://jacobmetoyer.com/games/lanternwake/evidence.json">Published game evidence ↗</a></details>\n</section>\n__RESEARCH____HACKATHONS____PROJECTS__<section class="notes" id="about-art"><span id="credits" class="section-alias"></span><h2>About this room</h2><p>This forge is an original, editable 3D presentation environment. Its geometry, materials and lighting are rendered by HAMON Engine’s maintained realtime renderer. It is not a photograph of Jacob’s workshop or a historical reconstruction, and contains no AI-generated backdrop.</p><p>The view on this page is a captured native HAMON Engine render, not a live 3D walkthrough. The optional recording shows an authored camera move through the same room, not browser-performance footage.</p>__RECORDING__<a class="public-action" href="assets/fonts/OFL.txt">Space Grotesk font license ↗</a></section>\n</main>'
