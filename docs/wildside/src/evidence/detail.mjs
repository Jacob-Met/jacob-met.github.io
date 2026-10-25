/** Source-pixel geometry. The focal point is normalized to the whole image. */
export function detailRegion(width, height, {zoom = 2, x = .5, y = .5} = {}) {
  if (![width, height].every(v => Number.isInteger(v) && v > 0 && v <= 16384) || width * height > 32_000_000)
    throw new Error('This source is too large for a closer look here. You can still view the original.');
  if (![1, 2, 4].includes(zoom) || ![x, y].every(v => Number.isFinite(v) && v >= 0 && v <= 1))
    throw new Error('Choose a point inside the original frame and a supported magnification.');
  const w = width / zoom, h = height / zoom;
  const left = Math.max(0, Math.min(width - w, x * width - w / 2));
  const top = Math.max(0, Math.min(height - h, y * height - h / 2));
  return Object.freeze({x: left, y: top, width: w, height: h, zoom});
}
