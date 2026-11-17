import { describe, expect, it } from "vitest";
import {
  parseRulerSettings,
  physicalDimensions,
  projectToGuide,
  projectToLine,
  rulerStepMm,
  RulerOverlay,
  snapRotation,
} from "../../src/view/ruler";
import { PAGE_PX_PER_MM } from "../../src/model/units";
import { triangleMarkings } from "../../src/view/triangle-markings";
import { protractorGeometry, protractorMarkings } from "../../src/view/protractor-markings";

describe("ruler geometry", () => {
  it("projects ink onto a horizontal edge", () => {
    expect(
      projectToLine({ x: 18, y: 9 }, { origin: { x: 2, y: 4 }, direction: { x: 1, y: 0 } }),
    ).toEqual({ x: 18, y: 4 });
  });

  it("checks stored settings and clamps their scale", () => {
    expect(parseRulerSettings({ theme: "dark", unit: "inch", scale: 4 })).toEqual({
      theme: "dark",
      unit: "inch",
      kind: "ruler",
      degreeSnap: 15,
      scale: 4,
    });
    expect(parseRulerSettings({ theme: "pink", unit: "yards", scale: "large" })).toEqual({
      theme: "clear",
      unit: "cm",
      kind: "ruler",
      degreeSnap: 15,
      scale: 1,
    });
    expect(parseRulerSettings({ kind: "triangle" }).kind).toBe("triangle");
    expect(parseRulerSettings({ kind: "protractor" }).kind).toBe("protractor");
    expect(parseRulerSettings({ theme: "school" }).theme).toBe("school");
  });

  it("magnetises cardinal angles more strongly than minor snap steps", () => {
    expect(snapRotation(4.5, 15)).toBe(0);
    expect(snapRotation(16, 15)).toBe(15);
    expect(snapRotation(20, 15)).toBe(20);
    expect(snapRotation(88, 45)).toBe(90);
    expect(snapRotation(88, "off")).toBe(88);
  });

  it("resizes every instrument proportionally, retaining a right-angle triangle", () => {
    expect(physicalDimensions("ruler")).toEqual({
      width: 120,
      height: 18,
    });
    expect(physicalDimensions("ruler", 2.5)).toEqual({
      width: 300,
      height: 45,
    });
    for (const kind of ["ruler", "triangle", "protractor"] as const) {
      const original = physicalDimensions(kind);
      const enlarged = physicalDimensions(kind, 2);
      expect(enlarged.width / enlarged.height).toBe(original.width / original.height);
      expect(enlarged.width).toBe(original.width * 2);
    }
    expect(physicalDimensions("triangle")).toEqual({ width: 160, height: 80 });
    expect(physicalDimensions("protractor", 2)).toEqual({ width: 220, height: 136 });
  });

  it("ignores the retired base length, including old values that distorted the triangle", () => {
    expect(parseRulerSettings({ kind: "triangle", baseLength: 50 })).not.toHaveProperty(
      "baseLength",
    );
    expect(parseRulerSettings({ scale: Infinity }).scale).toBe(1);
    expect(parseRulerSettings({ scale: -4 }).scale).toBe(0.5);
  });

  it("never adds finer divisions when the page is zoomed in", () => {
    for (const pxPerMm of [0.5, 1, 4, 8, 14, 140, 900, 9000]) {
      expect(rulerStepMm(pxPerMm, "cm")).toBe(1);
      expect(rulerStepMm(pxPerMm, "inch")).toBeCloseTo(25.4 / 16);
    }
  });

  it("projects ink onto a protractor arc", () => {
    expect(
      projectToGuide({ x: 6, y: 8 }, { kind: "arc", center: { x: 0, y: 0 }, radius: 5 }),
    ).toEqual({ x: 3, y: 4 });
  });

  it("projects ink onto a rotated edge", () => {
    const root = Math.SQRT1_2;
    const point = projectToLine(
      { x: 10, y: 0 },
      { origin: { x: 0, y: 0 }, direction: { x: root, y: root } },
    );
    expect(point.x).toBeCloseTo(5);
    expect(point.y).toBeCloseTo(5);
  });
});

describe("geometry triangle markings", () => {
  it("centres zero on the hypotenuse with 7 cm and 1 mm divisions in either direction", () => {
    const markings = triangleMarkings();
    const top = markings.labels.filter((label) => label.kind === "cm" && label.y === 6.6);
    expect(top.map((label) => label.text)).toEqual([
      "7",
      "6",
      "5",
      "4",
      "3",
      "2",
      "1",
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
    ]);
    expect(top[7].x).toBe(80);
    expect(top[8].x - top[7].x).toBe(10);
    expect(markings.edgeTicks).toContain("M80,0l0,4.5M81,0l0,1.8");
    expect(
      markings.labels.filter((label) => label.rotation === 45 && label.kind === "cm").length,
    ).toBeGreaterThan(0);
    expect(
      markings.labels.filter((label) => label.rotation === -45 && label.kind === "cm").length,
    ).toBeGreaterThan(0);
  });

  it("measures degrees from the hypotenuse midpoint, in both directions", () => {
    const degrees = triangleMarkings().labels.filter((label) => label.kind === "degree");
    expect(degrees).toHaveLength(34);
    expect(degrees.filter((label) => label.text === "90").every((label) => label.x === 80)).toBe(
      true,
    );
    expect(degrees.slice(0, 2).map((label) => label.text)).toEqual(["0", "180"]);
    expect(degrees.slice(-2).map((label) => label.text)).toEqual(["180", "0"]);
  });

  it("adds centimetres when resized while retaining the page's millimetre spacing", () => {
    const top = triangleMarkings(320).labels.filter(
      (label) => label.kind === "cm" && label.y === 6.6,
    );
    expect(top[0].text).toBe("15");
    expect(top[top.length - 1].text).toBe("15");
    expect(top[1].x - top[0].x).toBe(10);
  });

  it("keeps degree labels clear of adjacent degrees and the centimetre scales", () => {
    for (const width of [80, 119, 120, 159, 160, 240, 320, 640]) {
      const labels = triangleMarkings(width).labels;
      const boxes = labels.map((label) => {
        const radians = ((label.rotation ?? 0) * Math.PI) / 180;
        const fontSize = label.fontSize ?? 2.5;
        return {
          center: { x: label.x, y: label.y },
          xAxis: { x: Math.cos(radians), y: Math.sin(radians) },
          yAxis: { x: -Math.sin(radians), y: Math.cos(radians) },
          halfWidth: (label.textLength ?? fontSize * 0.65 * label.text.length) / 2,
          halfHeight: fontSize / 2,
        };
      });
      const dot = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        a.x * b.x + a.y * b.y;
      for (let i = 0; i < labels.length; i++) {
        if (labels[i].kind !== "degree") continue;
        expect(labels[i].textLength).toBeGreaterThan(0);
        for (let j = 0; j < labels.length; j++) {
          if (i === j) continue;
          const a = boxes[i];
          const b = boxes[j];
          const delta = { x: a.center.x - b.center.x, y: a.center.y - b.center.y };
          const separated = [a.xAxis, a.yAxis, b.xAxis, b.yAxis].some((axis) => {
            const extentA =
              a.halfWidth * Math.abs(dot(a.xAxis, axis)) +
              a.halfHeight * Math.abs(dot(a.yAxis, axis));
            const extentB =
              b.halfWidth * Math.abs(dot(b.xAxis, axis)) +
              b.halfHeight * Math.abs(dot(b.yAxis, axis));
            return Math.abs(dot(delta, axis)) > extentA + extentB + 0.1;
          });
          expect(
            separated,
            `${width} mm: degree ${labels[i].text} overlaps ${labels[j].kind} ${labels[j].text}`,
          ).toBe(true);
        }
      }
    }
  });
});

describe("10 cm semicircle protractor", () => {
  it("uses a 100 mm measuring arc, an open centre and a padded centimetre base", () => {
    const markings = protractorMarkings();
    expect(markings.radius * 2).toBe(100);
    expect(markings.center).toEqual({ x: 55, y: 50 });
    expect(markings.width).toBe(110);
    expect(markings.height).toBe(68);
    expect(markings.degreeTicks.match(/M/g)).toHaveLength(181);
    expect(markings.linearTicks.match(/M/g)).toHaveLength(101);
    const linear = markings.labels.filter((label) => label.kind === "linear");
    expect(linear.map((label) => label.text)).toEqual(
      Array.from({ length: 11 }, (_, cm) => String(cm)),
    );
    expect(linear[0].x).toBe(5);
    expect(linear[10].x).toBe(markings.width - 5);
    expect(linear[1].x - linear[0].x).toBe(10);
  });

  it("prints opposing 0–180° scales with 90° at the top", () => {
    const { labels, center } = protractorMarkings();
    const degrees = labels.filter((label) => label.kind === "degree");
    expect(degrees).toHaveLength(38);
    expect(degrees.slice(0, 2).map((label) => label.text)).toEqual(["0", "180"]);
    expect(degrees.slice(-2).map((label) => label.text)).toEqual(["180", "0"]);
    const rightAngles = degrees.filter((label) => label.text === "90");
    expect(rightAngles).toHaveLength(2);
    for (const label of rightAngles) {
      expect(label.x).toBeCloseTo(center.x);
      expect(label.y).toBeLessThan(center.y);
      expect(label.rotation).toBe(0);
    }
  });

  it("places the normal and reverse labels on separate stripes", () => {
    const markings = protractorMarkings();
    expect(markings.bands.map((band) => band.direction)).toEqual(["normal", "reverse"]);
    const [normal, reverse] = markings.bands;
    expect(normal.radius - normal.width / 2).toBeGreaterThan(reverse.radius + reverse.width / 2);
    expect(reverse.radius - reverse.width / 2).toBeGreaterThan(markings.innerRadius);
    for (const label of markings.labels.filter((label) => label.kind === "degree")) {
      const band = markings.bands.find((candidate) => candidate.direction === label.direction);
      expect(band).toBeDefined();
      const radius = Math.hypot(label.x - markings.center.x, label.y - markings.center.y);
      expect(radius).toBeCloseTo(band!.radius);
      expect(label.fontSize).toBeLessThan(band!.width);
    }
  });

  it("leaves a visible gap between every rotated degree label, including three-digit values", () => {
    for (const scale of [0.5, 1, 2, 4]) {
      const labels = protractorMarkings(scale).labels.filter((label) => label.kind === "degree");
      const boxes = labels.map((label) => {
        expect(label.textLength).toBeGreaterThan(0);
        const radians = (label.rotation * Math.PI) / 180;
        return {
          center: { x: label.x, y: label.y },
          xAxis: { x: Math.cos(radians), y: Math.sin(radians) },
          yAxis: { x: -Math.sin(radians), y: Math.cos(radians) },
          halfWidth: label.textLength! / 2 + 0.1 * scale,
          halfHeight: label.fontSize / 2 + 0.1 * scale,
        };
      });
      const dot = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        a.x * b.x + a.y * b.y;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const delta = { x: a.center.x - b.center.x, y: a.center.y - b.center.y };
          const separated = [a.xAxis, a.yAxis, b.xAxis, b.yAxis].some((axis) => {
            const extentA =
              a.halfWidth * Math.abs(dot(a.xAxis, axis)) +
              a.halfHeight * Math.abs(dot(a.yAxis, axis));
            const extentB =
              b.halfWidth * Math.abs(dot(b.xAxis, axis)) +
              b.halfHeight * Math.abs(dot(b.yAxis, axis));
            return Math.abs(dot(delta, axis)) > extentA + extentB;
          });
          expect(
            separated,
            `${labels[i].direction} ${labels[i].text} overlaps ${labels[j].direction} ${labels[j].text}`,
          ).toBe(true);
        }
      }
    }
  });

  it("keeps degree print in the outer half and base print in the lower half while resizing", () => {
    for (const scale of [0.5, 1, 2, 4]) {
      const markings = protractorMarkings(scale);
      const geometry = protractorGeometry(scale);
      for (const label of markings.labels) {
        if (label.kind === "degree") {
          const radius = Math.hypot(label.x - geometry.center.x, label.y - geometry.center.y);
          expect(radius - label.fontSize / 2).toBeGreaterThanOrEqual(geometry.radius / 2);
          expect(radius + label.fontSize / 2).toBeLessThan(geometry.radius);
        } else {
          expect(label.y - label.fontSize / 2).toBeCloseTo(
            geometry.height - geometry.baseHeight / 2,
          );
        }
      }
      const linear = markings.labels.filter((label) => label.kind === "linear");
      expect(linear[1].x - linear[0].x).toBe(10);
    }
  });
});

/** Minimal DOM surface: exercise the actual overlay's geometry and rendered sizes. */
class RulerElement {
  children: RulerElement[] = [];
  styles: Record<string, string> = {};
  attributes: Record<string, string> = {};
  textContent = "";
  clientWidth = 1000;
  clientHeight = 800;
  createDiv(): RulerElement {
    const child = new RulerElement();
    this.children.push(child);
    return child;
  }
  createSpan(options?: { text?: string }): RulerElement {
    const child = this.createDiv();
    child.textContent = options?.text ?? "";
    return child;
  }
  createSvg(): RulerElement {
    return this.createDiv();
  }
  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }
  setCssStyles(styles: Record<string, string>): void {
    Object.assign(this.styles, styles);
  }
  setCssProps(styles: Record<string, string>): void {
    Object.assign(this.styles, styles);
  }
  toggleClass(): void {}
  addEventListener(): void {}
  empty(): void {
    this.children = [];
  }
  append(...children: RulerElement[]): void {
    this.children.push(...children);
  }
  getBoundingClientRect(): { left: number; top: number } {
    return { left: 10, top: 20 };
  }
}

function overlay(kind: "ruler" | "triangle" | "protractor" = "ruler") {
  const host = new RulerElement();
  const ruler = new RulerOverlay(host as unknown as HTMLElement);
  ruler.setSettings(parseRulerSettings({ kind, degreeSnap: "off" }));
  ruler.setPageScale(4 / PAGE_PX_PER_MM);
  ruler.setVisible(true);
  ruler.transformBy(1, 8); // Start unrotated, centred at client (510, 420).
  return { ruler, el: host.children[0] };
}

describe("ruler overlay resizing", () => {
  it.each(["ruler", "triangle", "protractor"] as const)(
    "detects fast ink crossing the %s without adding handles",
    (kind) => {
      const { ruler, el } = overlay(kind);
      expect(el.children).toHaveLength(2); // Filter definitions and printed scale only.
      const y = kind === "protractor" ? 300 : 420;
      expect(ruler.crossesMaterial({ x: 100, y }, { x: 900, y })).toBe(true);
      expect(ruler.crossesMaterial({ x: 100, y: 100 }, { x: 900, y: 100 })).toBe(false);
      ruler.setVisible(false);
      expect(ruler.crossesMaterial({ x: 100, y }, { x: 900, y })).toBe(false);
    },
  );

  it("leaves the protractor opening available for writing", () => {
    const { ruler } = overlay("protractor");
    expect(ruler.crossesMaterial({ x: 490, y: 450 }, { x: 530, y: 450 })).toBe(false);
  });

  it("keeps the same number of millimetre divisions at 200% and extreme zoom", () => {
    const { ruler, el } = overlay();
    const ticks = el.children[1];
    const labelCount = ticks.children.length;
    for (const pxPerMm of [4, 8, 16, 140, 9000]) {
      ruler.setPageScale(pxPerMm / PAGE_PX_PER_MM);
      expect(Number.parseFloat(ticks.styles["--gob-ruler-minor"]) / pxPerMm).toBeCloseTo(1);
      expect(ticks.children).toHaveLength(labelCount);
    }
  });

  it("aligns protractor guides and hit testing with its semicircle, opening and base", () => {
    const { ruler } = overlay("protractor");
    // 110 x 68 mm body at 4 px/mm, centred at (510, 420).
    const center = { x: 510, y: 484 };
    expect(ruler.guideAt(510, 284)).toEqual({ kind: "arc", center, radius: 200 });
    expect(ruler.guideAt(510, 384)).toEqual({ kind: "arc", center, radius: 100 });
    expect(ruler.guideAt(510, 556)).toMatchObject({
      kind: "line",
      origin: { x: 290, y: 556 },
      direction: { x: 1, y: 0 },
    });
    expect(ruler.hit(510, 300)).toBe(true); // Printed ring.
    expect(ruler.hit(510, 450)).toBe(false); // Hollow centre.
    expect(ruler.hit(510, 484)).toBe(true); // Alignment tab.
    expect(ruler.hit(300, 540)).toBe(true); // Base extends beyond the arc.
    expect(ruler.hit(300, 480)).toBe(false); // Outside the curved body.
    ruler.transformBy(2, 90);
    const arc = ruler.guideAt(782, 420);
    expect(arc?.kind).toBe("arc");
    if (arc?.kind === "arc") {
      expect(arc.radius).toBe(400);
      expect(arc.center.x).toBeCloseTo(382);
      expect(arc.center.y).toBeCloseTo(420);
    }
  });

  it("zooms the protractor print without changing its degree or linear markings", () => {
    const { ruler, el } = overlay("protractor");
    const svg = el.children[1].children[0];
    const labels = svg.children.filter((child) => child.textContent !== "");
    expect(svg.attributes.viewBox).toBe("0 0 110 68");
    expect(labels).toHaveLength(49); // Two degree scales plus 0–10 cm.
    for (const zoom of [0.5, 1, 2, 4]) {
      ruler.setPageScale((4 * zoom) / PAGE_PX_PER_MM);
      expect(el.children[1].children[0]).toBe(svg);
      expect(Number.parseFloat(el.styles.width)).toBeCloseTo(440 * zoom);
      expect(Number.parseFloat(el.styles.height)).toBeCloseTo(272 * zoom);
    }
  });
  it("prints zero through the final centimetre with 5 mm of material at each end", () => {
    const { el } = overlay();
    const ticks = el.children[1];
    expect(ticks.children.map((label) => label.textContent)).toEqual(
      Array.from({ length: 12 }, (_, cm) => String(cm)),
    );
    const leftMargin = Number.parseFloat(ticks.styles.left);
    const printedSpan = Number.parseFloat(ticks.styles.width) - 1;
    expect(leftMargin).toBe(20); // 5 mm at 4 px/mm.
    expect(Number.parseFloat(el.styles.width) - leftMargin - printedSpan).toBe(20);
    // Label anchors coincide with the centre of each one-pixel cm stroke.
    expect(Number.parseFloat(ticks.children[0].styles.left)).toBe(0.5);
    expect(Number.parseFloat(ticks.children[11].styles.left)).toBe(440.5);
  });

  it("keeps the printed scale proportional and the margins calibrated across zoom and resize", () => {
    const { ruler, el } = overlay();
    const ticks = el.children[1];
    for (const zoom of [0.5, 1, 2, 4]) {
      ruler.setPageScale((4 * zoom) / PAGE_PX_PER_MM);
      expect(
        Number.parseFloat(ticks.styles.fontSize) / Number.parseFloat(el.styles.height),
      ).toBeCloseTo(0.12);
      const margin = Number.parseFloat(ticks.styles.left);
      expect(margin / (4 * zoom)).toBeCloseTo(5);
      expect(
        Number.parseFloat(el.styles.width) - margin - (Number.parseFloat(ticks.styles.width) - 1),
      ).toBeCloseTo(margin);
    }
    ruler.transformBy(1.5, 0);
    expect(
      Number.parseFloat(ticks.styles.fontSize) / Number.parseFloat(el.styles.height),
    ).toBeCloseTo(0.12);
    expect(ticks.children[ticks.children.length - 1].textContent).toBe("17");
  });

  it("retains the 1 mm, 5 mm and 1 cm divisions when zoomed out", () => {
    const { ruler, el } = overlay();
    ruler.setPageScale(1 / PAGE_PX_PER_MM);
    const ticks = el.children[1];
    expect(ticks.styles["--gob-ruler-minor"]).toBe("1px");
    expect(ticks.styles["--gob-ruler-half"]).toBe("5px");
    expect(ticks.styles["--gob-ruler-major"]).toBe("10px");
  });

  it("removes the straight ruler's print margins when switching to another tool", () => {
    const { ruler, el } = overlay();
    for (const kind of ["triangle", "protractor"] as const) {
      ruler.setSettings(parseRulerSettings({ kind }));
      expect(el.children[1].styles).toMatchObject({ left: "", width: "", fontSize: "" });
    }
  });

  it.each(["ruler", "triangle", "protractor"] as const)(
    "pinches the %s and follows page zoom",
    (kind) => {
      const { ruler, el } = overlay(kind);
      const width = Number.parseFloat(el.styles.width);
      const height = Number.parseFloat(el.styles.height);
      ruler.transformBy(1.5, 0);
      expect(Number.parseFloat(el.styles.width)).toBeCloseTo(width * 1.5);
      expect(Number.parseFloat(el.styles.height)).toBeCloseTo(height * 1.5);
      expect(ruler.configuration.scale).toBe(1.5);
      ruler.setPageScale(8 / PAGE_PX_PER_MM);
      expect(Number.parseFloat(el.styles.width)).toBeCloseTo(width * 3);
      expect(Number.parseFloat(el.styles.height)).toBeCloseTo(height * 3);
    },
  );

  it("keeps ticks calibrated when only the tool grows", () => {
    const { ruler, el } = overlay();
    const ticks = el.children[1];
    const spacing = ticks.styles["--gob-ruler-major"];
    ruler.transformBy(2, 0);
    expect(ticks.styles["--gob-ruler-major"]).toBe(spacing);
    ruler.setPageScale(8 / PAGE_PX_PER_MM);
    expect(Number.parseFloat(ticks.styles["--gob-ruler-major"])).toBeCloseTo(
      Number.parseFloat(spacing) * 2,
    );
  });

  it("keeps hit testing and all three drawing guides aligned with the resized triangle", () => {
    const { ruler } = overlay("triangle");
    ruler.transformBy(2, 0);
    expect(ruler.hit(510, 420 + 300)).toBe(true);
    expect(ruler.hit(510 + 500, 420 + 100)).toBe(false);
    const hypotenuse = ruler.guideAt(510, 420 - 320);
    expect(hypotenuse).toMatchObject({ direction: { x: 1, y: 0 } });
    for (const side of [-1, 1]) {
      const guide = ruler.guideAt(510 + side * 320, 420);
      expect(guide).not.toBeNull();
      if (guide && guide.kind !== "arc") {
        expect(guide.direction.x).toBeCloseTo(-Math.SQRT1_2);
        expect(guide.direction.y).toBeCloseTo(side * Math.SQRT1_2);
      }
    }
    expect(ruler.guideAt(510, 420)).toBeNull();
  });

  it("anchors a resize to the pinch focus", () => {
    const { ruler } = overlay();
    ruler.transformBy(2, 0, { x: 550, y: 420 });
    // The original centre is now (470, 420), 80 px left of the fixed focus.
    expect(ruler.guideAt(470, 420 - 72)).toMatchObject({ origin: { x: -10, y: 348 } });
  });

  it("rejects invalid gestures and clamps extreme pinches", () => {
    const { ruler, el } = overlay();
    ruler.transformBy(NaN, Infinity);
    ruler.transformBy(-1, 0);
    expect(ruler.configuration.scale).toBe(1);
    expect(el.styles.transform).not.toContain("NaN");
    ruler.transformBy(1000, 0);
    expect(ruler.configuration.scale).toBe(4);
    ruler.transformBy(0.0001, 0);
    expect(ruler.configuration.scale).toBe(0.5);
  });
});
