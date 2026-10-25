/** Local media review records. This is a review boundary, not a second world model. */
export const REVIEW_VERSION = 1;
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
const TYPES = new Map([
  ['image/jpeg', 'photo'], ['image/png', 'photo'], ['image/webp', 'photo'],
  ['image/gif', 'photo'], ['video/mp4', 'video'], ['video/webm', 'video'],
  ['video/ogg', 'video'], ['video/quicktime', 'video'],
]);

export function mediaKind(file) {
  const kind = TYPES.get(file?.type);
  if (!kind) throw new Error('Choose a JPEG, PNG, WebP, GIF, MP4, WebM, Ogg, or QuickTime file.');
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_MEDIA_BYTES)
    throw new Error('Choose a nonempty file of 100 MB or less.');
  return kind;
}

function text(value, name, max, required = false) {
  if (typeof value !== 'string') throw new Error(`${name} must be text.`);
  const result = value.trim();
  if ((required && !result) || result.length > max)
    throw new Error(`${name} ${required ? 'is required and ' : ''}must be at most ${max} characters.`);
  return result;
}

export function timestamp(value, name = 'Capture time') {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${name} must include a date and time zone.`);
  const m = value.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,3}))?(Z|[+-]\d\d:\d\d)$/);
  if (!m) throw new Error(`${name} must include a date and time zone.`);
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(hour, minute, second, 0);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 ||
      calendar.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59)
    throw new Error(`${name} is not a valid calendar time.`);
  if (m[8] !== 'Z') {
    const [hours, minutes] = m[8].slice(1).split(':').map(Number);
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0))
      throw new Error(`${name} has an invalid time zone.`);
  }
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) throw new Error(`${name} is not valid.`);
  return new Date(millis).toISOString();
}

/** Convert an explicitly supplied recording clock time and UTC offset, never the device zone. */
export function captureTimestamp(localTime, utcOffset) {
  if (localTime === '') return null;
  if (typeof localTime !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?$/.test(localTime))
    throw new Error('Choose a valid recording date and time, or leave it blank.');
  if (typeof utcOffset !== 'string' || !/^(?:Z|[+-]\d\d:\d\d)$/.test(utcOffset.trim()))
    throw new Error('Enter the recording’s UTC offset, such as -04:00 or +01:00 (Z for UTC), or leave the date and time blank.');
  const clock = localTime.length === 16 ? localTime + ':00' : localTime;
  return timestamp(clock + utcOffset.trim());
}

export async function identifyMedia(file, cryptoApi = globalThis.crypto) {
  const kind = mediaKind(file);
  const digest = await cryptoApi.subtle.digest('SHA-256', await file.arrayBuffer());
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  // No filename, file modification time, EXIF, coordinates, URL, or bytes cross this boundary.
  return Object.freeze({ sourceId: `local:sha256:${hash}`, kind });
}

export function makeReviewDraft(input) {
  if (!input || typeof input !== 'object') throw new Error('An observation is required.');
  const { source, identity } = input;
  if (!source || !/^local:sha256:[a-f0-9]{64}$/.test(source.sourceId))
    throw new Error('Select a local photo or clip first.');
  if (!['photo', 'video'].includes(source.kind)) throw new Error('Media kind is not supported.');
  if (!['unknown', 'possible', 'confirmed'].includes(identity?.certainty))
    throw new Error('Choose how certain you are about this individual.');
  const neighborId = identity.certainty === 'unknown' ? null : text(identity.neighborId, 'Neighbor', 160, true);
  const basis = identity.certainty === 'unknown' ? '' : text(identity.basis ?? '', 'Recognition evidence', 1000, true);
  if (typeof input.id !== 'string' || !/^[\w-]{1,100}$/.test(input.id)) throw new Error('An observation ID is required.');
  if (typeof input.authorized !== 'boolean' || !input.authorized)
    throw new Error('Confirm that you may use this photo or clip.');
  let offsetSeconds = null;
  if (source.kind === 'video') {
    if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0 ||
        !Number.isFinite(input.offsetSeconds) || input.offsetSeconds < 0 || input.offsetSeconds > input.durationSeconds)
      throw new Error('Wait for the clip to load, then choose a moment within it.');
    offsetSeconds = Math.round(input.offsetSeconds * 1000) / 1000;
  }
  const reviewedAt = timestamp(input.reviewedAt, 'Review time');
  if (!reviewedAt) throw new Error('Review time is required.');
  const draft = {
    version: REVIEW_VERSION,
    id: input.id,
    source: Object.freeze({
      kind: 'local-media', sourceId: source.sourceId, mediaKind: source.kind,
      label: text(input.label, 'Source label', 120, true),
      capturedAt: timestamp(input.capturedAt ?? null), offsetSeconds,
      availability: 'local-session',
    }),
    observation: Object.freeze({
      subject: text(input.subject, 'What you saw', 160, true),
      category: ['bird', 'mammal', 'insect', 'plant', 'other'].includes(input.category) ? input.category : 'other',
      notes: text(input.notes ?? '', 'Observation notes', 4000, true),
      placeId: input.placeId ? text(input.placeId, 'Place', 160, true) : null,
    }),
    identity: Object.freeze({ certainty: identity.certainty, neighborId, basis }),
    interpretation: text(input.interpretation ?? '', 'Interpretation', 2000),
    reviewedAt,
    method: 'human-review',
  };
  return Object.freeze(draft);
}
