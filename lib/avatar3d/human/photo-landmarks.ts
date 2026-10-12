export interface LandmarkPoint { x: number; y: number }
export interface GarmentLandmarks { leftShoulder: LandmarkPoint; rightShoulder: LandmarkPoint; neckline: LandmarkPoint; hem: LandmarkPoint }

/** Silhouette landmarks, only on an isolated garment. This is not semantic detection of a garment hidden by a person. */
export function silhouetteLandmarks(mask: Uint8Array, width: number, height: number,
  box: { x0: number; x1: number; y0: number; y1: number }): GarmentLandmarks | null {
  const { x0, x1, y0, y1 } = box;
  if (x1 - x0 < 24 || y1 - y0 < 24) return null;
  const waistY = Math.round(y0 + (y1 - y0) * .7);
  let left = -1, right = -1;
  for (let x = x0; x <= x1; x++) if (mask[waistY * width + x]) { if (left < 0) left = x; right = x; }
  if (right - left < 12) return null;
  const top = (cx: number) => {
    const ys: number[] = [], radius = Math.max(1, Math.round((right - left) * .025));
    for (let x = Math.max(0, cx - radius); x <= Math.min(width - 1, cx + radius); x++)
      for (let y = y0; y <= Math.min(height - 1, y1); y++) if (mask[y * width + x]) { ys.push(y); break; }
    ys.sort((a, b) => a - b); return ys.length ? ys[ys.length >> 1] : null;
  };
  const lx = Math.round(left + (right - left) * .08), rx = Math.round(right - (right - left) * .08), cx = Math.round((left + right) / 2);
  const ly = top(lx), ry = top(rx), cy = top(cx);
  if (ly === null || ry === null || cy === null || Math.max(ly, ry) > y0 + (y1 - y0) * .3) return null;
  return { leftShoulder: { x: lx, y: ly }, rightShoulder: { x: rx, y: ry }, neckline: { x: cx, y: cy }, hem: { x: cx, y: y1 + 1 } };
}

/** Piecewise correspondence through shoulder, torso and hem, rather than stretching the entire photo bounding box. */
export function landmarkProjection(rows: { modelY: number; modelLeft: number; modelRight: number; photoY: number; photoLeft: number; photoRight: number }[], width: number, height: number) {
  const ordered = [...rows].sort((a, b) => a.modelY - b.modelY);
  return (x: number, y: number): [number, number] => {
    let a = ordered[0], b = ordered[ordered.length - 1];
    for (let i = 1; i < ordered.length; i++) if (y <= ordered[i].modelY) { a = ordered[i - 1]; b = ordered[i]; break; }
    const f = Math.max(0, Math.min(1, (y - a.modelY) / Math.max(.001, b.modelY - a.modelY)));
    const lerp = (p: number, q: number) => p + (q - p) * f;
    const ml = lerp(a.modelLeft, b.modelLeft), mr = lerp(a.modelRight, b.modelRight);
    const fraction = (x - ml) / Math.max(.001, mr - ml);
    return [(lerp(a.photoLeft, b.photoLeft) + fraction * (lerp(a.photoRight, b.photoRight) - lerp(a.photoLeft, b.photoLeft))) / width,
      1 - lerp(a.photoY, b.photoY) / height];
  };
}
