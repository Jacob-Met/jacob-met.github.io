import { chromium } from 'playwright-core';
const base = 'http://127.0.0.1:18794/';
const out = '/workspace/hamon_forge_site/preview/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const errs = [];
async function page(w, h, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...opts });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(String(e)));
  p.on('requestfailed', r => errs.push('failed: ' + r.url()));
  await p.goto(base, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  return { ctx, p };
}
async function walk(w, h, prefix, ids, opts = {}) {
  const { ctx, p } = await page(w, h, opts);
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${out}${prefix}_00_fold.png` });
  let n = 1;
  for (const id of ids) {
    const y = await p.evaluate(id => { const e = document.getElementById(id); return e.getBoundingClientRect().top + scrollY + innerHeight * 0.22; }, id);
    await p.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
    await p.waitForTimeout(1600);
    await p.screenshot({ path: `${out}${prefix}_${String(n++).padStart(2, '0')}_${id}.png` });
  }
  return { ctx, p };
}
const all = ['yard', 'threshold', 'inside', 'hearth', 'anvil', 'bench', 'sword', 'sword-hamon', 'sword-hilt', 'door'];
let r = await walk(1440, 900, 'desktop_1440', all);
// hotspot hover in the "inside" room
const y = await r.p.evaluate(() => document.getElementById('inside').getBoundingClientRect().top + scrollY + innerHeight * 0.22);
await r.p.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y); await r.p.waitForTimeout(1200);
await r.p.hover('#inside .spot[href="#hearth"]'); await r.p.waitForTimeout(500);
await r.p.screenshot({ path: out + 'desktop_1440_inside_hover.png' });
// mid-crossfade between threshold and inside
const ym = await r.p.evaluate(() => document.getElementById('inside').getBoundingClientRect().top + scrollY - innerHeight * 0.72);
await r.p.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), ym); await r.p.waitForTimeout(1200);
await r.p.screenshot({ path: out + 'desktop_1440_crossfade.png' });
await r.ctx.close();
r = await walk(390, 844, 'mobile_390', ['yard', 'inside', 'hearth', 'anvil', 'sword', 'door'], { isMobile: true, hasTouch: true });
await r.ctx.close();
r = await walk(1440, 900, 'desktop_1440_reduced', ['hearth'], { reducedMotion: 'reduce' }); await r.ctx.close();
for (const [w, h, name, o] of [[1440, 900, 'nojs_desktop_1440', {}], [390, 844, 'nojs_mobile_390', { isMobile: true, hasTouch: true }]]) {
  const { ctx, p } = await page(w, h, { javaScriptEnabled: false, ...o });
  const H = await p.evaluate(() => document.body.scrollHeight);
  for (let yy = 0; yy < H; yy += h) { await p.evaluate(y => window.scrollTo(0, y), yy); await p.waitForTimeout(80); }
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}${name}_full.png`, fullPage: true });
  await ctx.close();
}
// keyboard: tab a few times and screenshot focus ring
{ const { ctx, p } = await page(1440, 900);
  for (let i = 0; i < 6; i++) await p.keyboard.press('Tab');
  await p.waitForTimeout(400); await p.screenshot({ path: out + 'desktop_1440_keyboard_focus.png' });
  const f = await p.evaluate(() => document.activeElement.outerHTML.slice(0, 120)); console.log('focused', f); await ctx.close(); }
console.log('errors', JSON.stringify(errs));
await b.close();
