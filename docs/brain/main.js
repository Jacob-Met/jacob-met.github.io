// The prerendered brain. Nothing here is live 3D: every pixel of the brain is a HAMON Engine render from the farm.
// orbit: 96 turntable frames scrubbed by drag / scroll; labels.png holds a region id per pixel for every orbit frame.
// A click turns the orbit to the region's hub frame (the first frame of its dive), plays the dive, and opens the region.
// An eye plays the flight out along the visual pathway (V1 -> optic radiation -> LGN -> tract -> chiasm -> nerve -> pupil)
// and the pupil opens onto that eye's world. Old realtime build: /brain/realtime.js.
import { REGIONS, EYES } from './content.js';
import { GRAPH } from './graph.js';

const N = GRAPH.n_orbit, PR = '/brain/pr/', IW = 1280, IH = 720, LW = 240, LH = 135;
let BG = '#05050c';
const $ = (s) => document.querySelector(s);
const stage = $('#stage'), view = $('#view'), glow = $('#glow'), tip = $('#tip'), flash = $('#flash');
const vids = [$('#segA'), $('#segB')], stepOutBtn = $('#stepOut'), poster = $('#poster');
const ctx = view.getContext('2d'), gctx = glow.getContext('2d');
// graceful fallback: no 2D canvas, or the farm frames will not load -> the plain, fully written page (no brain).
function fallback(why) { document.body.classList.remove('pr'); document.body.classList.add('flat'); document.documentElement.dataset.fallback = why; throw new Error('brain fallback: ' + why); }
if (!ctx || !gctx) fallback('no-canvas');
const mq = matchMedia('(prefers-reduced-motion: reduce)');
let reduce = mq.matches; mq.addEventListener?.('change', (e) => { reduce = e.matches; });
const byId = new Map(REGIONS.map((r) => [r.id, r]));
for (const [id, e] of Object.entries(EYES)) byId.set(+id, { ...e, id: +id, eye: true });
const keyToId = new Map([...byId.values()].map((r) => [r.key, r.id]));
document.body.classList.add('pr');

// ---------- frames
const big = innerWidth * (devicePixelRatio || 1) > 1700;
const small = innerWidth < 760 || (navigator.connection && /2g|3g/.test(navigator.connection.effectiveType || ''));
const lo = new Array(N), hi = new Array(N);
const pad = (i) => String(i).padStart(2, '0');
function load(arr, i, w) {
  if (arr[i]) return arr[i];
  const im = new Image(); im.decoding = 'async'; im.src = `${PR}orbit/o${pad(i)}-${w}.webp`;
  im.onerror = () => { if (w === 640 && i === Math.round(mod(pos)) && !bgSampled) { stage.remove(); try { fallback('frames'); } catch (e) {} } };
  im.onload = () => { im.ok = true; if (!bgSampled) sampleBG(im); if (Math.round(mod(pos)) === i) dirty = true; };
  return (arr[i] = im);
}
// the frames carry their own render background; letterbox with exactly that colour so the frame edge never shows
let bgSampled = false;
function sampleBG(im) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d');
    x.drawImage(im, 0, 0, 8, 8, 0, 0, 4, 4); const d = x.getImageData(0, 0, 4, 4).data;
    let r = 0, g = 0, b = 0; for (let k = 0; k < 64; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
    BG = `rgb(${Math.round(r / 16)},${Math.round(g / 16)},${Math.round(b / 16)})`; stage.style.background = BG; bgSampled = true; dirty = true;
  } catch (e) { bgSampled = true; }
}
function frameImg(i) { return (hi[i] && hi[i].ok) ? hi[i] : (lo[i] && lo[i].ok) ? lo[i] : null; }
// progressive: nearest frames first, then the rest; the 1280 set follows on wide screens
function warm(center) {
  const order = [...Array(N).keys()].sort((a, b) => cdist(a, center) - cdist(b, center));
  let k = 0;
  const step = () => {
    for (let n = 0; n < 6 && k < order.length; n++, k++) { load(lo, order[k], 640); if (!small) load(hi, order[k], big ? 1920 : 1280); }
    if (k < order.length) setTimeout(step, 60);
  };
  step();
}
const mod = (x) => ((x % N) + N) % N;
const cdist = (a, b) => { const d = Math.abs(mod(a) - mod(b)); return Math.min(d, N - d); };

// ---------- labels
let labels = null;
{
  const im = new Image(); im.src = PR + 'labels.png';
  im.onerror = () => { if (w === 640 && i === Math.round(mod(pos)) && !bgSampled) { stage.remove(); try { fallback('frames'); } catch (e) {} } };
  im.onload = () => {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; labels = new Uint8Array(c.width * c.height);
    for (let i = 0; i < labels.length; i++) labels[i] = d[i * 4];
    labels.w = c.width;
  };
}
function labelAt(f, u, v) {
  if (!labels || u < 0 || v < 0 || u >= 1 || v >= 1) return 0;
  const fx = (f % 12) * LW + Math.floor(u * LW), fy = Math.floor(f / 12) * LH + Math.floor(v * LH);
  return labels[fy * labels.w + fx];
}

// ---------- layout: the image rect inside the stage (cover on wide screens, brain-fit on tall ones)
let rect = { x: 0, y: 0, w: 0, h: 0 }, dpr = 1;
function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  const cw = stage.clientWidth, ch = stage.clientHeight;
  for (const c of [view, glow]) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
  // v3.1 frames: the brain fills ~70% of the frame. Desktop keeps it clear of the region list; phones fit the width.
  const side = cw >= 1000 ? Math.min(330, cw * 0.24) : 0;
  let s = Math.max(cw / IW, ch / IH);
  s = cw < 760 ? Math.min(s, cw / (IW * 0.78)) : Math.min(s, (cw - side) / IW);
  const w = IW * s, h = IH * s;
  rect = { x: (cw - side - w) / 2, y: (ch - h) / 2 - (cw < 760 ? ch * 0.08 : 0), w, h };
  for (const v of vids) Object.assign(v.style, { left: rect.x + 'px', top: rect.y + 'px', width: w + 'px', height: h + 'px' });
  Object.assign(poster.style, { left: rect.x + 'px', top: rect.y + 'px', width: w + 'px', height: h + 'px' });
  dirty = true;
}
addEventListener('resize', layout);

// ---------- draw
let pos = 0, vel = 0, dirty = true, hover = 0, hoverA = 0, lastInput = 0, state = 'orbit', current = null;
function draw() {
  const f = Math.round(mod(pos)) % N, im = frameImg(f);
  if (!im) return;
  poster.classList.add('gone');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, view.width, view.height);
  ctx.drawImage(im, rect.x, rect.y, rect.w, rect.h);
  feather(ctx);
  gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, glow.width, glow.height);
  if (hover && labels && state === 'orbit' && hoverA > 0.01) {
    const r = byId.get(hover), m = maskFor(f, hover, r.hue);
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.globalAlpha = 0.55 * hoverA; gctx.globalCompositeOperation = 'source-over';
    gctx.filter = 'blur(10px)'; gctx.drawImage(m, rect.x, rect.y, rect.w, rect.h);
    gctx.filter = 'blur(1.5px)'; gctx.globalAlpha = 0.32 * hoverA; gctx.drawImage(m, rect.x, rect.y, rect.w, rect.h);
    gctx.filter = 'none'; gctx.globalAlpha = 1;
  }
}
// when the frame sits inside the stage (phones), melt its edges into the letterbox
function feather(c) {
  const H = stage.clientHeight, W = stage.clientWidth, fy = rect.h * 0.16, fx = rect.w * 0.1;
  const band = (x0, y0, x1, y1, rx, ry, rw, rh) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, BG); g.addColorStop(1, BG.replace('rgb(', 'rgba(').replace(')', ',0)').replace('#05050c', 'rgba(5,5,12,0)')); c.fillStyle = g; c.fillRect(rx, ry, rw, rh); };
  // gradient end colour must be BG with alpha 0 to avoid grey fringes
  if (rect.y > 0.5) band(0, rect.y, 0, rect.y + fy, 0, rect.y, W, fy);
  if (rect.y + rect.h < H - 0.5) band(0, rect.y + rect.h, 0, rect.y + rect.h - fy, 0, rect.y + rect.h - fy, W, fy);
  if (rect.x > 0.5) band(rect.x, 0, rect.x + fx, 0, rect.x, 0, fx, H);
  if (rect.x + rect.w < W - 0.5) band(rect.x + rect.w, 0, rect.x + rect.w - fx, 0, rect.x + rect.w - fx, 0, fx, H);
  c.fillStyle = BG;
}
const maskCache = new Map();
function maskFor(f, id, hue) {
  const k = f * 16 + id; if (maskCache.has(k)) return maskCache.get(k);
  const c = document.createElement('canvas'); c.width = LW; c.height = LH;
  const x = c.getContext('2d'), d = x.createImageData(LW, LH);
  const [R, G, B] = [1, 3, 5].map((o) => parseInt(hue.slice(o, o + 2), 16));
  for (let y = 0; y < LH; y++) for (let xx = 0; xx < LW; xx++) {
    if (labels[(Math.floor(f / 12) * LH + y) * labels.w + (f % 12) * LW + xx] === id) { const i = (y * LW + xx) * 4; d.data[i] = R; d.data[i + 1] = G; d.data[i + 2] = B; d.data[i + 3] = 255; }
  }
  x.putImageData(d, 0, 0);
  if (maskCache.size > 64) maskCache.delete(maskCache.keys().next().value);
  maskCache.set(k, c); return c;
}
let last = performance.now(), turnTo = null;
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (turnTo) {
    const t = Math.min(1, (now - turnTo.t0) / turnTo.ms), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    pos = turnTo.from + turnTo.d * e; dirty = true;
    if (t >= 1) { pos = turnTo.to; const cb = turnTo.cb; turnTo = null; cb(); }
  } else if (state === 'orbit') {
    if (Math.abs(vel) > 0.01) { pos += vel * dt; vel *= Math.pow(0.04, dt); dirty = true; }
    else if (!reduce && now - lastInput > 3500 && !document.hidden) { pos += dt * 1.6; dirty = true; }
  }
  if (state === 'orbit') {
    const ta = hover ? 1 : 0; if (Math.abs(hoverA - ta) > 0.01) { hoverA += (ta - hoverA) * Math.min(1, dt * 10); dirty = true; }
  }
  if (dirty) { dirty = false; draw(); }
  requestAnimationFrame(tick);
}

// ---------- input
let drag = null;
function uv(e) { const b = stage.getBoundingClientRect(); return [(e.clientX - b.left - rect.x) / rect.w, (e.clientY - b.top - rect.y) / rect.h]; }
stage.addEventListener('pointerdown', (e) => {
  if (state !== 'orbit' || turnTo) return;
  drag = { x: e.clientX, p: pos, t: performance.now(), moved: 0, id: e.pointerId }; vel = 0; lastInput = performance.now();
});
addEventListener('pointermove', (e) => {
  if (state !== 'orbit') return;
  if (drag && drag.id === e.pointerId) {
    const dx = e.clientX - drag.x; drag.moved = Math.max(drag.moved, Math.abs(dx));
    if (drag.moved > 4) { stage.setPointerCapture?.(e.pointerId); stage.classList.add('dragging'); }
    const np = drag.p - dx / Math.max(rect.w, 1) * N * 0.75;
    const t = performance.now(); vel = (np - pos) / Math.max((t - drag.t) / 1000, 0.008); drag.t = t;
    pos = np; dirty = true; lastInput = t; setHover(0); return;
  }
  if (e.pointerType === 'mouse' && e.target.closest && e.target.closest('#stage')) {
    const [u, v] = uv(e); setHover(labelAt(Math.round(mod(pos)) % N, u, v), e);
  }
});
addEventListener('pointerup', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  stage.classList.remove('dragging');
  const moved = drag.moved; drag = null; vel = Math.max(-40, Math.min(40, vel)); lastInput = performance.now();
  if (moved <= 4) {
    vel = 0; const [u, v] = uv(e); const id = labelAt(Math.round(mod(pos)) % N, u, v);
    if (id) { if (e.pointerType !== 'mouse' && hover !== id) { setHover(id, e); return; } enter(id); }
    else setHover(0);
  }
});
stage.addEventListener('wheel', (e) => {
  if (state !== 'orbit' || turnTo) return;
  e.preventDefault(); vel = 0; pos += (e.deltaY + e.deltaX) * 0.025; dirty = true; lastInput = performance.now(); setHover(0);
}, { passive: false });
function setHover(id, e) {
  if (id === hover) { if (id && e) placeTip(e); return; }
  hover = id; dirty = true;
  stage.style.cursor = id ? 'pointer' : '';
  document.querySelectorAll('#regionList a').forEach((a) => a.classList.toggle('hot', +a.dataset.id === id));
  if (!id) { tip.classList.remove('on'); return; }
  const r = byId.get(id);
  tip.innerHTML = `<b>${r.title}</b><small>${r.name}${r.eye ? ' · leave through this eye' : ''}</small>`;
  tip.style.setProperty('--c', r.hue); tip.classList.add('on'); if (e) placeTip(e); else { tip.style.left = '50%'; tip.style.top = '18%'; }
  prefetch(r);
}
function placeTip(e) { tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; }

// ---------- segments
const segURL = (seg, rev) => `${PR}seg/${seg}${rev ? '-rev' : ''}.mp4`;
function prefetch(r) { const v = vids[1]; const u = segURL(r.seg); if (!v.src.endsWith(u)) { v.preload = 'auto'; v.src = u; } }
function playSeg(url, rate = 1) {
  return new Promise((res) => {
    let v = vids.find((x) => x.src.endsWith(url)) || vids[0];
    const other = vids.find((x) => x !== v);
    if (!v.src.endsWith(url)) v.src = url;
    v.playbackRate = rate; v.currentTime = 0;
    let shown = false, done = false;
    const show = () => { if (!shown && v.currentTime > 0.02) { shown = true; v.classList.add('on'); other.classList.remove('on'); } };
    let guard = 0;
    const end = () => { if (done) return; done = true; clearTimeout(guard); v.removeEventListener('timeupdate', show); show(); res(v); };
    // never strand the visitor: if the clip stalls, arrive anyway
    guard = setTimeout(end, ((isFinite(v.duration) && v.duration) ? v.duration : 8) / rate * 1000 + 4000);
    v.addEventListener('timeupdate', show);
    v.addEventListener('ended', end, { once: true });
    v.addEventListener('error', end, { once: true });
    const p = v.play(); if (p) p.catch(end);
  });
}
function hideVideos() { for (const v of vids) v.classList.remove('on'); }
function shortest(to) { let d = mod(to) - mod(pos); if (d > N / 2) d -= N; if (d < -N / 2) d += N; return d; }
function turn(to, cb) {
  const d = shortest(to);
  if (Math.abs(d) < 0.5 || reduce) { pos = to; dirty = true; cb(); return; }
  turnTo = { from: pos, to, d, t0: performance.now(), ms: 220 + Math.abs(d) * 22, cb };
}

async function enter(id, instant = false) {
  const r = byId.get(id); if (!r || state !== 'orbit') return;
  setHover(0); state = 'busy'; current = r;
  history.replaceState(null, '', r.eye ? `#w-${r.key}` : `#r-${r.key}`);
  document.body.classList.add('away');
  const hub = GRAPH.hubs[r.eye ? 'eye_' + r.key : r.key.replace('stem', 'brainstem')];
  if (instant || reduce) {
    pos = hub; dirty = true; showEnd(r); arrive(r); return;
  }
  await new Promise((res) => turn(hub, res));
  state = 'busy';
  await playSeg(segURL(r.seg));
  arrive(r);
}
function showEnd(r) {
  const v = vids[0]; v.removeAttribute('src'); v.poster = `${PR}seg/${r.seg}-end.webp`; v.load(); v.classList.add('on');
}
function arrive(r) {
  state = 'in';
  if (r.eye) openWorld(r); else openRegion(r);
  stepOutBtn.hidden = false; stepOutBtn.focus({ preventScroll: true });
}
function openRegion(r) {
  const s = document.getElementById('r-' + r.key);
  s.classList.add('open'); s.scrollTop = 0;
  s.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
}
function openWorld(r) {
  const w = document.getElementById('w-' + r.key);
  w.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
  flash.className = 'on ' + r.key;
  w.classList.add('open'); w.scrollTop = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('iris')));
  setTimeout(() => { flash.className = ''; }, 900);
}
async function stepOut() {
  if (state !== 'in' || !current) return;
  const r = current; state = 'busy'; stepOutBtn.hidden = true;
  history.replaceState(null, '', location.pathname);
  if (r.eye) {
    const w = document.getElementById('w-' + r.key); w.classList.remove('iris');
    await new Promise((res) => setTimeout(res, reduce ? 0 : 700)); w.classList.remove('open');
  } else document.getElementById('r-' + r.key).classList.remove('open');
  if (!reduce) await playSeg(segURL(r.seg, true), r.eye ? 2 : 1.25);
  pos = GRAPH.hubs[r.eye ? 'eye_' + r.key : r.key.replace('stem', 'brainstem')]; dirty = true;
  draw(); hideVideos(); state = 'orbit'; current = null; lastInput = performance.now();
  document.body.classList.remove('away');
}
stepOutBtn.addEventListener('click', stepOut);

// ---------- keyboard + list
const order = [10, 9, 1, 2, 3, 4, 5, 6, 7, 8];
document.querySelectorAll('#regionList a').forEach((a) => {
  a.addEventListener('click', (e) => { e.preventDefault(); if (state === 'in') return; enter(+a.dataset.id); });
  a.addEventListener('mouseenter', () => { if (state === 'orbit') { setHover(+a.dataset.id); } });
  a.addEventListener('mouseleave', () => { if (state === 'orbit') setHover(0); });
  a.addEventListener('focus', () => { if (state === 'orbit') setHover(+a.dataset.id); });
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { stepOut(); return; }
  if (state !== 'orbit' || e.target.closest?.('a,button,input')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const i = order.indexOf(hover), n = order[(i + (e.key === 'ArrowRight' ? 1 : order.length - 1) + (i < 0 ? 0 : 0)) % order.length] || order[0];
    setHover(n); e.preventDefault();
  } else if (e.key === 'Enter' && hover) enter(hover);
});

// ---------- start
layout();
const fromHash = keyToId.get((location.hash.match(/^#[rw]-(\w+)/) || [])[1]);
if (fromHash) pos = GRAPH.hubs[byId.get(fromHash).eye ? 'eye_' + byId.get(fromHash).key : byId.get(fromHash).key.replace('stem', 'brainstem')];
warm(Math.round(pos));
requestAnimationFrame(tick);
if (fromHash) { const go = () => enter(fromHash, true); lo[Math.round(pos)].complete ? go() : lo[Math.round(pos)].addEventListener('load', go, { once: true }); }
