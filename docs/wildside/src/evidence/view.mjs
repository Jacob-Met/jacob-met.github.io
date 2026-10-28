import { mountSourceDetail } from './detail-view.mjs';
import { prepareEvidence, verifyEvidenceFile, verifyRecordedMoment } from './source.mjs';

/** Reattach local evidence for a kept review. This view never saves or edits an observation. */
export function mountEvidenceRevisit(element) {
  if (!element?.ownerDocument) throw new Error('Provide a container for the recorded moment.');
  const document = element.ownerDocument, window = document.defaultView;
  const host = document.createElement('section');
  element.append(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<article aria-labelledby="title"><header><p class="eyebrow">A closer look</p>
    <h2 id="title">Revisit a recorded moment</h2><p class="intro">Choose an observation to look at its original source.</p></header>
    <div id="content" hidden><div class="context"><h3 id="subject"></h3><p id="source"></p><p id="when"></p>
    <details><summary>What was kept</summary><h4>Observed notes</h4><p id="notes"></p>
    <div id="thought" hidden><h4>Interpretation</h4><p id="interpretation"></p></div>
    <p class="hint">A matching file reconnects the original bytes. It does not confirm a species, identity, or interpretation.</p></details></div>
    <label for="file">Choose the original photo or clip</label><input id="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/ogg,video/quicktime" aria-describedby="privacy status">
    <p id="privacy" class="hint">Your file stays on this device. The original is needed because recordings are not stored with the observation.</p>
    <div id="preview" aria-label="Reattached source"></div><button id="return" type="button" hidden>Return to the kept moment</button>
    <output id="position" aria-live="off"></output><div id="detail"></div></div><p id="status" role="status" aria-live="polite"></p></article>`;
  const css = document.createElement('link'); css.rel = 'stylesheet';
  css.href = new URL('./evidence.css', import.meta.url).href; root.prepend(css);
  const $ = id => root.getElementById(id);
  const detail = mountSourceDetail($('detail'), {onOpen: () => { $('preview').hidden = true; }, onClose: () => { $('preview').hidden = false; }});
  let evidence = null, media = null, url = null, generation = 0, timer = null, destroyed = false;
  let remembered = null; // At most one admitted File, scoped to this mounted private view.
  const say = (message, error = false) => { $('status').textContent = message; $('status').dataset.error = String(error); };
  function release({keepSource = false} = {}) {
    if (!keepSource) remembered = null;
    detail.clear();
    generation++; window.clearTimeout(timer); timer = null;
    if (media?.tagName === 'VIDEO') { media.pause(); media.removeAttribute('src'); media.load(); }
    if (url) window.URL.revokeObjectURL(url);
    media = null; url = null; $('preview').replaceChildren();
    $('return').hidden = true; $('position').textContent = '';
  }
  function returnToMoment() {
    if (!media || !evidence || media.tagName !== 'VIDEO') return;
    media.pause(); media.currentTime = evidence.offsetSeconds;
  }
  $('return').addEventListener('click', returnToMoment);
  async function attachFile(file, {reuse = false} = {}) {
    release({keepSource: reuse});
    const token = generation, selected = evidence;
    if (!selected || !file) { say('The original file is not attached. Your observation is still kept.'); return; }
    say('Checking that this is the original source…');
    try {
      await verifyEvidenceFile(selected, file, window.crypto);
      if (destroyed || token !== generation) return;
      const item = document.createElement(selected.mediaKind === 'video' ? 'video' : 'img');
      media = item; item.hidden = true;
      const current = () => !destroyed && token === generation;
      const fail = message => { if (!current()) return; release(); say(message, true); };
      item.addEventListener('error', () => fail('The fingerprint matches, but this browser could not open the recording. Try a compatible browser with the original file.'));
      timer = window.setTimeout(() => fail('The matching recording has not finished opening. Choose it again to retry.'), 15000);
      if (selected.mediaKind === 'photo') {
        item.alt = `Original source for ${selected.subject}`;
        item.addEventListener('load', () => {
          if (!current()) return;
          window.clearTimeout(timer); item.hidden = false; detail.attach(item, selected);
          remembered = {file, sourceId: selected.sourceId, mediaKind: selected.mediaKind};
          say('Original photo reattached. Viewing it does not add another observation.');
        }, { once: true });
      } else {
        item.controls = false; item.preload = 'auto'; item.playsInline = true;
        let located = false, verifiedMoment = false;
        const locate = () => {
          if (!current() || !verifiedMoment || located || item.readyState < 2 || item.seeking || Math.abs(item.currentTime - selected.offsetSeconds) > 0.05) return;
          // Enable native controls after the hidden initial seek has completed;
          // otherwise Chromium can retain its loading overlay on a ready frame.
          located = true; window.clearTimeout(timer); item.hidden = false; item.controls = true; $('return').hidden = false; detail.attach(item, selected);
          remembered = {file, sourceId: selected.sourceId, mediaKind: selected.mediaKind};
          say('Original clip reattached at the kept moment. Playback does not add observations.');
        };
        const seekToMoment = () => {
          // Completed browser recordings may report Infinity at loadedmetadata.
          // Keep the existing opening deadline while native duration settles.
          if (!current() || verifiedMoment || item.readyState < 1 || item.duration === Infinity) return;
          try {
            verifyRecordedMoment(selected.offsetSeconds, item.duration);
            item.currentTime = selected.offsetSeconds; verifiedMoment = true; locate();
          } catch (error) { fail(error.message); }
        };
        for (const event of ['loadedmetadata', 'durationchange']) item.addEventListener(event, seekToMoment);
        for (const event of ['loadeddata', 'seeked', 'canplay']) item.addEventListener(event, locate);
        item.addEventListener('timeupdate', () => {
          if (current()) $('position').textContent = `Playback: ${item.currentTime.toFixed(2)} seconds · kept moment: ${selected.offsetSeconds.toFixed(2)} seconds`;
        });
      }
      url = window.URL.createObjectURL(file); item.src = url; $('preview').append(item);
      say('Fingerprint matches. Opening the recorded source…');
    } catch (error) {
      if (destroyed || token !== generation) return;
      release(); say(error.message, true);
    }
  }
  $('file').addEventListener('change', () => {
    const file = $('file').files[0];
    // Allow choosing the same original again after a decode error or timeout.
    $('file').value = '';
    void attachFile(file);
  });
  return Object.freeze({
    show(review) {
      if (destroyed) throw new Error('This recorded-moment view has been closed.');
      const previous = remembered;
      release(); evidence = null; $('file').value = ''; $('content').hidden = true;
      let next;
      try { next = prepareEvidence(review); }
      catch (error) { say(error.message, true); throw error; }
      evidence = next; $('content').hidden = false;
      root.querySelector('.intro').textContent = 'Return to the detail that caught your eye.';
      $('subject').textContent = next.subject; $('source').textContent = next.sourceLabel;
      $('when').textContent = (next.observedAt ? `Recorded: ${next.observedAt}` : 'Recording date and time are unknown.') +
        (next.mediaKind === 'video' ? ` Kept moment: ${next.offsetSeconds.toFixed(2)} seconds into the clip.` : '');
      $('notes').textContent = next.notes; $('thought').hidden = !next.interpretation;
      $('interpretation').textContent = next.interpretation;
      if (previous?.sourceId === next.sourceId && previous.mediaKind === next.mediaKind) {
        // Recheck local bytes and decode a new element: old event listeners remain retired.
        remembered = previous; void attachFile(previous.file, {reuse: true});
      } else say('The original file is not attached. Choose it here when you want to look again.');
    },
    clear() {
      if (destroyed) return;
      release(); evidence = null; $('file').value = ''; $('content').hidden = true;
      root.querySelector('.intro').textContent = 'Choose an observation to look at its original source.'; say('');
    },
    destroy() { if (!destroyed) { destroyed = true; release(); evidence = null; detail.destroy(); host.remove(); } },
  });
}
