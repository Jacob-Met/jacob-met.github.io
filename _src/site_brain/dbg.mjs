import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('console', m => console.log('C', m.type(), m.text()));
await p.goto('http://127.0.0.1:18822/'); await p.waitForTimeout(3000);
await p.click('#regionList a[data-id="1"]');
for (let i = 0; i < 8; i++) { await p.waitForTimeout(700); console.log(await p.evaluate(() => [...document.querySelectorAll('video')].map(v => [v.src.split('/').pop(), v.currentTime.toFixed(2), v.duration, v.paused, v.ended, v.readyState, v.networkState, v.error?.code, v.className]).concat([document.body.className, document.querySelector('.open')?.id]))); }
await b.close();
