import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => import("./fake-obsidian"));

import {
  clearStoredSmartClip,
  clipBounds,
  storeSmartClip,
  storedSmartClip,
} from "../../src/view/app-smart-clip";

describe("app Smart Clip selection", () => {
  afterEach(() => clearStoredSmartClip());
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

  it("keeps a clip in the FineNotes store without using the native clipboard", () => {
    const first = new Blob(["first"], { type: "image/png" });
    const second = new Blob(["second"], { type: "image/png" });
    storeSmartClip(first);
    const firstStamp = storedSmartClip()?.updatedAt ?? 0;
    storeSmartClip(second);
    expect(storedSmartClip()).toMatchObject({ blob: second });
    expect(storedSmartClip()?.updatedAt).toBeGreaterThan(firstStamp);
  });
});
