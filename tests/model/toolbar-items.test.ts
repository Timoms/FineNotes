import { describe, expect, it } from "vitest";
import {
  stripSlots,
  stripItemSlots,
  type ToolbarItemChoice,
  compactToolbarLabel,
  stripLayoutOf,
  moveStripItem,
  DEFAULT_TOOLBAR_ITEMS,
  TOOLBAR_ITEMS,
  savedPenToolbarIndex,
  toolbarItemsOf,
} from "../../src/model/toolbar-items";

describe("toolbar item settings", () => {
  it("uses every available item in the default order", () => {
    expect(toolbarItemsOf(undefined)).toEqual(DEFAULT_TOOLBAR_ITEMS);
    expect(DEFAULT_TOOLBAR_ITEMS.map((item) => item.id)).toEqual(
      TOOLBAR_ITEMS.map((item) => item.id),
    );
  });

  it("offers laser and eight favorite pens without placing them by default", () => {
    const items = toolbarItemsOf(undefined);
    expect(items.find((item) => item.id === "laser")?.visible).toBe(false);
    for (let index = 0; index < 8; index++) {
      const item = items.find((choice) => choice.id === `saved-pen-${index + 1}`);
      expect(item?.visible).toBe(false);
      expect(savedPenToolbarIndex(item!.id)).toBe(index);
    }
  });

  it("keeps order and visibility, removes duplicates and appends new items", () => {
    const parsed = toolbarItemsOf([
      { id: "eraser", visible: false },
      { id: "pen", visible: true },
      { id: "eraser", visible: true },
      { id: "unknown", visible: false },
    ]);
    expect(parsed.slice(0, 2)).toEqual([
      { id: "eraser", visible: false, group: "center" },
      { id: "pen", visible: true, group: "center" },
    ]);
    expect(parsed).toHaveLength(TOOLBAR_ITEMS.length);
    expect(new Set(parsed.map((item) => item.id)).size).toBe(TOOLBAR_ITEMS.length);
  });

  it("treats malformed visibility as visible", () => {
    expect(toolbarItemsOf([{ id: "pen", visible: "no" }])[0]).toEqual({
      id: "pen",
      visible: true,
      group: "center",
    });
  });

  it("keeps explicit groups and repairs unknown ones", () => {
    expect(
      toolbarItemsOf([
        { id: "pen", visible: true, group: "left" },
        { id: "settings", visible: false, group: "elsewhere" },
      ]).slice(0, 2),
    ).toEqual([
      { id: "pen", visible: true, group: "left" },
      { id: "settings", visible: false, group: "right" },
    ]);
  });
});

describe("unified strip layouts", () => {
  it("keeps repeated spacers and groups with stable unique identities", () => {
    const items = toolbarItemsOf([
      { id: "group", key: "pill-a", group: "left" },
      { id: "pen", group: "left" },
      { id: "fixed-space", key: "space", group: "left" },
      { id: "fixed-space", key: "space", group: "left" },
      { id: "flexible-space", group: "center" },
      { id: "divider", group: "right" },
      { id: "group", key: "pill-b", group: "right" },
    ]);
    expect(items.filter((item) => item.id === "group")).toHaveLength(2);
    expect(items.filter((item) => item.id === "fixed-space")).toHaveLength(2);
    const keys = items.flatMap((item) => (item.key ? [item.key] : []));
    expect(new Set(keys).size).toBe(keys.length);
    expect(toolbarItemsOf(items)).toEqual(items);
  });

  it("moves formerly separate More actions onto the strip or into Available", () => {
    const items = toolbarItemsOf([
      { id: "bookmark-page", group: "left", visible: true },
      { id: "search", group: "more", visible: true },
      { id: "clear-page", group: "more", visible: false },
    ]);
    expect(items.slice(0, 3)).toEqual([
      { id: "bookmark-page", group: "left", visible: true },
      { id: "search", group: "more", visible: true },
      { id: "clear-page", group: "more", visible: false },
    ]);
    expect(items.find((item) => item.id === "delete-page")?.group).toBe("more");
    expect(items.find((item) => item.id === "pen")?.group).toBe("center");
  });
});

describe("linear strip and explicit group containers", () => {
  it("migrates old lanes into one strip separated by flexible spaces", () => {
    const migrated = stripLayoutOf([
      { id: "pen", group: "center" },
      { id: "search", group: "left" },
      { id: "settings", group: "right" },
      { id: "clear-page", group: "more" },
    ]);
    expect(migrated.every((i) => i.group === "strip" || i.group === "more")).toBe(true);
    expect(migrated.filter((i) => i.id === "flexible-space")).toHaveLength(2);
    expect(stripLayoutOf(migrated)).toEqual(migrated);
  });
  it("moves items into and out of groups without absorbing neighboring items", () => {
    const items = stripLayoutOf([
      { id: "group", key: "tools", group: "strip", visible: true },
      { id: "pen", group: "strip", visible: true },
      { id: "eraser", group: "strip", visible: true },
    ]);
    const grouped = moveStripItem(items, 1, "strip", "tools");
    expect(grouped.find((i) => i.id === "pen")?.container).toBe("tools");
    expect(grouped.find((i) => i.id === "eraser")?.container).toBeUndefined();
    const moved = moveStripItem(
      grouped,
      grouped.findIndex((i) => i.id === "group"),
      "more",
    );
    expect(moved.find((i) => i.id === "pen")?.group).toBe("more");
    expect(moved.find((i) => i.id === "pen")?.container).toBe("tools");
    const removed = moveStripItem(
      moved,
      moved.findIndex((i) => i.id === "pen"),
      "library",
    );
    expect(removed.find((i) => i.id === "pen")?.visible).toBe(false);
    expect(removed.find((i) => i.id === "pen")?.container).toBeUndefined();
  });
  it("rejects nested groups and drops dangling parent references on load", () => {
    const items = stripLayoutOf([
      { id: "group", key: "one", group: "strip" },
      { id: "group", key: "two", group: "strip" },
      { id: "pen", container: "missing", group: "strip" },
    ]);
    expect(items.find((i) => i.id === "pen")?.container).toBeUndefined();
    expect(moveStripItem(items, 1, "strip", "one")).toEqual(items);
  });
});

describe("compact More wording", () => {
  it("shortens verbose actions and leaves ordinary tool names readable", () => {
    expect(compactToolbarLabel("Add or rename in contents")).toBe("Contents…");
    expect(compactToolbarLabel("Change page template or cover")).toBe("Page template…");
    expect(compactToolbarLabel("Toggle touch navigation")).toBe("Prevent touch scrolling");
    expect(compactToolbarLabel("Insert PDF")).toBe("Insert PDF");
  });
});

describe("fixed strip capacity and submenus", () => {
  const space = (key: string): ToolbarItemChoice => ({
    id: "fixed-space",
    key,
    group: "strip",
    visible: true,
  });
  it("counts spaces, flexible spaces and group contents, reserving More", () => {
    const items: ToolbarItemChoice[] = [
      space("a"),
      { ...space("b"), id: "flexible-space" },
      { ...space("g"), id: "group" },
      { ...space("c"), container: "g" },
    ];
    expect(stripItemSlots(items[1], items)).toBe(2);
    expect(stripSlots(items)).toBe(3);
  });
  it("rejects drops beyond 22 slots without losing the source item", () => {
    const items = Array.from({ length: 21 }, (_, i) => space(String(i)));
    items.push({ ...space("extra"), visible: false });
    expect(stripSlots(items)).toBe(22);
    expect(moveStripItem(items, 21, "strip")).toEqual(items);
    expect(moveStripItem(items, 0, "library").filter((i) => i.visible)).toHaveLength(20);
  });
  it("keeps submenu children in their own strip and moves descendants together", () => {
    const items: ToolbarItemChoice[] = [
      { id: "submenu", key: "sub", name: "Drawing", icon: "palette", visible: true, group: "more" },
      { id: "group", key: "g", container: "sub", visible: true, group: "more" },
      { id: "pen", container: "g", visible: true, group: "more" },
    ];
    expect(stripSlots(items, "sub")).toBe(1);
    const moved = moveStripItem(items, 0, "strip");
    expect(stripSlots(moved)).toBe(2);
    expect(moved.every((i) => i.group === "strip")).toBe(true);
    expect(moved[2].container).toBe("g");
    const normalized = stripLayoutOf(moved);
    expect(normalized.find((i) => i.key === "sub")).toMatchObject({
      name: "Drawing",
      icon: "palette",
    });
    expect(normalized.find((i) => i.key === "g")?.container).toBe("sub");
    expect(stripLayoutOf(normalized)).toEqual(normalized);
    expect(moveStripItem(items, 0, "more", "g")).toEqual(items);
  });
  it("keeps added-strip placement and accepts ordinary actions as its children", () => {
    const items = stripLayoutOf([
      {
        id: "menu-strip",
        key: "extra",
        visible: true,
        group: "strip",
        position: "left",
        alignment: "stretch",
      },
      { id: "pen", visible: true, group: "strip" },
    ]);
    expect(items[0]).toMatchObject({ position: "left", alignment: "stretch" });
    const moved = moveStripItem(items, 1, "strip", "extra");
    expect(moved.find((item) => item.id === "pen")?.container).toBe("extra");
    expect(stripSlots(moved, "extra")).toBe(1);
    expect(stripSlots(moved)).toBeLessThanOrEqual(22);
    expect(stripLayoutOf(moved)).toEqual(moved);
  });
  it("preserves excess legacy actions intact in More", () => {
    const migrated = stripLayoutOf(undefined);
    expect(stripSlots(migrated)).toBeLessThanOrEqual(22);
    expect(migrated.filter((i) => !i.key && i.visible)).toHaveLength(
      DEFAULT_TOOLBAR_ITEMS.filter((item) => item.visible).length,
    );
    expect(stripLayoutOf(migrated)).toEqual(migrated);
  });
});

it("lets users remove Collapse and Fullscreen", () => {
  const items = stripLayoutOf(undefined);
  for (const id of ["fullscreen", "collapse-menu"] as const) {
    const index = items.findIndex((item) => item.id === id);
    expect(moveStripItem(items, index, "library").find((item) => item.id === id)?.visible).toBe(
      false,
    );
    expect(moveStripItem(items, index, "more").find((item) => item.id === id)?.group).toBe("more");
  }
  expect(stripSlots(items)).toBeLessThanOrEqual(22);
});

it("removes retired wheel and Intelligent Strip toggle actions", () => {
  const items = toolbarItemsOf([
    { id: "color-wheel", visible: true, group: "strip" },
    { id: "intelligent-strip", visible: true, group: "strip" },
  ]);
  expect(items.some((item) => String(item.id) === "intelligent-strip")).toBe(false);
  expect(items.some((item) => String(item.id) === "color-wheel")).toBe(false);
});
