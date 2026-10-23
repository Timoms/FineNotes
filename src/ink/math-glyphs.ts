import type { Stroke } from "../model/document";

export type InkStrokeDraft = Omit<Stroke, "id">;
type Line = readonly number[];

const SEGMENTS: Record<string, Line> = {
  a: [2, 1, 10, 1],
  b: [10, 1, 10, 10],
  c: [10, 10, 10, 19],
  d: [2, 19, 10, 19],
  e: [2, 10, 2, 19],
  f: [2, 1, 2, 10],
  g: [2, 10, 10, 10],
};

const DIGITS: Record<string, string> = {
  "0": "ab cdef".replace(/ /g, ""),
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};

const GLYPHS: Record<string, readonly Line[]> = {
  "=": [
    [1, 7, 11, 7],
    [1, 13, 11, 13],
  ],
  "+": [
    [6, 4, 6, 16],
    [1, 10, 11, 10],
  ],
  "-": [[1, 10, 11, 10]],
  "/": [[2, 19, 10, 1]],
  "<": [[10, 3, 2, 10, 10, 17]],
  ">": [[2, 3, 10, 10, 2, 17]],
  "%": [
    [2, 19, 10, 1],
    [3, 4, 2, 5, 3, 6, 4, 5, 3, 4],
    [9, 14, 8, 15, 9, 16, 10, 15, 9, 14],
  ],
  ".": [[6, 18, 6.2, 18.2]],
  ",": [[6, 17, 5, 21]],
  "(": [[8, 1, 5, 5, 4, 10, 5, 15, 8, 19]],
  ")": [[4, 1, 7, 5, 8, 10, 7, 15, 4, 19]],
  E: [
    [10, 1, 2, 1, 2, 19, 10, 19],
    [2, 10, 8, 10],
  ],
  b: [[3, 1, 3, 19, 8, 19, 11, 16, 11, 11, 8, 8, 3, 8]],
  c: [[11, 9, 8, 7, 4, 8, 2, 13, 4, 18, 8, 19, 11, 17]],
  d: [[10, 1, 10, 19, 5, 19, 2, 16, 2, 11, 5, 8, 10, 8]],
  e: [[2, 13, 11, 13, 10, 9, 7, 7, 3, 9, 2, 14, 5, 19, 10, 18]],
  f: [
    [9, 2, 6, 1, 4, 4, 4, 19],
    [1, 8, 9, 8],
  ],
  g: [[11, 8, 6, 8, 3, 11, 3, 16, 6, 19, 11, 17, 11, 8, 11, 21, 8, 24, 3, 22]],
  h: [
    [3, 1, 3, 19],
    [3, 10, 6, 7, 10, 9, 10, 19],
  ],
  i: [
    [6, 8, 6, 19],
    [6, 3, 6.2, 3.2],
  ],
  k: [
    [3, 1, 3, 19],
    [10, 7, 3, 14, 11, 19],
  ],
  l: [[6, 1, 6, 17, 8, 19]],
  m: [
    [2, 19, 2, 8, 6, 8, 6, 19],
    [6, 9, 9, 7, 11, 10, 11, 19],
  ],
  n: [[3, 19, 3, 8, 7, 7, 10, 10, 10, 19]],
  o: [[6, 7, 3, 9, 2, 14, 4, 18, 8, 19, 11, 16, 11, 11, 9, 8, 6, 7]],
  s: [[11, 9, 8, 7, 4, 8, 3, 11, 10, 14, 11, 17, 8, 19, 3, 18]],
  t: [
    [6, 3, 6, 16, 8, 19, 11, 18],
    [2, 8, 10, 8],
  ],
  y: [
    [2, 8, 6, 19],
    [11, 8, 6, 19, 4, 23, 2, 22],
  ],
  z: [[2, 8, 11, 8, 2, 19, 11, 19]],
  "±": [
    [6, 2, 6, 13],
    [1, 7.5, 11, 7.5],
    [1, 18, 11, 18],
  ],
  "≠": [
    [1, 7, 11, 7],
    [1, 14, 11, 14],
    [9, 2, 3, 19],
  ],
  "≤": [
    [10, 3, 2, 10, 10, 16],
    [2, 20, 10, 20],
  ],
  "≥": [
    [2, 3, 10, 10, 2, 16],
    [2, 20, 10, 20],
  ],
  "≈": [
    [1, 7, 4, 5, 8, 8, 11, 6],
    [1, 15, 4, 13, 8, 16, 11, 14],
  ],
  "∞": [[1, 11, 3, 6, 6, 11, 9, 16, 11, 11, 9, 6, 6, 11, 3, 16, 1, 11]],
  "√": [[1, 12, 4, 18, 7, 3, 12, 3]],
  "∫": [[9, 1, 6, 1, 5, 5, 5, 17, 3, 21, 1, 21]],
  "∑": [[11, 2, 2, 2, 7, 10, 2, 19, 11, 19]],
  "∏": [
    [2, 19, 2, 3, 10, 3, 10, 19],
    [1, 3, 11, 3],
  ],
  π: [
    [1, 7, 11, 7],
    [4, 7, 4, 19],
    [9, 7, 9, 19],
  ],
  θ: [
    [6, 2, 3, 4, 2, 10, 3, 17, 6, 20, 9, 17, 10, 10, 9, 4, 6, 2],
    [2, 10, 10, 10],
  ],
  Δ: [[6, 2, 1, 19, 11, 19, 6, 2]],
  "∂": [[4, 4, 8, 2, 10, 7, 9, 15, 6, 19, 2, 17, 2, 12, 5, 9, 9, 10]],
  "∈": [
    [11, 3, 6, 2, 2, 6, 2, 15, 6, 19, 11, 18],
    [2, 10, 9, 10],
  ],
  "∉": [
    [11, 3, 6, 2, 2, 6, 2, 15, 6, 19, 11, 18],
    [2, 10, 9, 10],
    [9, 2, 3, 20],
  ],
  "⊂": [[11, 4, 7, 2, 3, 4, 2, 10, 3, 17, 7, 19, 11, 17]],
  "∪": [[2, 4, 2, 14, 4, 18, 8, 18, 10, 14, 10, 4]],
  "∩": [[2, 18, 2, 8, 4, 4, 8, 4, 10, 8, 10, 18]],
  "→": [
    [1, 10, 11, 10],
    [7, 6, 11, 10, 7, 14],
  ],
  "↔": [
    [1, 10, 11, 10],
    [5, 6, 1, 10, 5, 14],
    [7, 6, 11, 10, 7, 14],
  ],
  "∝": [[1, 11, 3, 6, 6, 11, 9, 16, 11, 11, 9, 6, 6, 11]],
  "°": [[6, 3, 4, 4, 4, 7, 6, 8, 8, 7, 8, 4, 6, 3]],
};

export interface InkMathResult {
  strokes: InkStrokeDraft[];
  width: number;
  height: number;
}

export interface SampleInkStroke {
  pts: ArrayLike<number>;
}

export function canInkMath(text: string): boolean {
  if (text.length === 0 || text.includes("\n")) return false;
  return [...text].every((raw) => {
    const char = raw === "−" ? "-" : raw === "×" ? "x" : raw;
    return char === " " || char in DIGITS || char in GLYPHS || "xX*".includes(char);
  });
}

/** Render calculator text as bundled monoline ink glyphs, ready for real stroke ids. */
export function inkMath(
  text: string,
  origin: { x: number; y: number },
  color: string,
  size = 2.2,
  scale = 1.25,
): InkMathResult {
  const strokes: InkStrokeDraft[] = [];
  let x = origin.x;
  const add = (line: Line): void => {
    const pts: number[] = [];
    for (let i = 0; i < line.length; i += 2) {
      pts.push(x + line[i] * scale, origin.y + line[i + 1] * scale, 0.5);
    }
    strokes.push({ color, size, tool: "pen", pts });
  };
  for (const raw of text) {
    const char = raw === "−" ? "-" : raw === "×" ? "x" : raw;
    if (char === " ") {
      x += 7 * scale;
      continue;
    }
    const segments = DIGITS[char];
    if (segments) for (const segment of segments) add(SEGMENTS[segment]);
    else if (char === "x" || char === "X" || char === "*") {
      add([2, 3, 10, 17]);
      add([10, 3, 2, 17]);
    } else {
      for (const line of GLYPHS[char] ?? GLYPHS["-"]) add(line);
    }
    x += 14 * scale;
  }
  return { strokes, width: Math.max(0, x - origin.x), height: 21 * scale };
}

/** Place a captured one-character sample at a new origin, preserving its proportions. */
export function inkFromSample(
  sample: readonly SampleInkStroke[],
  origin: { x: number; y: number },
  color: string,
  size = 2.2,
  targetHeight = 30,
): InkMathResult | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of sample) {
    for (let i = 0; i + 1 < stroke.pts.length; i += 3) {
      minX = Math.min(minX, stroke.pts[i]);
      minY = Math.min(minY, stroke.pts[i + 1]);
      maxX = Math.max(maxX, stroke.pts[i]);
      maxY = Math.max(maxY, stroke.pts[i + 1]);
    }
  }
  if (!Number.isFinite(minX) || !(maxY > minY)) return null;
  const scale = targetHeight / (maxY - minY);
  const strokes = sample.map((stroke) => {
    const pts = Array.from(stroke.pts);
    for (let i = 0; i + 1 < pts.length; i += 3) {
      pts[i] = origin.x + (pts[i] - minX) * scale;
      pts[i + 1] = origin.y + (pts[i + 1] - minY) * scale;
    }
    return { color, size, tool: "pen" as const, pts };
  });
  return { strokes, width: (maxX - minX) * scale, height: targetHeight };
}
