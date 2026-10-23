import { describe, expect, it } from "vitest";
import {
  cloneGeneratedBackdrop,
  encodeGeneratedPaper,
  parseGeneratedPaper,
} from "../../src/model/generated-paper";

describe("generated paper files", () => {
  const paper = {
    format: 1 as const,
    geometry: { width: 1024, height: 1448 },
    backdrop: {
      kind: "squared" as const,
      paperColor: "#f6efe0",
      color: "#b8cde8",
      spacing: 32,
      texture: "heavy" as const,
      margins: { top: 40, right: 50, bottom: 60, left: 70 },
      blankZones: [{ side: "right" as const, size: 180 }],
      dividers: [{ side: "right" as const, inset: 180, color: "#df7777", width: 1 }],
    },
  };

  it("round-trips an editable paper design", () => {
    expect(parseGeneratedPaper(JSON.parse(encodeGeneratedPaper(paper)))).toEqual(paper);
  });

  it("rejects executable or malformed content instead of guessing", () => {
    expect(parseGeneratedPaper({ format: 1, geometry: {}, backdrop: { kind: "squared" } })).toBeNull();
    expect(
      parseGeneratedPaper({
        format: 1,
        geometry: { width: 1024, height: 1448 },
        backdrop: { kind: "script", paperColor: "url(javascript:bad)" },
      }),
    ).toBeNull();
  });

  it("clones the embedded design without sharing nested arrays", () => {
    const clone = cloneGeneratedBackdrop(paper.backdrop);
    expect(clone).toEqual(paper.backdrop);
    expect(clone.blankZones).not.toBe(paper.backdrop.blankZones);
  });
});
