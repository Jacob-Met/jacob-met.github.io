"""Pure portfolio lobby renderer with recorded HAMON camera routes and public work.
Build validation and ordered script/SRI insertion are owned by build.py.
"""
from html import escape
import wildside_page


def e(value):
    return escape(str(value), quote=True)


def branch_arrival(route):
    if not route:
        return ''
    still = route['still']
    return (f'<figure class="branch-arrival"><img loading="lazy" src="{e(still["src"])}" '
            f'width="{still["width"]}" height="{still["height"]}" alt="{e(still["alt"])}">'
            f'<figcaption><span>{e(route["location"])}</span><small>Native HAMON Engine render</small></figcaption></figure>')


def branch_videos(branches):
    return ''.join(f'<video id="route-{key}-{direction}" data-route="{key}" data-direction="{direction}" muted playsinline preload="none" hidden>'
                   f'<source src="{e(branches[key]["media"][direction]["src"])}" type="video/mp4"></video>'
                   for key in ('hackathons', 'projects') if key in branches for direction in ('forward', 'reverse'))


def room_nav(current):
    """An ordinary link map: useful without scripts, spatial when enhanced."""
    routes = [('forge', 'The forge'), ('research', 'Research'), ('engine', 'Engine'),
              ('hackathons', 'Hackathons'), ('projects', 'Projects')]
    links = []
    for route, label in routes:
        attrs = (' data-engine' if route == 'engine' else '')
        attrs += (' aria-current="page"' if route == current else '')
        links.append(f'<a href="#{route}"{attrs}>{label}</a>')
    return '<nav class="room-nav" aria-label="Explore the forge">' + ''.join(links) + '</nav>'


def computed_figure(figure):
    if not figure:
        return ''
    mobile = figure.get('mobile') if figure else None
    source = (f'<source media="(max-width: 800px)" type="image/svg+xml" srcset="{e(mobile["src"])}" width="{mobile["width"]}" height="{mobile["height"]}">' if mobile else '')
    return (f'<figure class="project-figure"><picture>{source}<img loading="lazy" src="{e(figure["src"])}" width="{figure["width"]}" height="{figure["height"]}" alt="{e(figure["alt"])}"></picture>'
              f'<figcaption>{e(figure["label"])}</figcaption></figure>' if figure else '')


def worldlaw_experiment(figure):
    """Four computed model probes; no JS, measured data, or form submission."""
    if not figure:
        return ''
    from math import radians, sin
    choices = (5, 30, 60, 90)
    controls, probes, readings = [], [], []
    for degrees in choices:
        spring = radians(degrees)
        gravity = sin(spring)
        gap = spring - gravity
        key = f'worldlaw-angle-{degrees}'
        checked = ' checked' if degrees == 90 else ''
        values = f'Spring {spring:.4f}; gravity {gravity:.4f}; prediction gap {gap:.4f}. Normalized torque magnitude.'
        controls.append(f'<input class="worldlaw-choice" type="radio" name="worldlaw-angle" id="{key}" value="{degrees}"{checked}>'
                        f'<label for="{key}">{degrees}°<span class="worldlaw-sr">. {e(values)}</span></label>')
        probes.append(f'<span class="worldlaw-probe worldlaw-probe-{degrees}" aria-hidden="true"><span class="worldlaw-guide"></span><span class="worldlaw-spring"></span><span class="worldlaw-gravity"></span></span>')
        readings.append(f'<p class="worldlaw-reading worldlaw-reading-{degrees}"><span class="worldlaw-angle">At {degrees}°</span> '
                        f'<span class="worldlaw-spring-value">Spring <strong>{spring:.4f}</strong></span> '
                        f'<span class="worldlaw-gravity-value">Gravity <strong>{gravity:.4f}</strong></span> '
                        f'<span>Prediction gap <strong>{gap:.4f}</strong></span></p>')
    mobile = figure['mobile']
    chart = (f'<picture><source media="(max-width: 800px)" type="image/svg+xml" srcset="{e(mobile["src"])}" width="{mobile["width"]}" height="{mobile["height"]}">'
             f'<img loading="lazy" src="{e(figure["src"])}" width="{figure["width"]}" height="{figure["height"]}" alt="{e(figure["alt"])}"></picture>')
    return ('<figure class="project-figure worldlaw-experiment"><fieldset><legend>Where would you measure?</legend>'
            + ''.join(controls) + '<div class="worldlaw-stage">' + chart + ''.join(probes) + '</div>'
            + '<div class="worldlaw-readings">' + ''.join(readings) + '</div></fieldset>'
            + '<figcaption>Computed model predictions, not measurements. Normalized torque magnitude; formulas use radians.</figcaption></figure>')

def public_demo(d, figure=None):
    # Native computations are explanatory illustrations, never passed off as UI captures.
    hooks = {'towerops-airspace': ('See the conflict. Change the outcome.',
                                  'Two paths can look harmless until they cross at the same time. Explore a proposed change, then compare the consequences.'),
             'recallweave': ('A flat line can hide a growing problem.',
                            'Choose “A flat run can hide instability” in the learning lab. Change the starting state or gain.')}
    hook, purpose = hooks.get(d['id'], (d['name'], d['line']))
    experiment = ({'label': 'Try the feedback experiment',
                   'url': 'https://jacobmetoyer.com/RecallWeave/courses/feedback-control-lab.html'}
                  if d['id'] == 'recallweave' else d['play'])
    toolkit = (f'<a href="{e(d["play"]["url"])}">Explore all RecallWeave tools ↗</a>'
               if d['id'] == 'recallweave' else '')
    detail = d['detail'].replace('Synthetic or visitor-provided data only; not operational air-traffic-control software.', 'Synthetic demo, not operational ATC. Uses synthetic or visitor-provided data.') if d['id'] == 'towerops-airspace' else d['detail']
    visual = computed_figure(figure)
    captures = ''.join(
        f'<a href="{e(shot["src"])}" aria-label="{e(d["name"])}: full {label.lower()}">{label}</a>'
        for key, label in [('desktop', 'Desktop capture'), ('mobile', 'Phone capture')]
        for shot in [d['shots'][key]])
    return (f'<article class="feature-story" id="{e(d["id"])}" tabindex="-1">'
            f'<p class="section-context">{e(d["name"])}</p><h3>{e(hook)}</h3><p class="feature-purpose">{e(purpose)}</p>{visual}'
            f'<a class="feature-action" href="{e(experiment["url"])}">{e(experiment["label"])} <span aria-hidden="true">↗</span></a>'
            f'<details class="feature-details"><summary>Source, captures &amp; scope</summary><p>{e(detail)}</p>'
            f'<div class="public-actions">{toolkit}<a href="{e(d["repo"])}">Public source ↗</a>{captures}</div></details></article>')


def research_section(experience, figures=None):
    bio = experience['publicBio']; work = experience['researchWork']; resource = bio['researchResource']
    academic = ''.join(f'<div><dt>{e(x["name"])}</dt><dd>{e(x["focus"])}</dd></div>' for x in work['academic'])
    independent = ''.join(
        f'<article class="research-entry" id="{e(x["id"])}"><p class="section-context">{e(x["name"])}</p>'
        f'<h3>{e(x["question"])}</h3><p>{e(x["output"])}</p>{worldlaw_experiment((figures or {}).get(x["id"])) if x["id"] == "worldlaw" else computed_figure((figures or {}).get(x["id"]))}<details><summary>Inside the study</summary>'
        f'<p>{e(x["detail"])}</p><p class="scope-copy">{e(x["limit"])}</p></details></article>'
        for x in work['independent'])
    return (f'<section class="work-section" id="research" tabindex="-1"><span id="about" class="section-alias"></span>'
            f'{room_nav("research")}<div class="research-hero"><div class="research-intro"><p class="section-context">Research</p><h2>{e(bio["researchHeading"])}</h2>'
            f'<p>{e(bio["researchLead"])}</p></div><figure class="research-art"><img loading="lazy" src="assets/scene/research-observatory.svg" width="860" height="720" alt="A conceptual brain in profile, with folded surfaces and three branching pathways."><figcaption>Conceptual illustration · not experimental data</figcaption></figure></div><h3>Academic collaboration</h3><p>{e(bio["research"])}</p>'
            f'<dl class="academic-list">{academic}</dl><h3>Independent investigations</h3>{independent}'
            f'<article class="research-entry"><h3>{e(resource["name"])}</h3><p>{e(resource["description"])}</p>'
            f'<a class="public-action" href="{e(resource["url"])}">{e(resource["actionLabel"])} ↗</a>'
            f'<details><summary>Example scope</summary><p>{e(resource["limit"])}</p></details></article>'
            '<a href="#forge" class="return-link">← Return to the forge</a></section>')


def domino_outcomes(experience):
    record = experience['recordedRepairChoices']
    rows = ''.join(f'<details class="repair-outcome"><summary><span>{i:02d}</span><strong>{e(choice["label"])}</strong></summary>'
                   f'<p class="repair-change">{e(choice["change"])}</p><p>{e(choice["outcome"])}</p><p class="repair-verdict">{e(choice["verdict"])}</p></details>'
                   for i, choice in enumerate(record['choices'], 1))
    return ('<article class="domino-study" id="domino-outcomes" tabindex="-1"><p class="section-context">DOMINO / a modeled rule conflict</p>'
            '<h3>Why did the door unlock?</h3><p>A welcome rule meets an empty house. Fixing the visible collision is not the same as fixing the behavior.</p>'
            '<figure class="event-chain"><ol><li><span>Observed</span>Known visitor</li><li><span>Context</span>Resident away</li><li><span>Unwanted result</span>Door unlocks</li></ol>'
            '<figcaption>Recorded local model outcomes. No real-home connection.</figcaption></figure>'
            f'<div class="repair-outcomes">{rows}</div><details class="feature-details"><summary>What was checked</summary><p>{e(record["intro"])}</p><p>{e(record["limit"])}</p></details></article>')


def hackathon_section(experience, route=None):
    branch = next(x for x in experience['hamonBranches'] if x['id'] == 'hackathons')
    entries = []
    for x in branch['entries']:
        link = (f'<a class="public-action" href="{e(x["publicUrl"])}">View the public entry ↗</a>'
                if x.get('publicUrl') else f'<a class="public-action" href="#{e(x["projectId"])}">Explore the project ↓</a>')
        entries.append(f'<article class="research-entry"><h3>{e(x["name"])}</h3><p>{e(x["purpose"])}</p>{link}'
                       f'<details><summary>Project status</summary><p>{e(x["status"])}</p><p>{e(x["limit"])}</p></details></article>')
    return (f'<section class="work-section forge-room" id="hackathons" tabindex="-1">{branch_arrival(route)}<p class="section-context">HAMON</p>'
            f'{room_nav("hackathons")}<h2>One constraint.<br> A working idea.</h2><p>Competition-built projects, each with a question to answer.</p>' + domino_outcomes(experience) + '<details class="related-experiments"><summary>Explore the other projects &amp; competition details</summary>' + ''.join(entries) + '</details>'
            '<a href="#forge" class="return-link">← Return to the forge</a></section>')


def projects_section(data, legacy, experience, figures=None, route=None):
    figures = figures or {}
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
                       f'<p>{e(story["question"])}</p><details><summary>Explore the idea</summary><p>{e(story["opening"])}</p>{proof}</details></article>')
    sources = ''.join(f'<article class="research-entry"><h3>{e(p["name"])}</h3><p>{e(p["line"])}</p><a class="public-action" href="{e(p["url"])}">Public source ↗</a></article>' for p in legacy['projects'] if p['name'] != 'CaptureSuite')
    related = ''.join(f'<article class="research-entry"><h3>{e(r["name"])}</h3><p>{e(r["question"])}</p>'
                      f'<p>{e(r["description"])}</p><details><summary>Current scope</summary>'
                      f'<p>{e(r["stage"])}. {e(r["limit"])}</p></details></article>' for r in experience['relatedWork'])
    return (f'<section class="work-section forge-room" id="projects" tabindex="-1">{branch_arrival(route)}<span id="work" class="section-alias"></span>'
            f'{room_nav("projects")}<p class="section-context">HAMON / PROJECTS</p><h2>Use it.<br> Change something.</h2><p>A few tools and worlds you can try.</p>'
            + wildside_page.card() + ''.join(public_demo(d, figures.get(d['id'])) for d in legacy['demos']) + '<details class="related-experiments"><summary>More tools &amp; experiments</summary>' + ''.join(entries) + '</details>'
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


def engine_style_study(proof):
    """A separate captured rendering study, not a playable world or scene toggle."""
    return ('<figure class="engine-style-study">'
            f'<img loading="lazy" src="{e(proof["src"])}" '
            f'width="{proof["width"]}" height="{proof["height"]}" alt="{e(proof["alt"])}">'
            '<figcaption>A native HAMON Engine rendering study.</figcaption></figure>')


def render(data, legacy, experience_content, forge_bundle):
    """Pure semantic lobby body. Builder validates exact local route media and scripts."""
    lobby = forge_bundle['lobby']; media = forge_bundle.get('presentationStills', lobby['media']); proof = forge_bundle['lobbyProof']
    game = next(g for g in legacy['games'] if g['id'] == 'lanternwake')
    available = bool(game.get('build'))
    game_panel = '<a class="playable" aria-label="Play the published game: Lanternwake" href="https://jacobmetoyer.com/games/lanternwake/"><img loading="lazy" src="games/lanternwake/desktop.png" width="1280" height="1046" alt="Lanternwake\'s small illuminated island in the published browser game."><span><small>A SMALL PLAYABLE WORLD</small><strong>Lanternwake <span aria-hidden="true">↗</span></strong><em>Restore the lights. Return at dawn.</em><small>Published snapshot · WebGPU required</small></span></a>' if available else '<p class="scope-copy">No verified playable build is currently listed.</p>'
    pillars = {x['id']: x for x in experience_content['hierarchy']['pillars']}
    engine = next(x for x in experience_content['projectStories'] if x['projectId'] == 'hamon-engine')
    branches = forge_bundle.get('branches', {})
    values = {
        'BRANCH_VIDEOS': branch_videos(branches),
        'BRANCH_STILL_ATTRIBUTES': ''.join(f' data-{key}-src="{e(route["still"]["src"])}"' for key,route in branches.items()),
        'ENTRY_LEAD': e(experience_content['entry']['lead']),
        'RESEARCH_SUMMARY': e(pillars['research']['summary']),
        'HAMON_SUMMARY': e(pillars['hamon']['summary']),
        'SPIRE_SUMMARY': e(pillars['spire']['summary']),
        'SPIRE_URL': e(pillars['spire']['action']['url']),
        'ENGINE_QUESTION': e(engine['question']), 'ENGINE_OPENING': e(engine['opening']),
        'ENGINE_CAPABILITY': e(engine['capability']), 'ENGINE_LIMIT': e(engine['limit']),
        'ENGINE_NAV': room_nav('engine'), 'ART_NAV': room_nav('about-art'),
        'WS_ALT': e(wildside_page.HERO_ALT), 'WS_HERO': wildside_page.CARD, 'WS_W': str(wildside_page.CARD_SIZE[0]), 'WS_H': str(wildside_page.CARD_SIZE[1]),
        'GITHUB': e(data['github']), 'LINKEDIN': e(data['linkedin']),
        'GAME_PANEL': game_panel,
        'STYLE_STUDY': engine_style_study(forge_bundle['engineProof']),
        'GAME_SCOPE': 'Lanternwake is a published browser-game snapshot and requires WebGPU.' if available else 'No verified playable browser build is currently listed.',
        'GAME_DETAILS': '<a href="https://jacobmetoyer.com/games/lanternwake/evidence.json">Published game details ↗</a>' if available else '',
        'ENTRANCE': e(media['entrance']['src']), 'ARRIVAL': e(media['arrival']['src']),
        'FORWARD': e(lobby['media']['forward']['src']), 'REVERSE': e(lobby['media']['reverse']['src']),
        'ENGINE_IMAGE': e(proof['src']), 'ENGINE_ALT': e(proof['alt']),
        'ENGINE_WIDTH': str(proof['width']), 'ENGINE_HEIGHT': str(proof['height']),
        'ARRIVAL_WIDTH': str(media['arrival'].get('width', lobby['route']['width'])), 'ARRIVAL_HEIGHT': str(media['arrival'].get('height', lobby['route']['height'])),
        'MEDIA_WIDTH': str(media['entrance'].get('width', lobby['route']['width'])), 'MEDIA_HEIGHT': str(media['entrance'].get('height', lobby['route']['height'])),
        'RESEARCH': research_section(experience_content, forge_bundle.get('projectFigures')),
        'HACKATHONS': hackathon_section(experience_content, branches.get('hackathons')),
        'PROJECTS': projects_section(data, legacy, experience_content, forge_bundle.get('projectFigures'), branches.get('projects')),
    }
    body = TEMPLATE
    for key, value in values.items():
        body = body.replace('__' + key + '__', value)
    return body

TEMPLATE = '\n<a class="skip" href="#engine" data-engine data-skip>Skip to the work</a>\n<div class="environment" aria-hidden="true"><img id="scene-still"__BRANCH_STILL_ATTRIBUTES__ data-entrance-src="__ENTRANCE__" data-arrival-src="__ARRIVAL__" src="__ENTRANCE__" width="__MEDIA_WIDTH__" height="__MEDIA_HEIGHT__" alt=""><img id="scene-buffer" src="__ENTRANCE__" width="__MEDIA_WIDTH__" height="__MEDIA_HEIGHT__" alt="" hidden><video id="route-forward" muted playsinline preload="none" hidden><source src="__FORWARD__" type="video/mp4"></video><video id="route-reverse" muted playsinline preload="none" hidden><source src="__REVERSE__" type="video/mp4"></video>__BRANCH_VIDEOS__<div class="reading-light"></div></div>\n<header><a class="identity" href="#forge" data-home aria-label="Jacob Metoyer — return to the forge">JM<span aria-hidden="true">.</span></a><nav aria-label="Site"><a href="hamon.html">HAMON</a><a href="wildside-project.html">Wildside</a><a href="#projects">Projects</a><a href="#about">About</a></nav></header>\n<main id="main"><section class="entrance" id="forge" aria-labelledby="identity-heading"><div class="intro"><p class="eyebrow">FOUNDER OF HAMON · CS + PHYSICS · CSULB</p><h1 id="identity-heading">Jacob<br>Metoyer<span aria-hidden="true">.</span></h1><p>__ENTRY_LEAD__</p></div>\n<nav class="destinations" aria-label="Explore my work"><a href="#research" class="destination destination-research"><span class="number">01</span><span><strong>Research</strong><small>__RESEARCH_SUMMARY__</small></span><span class="out" aria-hidden="true">→</span></a><div class="destination current"><span class="number">02</span><div><strong id="hamon"><a class="hamon-mark hamon-mark-link" href="hamon.html" aria-label="HAMON: about the studio">HAMON</a></strong><small>__HAMON_SUMMARY__</small><a class="enter" href="#engine" data-engine>Explore the Engine <span aria-hidden="true">→</span></a><div class="other-work"><a href="hamon.html">About HAMON</a><a href="#hackathons">Hackathons</a><a href="#projects">Projects</a></div></div></div><a href="__SPIRE_URL__" class="destination destination-spire"><span class="number">03</span><span class="spire-invitation"><strong>Spire of Octaves</strong><small>__SPIRE_SUMMARY__</small><img class="spire-glimpse" loading="lazy" src="assets/editorial/spire-world.webp" width="1200" height="675" alt="Artwork from the Spire of Octaves site: an inhabited vertical city of bridges, pipes, waterfalls and warm-lit windows."></span><span class="out" aria-hidden="true">↗</span></a></nav>\n<aside class="home-flagship" aria-label="Featured from HAMON"><a class="home-flagship-image" href="https://jacobmetoyer.com/wildside/" aria-label="Play Wildside"><img loading="lazy" decoding="async" src="__WS_HERO__" width="__WS_W__" height="__WS_H__" alt="__WS_ALT__"></a><div><p class="eyebrow">PLAY IT NOW · FROM HAMON</p><h2>Wildside</h2><p>A painted place you can walk through, rendered live by the HAMON Engine.</p><p class="home-flagship-actions"><a class="ws-play" href="https://jacobmetoyer.com/wildside/">Play Wildside</a><a href="wildside-project.html">Watch the demo</a></p></div></aside><div class="place-label"><span></span><p>The forge<br><em>A place for making.</em></p></div></section>\n<section class="journey-ui" hidden aria-label="Camera journey"><p id="journey-label" aria-live="polite">Approaching the hearth</p><div><button type="button" data-home>← Return</button><button type="button" id="skip-journey">Skip movement →</button></div></section>\n<section class="engine-story" id="engine" aria-labelledby="engine-heading"><span id="hamon-engine" class="section-alias"></span><figure class="arrival-window" aria-hidden="true"><img loading="lazy" src="__ARRIVAL__" width="__ARRIVAL_WIDTH__" height="__ARRIVAL_HEIGHT__" alt=""></figure>__ENGINE_NAV__<a class="return" href="#forge" data-home>← Back through the forge</a><p class="eyebrow">HAMON ENGINE</p><h2 id="engine-heading" tabindex="-1">__ENGINE_QUESTION__</h2><p class="lead">__ENGINE_OPENING__</p><figure class="output"><img loading="lazy" src="__ENGINE_IMAGE__" width="__ENGINE_WIDTH__" height="__ENGINE_HEIGHT__" alt="__ENGINE_ALT__"><figcaption><span>This room is one of its worlds.</span><small>Native HAMON Engine render</small></figcaption></figure>\n<div class="engine-ideas"><p><span>01</span><strong>Shape what you see.</strong> Physically based light and stylized rendering.</p>__STYLE_STUDY__<p><span>02</span><strong>Make it respond.</strong> Physics, animation and replayable simulation.</p><p><span>03</span><strong>Build the tools, too.</strong> Editable assets and programmable workflows.</p></div>\n__GAME_PANEL__\n<details class="scope"><summary>Inside the engine</summary><p>__ENGINE_CAPABILITY__</p><p>__ENGINE_LIMIT__ __GAME_SCOPE__</p>__GAME_DETAILS__</details></section>__RESEARCH____HACKATHONS____PROJECTS__<section class="work-section" id="about-art" tabindex="-1"><span id="credits" class="section-alias"></span>__ART_NAV__<p class="section-context">The forge</p><h2>A room made with the engine.</h2><p>Original geometry, materials and lighting, rendered by HAMON Engine. These are prerecorded camera journeys through that room; every movement can be skipped.</p><a class="public-action" href="assets/fonts/OFL.txt">Font license ↗</a><a href="#forge" class="return-link">← Return to the forge</a></section></main>\n<footer><span id="presentation-label">Forge rendered with HAMON Engine</span><nav class="foot-links" aria-label="Elsewhere"><a href="__GITHUB__">GitHub ↗</a><a href="__LINKEDIN__">LinkedIn ↗</a></nav><a href="#about-art">About this scene <span aria-hidden="true">+</span></a></footer>\n'
