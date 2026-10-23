import { describe, expect, it } from "vitest";
import { canInkMath, inkFromSample, inkMath } from "../../src/ink/math-glyphs";

describe("bundled math ink glyphs", () => {
  it("turns an answer into ordinary pen strokes", () => {
    const result = inkMath("= 42", { x: 100, y: 200 }, "#123456");
    expect(result.strokes.length).toBeGreaterThan(4);
    expect(result.strokes.every((stroke) => stroke.tool === "pen")).toBe(true);
    expect(result.strokes.every((stroke) => stroke.color === "#123456")).toBe(true);
    expect(result.strokes.flatMap((stroke) => stroke.pts)).not.toContain(undefined);
  });

  it("uses ink for supported calculator output and text for prose or steps", () => {
    expect(canInkMath("12 × 3 = 36")).toBe(true);
    expect(canInkMath("Answer: 36")).toBe(false);
    expect(canInkMath("1 + 2\n= 3")).toBe(false);
  });

  it("writes common unit suffixes as ink", () => {
    expect(canInkMath("= 2.5 cm")).toBe(true);
    expect(inkMath("= 2.5 cm", { x: 0, y: 0 }, "#000000").strokes.length).toBeGreaterThan(5);
  });

  it("draws the symbol table's advanced signs as ink", () => {
    expect(canInkMath("∫ ∑ √ π ≤ ≠ ∞")).toBe(true);
    expect(inkMath("∫∑√π≤≠∞", { x: 0, y: 0 }, "#000").strokes.length).toBeGreaterThan(10);
  });

  it("normalizes a captured personal glyph without changing its shape", () => {
    const ink = inkFromSample(
      [{ pts: [100, 200, 0.4, 110, 220, 0.7] }],
      { x: 5, y: 7 },
      "#abc",
      3,
      40,
    );
    expect(ink).toMatchObject({ width: 20, height: 40 });
    expect(ink?.strokes[0]).toMatchObject({ color: "#abc", size: 3, tool: "pen" });
    expect(ink?.strokes[0].pts).toEqual([5, 7, 0.4, 25, 47, 0.7]);
  });
});
