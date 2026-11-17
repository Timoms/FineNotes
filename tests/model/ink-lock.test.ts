import { describe, expect, it } from "vitest";
import {
  AddProtectionZone,
  UpdateProtectionZone,
  lockStrokeInRect,
  readProtectionZones,
} from "../../src/model/ink-lock";
import { emptyDocument, type Stroke } from "../../src/model/document";
import { ReplaceStrokesOnPage } from "../../src/model/erase-commands";
import { decodeDocument, encodeDocument } from "../../src/model/serialize";
import { eraseCircleFromStroke, eraserTakes } from "../../src/ink/stroke-eraser";

const rect = { minX: 4, minY: -2, maxX: 6, maxY: 2 };
const line = (): Stroke => ({
  id: "s1",
  color: "#000000",
  size: 1,
  tool: "pen",
  pts: [0, 0, 0.5, 10, 0, 1],
});
let sequence = 0;
const nextId = (): string => `piece${++sequence}`;

describe("ink protection rectangles", () => {
  it("splits crossing lines exactly at both edges and interpolates pressure", () => {
    const pieces = lockStrokeInRect(line(), rect, nextId)!;
    expect(pieces.map((s) => s.locked === true)).toEqual([false, true, false]);
    expect(pieces.map((s) => s.pts)).toEqual([
      [0, 0, 0.5, 4, 0, 0.7],
      [4, 0, 0.7, 6, 0, 0.8],
      [6, 0, 0.8, 10, 0, 1],
    ]);
  });

  it("keeps protected ink, erases outside, and erases new ink drawn on top", () => {
    const pieces = lockStrokeInRect(line(), rect, nextId)!;
    expect(eraseCircleFromStroke(pieces[1], 5, 0, 10, nextId)).toBeNull();
    expect(eraseCircleFromStroke(pieces[0], 2, 0, 10, nextId)).toEqual([]);
    expect(eraseCircleFromStroke(line(), 5, 0, 10, nextId)).toEqual([]);
    for (const filter of ["all", "pen", "highlighter"] as const)
      expect(eraserTakes(pieces[1], filter)).toBe(false);
  });

  it("leaves missed strokes untouched and protects a single dot", () => {
    const s = line();
    expect(lockStrokeInRect(s, { ...rect, minY: 2, maxY: 4 }, nextId)).toBeNull();
    expect(lockStrokeInRect({ ...s, pts: [5, 0, 1] }, rect, nextId)?.[0].locked).toBe(true);
  });

  it("preserves locks on save and restores original ink and links on undo", () => {
    const doc = emptyDocument();
    const original = line();
    const page = doc.pages[0];
    page.strokes = [original];
    const before = JSON.stringify(doc);
    const command = new ReplaceStrokesOnPage(
      page.id,
      [{ original, pieces: lockStrokeInRect(original, rect, nextId)! }],
      "Lock ink",
    );
    command.apply(doc);
    expect(decodeDocument(encodeDocument(doc)).pages[0].strokes.map((s) => !!s.locked)).toEqual([
      false,
      true,
      false,
    ]);
    command.invert(doc);
    expect(JSON.stringify(doc)).toBe(before);
    command.apply(doc);
    expect(page.strokes[1].locked).toBe(true);
  });
});

describe("persistent protection foils", () => {
  it("saves foil bounds, survives ink erasure, and undoes exactly", () => {
    const doc = emptyDocument();
    const page = doc.pages[0];
    const before = JSON.stringify(doc);
    const zone = { ...rect, strokes: ["s1"] };
    const command = new AddProtectionZone(page.id, zone);
    command.apply(doc);
    expect(decodeDocument(encodeDocument(doc)).pages[0].protectionZones).toEqual([zone]);
    page.strokes = [];
    expect(page.protectionZones).toEqual([zone]);
    command.invert(doc);
    expect(JSON.stringify(doc)).toBe(before);
    command.apply(doc);
    expect(page.protectionZones).toEqual([zone]);
  });

  it("rejects invalid frames and preserves valid frames", () => {
    const zone = { ...rect, strokes: [] };
    expect(
      readProtectionZones([
        zone,
        { ...zone, maxX: 1 },
        { ...zone, minY: NaN },
        { ...zone, strokes: [42] },
      ]),
    ).toEqual([zone]);
  });
});

describe("editing protection foils", () => {
  it("updates bounds and protected IDs with exact undo and redo", () => {
    const doc = emptyDocument(),
      page = doc.pages[0];
    const zone = { minX: 0, minY: 0, maxX: 20, maxY: 20, strokes: ["old"] };
    page.protectionZones = [zone];
    const command = new UpdateProtectionZone(page.id, zone, {
      minX: 5,
      minY: 7,
      maxX: 35,
      maxY: 40,
      strokes: ["old", "new"],
    });
    command.apply(doc);
    expect(zone).toMatchObject({ minX: 5, maxY: 40, strokes: ["old", "new"] });
    command.invert(doc);
    expect(zone).toEqual({ minX: 0, minY: 0, maxX: 20, maxY: 20, strokes: ["old"] });
    command.apply(doc);
    expect(zone.strokes).toEqual(["old", "new"]);
  });
});
