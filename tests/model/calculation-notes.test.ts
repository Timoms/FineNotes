import { describe, expect, it } from "vitest";
import { calculateNote } from "../../src/model/calculation-notes";

describe("Calculation Notes", () => {
  it("stores a page variable and resolves it in a later equation", () => {
    const variables = new Map<string, string>();
    const assignment = calculateNote("x = 12", variables);
    expect(assignment).toEqual({ kind: "assignment", name: "x", expression: "12" });
    if (assignment.kind === "assignment") variables.set(assignment.name, assignment.expression);
    expect(calculateNote("x / 3 =", variables)).toEqual({
      kind: "answer",
      expression: "(12) / 3",
      answer: "4",
    });
  });

  it("adds compatible units and converts between them", () => {
    expect(calculateNote("2 cm + 5 mm =", new Map())).toMatchObject({ answer: "2.5 cm" });
    expect(calculateNote("2 in to cm =", new Map())).toMatchObject({ answer: "5.08 cm" });
  });

  it("ignores prose, unfinished arithmetic and incompatible units", () => {
    expect(calculateNote("hello", new Map())).toEqual({ kind: "none" });
    expect(calculateNote("2 + 2", new Map())).toEqual({ kind: "none" });
    expect(calculateNote("2 cm + 3 kg =", new Map())).toEqual({ kind: "none" });
  });
});
