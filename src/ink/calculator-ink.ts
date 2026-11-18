/** Rebuild the calculator's natural math display as editable pen strokes. */
import { layoutWithEnding, type MathBox } from "../model/calc-display";
import type { NumberBase } from "../model/calculator";
import { mmToPage } from "../model/units";
import { canInkMath, inkMath, type InkMathResult, type InkStrokeDraft } from "./math-glyphs";

function move(ink: InkMathResult, x: number, y: number): InkStrokeDraft[] {
  return ink.strokes.map((stroke) => ({
    ...stroke,
    pts: stroke.pts.map((value, index) => value + (index % 3 === 0 ? x : index % 3 === 1 ? y : 0)),
  }));
}

function render(box: MathBox, color: string, height: number): InkMathResult | null {
  const scale = height / 21;
  const text = (s: string): InkMathResult | null =>
    canInkMath(s) ? inkMath(s, { x: 0, y: 0 }, color, Math.max(0.8, height / 15), scale) : null;
  const combine = (
    parts: Array<{ ink: InkMathResult; x: number; y: number }>,
    width: number,
    h: number,
  ): InkMathResult => ({
    strokes: parts.flatMap(({ ink, x, y }) => move(ink, x, y)),
    width,
    height: h,
  });
  const line = (x1: number, y1: number, x2: number, y2: number): InkStrokeDraft => ({
    color,
    size: Math.max(0.8, height / 15),
    tool: "pen",
    pts: [x1, y1, 0.5, x2, y2, 0.5],
  });
  if (box.t === "text") return text(box.s);
  if (box.t === "caret" || box.t === "slot") return null;
  if (box.t === "row") {
    const items = box.items.map((item) => render(item, color, height));
    if (items.some((item) => !item)) return null;
    const h = Math.max(height, ...items.map((item) => item!.height));
    let x = 0;
    const parts = items.map((item) => {
      const ink = item!;
      const part = { ink, x, y: (h - ink.height) / 2 };
      x += ink.width;
      return part;
    });
    return combine(parts, x, h);
  }
  if (box.t === "frac") {
    const num = render(box.num, color, height * 0.8);
    const den = render(box.den, color, height * 0.8);
    if (!num || !den) return null;
    const width = Math.max(num.width, den.width) + height * 0.3;
    const y = num.height + height * 0.15;
    const out = combine(
      [
        { ink: num, x: (width - num.width) / 2, y: 0 },
        { ink: den, x: (width - den.width) / 2, y: y + height * 0.15 },
      ],
      width,
      y + height * 0.15 + den.height,
    );
    out.strokes.push(line(0, y, width, y));
    return out;
  }
  if (box.t === "sup") {
    const base = render(box.base, color, height);
    const exp = render(box.exp, color, height * 0.65);
    if (!base || !exp) return null;
    const offset = exp.height * 0.55;
    return combine(
      [
        { ink: base, x: 0, y: offset },
        { ink: exp, x: base.width, y: 0 },
      ],
      base.width + exp.width,
      offset + base.height,
    );
  }
  if (box.t === "paren" || box.t === "abs") {
    const body = render(box.body, color, height);
    const left = text(box.t === "paren" ? "(" : "|");
    const right = text(box.t === "paren" ? ")" : "|");
    if (!body || !left || !right) return null;
    const h = Math.max(height, body.height);
    return combine(
      [
        { ink: left, x: 0, y: (h - left.height) / 2 },
        { ink: body, x: left.width, y: (h - body.height) / 2 },
        { ink: right, x: left.width + body.width, y: (h - right.height) / 2 },
      ],
      left.width + body.width + right.width,
      h,
    );
  }
  if (box.t === "root") {
    const body = render(box.body, color, height);
    const root = text("√");
    const index = box.index ? render(box.index, color, height * 0.5) : null;
    if (!body || !root || (box.index && !index)) return null;
    const prefix = Math.max(root.width, index?.width ?? 0);
    const top = height * 0.18 + (index ? index.height * 0.5 : 0);
    const out = combine(
      [
        { ink: root, x: prefix - root.width, y: top + (body.height - root.height) / 2 },
        { ink: body, x: prefix, y: top },
        ...(index ? [{ ink: index, x: 0, y: 0 }] : []),
      ],
      prefix + body.width,
      top + body.height,
    );
    out.strokes.push(line(prefix - height * 0.1, top, out.width, top));
    return out;
  }
  // Render operators with their upper and lower limits, followed by their body.
  const symbol = text(box.sym);
  const lo = box.lo ? render(box.lo, color, height * 0.55) : null;
  const hi = box.hi ? render(box.hi, color, height * 0.55) : null;
  const body = render(box.body, color, height);
  const tail = box.tail ? text(box.tail) : null;
  if (!symbol || !body || (box.lo && !lo) || (box.hi && !hi) || (box.tail && !tail)) return null;
  const w = Math.max(symbol.width, lo?.width ?? 0, hi?.width ?? 0);
  const top = hi?.height ?? 0;
  const h = top + Math.max(symbol.height, body.height) + (lo?.height ?? 0);
  return combine(
    [
      { ink: symbol, x: (w - symbol.width) / 2, y: top },
      { ink: body, x: w, y: top },
      ...(hi ? [{ ink: hi, x: (w - hi.width) / 2, y: 0 }] : []),
      ...(lo ? [{ ink: lo, x: (w - lo.width) / 2, y: h - lo.height }] : []),
      ...(tail ? [{ ink: tail, x: w + body.width, y: top }] : []),
    ],
    w + body.width + (tail?.width ?? 0),
    h,
  );
}

/** Returns null for unsupported notation rather than silently changing it. */
export function calculatorInk(
  expression: string | null,
  answer: string,
  base: NumberBase,
  color: string,
  heightMm = 8,
): InkMathResult | null {
  const height = mmToPage(heightMm);
  const build = (value: string): InkMathResult | null => {
    const parsed = layoutWithEnding(value, base, { relations: true });
    if (parsed && !parsed.ending) return render(parsed.box, color, height);
    return canInkMath(value)
      ? inkMath(value, { x: 0, y: 0 }, color, height / 15, height / 21)
      : null;
  };
  const result = build(answer);
  if (!result) return null;
  if (!expression) return result;
  const sum = build(expression);
  if (!sum) return null;
  const gap = height * 0.4;
  const equals = build("=");
  if (!equals) return null;
  const totalHeight = Math.max(sum.height, equals.height, result.height);
  const equalsX = sum.width + gap;
  const resultX = equalsX + equals.width + gap;
  return {
    strokes: [
      ...move(sum, 0, (totalHeight - sum.height) / 2),
      ...move(equals, equalsX, (totalHeight - equals.height) / 2),
      ...move(result, resultX, (totalHeight - result.height) / 2),
    ],
    width: resultX + result.width,
    height: totalHeight,
  };
}
