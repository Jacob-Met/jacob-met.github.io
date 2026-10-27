import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://127.0.0.1:18821';
const prefix = process.argv[3] || '/workspace/site_publish/shots/local_';
const bust = process.argv[4] || '';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const report = {};
const pages = [['home', '/'], ['brain', '/brain/'], ['lobby', '/lobby/'], ['forge', '/forge/'], ['hamon', '/hamon.html'], ['wildside', '/wildside-project.html'], ['notfound', '/nope-xyz']];
const vps = { desktop: { viewport: { width: 1440, height: 900 } }, mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
const links = new Set();
for (const [vn, opts] of Object.entries(vps)) for (const [name, path] of pages) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(String(e)));
  p.on('requestfailed', r => errs.push('failed: ' + r.url()));
  p.on('response', r => { if (r.status() >= 400 && !(name === 'notfound' && r.url().includes('nope-xyz'))) errs.push(r.status() + ' ' + r.url()); });
  const res = await p.goto(base + path + bust, { waitUntil: 'load' }); await p.waitForTimeout(name === 'home' || name === 'brain' ? 4000 : 1500);
  await p.screenshot({ path: `${prefix}${name}_${vn}.png` });
  const hrefs = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.href));
  hrefs.forEach(h => links.add(h));
  const info = await p.evaluate(() => ({ title: document.title, canvas: !!document.querySelector('canvas#gl'), h1: document.querySelector('h1')?.textContent }));
  report[`${name}_${vn}`] = { status: res.status(), ...info, errors: errs };
  await ctx.close();
}
// link check (same-origin only)
const origin = new URL(base).origin; const bad = [];
const ctx = await b.newContext();
for (const h of links) { const u = new URL(h); if (u.origin !== origin && !u.href.startsWith('https://jacobmetoyer.com')) continue;
  const target = u.origin === origin ? u.href.split('#')[0] : u.href.split('#')[0].replace('https://jacobmetoyer.com', origin);
  const r = await ctx.request.get(target); if (r.status() >= 400) bad.push(r.status() + ' ' + h); }
report.brokenLinks = bad; report.linkCount = links.size;
console.log(JSON.stringify(report, null, 1));
await b.close();
