import { describe, expect, it } from "vitest";
import {
  STICKY_NOTE_COLORS,
  stickyAt,
  stickyNoteFileName,
  stickyNoteSvg,
  strokeOnSticky,
} from "../../src/model/sticky-notes";
import type { ImageElement, Stroke } from "../../src/model/document";

describe("bundled sticky notes", () => {
  it("renders every paper colour as a self-contained shaded SVG", () => {
    for (const color of STICKY_NOTE_COLORS) {
      const svg = stickyNoteSvg(color);
      expect(svg).toContain(`<svg xmlns="http://www.w3.org/2000/svg"`);
      expect(svg).toContain(`fill="${color}"`);
      expect(svg).toContain("feDropShadow");
      expect(stickyNoteFileName(color)).toContain(color.slice(1));
    }
  });

  it("falls back to yellow for an unknown colour", () => {
    expect(stickyNoteSvg("nope")).toContain(`fill="${STICKY_NOTE_COLORS[0]}"`);
  });

  it("finds the top paper and converts page ink into its local coordinates", () => {
    const image: ImageElement = {
      id: "i1",
      path: "sticky.svg",
      x: 20,
      y: 40,
      w: 90,
      h: 90,
      sticky: { color: "#ffd95a", strokes: [] },
    };
    const stroke: Stroke = {
      id: "s1",
      color: "#111111",
      size: 2,
      tool: "pen",
      pts: [20, 40, 0.5, 110, 130, 0.5],
    };
    expect(stickyAt([image], { x: 65, y: 85 })).toBe(image);
    expect(stickyAt([image], { x: 5, y: 5 })).toBeNull();
    expect(strokeOnSticky(image, stroke)).toMatchObject({
      size: 4,
      pts: [0, 0, 0.5, 180, 180, 0.5],
    });
  });
});
