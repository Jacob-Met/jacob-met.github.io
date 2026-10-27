// Generates gateway (/), /outside/, /work/<slug>/ from docs/projects.json and refreshes build-manifest sha256.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
const D="docs", data=JSON.parse(fs.readFileSync(`${D}/projects.json`,"utf8"));
const e=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const slug=g=>g.toLowerCase().replace(/[^a-z]+/g,"-").replace(/-$/,"");
const head=(t,d)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(t)}</title><meta name="description" content="${e(d)}"><meta name="theme-color" content="#0d0c0b"><link rel="icon" href="/assets/mark.svg" type="image/svg+xml"><link rel="stylesheet" href="/site/site.css"></head><body>`;
const nav=`<header class="bar"><a class="mark" href="/">Jacob Metoyer</a><nav><a href="/brain/">The mind</a><a href="/outside/">The outside</a><a href="/forge/">Forge</a><a href="https://spireofoctaves.com/">Spire</a><a href="https://hamon.works/">hamon.works</a></nav></header>`;
const foot=`<footer class="foot"><span>Jacob Metoyer · CS &amp; physics, CSULB</span><a href="https://github.com/Jacob-Met">GitHub</a><a href="https://www.linkedin.com/in/jacob-metoyer-15b701352">LinkedIn</a></footer></body></html>`;
const media=(p,cls="")=>p.thumbnail?`<img class="${cls}" src="${e(p.thumbnail)}" alt="${e(p.title)}" loading="lazy">`:`<div class="ph ${cls}"><span>${e(p.title)}</span></div>`;
const status=p=>p.status==="live"?"Live":p.status==="demo-video"?"Demo":"In development";
const card=p=>`<a class="card" href="/work/${p.slug}/" data-g="${slug(p.group)}">${media(p)}<h3>${e(p.title)}</h3><p>${e(p.oneLiner)}</p><small>${status(p)}${p.sourcePublic?" · open source":""}</small></a>`;
const P=data.projects;
// gateway
fs.writeFileSync(`${D}/index.html`,head("Jacob Metoyer","Jacob Metoyer: worlds, perception, accessibility and research software. Enter the mind, or view the outside.")+`<main class="gate">
<div class="gate-name"><h1>Jacob Metoyer</h1><p>Builds worlds, instruments, and tools that help people see and do more.</p></div>
<div class="doors"><a class="door mind" href="/brain/" style="background-image:linear-gradient(#0d0c0b99,#0d0c0bee),url(/assets/demos/brain-door.webp)"><span class="k">I</span><b>Enter the mind</b><em>An explorable brain: each region a part of the work.</em></a>
<a class="door out" href="/outside/" style="background-image:linear-gradient(#0d0c0bcc,#0d0c0bee),url(/assets/wildside/wildside-hero.webp)"><span class="k">II</span><b>View the outside</b><em>${P.length} projects, plainly laid out.</em></a></div>
<nav class="elsewhere"><span>Elsewhere</span><a href="https://spireofoctaves.com/">Spire of Octaves <i>fiction world</i></a><a href="https://hamon.works/">hamon.works <i>the company</i></a><a href="/forge/">Walk the forge <i>on this site</i></a></nav>
</main></body></html>`);
// outside
const flag=P.filter(p=>p.flagship);
const groups=data.groups.map(g=>`<button data-f="${slug(g)}">${e(g)}</button>`).join("");
fs.mkdirSync(`${D}/outside`,{recursive:true});
fs.writeFileSync(`${D}/outside/index.html`,head("The outside · Jacob Metoyer","Projects by Jacob Metoyer.")+nav+`<main class="wrap">
<section class="intro"><h1>The outside</h1><p>Worlds and games, perception and physical AI, accessibility and care, research instruments, and tools. ${P.length} projects.</p></section>
<section class="flags">${flag.map(p=>`<a class="flag" href="/work/${p.slug}/">${media(p)}<div><h2>${e(p.title)}</h2><p>${e(p.oneLiner)}</p></div></a>`).join("")}</section>
<div class="filters"><button data-f="all" class="on">All</button>${groups}</div>
<section class="grid">${P.map(card).join("")}</section>
<section class="about"><h2>About</h2><p>Jacob Metoyer studies computer science and physics at CSULB. He researches movement, neuroscience and scientific computing, runs HAMON, and writes the world of Spire of Octaves.</p></section>
</main><script src="/site/filter.js"></script>`+foot);
// project pages
for(const p of P){const dir=`${D}/work/${p.slug}`;fs.mkdirSync(dir,{recursive:true});
 const L=p.links,links=[L.demo&&`<a href="${e(L.demo)}">Open the live demo →</a>`,L.video&&`<a href="${e(L.video)}">Watch the video →</a>`,L.repo?`<a href="${e(L.repo)}">Source on GitHub →</a>`:`<span>Source is private</span>`,L.hackathon&&`<span>${e(L.hackathon)}</span>`].filter(Boolean).join("");
 fs.writeFileSync(`${dir}/index.html`,head(`${p.title} · Jacob Metoyer`,p.oneLiner)+nav+`<main class="wrap proj"><p class="crumb"><a href="/outside/">The outside</a> / ${e(p.group)}</p><h1>${e(p.title)}</h1><p class="lede">${e(p.oneLiner)}</p>${media(p,"hero")}<div class="links">${links}</div>${p.scope?`<p class="scope">${e(p.scope)}</p>`:""}</main>`+foot);}
// manifest: recompute sha256 of every existing pinned file plus new outputs
const mf=`${D}/build-manifest.json`,m=JSON.parse(fs.readFileSync(mf,"utf8"));const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):[path.join(d,x.name)]);
const keep=new Set([...Object.keys(m.sha256),"index.html","outside/index.html","projects.json","site/site.css","site/filter.js",...walk(`${D}/work`).map(f=>path.relative(D,f)),...walk(`${D}/assets/demos`).map(f=>path.relative(D,f))]);
const out={};for(const k of [...keep].sort()){const f=path.join(D,k);if(fs.existsSync(f))out[k]=crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");}
m.sha256=out;m.date="2026-10-27";fs.writeFileSync(mf,JSON.stringify(m,null,2)+"\n");
console.log("built",P.length,"pages; manifest",Object.keys(out).length);
