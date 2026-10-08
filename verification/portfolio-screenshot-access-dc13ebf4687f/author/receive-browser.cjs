const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {chromium} = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

async function main() {
  const [docs, output, stage] = process.argv.slice(2);
  assert.ok(stage === 'before' || stage === 'after');
  fs.mkdirSync(output, {recursive: true});
  const record = JSON.parse(fs.readFileSync(path.join(docs, 'cv.json')));
  const expected = record.demos.flatMap(d => ['desktop', 'mobile'].map(device => ({
    name: `${d.name}: full ${device === 'mobile' ? 'phone' : 'desktop'} screenshot`,
    ...d.shots[device],
  })));
  const served = [], blocked = [];
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let rel = pathname.replace(/^\/preview\//, '/').replace(/^\//, '') || 'index.html';
    const filename = path.resolve(docs, rel);
    if (!filename.startsWith(path.resolve(docs) + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    served.push(pathname);
    const type = {'.html':'text/html', '.css':'text/css', '.webp':'image/webp', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon'}[path.extname(filename)] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type':type}); res.end(fs.readFileSync(filename));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser, activePage, context;
  const report = {stage, docs: path.resolve(docs), viewports: [], blocked, served, page_errors:[]};
  try {
    browser = await chromium.launch({
      executablePath:'/workspace/scratch/ae0a1ea0b247/browser-tools/runtime/chromium',
      headless:true,
      args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--disk-cache-size=1048576'],
    });
    report.browser = browser.version();
    for (const width of [1280, 390]) {
      const origin = `http://127.0.0.1:${server.address().port}`;
      if (!context) {
        context = await browser.newContext({viewport:{width,height:900}, reducedMotion:'reduce'});
        await context.route('**/*', route => {
          if (new URL(route.request().url()).origin === origin) return route.continue();
          blocked.push(route.request().url()); return route.abort();
        });
      }
      const page = await context.newPage();
      await page.setViewportSize({width,height:900});
      activePage = page;
      page.on('pageerror', error => report.page_errors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') report.page_errors.push(message.text()); });
      const prefix = width === 390 ? '/preview/' : '/';
      await page.goto(origin + prefix + 'index.html');
      await page.locator('img').evaluateAll(images => images.forEach(img => img.loading = 'eager'));
      await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth));
      const row = {width, entry:prefix + 'index.html', previews:await page.locator('.demo img').count(),
        full_screenshot_actions:await page.locator('.screenshot-link').count(), opened:[]};
      assert.equal(row.previews, 6);
      assert.equal(row.full_screenshot_actions, stage === 'after' ? 6 : 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (stage === 'after') {
        for (const shot of expected) {
          const link = page.getByRole('link', {name:shot.name, exact:true});
          await link.focus();
          const focus = await link.evaluate(el => ({visible:el.matches(':focus-visible'), outline:getComputedStyle(el).outlineWidth, height:el.getBoundingClientRect().height}));
          assert.equal(focus.visible, true); assert.equal(focus.outline, '2px'); assert.ok(focus.height >= 44);
          const [reply] = await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
          assert.equal(page.url(), origin + prefix + shot.src);
          const raw = await reply.body();
          assert.deepEqual(raw, fs.readFileSync(path.join(docs, shot.src)));
          const dimensions = await page.locator('img').evaluate(img => ({width:img.naturalWidth,height:img.naturalHeight}));
          assert.deepEqual(dimensions, {width:shot.w,height:shot.h});
          row.opened.push({name:shot.name, path:prefix + shot.src, dimensions, sha256:crypto.createHash('sha256').update(raw).digest('hex'), focus});
          await page.goBack();
        }
        const summary = page.locator('#demo-returnby summary'); await summary.focus(); await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'ReturnBy: full desktop screenshot');
        row.tab_after_details = 'ReturnBy: full desktop screenshot';
      }
      if (width === 390) await page.locator('#demo-returnby').screenshot({path:path.join(output,'returnby-phone.png')});
      report.viewports.push(row);
      await page.close();
    }
    assert.deepEqual(blocked, []);
    report.ok = true;
  } catch (error) {
    report.ok = false; report.error = String(error.stack || error); process.exitCode = 1;
    if (activePage) try { report.images_at_failure = await activePage.locator('img').evaluateAll(images => images.map(img => ({src:img.getAttribute('src'),complete:img.complete,width:img.naturalWidth,height:img.naturalHeight}))); } catch (error) { report.diagnostic_error = String(error); }
  }
  finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
  fs.writeFileSync(path.join(output,'receipt.json'), JSON.stringify(report,null,2) + '\n');
  console.log(JSON.stringify({stage,ok:report.ok,browser:report.browser,viewports:report.viewports.map(({width,full_screenshot_actions,opened})=>({width,full_screenshot_actions,opened:opened.length})),error:report.error}));
}
main().catch(error => { console.error(String(error.stack || error)); process.exitCode = 1; });
