import { identifyMedia, timestamp } from '../review/draft.mjs';

const text = (value, name, max) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`This observation has no valid ${name}.`);
  return value.trim();
};

/** A read-only projection of the maintained local review record; no new observation. */
export function prepareEvidence(review) {
  if (review?.version !== 1 || review?.method !== 'human-review' ||
      review?.source?.kind !== 'local-media')
    throw new Error('Choose an observation made from a local photo or clip.');
  const source = review.source;
  if (typeof source.sourceId !== 'string' || !/^local:sha256:[a-f0-9]{64}$/.test(source.sourceId) ||
      !['photo', 'video'].includes(source.mediaKind))
    throw new Error('This observation has no usable local source fingerprint.');
  if (source.mediaKind === 'video' &&
      (!Number.isFinite(source.offsetSeconds) || source.offsetSeconds < 0))
    throw new Error('This observation has no valid recorded moment.');
  if (source.mediaKind === 'photo' && source.offsetSeconds !== null)
    throw new Error('A photo observation cannot have a clip offset.');
  const capturedAt = timestamp(source.capturedAt ?? null);
  let observedAt = null;
  if (capturedAt) {
    const millis = Date.parse(capturedAt) + (source.offsetSeconds ?? 0) * 1000;
    if (!Number.isFinite(millis) || Math.abs(millis) > 8640000000000000)
      throw new Error('This observation has an invalid recorded moment.');
    observedAt = new Date(millis).toISOString();
  }
  const interpretation = review.interpretation ?? '';
  if (typeof interpretation !== 'string' || interpretation.length > 2000)
    throw new Error('This observation has an invalid interpretation.');
  return Object.freeze({
    id: text(review.id, 'identifier', 100),
    sourceId: source.sourceId, mediaKind: source.mediaKind,
    sourceLabel: text(source.label, 'source label', 120),
    offsetSeconds: source.offsetSeconds, observedAt,
    subject: text(review.observation?.subject, 'subject', 160),
    notes: text(review.observation?.notes, 'observation notes', 4000),
    interpretation: interpretation.trim(),
  });
}

/** Byte identity reconnects a source, but does not verify the observation's interpretation. */
export async function verifyEvidenceFile(evidence, file, cryptoApi = globalThis.crypto) {
  const identified = await identifyMedia(file, cryptoApi);
  if (identified.sourceId !== evidence.sourceId)
    throw new Error('This is a different file. Choose the original photo or clip; renaming it is fine, editing or converting it changes its fingerprint.');
  if (identified.kind !== evidence.mediaKind)
    throw new Error('This file’s media kind does not match the kept observation.');
  return identified;
}

export function verifyRecordedMoment(offsetSeconds, durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 ||
      !Number.isFinite(offsetSeconds) || offsetSeconds < 0 || offsetSeconds > durationSeconds)
    throw new Error('The kept moment is outside this clip’s available duration. The observation has not been changed.');
  return offsetSeconds;
}
