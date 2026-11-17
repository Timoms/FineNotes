import { strokeBounds, type Stroke, type Bounds } from "../model/document";

/** Compact distinct lines of handwriting, retaining positions within each line. */
export function shrinkSelection(strokes: readonly Stroke[]): Stroke[] {
  const entries = strokes
    .map((stroke) => ({ stroke, bounds: strokeBounds(stroke) }))
    .filter((entry): entry is { stroke: Stroke; bounds: Bounds } => entry.bounds !== null);
  if (entries.length < 2) return [...strokes];
  entries.sort((a, b) => a.bounds.minY - b.bounds.minY);
  const lines: Array<{ top: number; bottom: number; items: typeof entries }> = [];
  for (const entry of entries) {
    const b = entry.bounds;
    const line = lines.find((candidate) => b.minY <= candidate.bottom && b.maxY >= candidate.top);
    if (line) {
      line.top = Math.min(line.top, b.minY);
      line.bottom = Math.max(line.bottom, b.maxY);
      line.items.push(entry);
    } else lines.push({ top: b.minY, bottom: b.maxY, items: [entry] });
  }
  if (lines.length < 2) return [...strokes];
  const heights = lines.map((line) => line.bottom - line.top).sort((a, b) => a - b);
  const gap = Math.max(1, heights[Math.floor(heights.length / 2)] * 0.35);
  const shifted = new Map<Stroke, Stroke>();
  let bottom = lines[0].bottom;
  for (const line of lines.slice(1)) {
    const dy = Math.min(0, bottom + gap - line.top);
    for (const { stroke } of line.items) {
      if (!dy) continue;
      const pts = stroke.pts.map((v, i) => (i % 3 === 1 ? v + dy : v));
      const copy = { ...stroke, pts };
      delete copy.samples;
      shifted.set(stroke, copy);
    }
    bottom = line.bottom + dy;
  }
  return strokes.map((stroke) => shifted.get(stroke) ?? stroke);
}
