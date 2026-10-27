import { chromium } from 'playwright-core';
const base = 'http://127.0.0.1:18793/';
const out = '/workspace/hamon_site/preview/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const errs = [];
async function shoot(w, h, name, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...opts });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', e => errs.push(name + ': ' + e));
  p.on('requestfailed', r => errs.push(name + ' failed: ' + r.url()));
  await p.goto(base, { waitUntil: 'load' });
  await p.waitForTimeout(4500);
  await p.screenshot({ path: out + name + '_fold.png' });
  // scroll through so lazy images load and reveals fire
  const H = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < H; y += h / 2) { await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(150); }
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1200);
  await p.screenshot({ path: out + name + '_full.png', fullPage: true });
  await ctx.close();
}
await shoot(1440, 900, 'desktop_1440');
await shoot(390, 844, 'mobile_390', { isMobile: true, hasTouch: true });
await shoot(1440, 900, 'desktop_1440_reduced_motion', { reducedMotion: 'reduce' });
console.log('errors', JSON.stringify(errs));
await b.close();
