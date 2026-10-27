import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://127.0.0.1:18822';
const out = process.argv[3] || '/workspace/site_publish/shots/pr_';
const bust = process.argv[4] || '';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const vps = { desktop: { viewport: { width: 1440, height: 900 } }, mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
const rep = {};
for (const [vn, o] of Object.entries(vps)) {
  const ctx = await b.newContext(o); const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(String(e)));
  p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  await p.goto(base + '/' + bust, { waitUntil: 'load' }); await p.waitForTimeout(3500);
  await p.screenshot({ path: `${out}orbit_${vn}.png` });
  const shot = async (n) => p.screenshot({ path: `${out}${n}_${vn}.png` });
  const st = async () => p.evaluate(() => ({ open: [...document.querySelectorAll('.open')].map(e => e.id), out: !document.querySelector('#stepOut').hidden, vid: [...document.querySelectorAll('video.on')].map(v => v.currentSrc.split('/').pop()) }));
  // drag
  const sb = await p.locator('#stage').boundingBox();
  if (vn === 'desktop') {
    await p.mouse.move(sb.x + sb.width * 0.5, sb.y + sb.height * 0.5); await p.mouse.down(); await p.mouse.move(sb.x + sb.width * 0.3, sb.y + sb.height * 0.5, { steps: 10 }); await p.mouse.up();
    await p.waitForTimeout(1500); await shot('dragged');
    // hover scan for a region
    let found = null;
    for (let x = 0.3; x < 0.7 && !found; x += 0.04) { await p.mouse.move(sb.x + sb.width * x, sb.y + sb.height * 0.42); await p.waitForTimeout(60); const t = await p.evaluate(() => document.querySelector('#tip.on b')?.textContent); if (t) found = [x, t]; }
    await p.waitForTimeout(400); await shot('hover'); rep['hover_' + vn] = found;
    if (found) { await p.mouse.click(sb.x + sb.width * found[0], sb.y + sb.height * 0.42); await p.waitForTimeout(4000); await shot('clicked'); rep['clicked_' + vn] = await st(); await p.keyboard.press('Escape'); await p.waitForTimeout(3500); }
  }
  for (const [n, sel] of [['frontal', 'a[data-id="1"]'], ['motor', 'a[data-id="7"]'], ['hippocampus', 'a[data-id="8"]'], ['hamon', 'a[data-id="10"]'], ['spire', 'a[data-id="9"]']]) {
    await p.click('#regionList ' + sel);
    await p.waitForTimeout(n === 'hamon' || n === 'spire' ? 10500 : 4500);
    await shot(n); rep[n + '_' + vn] = await st();
    if (n === 'spire' || n === 'hamon') { await p.evaluate(() => document.querySelector('.world.open')?.scrollTo(0, 900)); await p.waitForTimeout(600); await shot(n + '_scroll'); }
    await p.click('#stepOut'); await p.waitForTimeout(n === 'hamon' || n === 'spire' ? 6000 : 3500);
    rep[n + '_back_' + vn] = await st();
  }
  await shot('back');
  rep['errors_' + vn] = errs;
  await ctx.close();
}
// deep link + no-JS
{ const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); await p.goto(base + '/#r-parietal'); await p.waitForTimeout(3000); await p.screenshot({ path: `${out}deeplink_desktop.png` }); rep.deeplink = await p.evaluate(() => [...document.querySelectorAll('.open')].map(e => e.id)); await ctx.close(); }
{ const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false }); const p = await ctx.newPage(); await p.goto(base + '/'); await p.waitForTimeout(1000); await p.screenshot({ path: `${out}nojs_desktop.png`, fullPage: false }); await ctx.close(); }
console.log(JSON.stringify(rep, null, 1));
await b.close();
