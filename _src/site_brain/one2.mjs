import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
for (const [n,o] of [['desktop',{viewport:{width:1440,height:900}}],['mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}]]) {
const p = await (await b.newContext(o)).newPage(); await p.goto('http://127.0.0.1:18822/'); await p.waitForTimeout(3500); await p.screenshot({ path: `/workspace/site_publish/shots/pr2_orbit_${n}.png` }); }
await b.close();
