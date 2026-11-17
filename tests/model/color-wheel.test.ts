import { describe, expect, it } from "vitest";
import {
  rememberWheelColor,
  wheelColor,
  wheelPosition,
  wheelPins,
  wheelSwatches,
} from "../../src/model/color-wheel";
import { hsvToRgb, rgbToHex } from "../../src/model/colors";

describe("color wheel", () => {
  it("maps wheel direction to hue and distance to saturation", () => {
    expect(rgbToHex(hsvToRgb(wheelColor(1, 0, 1)))).toBe("#ff0000");
    expect(rgbToHex(hsvToRgb(wheelColor(-1, 0, 1)))).toBe("#00ffff");
    expect(rgbToHex(hsvToRgb(wheelColor(0, 0, 1)))).toBe("#ffffff");
    expect(rgbToHex(hsvToRgb(wheelColor(1, 0, 0)))).toBe("#000000");
    expect(wheelColor(4, 0, 1).s).toBe(1);
  });
  it("remembers common and custom colors without duplicates, newest first", () => {
    expect(rememberWheelColor(["#ff0000", "#000000"], "#000000")).toEqual(["#000000", "#ff0000"]);
    expect(rememberWheelColor(["#aabbcc"], "ABC")).toEqual(["#aabbcc"]);
    expect(
      rememberWheelColor(
        Array.from({ length: 10 }, (_, i) => `#00000${i}`),
        "#ffffff",
      ),
    ).toHaveLength(8);
  });
  it("keeps saved positions inside the available area", () => {
    expect(wheelPosition({ x: -1, y: 20 })).toEqual({ x: 0, y: 1 });
    expect(wheelPosition({ x: NaN, y: "oops" })).toEqual(wheelPosition(undefined));
    expect(wheelPosition({ x: 0.2, y: 0.6 })).toEqual({ x: 0.2, y: 0.6 });
  });
});

describe("pinned wheel colors", () => {
  it("round trips sparse pins and never displaces them with recent colors", () => {
    const pins = wheelPins([null, "#f00", null, null, "#000"]);
    const saved = JSON.parse(JSON.stringify(pins));
    expect(wheelSwatches(["#abcdef", "#ff0000", "#123456"], saved)).toEqual([
      { slot: 0, color: "#abcdef", locked: false },
      { slot: 1, color: "#ff0000", locked: true },
      { slot: 2, color: "#123456", locked: false },
      { slot: 4, color: "#000000", locked: true },
    ]);
    expect(wheelPins([42, "bad color", false])).toEqual(Array(8).fill(null));
  });
});
