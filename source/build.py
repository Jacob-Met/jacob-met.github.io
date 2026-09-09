#!/usr/bin/env python3
"""Build a small, public-only personal site. Python stdlib; no network or secrets.

Usage: python build.py --out docs
Content and template changes remain ordinary reviewable source edits. This tool
never discovers personal files, publishes a repository, or changes an account.
"""
from __future__ import annotations
import argparse, hashlib, html, json, re, shutil
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
BASE = 'https://jacob-met.github.io'
STAMP = '2026-09-09'
NAV = [('work.html','Work'),('research.html','Research'),('spire.html','M. Schauz'),('computing.html','Software'),('making.html','Making'),('about.html','About')]
ALLOWED_HOSTS = {'github.com','www.instagram.com','myanimelist.net','www.royalroad.com','www.linkedin.com','www.csulbtbp.org'}
E = html.escape

def safe_url(value: str) -> str:
    if not isinstance(value,str) or len(value)>600 or any(c.isspace() for c in value):
        raise ValueError('Invalid URL')
    u=urlsplit(value)
    if u.scheme!='https' or u.hostname not in ALLOWED_HOSTS or u.username or u.password or u.port or u.query or u.fragment:
        raise ValueError('URL outside the approved public link set')
    return value

def validate(data: dict) -> None:
    if not isinstance(data,dict) or data.get('visibility')!='public':
        raise ValueError('Only explicitly public content can be built')
    if data.get('name')!='Jacob Metoyer' or data.get('byline')!='M. Schauz':
        raise ValueError('Identity differs from the approved public record')
    if set(data)!={'visibility','name','byline','updated','identities','work'}:
        raise ValueError('Unexpected root field: public export must be explicit')
    if not isinstance(data['work'],list) or not isinstance(data['identities'],list):
        raise ValueError('Expected explicit lists')
    seen=set()
    for row in data.get('work',[]):
        if not isinstance(row,dict) or set(row)!={'id','title','category','status','route','summary','role','evidence','limitations','links','visibility','publication_approved'}:
            raise ValueError('Unexpected work field')
        if row.get('visibility')!='public' or row.get('publication_approved') is not True:
            raise ValueError('Work entry lacks public approval')
        ident=row.get('id','')
        if not re.fullmatch(r'[a-z][a-z0-9-]{1,48}',ident) or ident in seen:
            raise ValueError('Invalid or duplicate work id')
        seen.add(ident)
        for key in ('title','summary','status','category','role','evidence','limitations'):
            if not isinstance(row.get(key),str) or not 1<=len(row[key])<=2000:
                raise ValueError(f'Invalid {key}')
        if row['category'] not in ('Research','Fiction','Computing','Making'):
            raise ValueError('Unknown category')
        route=row.get('route','')
        if route not in {x[0] for x in NAV}: raise ValueError('Invalid internal route')
        for link in row.get('links',[]):
            if set(link)!={'label','url'}:raise ValueError('Unexpected link field')
            safe_url(link['url'])
            if not isinstance(link.get('label'),str) or not link['label']:raise ValueError('Missing link label')
    for link in data.get('identities',[]):
        if set(link)!={'label','url'}:raise ValueError('Unexpected identity field')
        safe_url(link['url'])
    if not seen:raise ValueError('Empty public catalogue')

def link(url: str,label: str,cls: str='text-link') -> str:
    safe_url(url)
    return f'<a class="{E(cls)}" href="{E(url,quote=True)}" rel="me noopener">{E(label)} <span aria-hidden="true">↗</span></a>'

def paragraphs(items: list[str]) -> str:
    return ''.join(f'<p>{E(x)}</p>' for x in items)

def section_intro(kicker: str,title: str,body: str='') -> str:
    return f'<header class="page-intro"><p class="eyebrow">{E(kicker)}</p><h1>{E(title)}</h1>'+ (f'<p class="intro">{E(body)}</p>' if body else '')+'</header>'

def layout(name: str,title: str,desc: str,body: str, data: dict) -> str:
    nav=''.join(f'<a href="{p}"'+(' aria-current="page"' if name==p else '')+f'>{E(t)}</a>' for p,t in NAV)
    schema={'@context':'https://schema.org','@type':'Person','name':data['name'],'alternateName':data['byline'],'url':BASE,'sameAs':[x['url'] for x in data['identities']]}
    structured=json.dumps(schema,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e')
    canonical=BASE+'/'+('' if name=='index.html' else name)
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)} · Jacob Metoyer</title><meta name="description" content="{E(desc,quote=True)}">
<meta name="theme-color" content="#183c31"><meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="canonical" href="{canonical}"><link rel="icon" href="assets/mark.svg" type="image/svg+xml"><link rel="stylesheet" href="style.css">
<meta property="og:type" content="website"><meta property="og:title" content="{E(title,quote=True)} · Jacob Metoyer"><meta property="og:description" content="{E(desc,quote=True)}"><meta property="og:url" content="{canonical}"><meta property="og:image" content="{BASE}/assets/spire-hero.webp">
<script type="application/ld+json">{structured}</script><script src="site.js" defer></script></head>
<body><a class="skip" href="#main">Skip to content</a><header class="masthead"><a class="wordmark" href="index.html" aria-label="Jacob Metoyer home">Jacob <strong>Metoyer</strong><span class="wordmark-note">an ongoing body of work</span></a><nav aria-label="Main navigation">{nav}</nav></header>
<main id="main">{body}</main>
<footer class="footer"><div><a class="footer-name" href="index.html">Jacob Metoyer</a><p>Research, fiction, software, and making.<br>M. Schauz is my creative byline.</p></div><div class="footer-links"><a href="now.html">Now</a><a href="process.html">AI &amp; authorship</a><a href="credits.html">Sources &amp; credits</a><a href="privacy.html">Privacy</a></div><div class="footer-links"><a href="https://github.com/Jacob-Met" rel="me noopener">GitHub ↗</a><a href="https://www.instagram.com/tornadocos/" rel="me noopener">Cosplay ↗</a><a href="https://myanimelist.net/profile/TornadoZW" rel="me noopener">MyAnimeList ↗</a><small>Revised September 9, 2026<br>Jacob Metoyer / M. Schauz</small></div></footer>
</body></html>'''

def card(row: dict,compact: bool=False) -> str:
    heading='h3' if compact else 'h2'
    return f'''<article class="work-card" data-category="{E(row['category'])}"><div class="card-top"><span class="category">{E(row['category'])}</span><span class="status">{E(row['status'])}</span></div><{heading}><a href="{E(row['route'])}#{E(row['id'])}">{E(row['title'])}<span aria-hidden="true">↗</span></a></{heading}><p>{E(row['summary'])}</p></article>'''


def project_detail(row: dict) -> str:
    links=' '.join(link(x['url'],x['label']) for x in row.get('links',[]))
    return f'''<article id="{E(row['id'])}" class="project-detail"><div class="detail-label"><p class="eyebrow">{E(row['category'])}</p><span class="status">{E(row['status'])}</span></div><div class="detail-body"><h2>{E(row['title'])}</h2><p class="lead">{E(row['summary'])}</p><p class="contribution">{E(row['role'])}</p><div class="project-links">{links}</div><details class="project-notes"><summary>Project notes &amp; scope</summary><dl class="evidence"><dt>What exists</dt><dd>{E(row['evidence'])}</dd><dt>Scope</dt><dd>{E(row['limitations'])}</dd></dl></details></div></article>'''


def build(out: Path,data: dict|None=None) -> dict:
    data=json.loads((ROOT/'content.json').read_text(encoding='utf-8')) if data is None else data
    validate(data)
    out=out.resolve()
    if out==ROOT or ROOT.is_relative_to(out):raise ValueError('Output must not replace source')
    allowed_files={'index.html','work.html','research.html','spire.html','computing.html','making.html','about.html','process.html','now.html','credits.html','privacy.html','404.html','style.css','site.js','.nojekyll','robots.txt','sitemap.xml','work.json','build-manifest.json','assets/mark.svg','assets/spire-hero.webp','assets/seamwork.webp','assets/reminder.webp'}
    if out.exists():
        for existing in out.rglob('*'):
            if existing.is_symlink() or (existing.is_file() and existing.relative_to(out).as_posix() not in allowed_files):
                raise ValueError('Output contains unexpected material; refuse to overwrite or publish it')
    out.mkdir(parents=True,exist_ok=True)
    pages={}; work=data['work']
    home='''<section class="hero"><div class="hero-copy"><p class="eyebrow">Jacob Metoyer / Selected work</p><h1>A life<br><em>in works.</em></h1><p class="intro">I'm Jacob. I study living systems and build tools to look more closely. Elsewhere, I'm writing my way through an imagined city—and occasionally turning a character into something I can wear.</p><div class="actions"><a class="button" href="work.html">Explore the work <span aria-hidden="true">↗</span></a><a class="text-link" href="about.html">A little about me →</a></div></div><figure class="hero-art"><img src="assets/spire-hero.webp" alt="An immense industrial city with glowing windows, pipes, bridges, and falling water; concept artwork for Spire of Octaves" width="1600" height="900" fetchpriority="high"><figcaption><span>From Spire of Octaves</span><a href="spire.html">The world of M. Schauz ↗</a></figcaption><span class="art-label" aria-hidden="true">01 / A world in progress</span></figure></section>
<section class="identity-strip" aria-label="Elsewhere in the work"><p>Follow a thread.<br><strong>See where it leads.</strong></p><a href="research.html">Jacob Metoyer<span>research &amp; computation</span></a><a href="spire.html">M. Schauz<span>fiction &amp; imagined worlds</span></a><a href="making.html">tornadocos<span>cosplay &amp; physical making</span></a></section>
<section class="section"><div class="section-heading"><div><p class="eyebrow">Selected work</p><h2>A few places<br>to begin.</h2></div><p>A city sustained by its people. A closer look at how a body moves. The tools and objects that take shape around those questions.</p></div><div class="work-grid featured-grid">'''+''.join(card(x,compact=True) for x in work if x['id'] in ('spire-world','research-movement','capturesuite','cosplay'))+'''</div><a class="text-link end-link" href="work.html">Browse all work →</a></section>
<section class="research-band"><p class="eyebrow">Research / The longer view</p><div><h2>Learning to look<br>more closely.</h2><p>My research has taken me from behavioral observation to protein trajectories and human movement. Biology and medicine are the longer thread: I hope to pursue an MD/PhD, and to keep building better ways to ask questions about living systems.</p><a class="text-link" href="research.html">Follow the research →</a></div></section>
<section class="section process-teaser"><p class="eyebrow">Behind the work</p><h2>A closer look<br><em>at the process.</em></h2><p>I use AI in the work, from exploring an idea to revising an implementation or a passage. The process notes explain my contribution, how I check the results, and where collaborators and source material belong.</p><a class="text-link" href="process.html">Read the process notes →</a></section>'''
    pages['index.html']=('A life in works','The connected work of Jacob Metoyer: biology and medicine, computation, fiction as M. Schauz, and cosplay as tornadocos.',home)
    filters='''<div class="filter-wrap" hidden><div class="filters" role="group" aria-label="Filter work by field">'''+''.join(f'<button type="button" data-filter="{x}" aria-pressed="{str(x=="All").lower()}">{x}</button>' for x in ['All','Research','Fiction','Computing','Making'])+'''</div><p id="filter-count" role="status" aria-live="polite"></p></div>'''
    body=section_intro('Public index','An open notebook.','Follow a project from the idea to what exists today. Some have source code or a place to read; others are still taking shape.')+filters+'<section class="work-grid catalogue" aria-label="Public work">'+''.join(card(x) for x in work)+'</section><aside class="note">Each project page includes my contribution, its current stage, and links or notes for looking further.</aside>'
    pages['work.html']=('Work','A navigable record of research, fiction, software and making by Jacob Metoyer.',body)
    body=section_intro('Biology / medicine / computation','Questions worth staying with.','I want to understand living systems well enough to ask better questions about them. My path so far moves between the lab, human movement, and the computational methods that help us see patterns in both.')+'''<section class="research-intro"><div><h2>From behavior to movement.</h2><p>My research experience includes behavioral neuroscience, molecular dynamics and protein modeling, rehabilitation data, and surgical ergonomics. I am interested in how we measure complex biological systems and how computational methods can help us ask better questions about them.</p></div><aside class="education"><p class="eyebrow">Education &amp; training</p><h3>California State University,<br>Long Beach</h3><p>Computer science and physics<br>Biology minor<br>BUILD Scholar</p><p class="small">Undergraduate studies. MD/PhD is a future goal, not a current credential.</p></aside></section>'''+''.join(project_detail(x) for x in work if x['category']=='Research')+'''<aside class="note">These summaries describe my contributions and areas of work. They do not release participant data, confidential research material, or unpublished findings. </aside>'''
    pages['research.html']=('Research','Jacob Metoyer’s research interests and experience in biology, behavioral neuroscience, protein modeling, rehabilitation and human movement.',body)
    body=section_intro('Fiction & worldbuilding / M. Schauz','Spire of Octaves.','Fantasy about the people who keep worlds alive.')+'''<figure class="wide-art"><img src="assets/spire-hero.webp" alt="Spire concept artwork: a vast inhabited industrial interior, layered bridges and amber light" width="1600" height="900"><figcaption>Spire publication artwork. Concept image, not a screenshot of a completed game. <a href="credits.html">Artwork &amp; process notes →</a></figcaption></figure><section class="split-story" id="spire-world"><div><p class="eyebrow">The world</p><h2>Work, warmth,<br>and the cost of being useful.</h2></div><div><p>Spire of Octaves begins with people trying to keep themselves and their households alive inside a vertical city. Pipes, labor, obligations, reputation, and power shape the world as much as its fantastic elements.</p><p>The main narrative follows Dorren and a working-class household. A useful ability draws attention; attention brings people who want a claim on it. The larger world is built to sustain more than one story.</p><p>The writing is the starting point. Companion stories, worldbuilding, and visual development make room to explore the city from other lives and other perspectives. Interactive work and animation remain possibilities for its future.</p><p>I write this body of fiction as <strong>M. Schauz</strong>.</p></div></section><section class="section"><div class="section-heading"><div><p class="eyebrow">Ways into the fiction</p><h2>Stories with their own doors.</h2></div></div><div class="books"><article id="seamwork" class="book"><img src="assets/seamwork.webp" alt="Seamwork cover, credited to M. Schauz" width="400" height="600" loading="lazy"><div><p class="eyebrow">Serial / reader link</p><h2>Seamwork</h2><p>Harl means to stay boring. The road won't let him. A journey with a marriage cart through the Greel becomes a story about the price of using a craft he has been trying not to use.</p><a class="text-link" href="https://www.royalroad.com/fiction/183255/seamwork">Read on Royal Road ↗</a><p class="small">Available chapters are on Royal Road.</p></div></article><article id="cold-reminder" class="book"><img src="assets/reminder.webp" alt="A Cold Reminder cover, credited to M. Schauz" width="400" height="600" loading="lazy"><div><p class="eyebrow">Working manuscript</p><h2>A Cold Reminder</h2><p>Kler climbs for a release. The gates take memory as toll. A separate short-novel project in the creative archive, with its own cast and central cost.</p><p class="small">In development; not yet released.</p></div></article></div><article class="veria-note" id="veria"><div><p class="eyebrow">Working long-form fiction</p><h2>Veria</h2></div><p>A separate long-form book project with its own narrative identity and reading path, alongside the larger Spire body of work.</p></article></section><section class="archive-note"><h2>Behind the visible work</h2><p>Away from the reading pages, the world grows through revisions, companion stories, languages, and locations. The archive is a working space; the published fiction has its own pace.</p><details><summary>Notes on the working manuscripts</summary><p>A September 9, 2026 read-only inventory found 425 numbered main-narrative chapter files, 32 Veria files, 12 Seamwork files, and 28 A Cold Reminder files in their designated working chapter directories. Revision directories, duplicate exports, and archived copies were not counted as extra chapters.</p><p>These are source-file counts—not published, final, peer-reviewed, or reader-validated chapters. The site does not automatically publish the writing archive.</p></details></section>'''
    pages['spire.html']=('M. Schauz · Spire of Octaves','Spire of Octaves, Seamwork, Veria and A Cold Reminder: the fiction and worldbuilding of Jacob Metoyer, writing as M. Schauz.',body)
    body=section_intro('Software & computational work','Tools I wanted to exist.','Some problems are easier to understand once there is a tool to explore them with. These are a few of mine, with source code and documentation to follow.')+''.join(project_detail(x) for x in work if x['category']=='Computing')+'''<aside class="note">Some software uses AI-assisted implementation. The scope, licensing, installation instructions, and current state live in the project repositories. Third-party names and platforms do not imply affiliation or endorsement.</aside>'''
    pages['computing.html']=('Computing','CaptureSuite, CanvasPilot, uma-sim and other public computational work by Jacob Metoyer.',body)
    body=section_intro('Cosplay / objects / culture','Some of it leaves the screen.','A character on a page becomes a sketch, then a model, then a problem of shape and fit. Cosplay is where those ideas meet materials.')+''.join(project_detail(x) for x in work if x['category']=='Making')+'''<section class="split-story"><div><p class="eyebrow">From character to object</p><h2>Making something<br>you can actually wear.</h2></div><div><p>My cosplay work includes CAD, Blender studies, 3D-printable parts, and prop and armor projects inspired by the stories I enjoy. The making archive includes work around Kingdom and Gilgamesh.</p><p>The process moves between digital models and material constraints: a promising shape on screen still has to print, fit, and move. My cosplay account is where to follow the finished looks.</p><p>These are fan works. The original characters and settings belong to their respective creators; a cosplay is not a claim to their intellectual property.</p></div></section><section class="culture"><p class="eyebrow">Watching, reading, playing</p><h2>Taste is part of the story.</h2><p>Anime, manga, and games are interests in their own right. They also feed the worlds I imagine and the things I make. MyAnimeList lives under <strong>TornadoZW</strong>; my cosplay account is <strong>tornadocos</strong>.</p><div class="actions"><a class="button" href="https://myanimelist.net/profile/TornadoZW" rel="me noopener">MyAnimeList ↗</a><a class="text-link" href="https://www.instagram.com/tornadocos/" rel="me noopener">Cosplay on Instagram ↗</a></div></section>'''
    pages['making.html']=('Making & interests','Cosplay as tornadocos, CAD and physical props, anime and manga as TornadoZW: another part of Jacob Metoyer’s body of work.',body)
    body=section_intro('The person behind the work','Jacob Metoyer.','A little about where the questions come from.')+'''<article class="prose"><p class="opening">I like following a question far enough that it asks me to learn something new.</p><p>Biology and medicine are the longer thread. At CSULB, I study computer science and physics, with a biology minor, and my research experience has moved between behavior, protein modeling, rehabilitation, and surgical ergonomics. I hope to pursue an MD/PhD and bring those ways of thinking into physician-scientist work.</p><p>Computation gives me ways to look more closely, but it is also something I enjoy in its own right. Research capture, practical interfaces, and simulations all offer different problems to work through. Some of those tools have become public projects; their code and documentation live here alongside the research.</p><h2>Beyond the lab and the code.</h2><p>I write as <strong>M. Schauz</strong>. Spire of Octaves is an imagined city whose pipes, labor, and households matter as much as its fantastic elements. I am interested in the people keeping it alive, and in what happens when being useful gives someone else a claim on you.</p><p>Cosplay brings a different kind of attention. A character becomes a shape to model, a part to print, a costume to fit. I share that work as <strong>tornadocos</strong>. Anime, manga, and games are also things I simply enjoy; my reading and watching lists are under <strong>TornadoZW</strong>.</p><h2>Still taking shape.</h2><p>Some of these interests meet, and some are worth following on their own. This site gives the work somewhere to develop without asking it all to become the same thing.</p><p>AI is part of the process. I explain my contribution, the checks behind the work, and its sources in the <a href="process.html">process notes</a>. I want the trail to be useful to someone who comes after the finished page.</p><p><a class="text-link" href="now.html">What's on the workbench →</a></p></article>'''
    pages['about.html']=('About','Jacob Metoyer, also writing as M. Schauz: research, computation, fiction, cosplay, and a life led by genuine interests.',body)
    body=section_intro('AI / authorship / process','How the work gets made.','Tools can widen a practice. The decisions still need a person behind them.')+'''<article class="prose"><p class="opening">I use AI to explore, develop, and revise the work. I am responsible for what I choose to release.</p><p>That can mean working through an implementation, trying a direction in a story, or examining an unfamiliar method. I don't claim that every line was typed by me or every image was drawn by hand. My contribution includes the questions, direction, selection, revision, and checking. Where a project involves collaborators or upstream work, those contributions deserve their own credit.</p><h2>The result sets the standard.</h2><p>A useful research method needs a traceable account of the data and its uncertainty. Generated examples can help test a workflow, but they are not observed research data. The research described here is collaborative work, not a claim to clinical practice or independently validated treatment.</p><p>For software, the supported examples, tests, installation notes, and known limits belong with the source. Passing a test tells us something about the behavior it actually checks. It is a starting point for inspection, not a promise about every possible use.</p><p>Fiction asks something else of a reader: attention to character, language, atmosphere, and the experience of the story. AI assistance is disclosed here, but it cannot settle whether a passage works. That has to be found in the reading and the revision.</p><p>Physical making adds its own resistance. A model has to become a print, a fitted object, or a costume that can move. I keep those stages distinct, just as a working manuscript remains distinct from a published chapter.</p><h2>Leave the trail visible.</h2><p>The project pages keep the contribution, current stage, and supporting notes close to the work. The <a href="credits.html">credits</a> collect sources and attribution. Confidential research material and private drafts stay outside this site.</p><p>As the work improves, its record should improve with it: clearer explanations, better checks, and more useful things to read, inspect, or try.</p></article>'''
    pages['process.html']=('AI & authorship','How Jacob Metoyer approaches AI assistance, authorship, credit, evidence, and responsibility across different kinds of work.',body)
    body=section_intro('Now / September 9, 2026','On the workbench.','A few threads I am following this September. Updated September 9, 2026.')+'''<div class="now-grid"><section><p class="eyebrow">Research</p><h2>Biology, movement, and computational methods.</h2><p>Continuing research connected to rehabilitation and surgical ergonomics while developing a longer-term path toward physician-scientist work. The MD/PhD remains an aspiration.</p></section><section><p class="eyebrow">Fiction</p><h2>Giving the world room to grow.</h2><p>Working with the Spire of Octaves body of fiction, its related manuscripts and world material. M. Schauz is now openly connected to Jacob Metoyer.</p></section><section><p class="eyebrow">Software & making</p><h2>Following the problems that hold my attention.</h2><p>Research tools, computational projects, cosplay and physical making remain active interests. Not everything is ready for public release or needs to be.</p></section><section><p class="eyebrow">This record</p><h2>Leaving a better trail.</h2><p>Bringing the research, software, and creative projects into a place that is easier to explore. The next additions will follow the work as it develops.</p></section></div><aside class="note">This page is a dated snapshot. Project pages and their linked repositories or reading platforms carry the more detailed record.</aside>'''
    pages['now.html']=('Now','A dated snapshot of Jacob Metoyer’s research, writing, software and creative interests.',body)
    body=section_intro('Sources & credits','Make the connections visible.','A public record should distinguish where a description comes from and what it establishes.')+'''<article class="prose"><h2>Identity</h2><p>Jacob Metoyer, M. Schauz, tornadocos, and TornadoZW are linked here with the account owner's explicit authorization. This site does not claim to speak for an employer, university, laboratory, or platform.</p><h2>Research descriptions</h2><p>Research summaries draw on my CV and project records. They describe my contributions to collaborative work; confidential data and unpublished scientific findings are not included.</p><h2>Public software</h2><p>CaptureSuite, CanvasPilot, and uma-sim descriptions are based on their public repository documentation. The repositories, rather than this site, are the source for installation, licensing, current feature support, and technical limitations.</p><ul><li><a href="https://github.com/Jacob-Met/CaptureSuite">CaptureSuite source and licensing</a></li><li><a href="https://github.com/Jacob-Met/canvaspilot">CanvasPilot source and responsible-use notes</a></li><li><a href="https://github.com/Jacob-Met/uma-sim">uma-sim source and notice</a></li></ul><h2>Spire writing and images</h2><p>Spire material comes from the existing M. Schauz writing and author-site archive. The city image is concept artwork, not a photograph or completed game screenshot. The two covers are existing publication-packaging assets. They have been resized for this site, with unnecessary metadata removed.</p><p>The project uses AI-assisted creative processes. The specific generation model and complete image-generation history are not asserted here. Publication status is not inferred from a local export or cover existing.</p><h2>Cosplay and fan work</h2><p>The linked cosplay account belongs to me. Original characters, franchises, and other creators' designs retain their own rights. This page does not redistribute costume patterns or assets whose licensing has not been established.</p><h2>Website</h2><p>This presentation was built with AI assistance and uses an explicit public-only content record, a small static generator, and no paid runtime or embedded trackers. Website test results establish only the tested presentation and build behavior—not the quality of every project described here.</p></article>'''
    pages['credits.html']=('Sources & credits','Source, authorship, image and attribution notes for Jacob Metoyer’s public body of work.',body)
    body=section_intro('Privacy','A small, static site.')+'''<article class="prose"><p>This site does not include an analytics tracker, newsletter form, advertising pixel, account system, checkout, or embedded social-media feed. Its fonts and presentation assets do not require a third-party font request.</p><p>The hosting provider may process ordinary connection and request information to serve the site. Following an external link takes you to a separate service with its own privacy practices.</p><p>Do not send private research data, patient or participant information, credentials, or sensitive files through a social profile linked here. Public links are not a secure research intake channel.</p></article>'''
    pages['privacy.html']=('Privacy','Privacy notes for this static personal website.',body)
    pages['404.html']=('Not found','This page is not part of the current public record.',section_intro('404',"That page is not here.",'The work may have moved, or the link may be incomplete.')+'<p class="back-home"><a class="button" href="index.html">Return home →</a></p>')
    for name,(title,desc,body) in pages.items():
        (out/name).write_text(layout(name,title,desc,body,data),encoding='utf-8',newline='\n')
    for name in ['style.css','site.js']:
        shutil.copyfile(ROOT/name,out/name)
    (out/'assets').mkdir(exist_ok=True)
    if (ROOT/'assets').exists():
        for f in (ROOT/'assets').iterdir():
            if f.is_file() and f.name in ('mark.svg','spire-hero.webp','seamwork.webp','reminder.webp'):
                shutil.copyfile(f,out/'assets'/f.name)
    (out/'.nojekyll').write_text('',encoding='utf-8',newline='\n')
    (out/'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n',encoding='utf-8',newline='\n')
    sm='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(f'<url><loc>{BASE}/{"" if p=="index.html" else p}</loc><lastmod>{STAMP}</lastmod></url>' for p in pages if p!='404.html')+'</urlset>'
    (out/'sitemap.xml').write_text(sm,encoding='utf-8',newline='\n')
    (out/'work.json').write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
    manifest={str(f.relative_to(out)).replace('\\','/'):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(out.rglob('*')) if f.is_file() and f.name!='build-manifest.json'}
    (out/'build-manifest.json').write_text(json.dumps({'schema':1,'date':STAMP,'sha256':manifest},indent=2)+'\n',encoding='utf-8',newline='\n')
    return {'pages':len(pages),'public_work_entries':len(work),'output':str(out),'files':len(manifest)+1}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,default=ROOT.parent/'docs');a=p.parse_args();print(json.dumps(build(a.out),indent=2))
