import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => import("./fake-obsidian"));

import { clipBounds } from "../../src/view/app-smart-clip";

describe("app Smart Clip selection", () => {
  it("normalises a rectangle dragged in either direction", () => {
    expect(clipBounds({ x: 90, y: 70 }, { x: 10, y: 20 })).toEqual({
      left: 10,
      top: 20,
      width: 80,
      height: 50,
    });
  });

  it("ignores a click and a one-pixel drag", () => {
    expect(clipBounds({ x: 10, y: 10 }, { x: 10, y: 10 })).toBeNull();
    expect(clipBounds({ x: 10, y: 10 }, { x: 11, y: 20 })).toBeNull();
  });
});
