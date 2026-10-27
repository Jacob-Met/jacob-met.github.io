import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const n = await b.newPage({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
await n.goto('http://127.0.0.1:8765/'); await n.screenshot({ path: '/workspace/site_brain/shots/11_no_js.png', fullPage: true }); await b.close();
