import { describe, expect, it } from "vitest";
import { calculatorInk } from "../../src/ink/calculator-ink";
import { mmToPage } from "../../src/model/units";

describe("calculator ink", () => {
  it("inserts only the result when the expression is omitted", () => {
    const ink = calculatorInk(null, "42", 10, "#123456");
    expect(ink).not.toBeNull();
    expect(ink?.height).toBeCloseTo(mmToPage(8));
    expect(ink?.strokes.every((stroke) => stroke.color === "#123456")).toBe(true);
  });

  it("rebuilds the full screen as expression, equals sign and answer on one line", () => {
    const answer = calculatorInk(null, "4", 10, "#000000");
    const expression = calculatorInk(null, "2 + 2", 10, "#000000");
    const screen = calculatorInk("2 + 2", "4", 10, "#000000");
    expect(screen).not.toBeNull();
    expect(screen!.height).toBeCloseTo(Math.max(answer!.height, expression!.height));
    expect(screen!.width).toBeGreaterThan(expression!.width + answer!.width);
    // The equals sign contributes two strokes between the expression and result.
    expect(screen!.strokes.length).toBe(expression!.strokes.length + 2 + answer!.strokes.length);
  });

  it("preserves fractions and powers as two-dimensional ink", () => {
    const fraction = calculatorInk("1 / 2", "0.5", 10, "#000000");
    const power = calculatorInk("2 ^ 3", "8", 10, "#000000");
    expect(fraction?.height).toBeGreaterThan(mmToPage(8));
    expect(power?.height).toBeGreaterThan(mmToPage(8));
  });
});
