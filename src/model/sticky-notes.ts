import type { ImageElement, Stroke } from "./document";
import { rotationOf, toImageLocal } from "../canvas/image-geometry";

/** Canonical paper space. Placed notes scale this square as one paper-within-paper object. */
export const STICKY_NOTE_SIZE = 180;

/** Bundled sticky-note papers. Their handwriting is stored on the placed image. */
export const STICKY_NOTE_COLORS = ["#ffd95a", "#ff9fb4", "#8fe0bd", "#8fc8ff", "#c9a7ff"] as const;

export function stickyNoteSvg(color: string): string {
  const paper = STICKY_NOTE_COLORS.includes(color as (typeof STICKY_NOTE_COLORS)[number])
    ? color
    : STICKY_NOTE_COLORS[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <defs>
    <filter id="s" x="-20%" y="-10%" width="145%" height="155%">
      <feDropShadow dx="2" dy="8" stdDeviation="5" flood-color="#000" flood-opacity=".2"/>
    </filter>
    <linearGradient id="p" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity=".035"/>
      <stop offset=".18" stop-color="#fff" stop-opacity=".02"/>
      <stop offset=".68" stop-color="#fff" stop-opacity=".14"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".38"/>
    </linearGradient>
    <linearGradient id="lift" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity=".05"/>
      <stop offset=".5" stop-color="#fff" stop-opacity=".16"/>
      <stop offset="1" stop-color="#000" stop-opacity=".08"/>
    </linearGradient>
  </defs>
  <g filter="url(#s)">
    <path d="M9 8H171V160Q132 174 90 168Q48 174 9 160Z" fill="${paper}"/>
    <path d="M9 8H171V160Q132 174 90 168Q48 174 9 160Z" fill="url(#p)"/>
    <path d="M9 8H171V38H9Z" fill="#000" fill-opacity=".055"/>
    <path d="M9 38H171" stroke="#000" stroke-opacity=".06"/>
    <path d="M9 116H171V160Q132 174 90 168Q48 174 9 160Z" fill="url(#lift)"/>
    <path d="M18 9H162" stroke="#fff" stroke-opacity=".3" stroke-linecap="round"/>
  </g>
</svg>`;
}

export function stickyNoteFileName(color: string): string {
  return `Sticky note ${color.replace("#", "")}`;
}

/** The topmost writable sticky whose physical paper contains `point`. */
export function stickyAt(
  images: readonly ImageElement[],
  point: { x: number; y: number },
): ImageElement | null {
  for (let i = images.length - 1; i >= 0; i--) {
    const image = images[i];
    if (!image.sticky || image.locked === true || !(image.w > 0) || !(image.h > 0)) continue;
    const local = toImageLocal(image, point);
    if (Math.abs(local.x) <= image.w / 2 && Math.abs(local.y) <= image.h / 2) return image;
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
