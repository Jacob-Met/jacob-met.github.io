#!/usr/bin/env python3
"""Build Jacob Metoyer's public academic/research site from an explicit allowlist."""
from __future__ import annotations
import argparse, hashlib, html, json, re, shutil
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
BASE = 'https://jacobmetoyer.com'
STAMP = '2026-09-19'
NAV = [('work.html','Work'),('research.html','Academic research'),('ai-systems.html','AI systems'),('computing.html','Software'),('making.html','Making'),('about.html','About')]
ALLOWED_HOSTS = {'github.com','www.instagram.com','myanimelist.net','www.linkedin.com','www.csulbtbp.org'}
E = html.escape
# W-12: GitHub Pages cannot send headers, so the policy ships as a meta tag. Every resource is
# same-origin; the JSON-LD block is a data block and is never executed, so it needs no allowance.
# Deliberately no upgrade-insecure-requests until HTTPS works on the custom domain (W-01).
# frame-ancestors/report-uri/sandbox are ignored in meta, so they are not claimed here.
CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'"

def safe_url(value: str) -> str:
    if not isinstance(value,str) or len(value)>600 or any(c.isspace() for c in value): raise ValueError('Invalid URL')
    u=urlsplit(value)
    if u.scheme!='https' or u.hostname not in ALLOWED_HOSTS or u.username or u.password or u.port or u.query or u.fragment: raise ValueError('URL outside approved public link set')
    return value

def validate(data: dict) -> None:
    if not isinstance(data,dict) or data.get('visibility')!='public': raise ValueError('Only explicitly public content can be built')
    if data.get('name')!='Jacob Metoyer': raise ValueError('Identity differs from approved public record')
    if set(data)!={'visibility','name','updated','identities','work'}: raise ValueError('Unexpected root field')
    if not isinstance(data['work'],list) or not isinstance(data['identities'],list): raise ValueError('Expected explicit lists')
    seen=set()
    routes={x[0] for x in NAV}
    for row in data['work']:
        if set(row)!={'id','title','category','status','route','summary','story','role','evidence','limitations','links','visibility','publication_approved'}: raise ValueError('Unexpected work field')
        story=row.get('story')
        if not isinstance(story,list) or not 1<=len(story)<=6 or any(not isinstance(p,str) or not 1<=len(p)<=2000 for p in story): raise ValueError('Invalid story')
        if row.get('visibility')!='public' or row.get('publication_approved') is not True: raise ValueError('Work entry lacks public approval')
        ident=row.get('id','')
        if not re.fullmatch(r'[a-z][a-z0-9-]{1,48}',ident) or ident in seen: raise ValueError('Invalid or duplicate work id')
        seen.add(ident)
        for key in ('title','summary','status','category','role','evidence','limitations'):
            if not isinstance(row.get(key),str) or not 1<=len(row[key])<=2000: raise ValueError(f'Invalid {key}')
        if row['category'] not in ('Research','Computing','Making'): raise ValueError('Unknown category')
        if row['route'] not in routes: raise ValueError('Invalid internal route')
        for item in row['links']:
            if set(item)!={'label','url'} or not item['label']: raise ValueError('Unexpected link field')
            safe_url(item['url'])
    for item in data['identities']:
        if set(item)!={'label','url'}: raise ValueError('Unexpected identity field')
        safe_url(item['url'])
    if not seen: raise ValueError('Empty public catalogue')

def link(url: str,label: str,cls: str='text-link') -> str:
    safe_url(url); return f'<a class="{E(cls)}" href="{E(url,quote=True)}" rel="me noopener">{E(label)} <span aria-hidden="true">↗</span></a>'

def section_intro(kicker: str,title: str,body: str='') -> str:
    return f'<header class="page-intro"><p class="eyebrow">{E(kicker)}</p><h1>{E(title)}</h1>'+ (f'<p class="intro">{E(body)}</p>' if body else '')+'</header>'

def card(row: dict,compact: bool=False) -> str:
    h='h3' if compact else 'h2'
    return f'<article class="work-card" data-category="{E(row["category"])}"><div class="card-top"><span class="category">{E(row["category"])}</span><span class="status">{E(row["status"])}</span></div><{h}><a href="{E(row["route"])}#{E(row["id"])}">{E(row["title"])}<span aria-hidden="true">↗</span></a></{h}><p>{E(row["summary"])}</p></article>'

def project_detail(row: dict) -> str:
    links=' '.join(link(x['url'],x['label']) for x in row['links'])
    story=''.join(f'<p>{E(p)}</p>' for p in row['story'])
    return f'<article id="{E(row["id"])}" class="project-detail"><div class="detail-label"><p class="eyebrow">{E(row["category"])}</p><span class="status">{E(row["status"])}</span></div><div class="detail-body"><h2>{E(row["title"])}</h2><div class="story">{story}</div><p class="scope">{E(row["limitations"])}</p><div class="project-links">{links}</div></div></article>'

ROOTED_PAGES={'404.html'}  # served by the host at arbitrary missing paths, e.g. /research/old/

def root_links(name: str,markup: str) -> str:
    """Anchor local href/src values to the site root for pages served at any depth."""
    if name not in ROOTED_PAGES: return markup
    return re.sub(r'(\s(?:href|src)=")(?![a-z][a-z0-9+.-]*:|/|#)',r'\1/',markup)

def layout(name: str,title: str,desc: str,body: str,data: dict) -> str:
    return root_links(name,page_html(name,title,desc,body,data))

def page_html(name: str,title: str,desc: str,body: str,data: dict) -> str:
    nav=''.join(f'<a href="{p}"'+(' aria-current="page"' if name==p else '')+f'>{E(t)}</a>' for p,t in NAV)
    schema={'@context':'https://schema.org','@type':'Person','name':data['name'],'url':BASE,'sameAs':[x['url'] for x in data['identities']]}
    structured=json.dumps(schema,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e')
    canonical=BASE+'/'+('' if name=='index.html' else name)
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="{CSP}"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)} · Jacob Metoyer</title><meta name="description" content="{E(desc,quote=True)}"><meta name="theme-color" content="#183c31"><meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="canonical" href="{canonical}"><link rel="icon" href="assets/mark.svg" type="image/svg+xml"><link rel="stylesheet" href="style.css">
<meta property="og:type" content="website"><meta property="og:title" content="{E(title,quote=True)} · Jacob Metoyer"><meta property="og:description" content="{E(desc,quote=True)}"><meta property="og:url" content="{canonical}">
<script type="application/ld+json">{structured}</script><script src="site.js" defer></script></head>
<body><a class="skip" href="#main">Skip to content</a><header class="masthead"><a class="wordmark" href="index.html" aria-label="Jacob Metoyer home">Jacob <strong>Metoyer</strong><span class="wordmark-note">research / computation / making</span></a><nav aria-label="Main navigation">{nav}</nav></header>
<main id="main">{body}</main>
<footer class="footer"><div><a class="footer-name" href="index.html">Jacob Metoyer</a><p>Research, software and making.</p></div><div class="footer-links"><a href="now.html">Now</a><a href="process.html">Methods &amp; evidence</a><a href="credits.html">Sources &amp; credits</a><a href="privacy.html">Privacy</a></div><div class="footer-links"><a href="https://github.com/Jacob-Met" rel="me noopener">GitHub ↗</a><a href="https://www.linkedin.com/in/jacob-metoyer-15b701352" rel="me noopener">LinkedIn ↗</a><small>Revised September 19, 2026<br>Jacob Metoyer</small></div></footer></body></html>'''

def build(out: Path,data: dict|None=None) -> dict:
    data=json.loads((ROOT/'content.json').read_text(encoding='utf-8')) if data is None else data; validate(data)
    out=out.resolve()
    if out==ROOT or ROOT.is_relative_to(out): raise ValueError('Output must not replace source')
    allowed={'index.html','work.html','research.html','ai-systems.html','computing.html','making.html','about.html','process.html','now.html','credits.html','privacy.html','404.html','style.css','site.js','.nojekyll','CNAME','robots.txt','sitemap.xml','work.json','build-manifest.json','assets/mark.svg'}
    if out.exists():
        for f in out.rglob('*'):
            if f.is_symlink() or (f.is_file() and f.relative_to(out).as_posix() not in allowed): raise ValueError('Output contains unexpected material; refuse to overwrite it')
    out.mkdir(parents=True,exist_ok=True); pages={}; work=data['work']
    featured=('research-movement','ai-systems-research','capturesuite','cosplay')
    home=section_intro('Research / software / making','Hi, I’m Jacob.','I’m a student at Cal State Long Beach studying computer science and physics, with a minor in biology. Most of what I do comes back to measurement: how you record something as messy as a person walking, a protein moving, or a surgeon at work, and how you know the numbers mean anything.')+'<section class="section"><div class="section-heading"><div><p class="eyebrow">Where to start</p><h2>A few things I’ve been working on.</h2></div><p>Research in labs, software I built because I needed it, experiments I run on my own time, and cosplay.</p></div><div class="work-grid featured-grid">'+''.join(card(x,True) for x in work if x['id'] in featured)+'</div><a class="text-link end-link" href="work.html">See everything →</a></section><section class="research-band"><p class="eyebrow">A common thread</p><div><h2>Motion keeps showing up.</h2><p>I started with behavior videos in a neuroscience lab. Now I work with Vicon data from gait rehabilitation research, helped track surgeons’ movements in an ergonomics study, and I’m building CaptureSuite, software for recording exactly those kinds of multi-sensor sessions. Even cosplay armor is partly a question of how something sits and moves on a body.</p><a class="text-link" href="research.html">Research →</a> <a class="text-link" href="ai-systems.html">AI systems →</a></div></section>'
    pages['index.html']=('Research and selected work','Jacob Metoyer, a CSULB student working on research, scientific software, AI systems and cosplay.',home)
    filters='<div class="filter-wrap" hidden><div class="filters" role="group" aria-label="Filter work by field">'+''.join(f'<button type="button" data-filter="{x}" aria-pressed="{str(x=="All").lower()}">{x}</button>' for x in ['All','Research','Computing','Making'])+'</div><p id="filter-count" role="status" aria-live="polite"></p></div>'
    body=section_intro('Everything','All of it, in one place.','Lab work, software, side projects and hobbies. Each card links to a longer write-up.')+filters+'<section class="work-grid catalogue" aria-label="Public work">'+''.join(card(x) for x in work)+'</section>'
    pages['work.html']=('Work','A public record of research, software, independent AI-systems experiments, and making by Jacob Metoyer.',body)
    academic=[x for x in work if x['category']=='Research' and x['id']!='ai-systems-research']
    body=section_intro('Biology / medicine / computation','Research.','Most of my research has been about getting good measurements out of living things, and being honest about what those measurements can and can’t tell you.')+'<section class="research-intro"><div><h2>How it’s gone so far.</h2><p>I started in the Tsai Lab at CSULB, scoring mouse behavior from video. Then I spent several months doing remote molecular-dynamics work for a lab at Georgetown. Since March 2026 I’ve been working with motion-capture data in gait rehabilitation research, and I’ve contributed to a study of surgeons’ ergonomics. This year I’ve also done independent connectomics and structural-bioinformatics analyses.</p><p>The subjects change, but the work keeps turning into the same job: making the data trustworthy before anyone draws conclusions from it. Where a project below was a team effort, I describe my part of it.</p></div><aside class="education"><p class="eyebrow">School</p><h3>California State University,<br>Long Beach</h3><p>B.S. Computer Science, B.A. Physics<br>Biology minor<br>BUILD Scholar</p><p class="small">I hope to go on to an MD/PhD.</p></aside></section>'+''.join(project_detail(x) for x in academic)
    pages['research.html']=('Research','Jacob Metoyer’s research in behavioral neuroscience, protein molecular dynamics, gait rehabilitation, surgical ergonomics, connectomics and structural bioinformatics.',body)
    airow=next(x for x in work if x['id']=='ai-systems-research')
    body=section_intro('Independent research','Working with AI, carefully.','A hobby that got serious: I build systems where AI models do real work, and then check whether they actually did it well.')+project_detail(airow)+'<article class="prose"><h2>The questions</h2><p>Does running more models in parallel help, or does it mostly add coordination overhead? How much context does a task really need? And when a model gets something right once, can that turn into a procedure you can rely on, or was it luck?</p><p>The easy trap is to confuse fast with good. So I try to keep the comparison fair: the same task done by one model, by a small group, and by a larger setup, with the failures kept alongside the successes.</p><h2>Where it could go</h2><p>My own work is the first test bed. Eventually I’d like to try this with organizations: look at how a team already does something, build a small AI-assisted version with ordinary tools like ChatGPT, and measure whether it’s better on quality, time and cost. I haven’t done that for a client yet. It’s where I want this to go.</p></article>'
    pages['ai-systems.html']=('Independent AI systems research','Independent research by Jacob Metoyer on human–AI collaboration, agentic systems, evaluation, and reusable workflows.',body)
    body=section_intro('Software','Things I built.','One tool grew out of research, one out of school, and one out of a game. All three are public on GitHub, and each repository has the real setup notes and current limits.')+''.join(project_detail(x) for x in work if x['category']=='Computing')
    pages['computing.html']=('Software','CaptureSuite, CanvasPilot, uma-sim, and other public computational work by Jacob Metoyer.',body)
    body=section_intro('Cosplay / objects / stories','Making.','Not everything has to be research. Some of it is armor, props, prints, and the shows and games that gave me the ideas.')+''.join(project_detail(x) for x in work if x['category']=='Making')+'<section class="culture"><p class="eyebrow">Elsewhere</p><h2>Say hi.</h2><p>Finished builds go on Instagram, and my MyAnimeList shows what I’ve been watching and reading.</p><div class="actions"><a class="button" href="https://myanimelist.net/profile/TornadoZW" rel="me noopener">MyAnimeList ↗</a><a class="text-link" href="https://www.instagram.com/tornadocos/" rel="me noopener">Cosplay on Instagram ↗</a></div></section>'
    pages['making.html']=('Making & interests','Cosplay, CAD, physical making, anime, manga, and games as part of Jacob Metoyer’s broader interests.',body)
    body=section_intro('About','Jacob Metoyer.','Student, researcher, programmer, cosplayer.')+'<article class="prose"><p class="opening">I like following a question far enough that I have to learn something new to answer it.</p><p>I’m at Cal State Long Beach studying computer science and physics, with a minor in biology. I’m a BUILD Scholar, and I hope to go on to an MD/PhD. I speak English and Spanish.</p><p>My research has moved around more than I expected. I started with mouse behavior in the Tsai Lab, spent time on protein molecular dynamics with a lab at Georgetown, and now work with motion-capture data in gait rehabilitation research. Along the way I contributed to a surgical-ergonomics study and did independent analyses in connectomics and structural bioinformatics. What ties it together is that I usually end up working on the data itself: cleaning it, checking it, and making the failures visible.</p><p>That habit spills into software. I’m building CaptureSuite for recording multi-sensor research sessions. CanvasPilot came from a practical snag: a lot of schools don’t let students create Canvas API tokens. And uma-sim is a fan-made simulator for Umamusume. I also run my own experiments on how people and AI systems work together, and I try to keep the same standard there: save the evidence, keep the failures, measure before claiming anything.</p><p>Outside of that there’s cosplay, music, anime, manga and games, which get their own page here.</p><p><a class="text-link" href="now.html">What I’m working on now →</a></p></article>'
    pages['about.html']=('About','About Jacob Metoyer: academic research, computation, independent AI-systems research, software, and making.',body)
    body=section_intro('How I work','Show the work.','A few habits I try to keep, whatever the project is.')+'<article class="prose"><h2>In labs</h2><p>When I write about research I did with a team, I describe my part and leave the results to the lab. Participant data, confidential material and unpublished findings don’t go on this site.</p><h2>With AI systems</h2><p>I save the task, what the tools did, what came out, and what went wrong. A fast answer isn’t automatically a good one, and a model grading its own work isn’t the same as someone independent checking it.</p><h2>In code</h2><p>Tests, examples and known limits live next to the source. A passing test tells you the thing it tests works. It doesn’t tell you much else, so I try to say which is which.</p><h2>Credit and tools</h2><p>Most things I make involve other people’s libraries, tools and help. Where a publication, platform or collaboration has its own disclosure rules, I follow them.</p><h2>Keeping it current</h2><p>Projects change, and this site should change with them. If something here is out of date, that’s a bug.</p></article>'
    pages['process.html']=('Methods & evidence','How Jacob Metoyer approaches evidence, reproducibility, authorship, and responsibility across research, software, and independent AI-systems work.',body)
    body=section_intro('Now / September 10, 2026','What I’m working on.','A snapshot from September 10, 2026. It will go out of date; the project pages hold the details.')+'<div class="now-grid"><section><p class="eyebrow">Research</p><h2>Gait and movement data.</h2><p>Still working with motion-capture data in gait rehabilitation research, and still aiming at an MD/PhD down the line.</p></section><section><p class="eyebrow">AI systems</p><h2>Making my experiments testable.</h2><p>Turning my own experiments with AI systems into something more careful: clear tasks, saved results, and comparisons that could someday be run with a real organization.</p></section><section><p class="eyebrow">Software</p><h2>Research capture.</h2><p>CaptureSuite is still in active development, alongside smaller tools like CanvasPilot and uma-sim.</p></section><section><p class="eyebrow">Making</p><h2>Keeping room for hobbies.</h2><p>Cosplay, music, anime, manga and games. They don’t have to connect to the research to matter.</p></section></div>'
    pages['now.html']=('Now','A dated snapshot of Jacob Metoyer’s academic research, independent AI-systems experiments, software, and making.',body)
    body=section_intro('Sources & credits','Where this comes from.','What the descriptions on this site are based on, and who owns what.')+'<article class="prose"><h2>Research</h2><p>The research write-ups come from my CV and project records. Where the work was collaborative, they describe my part, and the labs keep their own data and results.</p><h2>AI systems</h2><p>My AI-systems research is something I do on my own. No university, lab or client is behind it.</p><h2>Software</h2><p>The software descriptions are based on the public repositories, which are the real source for licensing, installation and current limits.</p><ul><li><a href="https://github.com/Jacob-Met/CaptureSuite">CaptureSuite source and licensing</a></li><li><a href="https://github.com/Jacob-Met/canvaspilot">CanvasPilot source and responsible-use notes</a></li><li><a href="https://github.com/Jacob-Met/uma-sim">uma-sim source and notice</a></li></ul><h2>Fan work</h2><p>Cosplay and uma-sim are built on other people’s characters and games, and those belong to their creators.</p><h2>This site</h2><p>It’s a small static site generated from a single content file, with checks that run before each build. The checks make sure the pages are put together correctly. Whether the work is any good is up to you.</p></article>'
    pages['credits.html']=('Sources & credits','Source, evidence, and attribution notes for Jacob Metoyer’s public academic and technical work.',body)
    body=section_intro('Privacy','A small, static site.')+'<article class="prose"><p>This site does not include an analytics tracker, newsletter form, advertising pixel, account system, checkout, or embedded social-media feed. Its presentation assets do not require a third-party font request.</p><p>The hosting provider may process ordinary connection and request information to serve the site. Following an external link takes you to a separate service with its own privacy practices.</p><p>Do not send private research data, patient or participant information, credentials, or sensitive files through a social profile linked here. Public links are not a secure research intake channel.</p></article>'
    pages['privacy.html']=('Privacy','Privacy notes for this static personal website.',body)
    pages['404.html']=('Not found','This page is not part of the current public record.',section_intro('404','Nothing here.','That page may have moved, or the link got cut short.')+'<p class="back-home"><a class="button" href="index.html">Return home →</a></p>')
    for name,(title,desc,body) in pages.items(): (out/name).write_text(layout(name,title,desc,body,data),encoding='utf-8',newline='\n')
    for name in ['style.css','site.js']:
        (out/name).write_text((ROOT/name).read_text(encoding='utf-8'),encoding='utf-8',newline='\n')
    (out/'assets').mkdir(exist_ok=True); shutil.copyfile(ROOT/'assets'/'mark.svg',out/'assets'/'mark.svg')
    (out/'.nojekyll').write_text('',encoding='utf-8',newline='\n')
    (out/'CNAME').write_text('jacobmetoyer.com\n',encoding='utf-8',newline='\n')
    (out/'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n',encoding='utf-8',newline='\n')
    sm='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(f'<url><loc>{BASE}/{"" if p=="index.html" else p}</loc><lastmod>{STAMP}</lastmod></url>' for p in pages if p!='404.html')+'</urlset>'
    (out/'sitemap.xml').write_text(sm,encoding='utf-8',newline='\n')
    (out/'work.json').write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
    manifest_files=[f for f in out.rglob('*') if f.is_file() and f.name!='build-manifest.json']
    manifest={f.relative_to(out).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(manifest_files,key=lambda f:f.relative_to(out).as_posix())}
    (out/'build-manifest.json').write_text(json.dumps({'schema':1,'date':STAMP,'sha256':manifest},indent=2)+'\n',encoding='utf-8',newline='\n')
    return {'pages':len(pages),'public_work_entries':len(work),'output':str(out),'files':len(manifest)+1}

if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('--out',type=Path,default=ROOT.parent/'docs'); a=p.parse_args(); print(json.dumps(build(a.out),indent=2))
