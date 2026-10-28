// Generates the grid front door (/), the plain index /outside/, /work/<slug>/ from docs/projects.json and refreshes build-manifest sha256.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
const D="docs", data=JSON.parse(fs.readFileSync(`${D}/projects.json`,"utf8"));
const e=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const slug=g=>g.toLowerCase().replace(/[^a-z]+/g,"-").replace(/-$/,"");
const head=(t,d)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(t)}</title><meta name="description" content="${e(d)}"><meta name="theme-color" content="#0d0c0b"><link rel="icon" href="/assets/mark.svg" type="image/svg+xml"><link rel="preload" href="/assets/fonts/fraunces-vf.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/site/site.css"></head><body>`;
const nav=`<header class="bar"><a class="mark" href="/">Jacob <i>Metoyer</i></a><nav><a href="/">Work</a><a href="/brain/">The mind</a><a href="/forge/">Forge</a><a href="https://spireofoctaves.com/">Spire</a><a href="https://hamon.works/">hamon.works</a></nav></header>`;
const foot=`<footer class="foot"><span>Jacob Metoyer · CS &amp; physics, CSULB</span><a href="https://github.com/Jacob-Met">GitHub</a><a href="https://www.linkedin.com/in/jacob-metoyer-15b701352">LinkedIn</a></footer><script src="/site/motion.js" defer></script></body></html>`;
const media=(p,cls="")=>p.thumbnail?`<img class="${cls}" src="${e(p.thumbnail)}" alt="${e(p.title)}" loading="lazy">`:`<div class="ph ${cls}"><span>${e(p.title)}</span></div>`;
const status=p=>p.status==="live"?"Live":p.status==="demo-video"?"Demo":"In development";
const stc=p=>p.status==="live"?"live":p.status==="demo-video"?"demo":"dev";
const card=(p,i)=>`<a class="card reveal${p.flagship?" flagship":""}" href="/work/${p.slug}/" data-g="${slug(p.group)}"><div class="fr">${media(p)}<div class="ov"><p>${e(p.oneLiner)}</p></div></div><div class="meta"><span class="st ${stc(p)}">${status(p)}${p.sourcePublic?" · open source":""}</span><span>${e(p.group)}</span></div>${ms(p)}<h3><span class="ix">${String(i+1).padStart(2,"0")}</span>${e(p.title)}</h3></a>`;
const P=[...data.projects].sort((a,b)=>(a.rank??999)-(b.rank??999));
const ms=p=>p.milestone?`<span class="ms">${e(p.milestone)}</span>`:"";
// grid front door: name, the brain kept as "Enter the mind", then every project as a filterable grid.
const groups=data.groups.map(g=>`<button data-f="${slug(g)}">${e(g)}<sup>${P.filter(p=>p.group===g).length}</sup></button>`).join("");
fs.writeFileSync(`${D}/index.html`,head("Jacob Metoyer","Jacob Metoyer: worlds, perception, accessibility and research software.")+nav+`<main class="wrap">
<section class="intro reveal"><div><span class="eyebrow">CS &amp; physics · CSULB</span><h1>Jacob <em>Metoyer</em></h1></div><p>Builds worlds, instruments, and tools that help people see and do more. <span class="count">${P.length}</span> projects below.</p></section>
<div class="doors solo"><a class="door mind" href="/brain/"><span class="img" style="background-image:url(/assets/demos/brain-door.webp)"></span><span class="k">I.</span><b>Enter the mind</b><em>An explorable brain: each region a part of the work.</em><span class="go">Step inside →</span></a></div>
<div class="section-h"><h2>All <em>work</em></h2></div><div class="filters"><button data-f="all" class="on">All<sup>${P.length}</sup></button>${groups}</div>
<section class="grid">${P.map(card).join("")}</section>
<nav class="elsewhere"><span class="eyebrow">Elsewhere</span><a href="https://spireofoctaves.com/">Spire of Octaves <i>fiction world</i></a><a href="https://hamon.works/">hamon.works <i>the company</i></a><a href="/forge/">Walk the forge <i>on this site</i></a></nav>
</main><script src="/site/filter.js"></script>`+foot);
// plain text index (secondary; linked only from the brainstem)
fs.mkdirSync(`${D}/outside`,{recursive:true});
fs.writeFileSync(`${D}/outside/index.html`,head("Index · Jacob Metoyer","Every project, in plain text.").replace("<head>",'<head><meta name="robots" content="noindex">')+nav+`<main class="wrap"><section class="intro"><div><span class="eyebrow">Plain index</span><h1>Every <em>project</em></h1></div><p>The same work as a plain list. <a href="/">Back to the work</a></p></section><ol class="tindex">${P.map(p=>`<li><a href="/work/${p.slug}/"><b>${e(p.title)}</b></a>${p.milestone?` <span class="ms">${e(p.milestone)}</span>`:""}<span>${e(p.oneLiner)}</span></li>`).join("")}</ol></main>`+foot);

// project pages
P.forEach((p,i)=>{const nx=P[(i+1)%P.length];const dir=`${D}/work/${p.slug}`;fs.mkdirSync(dir,{recursive:true});
 const L=p.links,links=[L.demo&&`<a href="${e(L.demo)}">Open the live demo</a>`,L.video&&`<a href="${e(L.video)}">Watch the video</a>`,L.repo?`<a href="${e(L.repo)}">Source on GitHub</a>`:`<span>Source is private</span>`,L.hackathon&&`<span>${e(L.hackathon)}</span>`].filter(Boolean).join("");
 fs.writeFileSync(`${dir}/index.html`,head(`${p.title} · Jacob Metoyer`,p.oneLiner)+nav+`<main class="wrap proj"><p class="crumb"><a href="/">Work</a> &nbsp;/&nbsp; ${e(p.group)}</p><div class="head reveal"><h1>${e(p.title)}</h1>${ms(p)}<p class="lede">${e(p.oneLiner)}</p></div><div class="heroframe reveal">${media(p,"hero")}</div><div class="facts reveal"><dl><dt>Group</dt><dd>${e(p.group)}</dd><dt>Status</dt><dd>${status(p)}</dd><dt>Source</dt><dd>${p.sourcePublic?"Open":"Private"}</dd></dl><div><div class="links">${links}</div>${p.scope?`<p class="scope">${e(p.scope)}</p>`:""}</div></div><a class="next" href="/work/${nx.slug}/"><small class="eyebrow">Next</small><b>${e(nx.title)}</b></a></main>`+foot);});
// manifest: recompute sha256 of every existing pinned file plus new outputs
const mf=`${D}/build-manifest.json`,m=JSON.parse(fs.readFileSync(mf,"utf8"));const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):[path.join(d,x.name)]);
const keep=new Set([...Object.keys(m.sha256),"index.html","outside/index.html","projects.json","site/site.css","site/filter.js","site/motion.js","assets/fonts/fraunces-vf.woff2","assets/fonts/fraunces-vf-italic.woff2","assets/fonts/OFL-Fraunces.txt",...walk(`${D}/work`).map(f=>path.relative(D,f)),...walk(`${D}/assets/demos`).map(f=>path.relative(D,f))]);
const out={};for(const k of [...keep].sort()){const f=path.join(D,k);if(fs.existsSync(f))out[k]=crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");}
m.sha256=out;m.date="2026-10-27";fs.writeFileSync(mf,JSON.stringify(m,null,2)+"\n");
console.log("built",P.length,"pages; manifest",Object.keys(out).length);
