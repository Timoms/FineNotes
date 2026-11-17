import { describe, it, expect } from "vitest";
import { shrinkSelection } from "../../src/ink/shrink-selection";
import type { Stroke } from "../../src/model/document";
const stroke = (id: string, y: number): Stroke => ({
  id,
  tool: "pen",
  color: "#000",
  size: 1,
  pts: [0, y, 0.5, 10, y + 10, 0.5],
});
describe("shrink selection", () => {
  it("compacts gaps while preserving the shape of each line", () => {
    const original = [stroke("a", 0), stroke("b", 80), stroke("c", 160)];
    const result = shrinkSelection(original);
    expect(result[0]).toBe(original[0]);
    expect(result[1].pts[1]).toBeLessThan(80);
    expect(result[2].pts[1] - result[1].pts[1]).toBeCloseTo(result[1].pts[1] - result[0].pts[1]);
    expect(result[1].pts[4] - result[1].pts[1]).toBe(10);
    expect(original[1].pts[1]).toBe(80);
  });
  it("leaves a single line untouched", () => {
    const first = stroke("a", 0),
      second = stroke("b", 3);
    expect(shrinkSelection([first, second])).toEqual([first, second]);
  });
});
