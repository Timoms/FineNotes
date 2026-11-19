import { describe, expect, it } from "vitest";
import {
  PASTED_TEXT_ROOM,
  cleanPastedText,
  pastedTextOrigin,
  pickClipboardType,
  systemClipboardIsNewer,
} from "../../src/view/paste-choice";

describe("clipboard freshness", () => {
  it("uses the store with the later timestamp", () => {
    expect(systemClipboardIsNewer(4, 5)).toBe(true);
    expect(systemClipboardIsNewer(5, 4)).toBe(false);
    expect(systemClipboardIsNewer(5, 5)).toBe(false);
  });
});

describe("pickClipboardType", () => {
  it("prefers a picture over the text that comes with it", () => {
    expect(pickClipboardType(["text/plain", "image/png"])).toEqual({
      kind: "image",
      type: "image/png",
    });
    expect(pickClipboardType(["text/html", "image/jpeg", "image/png"])).toEqual({
      kind: "image",
      type: "image/png",
    });
  });

  it("accepts image formats supplied by the platform beyond the preferred set", () => {
    expect(pickClipboardType(["image/heic"])).toEqual({ kind: "image", type: "image/heic" });
  });

  it("reads any picture type a page shows, whatever its case", () => {
    expect(pickClipboardType(["IMAGE/GIF"])).toEqual({ kind: "image", type: "image/gif" });
    expect(pickClipboardType(["image/webp"])).toEqual({ kind: "image", type: "image/webp" });
    expect(pickClipboardType(["image/svg+xml"])).toEqual({ kind: "image", type: "image/svg+xml" });
  });

  it("falls back to plain text", () => {
    expect(pickClipboardType(["text/html", "text/plain"])).toEqual({
      kind: "text",
      type: "text/plain",
    });
  });

  it("finds nothing in HTML alone, a non-picture app type, or nothing", () => {
    expect(pickClipboardType(["text/html"])).toBeNull();
    expect(pickClipboardType(["web application/x-goodnotes"])).toBeNull();
    expect(pickClipboardType([])).toBeNull();
  });
});

describe("cleanPastedText", () => {
  it("makes every line break a \\n and drops trailing spaces", () => {
    expect(cleanPastedText("one  \r\ntwo\rthree\t\n")).toBe("one\ntwo\nthree");
  });

  it("keeps indentation, inner blank lines and tabs as spaces", () => {
    expect(cleanPastedText("\n\n  a\n\n\tb\n\n")).toBe("  a\n\n    b");
  });

  it("is empty when only whitespace was copied", () => {
    expect(cleanPastedText(" \n\t \r\n  ")).toBe("");
    expect(cleanPastedText("")).toBe("");
  });
});

describe("pastedTextOrigin", () => {
  const page = { width: 800, height: 1100 };

  it("starts the box at the press", () => {
    expect(pastedTextOrigin({ x: 100, y: 300 }, page)).toEqual({ x: 100, y: 300 });
  });

  it("moves it left so it keeps room to the page's right edge", () => {
    expect(pastedTextOrigin({ x: 790, y: 300 }, page)).toEqual({
      x: page.width - PASTED_TEXT_ROOM,
      y: 300,
    });
  });

  it("keeps it on the page", () => {
    expect(pastedTextOrigin({ x: -20, y: -5 }, page)).toEqual({ x: 0, y: 0 });
    expect(pastedTextOrigin({ x: 10, y: 5000 }, page)).toEqual({ x: 10, y: 1100 });
  });

  it("starts at the left edge on a page narrower than the room", () => {
    expect(pastedTextOrigin({ x: 100, y: 10 }, { width: 200, height: 300 })).toEqual({
      x: 0,
      y: 10,
    });
  });
});
