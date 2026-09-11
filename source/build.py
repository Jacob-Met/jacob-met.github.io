#!/usr/bin/env python3
"""Build Jacob Metoyer's public academic/research site from an explicit allowlist."""
from __future__ import annotations
import argparse, hashlib, html, json, re, shutil
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
BASE = 'https://jacobmetoyer.com'
STAMP = '2026-09-10'
NAV = [('work.html','Work'),('research.html','Academic research'),('ai-systems.html','AI systems'),('computing.html','Software'),('making.html','Making'),('about.html','About')]
ALLOWED_HOSTS = {'github.com','www.instagram.com','myanimelist.net','www.linkedin.com','www.csulbtbp.org'}
E = html.escape

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
        if set(row)!={'id','title','category','status','route','summary','role','evidence','limitations','links','visibility','publication_approved'}: raise ValueError('Unexpected work field')
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
    return f'<article id="{E(row["id"])}" class="project-detail"><div class="detail-label"><p class="eyebrow">{E(row["category"])}</p><span class="status">{E(row["status"])}</span></div><div class="detail-body"><h2>{E(row["title"])}</h2><p class="lead">{E(row["summary"])}</p><p class="contribution">{E(row["role"])}</p><div class="project-links">{links}</div><details class="project-notes"><summary>Project notes &amp; scope</summary><dl class="evidence"><dt>What exists</dt><dd>{E(row["evidence"])}</dd><dt>Scope</dt><dd>{E(row["limitations"])}</dd></dl></details></div></article>'

def layout(name: str,title: str,desc: str,body: str,data: dict) -> str:
    nav=''.join(f'<a href="{p}"'+(' aria-current="page"' if name==p else '')+f'>{E(t)}</a>' for p,t in NAV)
    schema={'@context':'https://schema.org','@type':'Person','name':data['name'],'url':BASE,'sameAs':[x['url'] for x in data['identities']]}
    structured=json.dumps(schema,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e')
    canonical=BASE+'/'+('' if name=='index.html' else name)
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)} · Jacob Metoyer</title><meta name="description" content="{E(desc,quote=True)}"><meta name="theme-color" content="#183c31"><meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="canonical" href="{canonical}"><link rel="icon" href="assets/mark.svg" type="image/svg+xml"><link rel="stylesheet" href="style.css">
<meta property="og:type" content="website"><meta property="og:title" content="{E(title,quote=True)} · Jacob Metoyer"><meta property="og:description" content="{E(desc,quote=True)}"><meta property="og:url" content="{canonical}">
<script type="application/ld+json">{structured}</script><script src="site.js" defer></script></head>
<body><a class="skip" href="#main">Skip to content</a><header class="masthead"><a class="wordmark" href="index.html" aria-label="Jacob Metoyer home">Jacob <strong>Metoyer</strong><span class="wordmark-note">research / computation / making</span></a><nav aria-label="Main navigation">{nav}</nav></header>
<main id="main">{body}</main>
<footer class="footer"><div><a class="footer-name" href="index.html">Jacob Metoyer</a><p>Academic research, independent AI-systems research, software, and making.</p></div><div class="footer-links"><a href="now.html">Now</a><a href="process.html">Methods &amp; evidence</a><a href="credits.html">Sources &amp; credits</a><a href="privacy.html">Privacy</a></div><div class="footer-links"><a href="https://github.com/Jacob-Met" rel="me noopener">GitHub ↗</a><a href="https://www.linkedin.com/in/jacob-scott-metoyer-15b701352" rel="me noopener">LinkedIn ↗</a><small>Revised September 10, 2026<br>Jacob Metoyer</small></div></footer></body></html>'''

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
    home=section_intro('Research / systems / making','Questions worth following.','I study living systems, build tools around difficult measurements, and independently investigate how people and AI systems work together.')+'<section class="section"><div class="section-heading"><div><p class="eyebrow">Selected work</p><h2>A few places to begin.</h2></div><p>Academic research, independent systems experiments, software, and hands-on making—kept distinct enough that each can be judged on its own evidence.</p></div><div class="work-grid featured-grid">'+''.join(card(x,True) for x in work if x['id'] in featured)+'</div><a class="text-link end-link" href="work.html">Browse the public record →</a></section><section class="research-band"><p class="eyebrow">The longer view</p><div><h2>Learning to look more closely.</h2><p>My academic work spans behavior, molecular dynamics, rehabilitation, and human movement. Alongside it, I run independent experiments on human–AI collaboration and agentic systems as a serious technical hobby.</p><a class="text-link" href="research.html">Academic research →</a> <a class="text-link" href="ai-systems.html">Independent AI systems research →</a></div></section>'
    pages['index.html']=('Research and selected work','Jacob Metoyer: academic research, independent AI-systems research, scientific software, and making.',home)
    filters='<div class="filter-wrap" hidden><div class="filters" role="group" aria-label="Filter work by field">'+''.join(f'<button type="button" data-filter="{x}" aria-pressed="{str(x=="All").lower()}">{x}</button>' for x in ['All','Research','Computing','Making'])+'</div><p id="filter-count" role="status" aria-live="polite"></p></div>'
    body=section_intro('Public index','An open notebook.','A concise record of work that has enough evidence to describe publicly.')+filters+'<section class="work-grid catalogue" aria-label="Public work">'+''.join(card(x) for x in work)+'</section><aside class="note">Project pages distinguish contribution, current stage, evidence, and limitations. A public description is not a claim of independent validation.</aside>'
    pages['work.html']=('Work','A public record of research, software, independent AI-systems experiments, and making by Jacob Metoyer.',body)
    academic=[x for x in work if x['category']=='Research' and x['id']!='ai-systems-research']
    body=section_intro('Biology / medicine / computation','Academic research.','I am interested in how complex living systems can be measured well enough to ask better questions about them.')+'<section class="research-intro"><div><h2>From behavior to movement.</h2><p>My research experience includes behavioral neuroscience, molecular dynamics and protein modeling, rehabilitation data, and surgical ergonomics. I am especially interested in measurement, reproducibility, and computational methods that make uncertainty easier to inspect.</p></div><aside class="education"><p class="eyebrow">Education &amp; training</p><h3>California State University,<br>Long Beach</h3><p>Computer science and physics<br>Biology minor<br>BUILD Scholar</p><p class="small">Undergraduate studies. MD/PhD is a future goal, not a current credential.</p></aside></section>'+''.join(project_detail(x) for x in academic)+'<aside class="note">These summaries describe my contributions to collaborative work. They do not release participant data, confidential material, or unpublished findings.</aside>'
    pages['research.html']=('Academic research','Jacob Metoyer’s academic research experience in behavior, molecular dynamics, rehabilitation, human movement, and computational methods.',body)
    airow=next(x for x in work if x['id']=='ai-systems-research')
    body=section_intro('Independent research / technical hobby','Human–AI systems.','I study how AI changes the way individuals and organizations think, create, coordinate, and build—by constructing systems and testing them against real work.')+project_detail(airow)+'<article class="prose"><h2>What I am trying to understand</h2><p>The questions are practical and academic at once: when does additional model parallelism help; when does it only add coordination cost; what context is actually necessary; how should failures be preserved; when can repeated reasoning become a reusable procedure; and what forms of evaluation keep speed from masquerading as quality?</p><h2>From personal laboratory to organizations</h2><p>My own workflows are the first longitudinal test bed. A natural next step is selective collaboration or consulting with organizations: study an existing workflow, build a bounded AI-assisted alternative using accessible tools such as ChatGPT, and compare quality, capability, time, cost, and human intervention. That is a research direction and service model, not a claim that named client studies already exist.</p><h2>Evidence before spectacle</h2><p>Internal experiments can compare one model, small coordinated groups, and larger agentic systems. Public case studies should foreground the task, controls, artifacts, failures, measurements, and limits rather than treating worker count as proof of value.</p></article>'
    pages['ai-systems.html']=('Independent AI systems research','Independent research by Jacob Metoyer on human–AI collaboration, agentic systems, evaluation, and reusable workflows.',body)
    body=section_intro('Software & computational work','Tools I wanted to exist.','Some questions become easier to inspect once there is a tool that makes the state visible and repeatable.')+''.join(project_detail(x) for x in work if x['category']=='Computing')+'<aside class="note">Repository documentation is the source for installation, licensing, supported behavior, and current limitations. Third-party names and platforms do not imply affiliation or endorsement.</aside>'
    pages['computing.html']=('Software','CaptureSuite, CanvasPilot, uma-sim, and other public computational work by Jacob Metoyer.',body)
    body=section_intro('Cosplay / objects / culture','Making.','Some interests leave the screen and become models, prints, props, costumes, or simply things worth studying for fun.')+''.join(project_detail(x) for x in work if x['category']=='Making')+'<section class="culture"><p class="eyebrow">Watching, reading, playing</p><h2>Taste is part of the record.</h2><p>Anime, manga, games, cosplay, CAD, and physical fabrication are genuine interests in their own right. They do not need to be reframed as a professional specialization to belong here.</p><div class="actions"><a class="button" href="https://myanimelist.net/profile/TornadoZW" rel="me noopener">MyAnimeList ↗</a><a class="text-link" href="https://www.instagram.com/tornadocos/" rel="me noopener">Cosplay on Instagram ↗</a></div></section>'
    pages['making.html']=('Making & interests','Cosplay, CAD, physical making, anime, manga, and games as part of Jacob Metoyer’s broader interests.',body)
    body=section_intro('The person behind the work','Jacob Metoyer.','A student researcher, developer, and persistent hobbyist following several questions at once.')+'<article class="prose"><p class="opening">I like following a question far enough that it forces me to learn something new.</p><p>I study computer science and physics at CSULB with a minor in biology. My academic research has moved between behavior and neurobiology, protein molecular dynamics, rehabilitation and gait, and surgical ergonomics. I hope to pursue an MD/PhD and continue working where computation can make biological questions more testable.</p><p>I also build software around problems I encounter. Measurement, reproducibility, and inspectable failure modes matter to me whether the subject is motion data, a simulation, or a practical interface.</p><h2>An independent line of inquiry.</h2><p>Outside formal academic work, I have developed a sustained technical hobby around AI systems. I study human–AI collaboration, agentic workflows, evaluation, and how repeated successful work can become reusable capability. I treat this as independent research: systematic experiments and preserved evidence, without implying peer review or institutional endorsement that has not occurred.</p><p>Selective consulting or research collaboration is a way to extend those questions into real organizations. The goal is not to sell hype; it is to build a bounded alternative to an existing workflow and determine whether it actually improves anything.</p><h2>Still more than one thing.</h2><p>Cosplay, physical making, music, anime, manga, and games remain important interests too. This site is deliberately broad enough to keep those parts of my life visible without forcing them into one career label.</p><p><a class="text-link" href="now.html">What is on the workbench →</a></p></article>'
    pages['about.html']=('About','About Jacob Metoyer: academic research, computation, independent AI-systems research, software, and making.',body)
    body=section_intro('Methods / evidence / responsibility','How I keep claims attached to evidence.','Different kinds of work need different standards, but they all benefit from a visible trail.')+'<article class="prose"><h2>Research</h2><p>Academic research descriptions distinguish my contribution from the work of the lab or collaboration. Participant data, confidential materials, and unpublished findings stay out of this public site.</p><h2>Independent AI-systems experiments</h2><p>I preserve task definitions, tool actions, artifacts, failures, evaluator results, and changed-input checks when they matter. A fast result is not automatically a useful result, and an internal evaluator is not the same thing as independent validation.</p><h2>Software</h2><p>Tests, examples, installation notes, and known limitations belong close to the source. Passing a test establishes the behavior that test actually checks—not every possible use of the program.</p><h2>Authorship and tools</h2><p>I describe work at the level relevant to the claim being made. Creating or developing something can involve many tools, collaborators, libraries, and automated systems; where a platform, publication, collaboration, or research standard requires a more specific disclosure, that requirement controls. I do not use blanket process disclaimers as a substitute for accurate project-level evidence.</p><h2>Revision</h2><p>As projects change, public claims should change with them. The goal is a record that becomes more precise over time rather than a static résumé frozen around old wording.</p></article>'
    pages['process.html']=('Methods & evidence','How Jacob Metoyer approaches evidence, reproducibility, authorship, and responsibility across research, software, and independent AI-systems work.',body)
    body=section_intro('Now / September 10, 2026','On the workbench.','A dated snapshot of a few active lines of work.')+'<div class="now-grid"><section><p class="eyebrow">Academic research</p><h2>Biology, movement, and computational methods.</h2><p>Continuing work connected to rehabilitation, human movement, and computational analysis while developing a longer-term physician-scientist path.</p></section><section><p class="eyebrow">Independent AI systems</p><h2>Turning personal experiments into testable research.</h2><p>Formalizing experiments in human–AI collaboration, agentic execution, evaluation, and reusable workflows, with an eye toward future organizational studies.</p></section><section><p class="eyebrow">Software</p><h2>Making the evidence easier to inspect.</h2><p>Research capture, practical interfaces, simulation, and automation remain active development interests.</p></section><section><p class="eyebrow">Making</p><h2>Keeping room for hobbies.</h2><p>Cosplay, physical fabrication, music, anime, manga, and games remain important without needing to become the same project as the research.</p></section></div><aside class="note">This is a dated snapshot. Project pages and linked repositories carry the more detailed record.</aside>'
    pages['now.html']=('Now','A dated snapshot of Jacob Metoyer’s academic research, independent AI-systems experiments, software, and making.',body)
    body=section_intro('Sources & credits','Keep the claim close to its source.','A public record should distinguish personal statements, collaborative research, public software, and independent experiments.')+'<article class="prose"><h2>Academic research</h2><p>Research summaries draw on my CV and project records and describe my contributions to collaborative work. They do not publish confidential data or unpublished scientific results.</p><h2>Independent AI systems research</h2><p>This is a personal research practice developed outside formal coursework. The public description does not imply university sponsorship, peer review, a funded laboratory, or completed consulting engagements.</p><h2>Public software</h2><p>CaptureSuite, CanvasPilot, and uma-sim descriptions are based on their public repositories, which remain the source for licensing, installation, current support, and technical limitations.</p><ul><li><a href="https://github.com/Jacob-Met/CaptureSuite">CaptureSuite source and licensing</a></li><li><a href="https://github.com/Jacob-Met/canvaspilot">CanvasPilot source and responsible-use notes</a></li><li><a href="https://github.com/Jacob-Met/uma-sim">uma-sim source and notice</a></li></ul><h2>Cosplay and fan work</h2><p>The linked cosplay and media-tracking accounts are personal interests. Original characters, franchises, designs, and other creators’ work retain their own rights.</p><h2>Website</h2><p>This static site uses an explicit public-only content record and local build checks. Those checks establish presentation behavior, not the scientific or artistic quality of the projects described.</p></article>'
    pages['credits.html']=('Sources & credits','Source, evidence, and attribution notes for Jacob Metoyer’s public academic and technical work.',body)
    body=section_intro('Privacy','A small, static site.')+'<article class="prose"><p>This site does not include an analytics tracker, newsletter form, advertising pixel, account system, checkout, or embedded social-media feed. Its presentation assets do not require a third-party font request.</p><p>The hosting provider may process ordinary connection and request information to serve the site. Following an external link takes you to a separate service with its own privacy practices.</p><p>Do not send private research data, patient or participant information, credentials, or sensitive files through a social profile linked here. Public links are not a secure research intake channel.</p></article>'
    pages['privacy.html']=('Privacy','Privacy notes for this static personal website.',body)
    pages['404.html']=('Not found','This page is not part of the current public record.',section_intro('404','That page is not here.','The work may have moved, or the link may be incomplete.')+'<p class="back-home"><a class="button" href="index.html">Return home →</a></p>')
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
