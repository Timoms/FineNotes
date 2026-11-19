import type { ImageElement, Stroke } from "./document";
import { rotationOf, toImageLocal } from "../canvas/image-geometry";

/** Canonical paper space. Placed notes scale this square as one paper-within-paper object. */
export const STICKY_NOTE_SIZE = 180;

/** Bundled sticky-note papers. Their handwriting is stored on the placed image. */
export const STICKY_NOTE_COLORS = ["#ffd95a", "#ff9fb4", "#8fe0bd", "#8fc8ff", "#c9a7ff"] as const;

export type StickyNoteType = "note" | "index-tab";

export function stickyNoteSvg(color: string, type: StickyNoteType = "note", opacity = 1): string {
  const paper = STICKY_NOTE_COLORS.includes(color as (typeof STICKY_NOTE_COLORS)[number])
    ? color
    : STICKY_NOTE_COLORS[0];
  const alpha = Math.max(0.1, Math.min(1, opacity));
  if (type === "index-tab")
    return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <defs>
    <filter id="s" x="-15%" y="-10%" width="135%" height="140%"><feDropShadow dx="2" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".18"/></filter>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".68"/><stop offset="1" stop-color="#fff" stop-opacity=".38"/></linearGradient>
  </defs>
  <g opacity="${alpha}" filter="url(#s)"><rect x="10" y="8" width="160" height="164" rx="5" fill="url(#g)" stroke="#fff" stroke-opacity=".72"/>
  <path d="M10 8H170V54H10Z" fill="${paper}"/><path d="M10 54H170" stroke="#fff" stroke-opacity=".65"/></g>
</svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <defs>
    <filter id="s" x="-20%" y="-15%" width="145%" height="150%"><feDropShadow dx="2" dy="7" stdDeviation="5" flood-color="#000" flood-opacity=".24"/></filter>
  </defs>
  <g opacity="${alpha}"><path d="M10 62H170V170H10Z" fill="${paper}" filter="url(#s)"/>
  <rect x="10" y="8" width="160" height="162" fill="${paper}"/></g>
</svg>`;
}

export function stickyNoteFileName(color: string, type: StickyNoteType = "note"): string {
  return `${type === "index-tab" ? "Index tab" : "Sticky note"} ${color.replace("#", "")}`;
}

/** The topmost writable sticky whose physical paper contains `point`. */
export function stickyAt(
  images: readonly ImageElement[],
  point: { x: number; y: number },
): ImageElement | null {
  for (const type of ["index-tab", "other"] as const) {
    for (let i = images.length - 1; i >= 0; i--) {
      const image = images[i];
      if ((image.sticky?.type === "index-tab") !== (type === "index-tab")) continue;
      if (!image.sticky || image.locked === true || !(image.w > 0) || !(image.h > 0)) continue;
      const local = toImageLocal(image, point);
      if (Math.abs(local.x) <= image.w / 2 && Math.abs(local.y) <= image.h / 2) return image;
    }
  }
  return null;
}

/** Page-space ink -> the note's fixed paper space, including recorded Pencil samples. */
export function strokeOnSticky(image: ImageElement, stroke: Stroke): Stroke {
  const map = (values: readonly number[], stride: number): number[] => {
    const out = [...values];
    for (let i = 0; i + 1 < out.length; i += stride) {
      const local = toImageLocal(image, { x: out[i], y: out[i + 1] });
      out[i] = (local.x / image.w + 0.5) * STICKY_NOTE_SIZE;
      out[i + 1] = (local.y / image.h + 0.5) * STICKY_NOTE_SIZE;
    }
    return out;
  };
  const localScale = STICKY_NOTE_SIZE / Math.sqrt(image.w * image.h);
  return {
    ...stroke,
    size: stroke.size * localScale,
    pts: map(stroke.pts, 3),
    ...(stroke.samples ? { samples: map(stroke.samples, 4) } : {}),
  };
}

/** Kept here to document that paper transforms use the same rotation contract as images. */
export function stickyRotation(image: ImageElement): number {
  return rotationOf(image);
}
