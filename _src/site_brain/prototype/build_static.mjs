// Writes the plain-HTML version of every region into index.html (between the STATIC markers),
// so the site reads and links correctly with no JavaScript and no WebGL. Run: node build_static.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { REGIONS, EYES } from './regions.js';
const ALL = [EYES.hamon, EYES.spire, ...REGIONS];
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const list = ALL.map(r => `    <li${r.id >= 10 ? ' class="eye"' : ''}><a href="#r-${r.key}" data-id="${r.id}" style="--c:rgb(${r.color.map(c => c * 255 | 0).join(',')})">${esc(r.title)}<small>${esc(r.name)}</small></a></li>`).join('\n');
const secs = ALL.map(r => `  <section class="static" id="r-${r.key}">
    <p class="kicker">${esc(r.kicker)}</p><h2>${esc(r.title)}</h2><p>${esc(r.lead)}</p>
    <ul>${r.items.map(([a, b]) => `<li><b>${esc(a)}</b>: ${esc(b)}</li>`).join('')}</ul>
    ${r.media ? `<img src="${r.media}" alt="${esc(r.mediaTag)}" width="1280" loading="lazy">` : ''}
  </section>`).join('\n');
let h = readFileSync('index.html', 'utf8');
h = h.replace(/<!--LIST-->[\s\S]*?<!--\/LIST-->/, `<!--LIST-->\n${list}\n    <!--/LIST-->`);
h = h.replace(/<!--STATIC-->[\s\S]*?<!--\/STATIC-->/, `<!--STATIC-->\n<main class="staticWrap">\n${secs}\n</main>\n<!--/STATIC-->`);
writeFileSync('index.html', h);
console.log('wrote', ALL.length, 'regions');
