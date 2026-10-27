import { chromium } from 'playwright-core';
const [,, q='?t=2', out='/workspace/site_brain/shots/_iter.png', w=1600, h=1000] = process.argv;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } }); p.on('pageerror', e => console.log('PE', e));
await p.goto('http://127.0.0.1:8765/' + q); await p.waitForTimeout(7000); await p.screenshot({ path: out }); await b.close();
