import { describe, expect, it } from "vitest";
import type { ImageElement } from "../../src/model/document";
import { stickyAt, stickyNoteFileName, stickyNoteSvg } from "../../src/model/sticky-notes";

describe("sticky note papers", () => {
  it("renders a uniform note with its top third adhered and the colored cap on an index tab", () => {
    const note = stickyNoteSvg("#ffd95a", "note");
    expect(note).toContain('M10 62H170V170H10Z" fill="#ffd95a" filter="url(#s)"');
    expect(note).toContain('width="160" height="162" fill="#ffd95a"');
    expect(stickyNoteSvg("#ff9fb4", "index-tab")).toContain('V54H10Z" fill="#ff9fb4"');
    expect(stickyNoteFileName("#ff9fb4", "index-tab")).toBe("Index tab ff9fb4");
  });

  it("takes an index tab before a later overlapping ordinary sticky", () => {
    const image = (id: string, type?: "index-tab"): ImageElement => ({
      id,
      path: `${id}.svg`,
      x: 0,
      y: 0,
      w: 180,
      h: 180,
      sticky: { color: "#ffd95a", ...(type ? { type } : {}), strokes: [] },
    });
    expect(stickyAt([image("tab", "index-tab"), image("note")], { x: 90, y: 90 })?.id).toBe("tab");
  });

  it("falls back to the first safe paper color", () => {
    expect(stickyNoteSvg("not-a-color", "note")).toContain('fill="#ffd95a"');
  });

  it("applies opacity to the paper group without changing captured ink", () => {
    expect(stickyNoteSvg("#ffd95a", "note", 0.55)).toContain('<g opacity="0.55">');
    expect(stickyNoteSvg("#ffd95a", "index-tab", 0.7)).toContain('<g opacity="0.7"');
  });
});
