/** Decode one explicit local clip moment into a frozen, annotation-safe frame.
 * The returned canvas never retains source bytes in the saved place. */
export function validateClipMoment(seconds, duration) {
  if (!Number.isFinite(duration) || duration <= 0 ||
      !Number.isFinite(seconds) || seconds < 0 || seconds >= duration)
    throw new RangeError('Choose a finite clip moment before the end of the recording.');
  return seconds;
}

function aborted() { return new DOMException('Clip scan cancelled.', 'AbortError'); }
function waitFor(video, events, ready, timeoutMs, signal, cancelEvents = []) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(aborted()); return; }
    let complete = false;
    const cleanup = () => {
      clearTimeout(timer);
      for (const name of events) video.removeEventListener(name, check);
      for (const name of cancelEvents) video.removeEventListener(name, cancel);
      video.removeEventListener('error', fail);
      signal?.removeEventListener('abort', cancel);
    };
    const finish = (error) => {
      if (complete) return;
      complete = true; cleanup();
      if (error) reject(error); else resolve();
    };
    const check = () => { if (ready()) finish(); };
    const fail = () => finish(new Error('This browser could not decode the selected clip.'));
    const cancel = () => finish(aborted());
    const timer = setTimeout(
      () => finish(new Error('The selected clip moment could not be decoded. Try a supported local video.')),
      timeoutMs,
    );
    for (const name of events) video.addEventListener(name, check);
    for (const name of cancelEvents) video.addEventListener(name, cancel);
    video.addEventListener('error', fail);
    signal?.addEventListener('abort', cancel, {once: true});
    check();
  });
}

export async function loadClipMetadata(video, {timeoutMs = 15000, signal} = {}) {
  const deadline = performance.now() + timeoutMs;
  await waitFor(video, ['loadedmetadata', 'durationchange'], () => video.readyState >= 1,
    timeoutMs, signal, ['emptied']);
  if (signal?.aborted) throw aborted();
  if (!Number.isInteger(video.videoWidth) || !Number.isInteger(video.videoHeight) ||
      video.videoWidth <= 0 || video.videoHeight <= 0 ||
      video.videoWidth * video.videoHeight > 50_000_000)
    throw new Error('Choose a decodable finite clip with frames of at most 50 megapixels.');
  // A completed MediaRecorder clip can first report Infinity, then expose its
  // native finite duration as decoding loads. Keep the original timeout budget.
  if (video.duration === Infinity) {
    await waitFor(video, ['durationchange', 'loadeddata'],
      () => Number.isFinite(video.duration) && video.duration > 0,
      Math.max(0, deadline - performance.now()), signal, ['emptied']);
  }
  if (!Number.isFinite(video.duration) || video.duration <= 0)
    throw new Error('Choose a decodable finite clip with frames of at most 50 megapixels.');
  return video.duration;
}

export async function captureClipFrame(video, seconds, {timeoutMs = 15000, signal, maxDimension = null} = {}) {
  if (signal?.aborted) throw aborted();
  if (maxDimension !== null && (!Number.isInteger(maxDimension) || maxDimension < 1 || maxDimension > 4096))
    throw new RangeError('Frame preview dimensions must be bounded.');
  validateClipMoment(seconds, video.duration);
  // Prevent accidental playback while seeking; every observation is a still moment.
  video.pause();
  video.currentTime = seconds;
  await waitFor(video, ['seeked', 'loadeddata', 'canplay', 'timeupdate'], () =>
    video.readyState >= 2 && !video.seeking &&
    Math.abs(video.currentTime - seconds) <= 0.05, timeoutMs, signal);
  if (signal?.aborted) throw aborted();
  const offsetSeconds = video.currentTime;
  validateClipMoment(offsetSeconds, video.duration);
  const image = video.ownerDocument.createElement('canvas');
  const scale = maxDimension === null ? 1 : Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
  image.width = Math.max(1, Math.round(video.videoWidth * scale));
  image.height = Math.max(1, Math.round(video.videoHeight * scale));
  // The existing source-palette sampler uses HTMLImageElement's pixel dimensions.
  image.naturalWidth = image.width;
  image.naturalHeight = image.height;
  const context = image.getContext('2d', {willReadFrequently: true});
  if (!context) throw new Error('This browser could not read a clip frame.');
  context.drawImage(video, 0, 0, image.width, image.height);
  return {image, offsetSeconds};
}

