import {detailRegion} from './detail.mjs';

/** Internal view: the parent attaches only media admitted by source verification and decoding. */
export function mountSourceDetail(element, {onOpen = () => {}, onClose = () => {}} = {}) {
  const document = element.ownerDocument;
  element.innerHTML = `<button type="button" id="detail-open" hidden>Look closer</button>
    <section id="detail-panel" aria-labelledby="detail-title" hidden>
    <div class="detail-heading"><h3 id="detail-title">A closer look</h3><button type="button" id="detail-close">Back to original</button></div>
    <p id="detail-time" class="hint"></p>
    <div class="detail-images"><figure class="detail-overview"><figcaption>Whole frame · choose a spot</figcaption>
    <canvas id="detail-overview" aria-label="Whole original frame; use the position controls below to choose a region"></canvas></figure>
    <figure class="detail-crop"><figcaption id="detail-caption">Selected detail</figcaption>
    <canvas id="detail-crop" aria-label="Magnified region from the original source"></canvas></figure></div>
    <div class="detail-zoom" role="group" aria-label="Magnification"><button type="button" data-zoom="1">1×</button><button type="button" data-zoom="2">2×</button><button type="button" data-zoom="4">4×</button><button type="button" id="detail-reset">Reset</button></div>
    <div class="detail-position"><label>Horizontal position<input id="detail-x" type="range" min="0" max="100" value="50" step="1"></label><label>Vertical position<input id="detail-y" type="range" min="0" max="100" value="50" step="1"></label></div>
    <p class="hint">Magnified original pixels. This view does not add detail or change the observation.</p></section>
    <p id="detail-status" role="status" aria-live="polite"></p>`;
  const $ = id => element.querySelector('#' + id);
  const overview = $('detail-overview'), crop = $('detail-crop');
  let media = null, evidence = null, snapshot = null, position = null, open = false, disposed = false;
  const status = text => { $('detail-status').textContent = text; };
  function close({focus = false, message = ''} = {}) {
    if (!open) return;
    open = false;
    if (snapshot) { snapshot.width = 0; snapshot.height = 0; snapshot = null; }
    overview.width = crop.width = 0; overview.height = crop.height = 0;
    $('detail-panel').hidden = true; $('detail-open').hidden = !media;
    status(message); onClose();
    if (focus) $('detail-open').focus({preventScroll: true});
  }
  const changed = () => close({message: 'The clip moved. Choose Look closer to inspect its new position.'});
  function draw() {
    const region = detailRegion(snapshot.width, snapshot.height, position);
    const overviewScale = Math.min(1, 640 / snapshot.width, 640 / snapshot.height);
    overview.width = Math.max(1, Math.round(snapshot.width * overviewScale));
    overview.height = Math.max(1, Math.round(snapshot.height * overviewScale));
    const context = overview.getContext('2d');
    context.drawImage(snapshot, 0, 0, overview.width, overview.height);
    const sx = overview.width / snapshot.width, sy = overview.height / snapshot.height;
    context.strokeStyle = '#fff'; context.lineWidth = 4;
    context.strokeRect(region.x * sx + 2, region.y * sy + 2, Math.max(0, region.width * sx - 4), Math.max(0, region.height * sy - 4));
    context.strokeStyle = '#243f31'; context.lineWidth = 2;
    context.strokeRect(region.x * sx + 2, region.y * sy + 2, Math.max(0, region.width * sx - 4), Math.max(0, region.height * sy - 4));
    const scale = Math.min(1, 1280 / region.width, 1280 / region.height);
    crop.width = Math.max(1, Math.round(region.width * scale)); crop.height = Math.max(1, Math.round(region.height * scale));
    crop.getContext('2d').drawImage(snapshot, region.x, region.y, region.width, region.height, 0, 0, crop.width, crop.height);
    $('detail-x').value = String(position.x * 100); $('detail-y').value = String(position.y * 100);
    for (const button of element.querySelectorAll('[data-zoom]')) button.setAttribute('aria-pressed', String(Number(button.dataset.zoom) === position.zoom));
    $('detail-caption').textContent = `${position.zoom}× · selected detail`;
  }
  function enter() {
    if (!media || disposed) return;
    try {
      const video = media.tagName === 'VIDEO';
      if (video && (media.seeking || media.readyState < 2)) throw new Error('Let the clip finish moving before looking closer.');
      const width = video ? media.videoWidth : media.naturalWidth;
      const height = video ? media.videoHeight : media.naturalHeight;
      detailRegion(width, height);
      if (video) media.pause();
      close();
      snapshot = document.createElement('canvas'); snapshot.width = width; snapshot.height = height;
      snapshot.getContext('2d').drawImage(media, 0, 0);
      position = {zoom: 2, x: .5, y: .5}; open = true;
      draw();
      $('detail-time').textContent = video ? `Paused clip: ${media.currentTime.toFixed(2)} seconds · kept moment: ${evidence.offsetSeconds.toFixed(2)} seconds.` : 'Detail from the reattached original photo.';
      $('detail-panel').hidden = false; $('detail-open').hidden = true; onOpen();
      status('Choose a spot in the whole frame, or use the position controls.');
      $('detail-close').focus({preventScroll: true});
    } catch (error) {
      if (snapshot) { snapshot.width = 0; snapshot.height = 0; snapshot = null; }
      open = false; overview.width = crop.width = 0; overview.height = crop.height = 0;
      $('detail-panel').hidden = true; $('detail-open').hidden = !media; onClose(); status(error.message);
    }
  }
  $('detail-open').addEventListener('click', enter);
  $('detail-close').addEventListener('click', () => close({focus: true}));
  $('detail-reset').addEventListener('click', () => { if (open) { position = {zoom: 2, x: .5, y: .5}; draw(); } });
  for (const button of element.querySelectorAll('[data-zoom]')) button.addEventListener('click', () => {
    if (open) { position.zoom = Number(button.dataset.zoom); draw(); }
  });
  overview.addEventListener('click', event => {
    if (!open) return;
    const bounds = overview.getBoundingClientRect();
    position.x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    position.y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    draw();
  });
  for (const [id, axis] of [['detail-x', 'x'], ['detail-y', 'y']]) $(id).addEventListener('input', () => {
    if (open) { position[axis] = Number($(id).value) / 100; draw(); }
  });
  element.addEventListener('keydown', event => {
    if (open && event.key === 'Escape') { event.preventDefault(); close({focus: true}); }
  });
  function clear() {
    close();
    if (media) for (const event of ['play', 'seeking', 'emptied']) media.removeEventListener(event, changed);
    media = evidence = null; $('detail-open').hidden = true; status('');
  }
  return Object.freeze({
    attach(item, context) {
      if (disposed) return;
      clear(); media = item; evidence = context;
      for (const event of ['play', 'seeking', 'emptied']) media.addEventListener(event, changed);
      $('detail-open').hidden = false;
    },
    clear,
    destroy() { if (!disposed) { clear(); disposed = true; element.replaceChildren(); } },
  });
}
