import { describe, expect, it } from "vitest";
import {
  parseRulerSettings,
  physicalDimensions,
  projectToGuide,
  projectToLine,
  rulerStepMm,
  snapRotation,
} from "../../src/view/ruler";

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
      baseLength: 12 / 2.54,
      degreeSnap: 15,
      scale: 1.5,
    });
    expect(parseRulerSettings({ theme: "pink", unit: "yards", scale: "large" })).toEqual({
      theme: "clear",
      unit: "cm",
      kind: "ruler",
      baseLength: 12,
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

  it("changes base length without changing the tool height", () => {
    expect(physicalDimensions("ruler", { baseLength: 12, unit: "cm" })).toEqual({
      width: 120,
      height: 18,
    });
    expect(physicalDimensions("ruler", { baseLength: 30, unit: "cm" })).toEqual({
      width: 300,
      height: 18,
    });
    expect(physicalDimensions("triangle", { baseLength: 20, unit: "cm" }).height).toBe(60);
    expect(physicalDimensions("protractor", { baseLength: 8, unit: "inch" }).height).toBe(60);
  });

  it("reveals finer calibrated divisions as the page zooms", () => {
    expect(rulerStepMm(1, "cm")).toBe(10);
    expect(rulerStepMm(4, "cm")).toBe(1);
    expect(rulerStepMm(14, "cm")).toBe(0.1);
    expect(rulerStepMm(140, "cm")).toBe(0.01);
    expect(rulerStepMm(900, "cm")).toBe(0.001);
    expect(rulerStepMm(9000, "cm")).toBe(0.001);
    expect(rulerStepMm(9, "inch")).toBeCloseTo(25.4 / 32);
  });

  it("projects ink onto a protractor arc", () => {
    expect(
      projectToGuide(
        { x: 6, y: 8 },
        { kind: "arc", center: { x: 0, y: 0 }, radius: 5 },
      ),
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
