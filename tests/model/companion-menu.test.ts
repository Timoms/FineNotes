import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANION_ACTIONS, companionActionsOf } from "../../src/model/companion-menu";

describe("floating pen companion settings", () => {
  it("keeps valid unique actions in the chosen order", () => {
    expect(companionActionsOf(["stickers", "pen", "stickers", "unknown"])).toEqual([
      "stickers",
      "pen",
    ]);
  });

  it("uses the useful defaults for missing or empty settings", () => {
    expect(companionActionsOf(null)).toEqual(DEFAULT_COMPANION_ACTIONS);
    expect(companionActionsOf([])).toEqual(DEFAULT_COMPANION_ACTIONS);
  });
});
