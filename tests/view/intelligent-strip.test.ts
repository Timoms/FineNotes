import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("obsidian", () => import("../fakes/obsidian"));
import { FakeEl } from "../fakes/obsidian";
const { Toolbar } = await import("../../src/view/toolbar");
afterEach(() => vi.unstubAllGlobals());
const make = () => {
  const root = new FakeEl("div", { cls: "is-intelligent-strip" });
  const toolbar = Object.assign(Object.create(Toolbar.prototype), {
    optionsEl: root,
    barEl: new FakeEl(),
    itemButtons: new Map(),
    intelligentCollapsed: false,
    applyPosition: vi.fn(),
    popover: null,
    popoverKind: null,
    stripMore: null,
    submenuAnchor: null,
    intelligentDispose: null,
  });
  return { root, toolbar };
};
describe("Intelligent Strip", () => {
  it("collapses and reopens from tool controls", () => {
    const { root, toolbar } = make();
    const toggle = new FakeEl("button");
    toolbar.itemButtons.set("pen", toggle);
    toolbar.setIntelligentVisible(false);
    expect(root.hasClass("is-intelligent-hidden")).toBe(true);
    expect(toolbar.optionsVisible).toBe(false);
    toolbar.openPopover("ruler", new FakeEl());
    expect(root.hasClass("is-intelligent-hidden")).toBe(false);
    expect(toolbar.optionsVisible).toBe(true);
  });
  it("does not apply legacy floating geometry to attached details", () => {
    const { toolbar } = make();
    toolbar.openPopover("ruler", new FakeEl());
    // No host or anchor geometry is needed for a detail inside the dock.
    expect(() => toolbar.keepPopoverInside(new FakeEl())).not.toThrow();
    expect(toolbar.popover.hasClass("is-side-popover")).toBe(false);
  });
  it("places the strip beside a vertical bar and below a horizontal bar", () => {
    const { toolbar, root } = make();
    toolbar.host = {
      getBoundingClientRect: () => ({ top: 0, right: 1000, width: 1000, height: 800 }),
    };
    toolbar.barEl.getBoundingClientRect = () => ({ top: 100, bottom: 700, left: 922, right: 990 });
    Object.assign(root, { offsetHeight: 200 });
    vi.stubGlobal("getComputedStyle", () => ({ flexDirection: "column" }));
    try {
      toolbar.placePill();
      expect(root.style.right).toBe("84px");
      expect(root.style.top).toBe("300px");
      vi.stubGlobal("getComputedStyle", () => ({ flexDirection: "row" }));
      toolbar.barEl.getBoundingClientRect = () => ({ top: 0, bottom: 60, left: 0, right: 1000 });
      toolbar.placePill();
      expect(root.style.right).toBe("360px");
      expect(root.style.top).toBe("66px");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("aligns the strip with the selected vertical tool", () => {
    const { toolbar, root } = make();
    const active = toolbar.barEl.createEl("button", { cls: "finenotes-x-tool is-active" });
    toolbar.host = {
      getBoundingClientRect: () => ({ top: 0, right: 1000, width: 1000, height: 800 }),
    };
    toolbar.barEl.getBoundingClientRect = () => ({ top: 100, bottom: 700, left: 922, right: 990 });
    toolbar.barEl.querySelector = () => active;
    active.getBoundingClientRect = () => ({ top: 220, left: 922, right: 990 });
    Object.assign(root, { offsetHeight: 200 });
    vi.stubGlobal("getComputedStyle", () => ({ flexDirection: "column" }));
    try {
      toolbar.placePill();
      expect(root.style.top).toBe("220px");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("prefers a transient panel's own button over the selected tool", () => {
    const { toolbar, root } = make();
    const selected = new FakeEl("button"),
      more = new FakeEl("button");
    toolbar.host = {
      getBoundingClientRect: () => ({ top: 0, right: 1000, width: 1000, height: 800 }),
    };
    toolbar.barEl.getBoundingClientRect = () => ({ top: 100, bottom: 700, left: 922, right: 990 });
    toolbar.barEl.querySelector = () => selected;
    selected.getBoundingClientRect = () => ({ top: 180, bottom: 224, left: 922, right: 990 });
    more.getBoundingClientRect = () => ({ top: 460, bottom: 504, left: 922, right: 990 });
    toolbar.intelligentAnchor = more;
    Object.assign(root, { offsetHeight: 200 });
    vi.stubGlobal("getComputedStyle", () => ({ flexDirection: "column" }));
    try {
      toolbar.placePill();
      expect(root.style.top).toBe("460px");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("mounts nested settings inside the strip and returns to the toolkit", () => {
    const { root, toolbar } = make();
    const body = toolbar.openPopover("pens", new FakeEl());
    expect(body.parentElement?.parentElement).toBe(root);
    expect(root.hasClass("has-strip-detail")).toBe(true);
    toolbar.closePopover();
    expect(root.hasClass("has-strip-detail")).toBe(false);
    expect(root.children).toHaveLength(0);
  });
  it("hides pen tools after the ruler options close", () => {
    const { root, toolbar } = make();
    toolbar.openPopover("ruler", new FakeEl());
    toolbar.closePopover();
    expect(toolbar.optionsVisible).toBe(false);
    expect(root.hasClass("is-intelligent-hidden")).toBe(true);
  });
  it("hides the last toolkit after More closes", () => {
    const { root, toolbar } = make();
    toolbar.optionsVisible = true;
    toolbar.stripMore = root.createDiv({ cls: "is-strip-detail" });
    toolbar.closeStripMore();
    expect(toolbar.optionsVisible).toBe(false);
    expect(root.hasClass("is-intelligent-hidden")).toBe(true);
  });
  it("cleans up embedded tools when another tool replaces them", () => {
    const { toolbar } = make(),
      dispose = vi.fn();
    toolbar.openIntelligentTool("calculator", "Calculator", dispose);
    toolbar.openPopover("eraser-filter", new FakeEl());
    expect(dispose).toHaveBeenCalledOnce();
    expect(toolbar.popoverKind).toBe("eraser-filter");
  });
  it("reports when an external tool was closed", () => {
    const { root, toolbar } = make();
    toolbar.openIntelligentTool("stickers", "Stickers", vi.fn());
    expect(root.find("finenotes-x-strip-back")).toBeUndefined();
    expect(toolbar.closeIntelligentTool("stickers")).toBe(true);
    expect(toolbar.optionsVisible).toBe(false);
    expect(root.hasClass("is-intelligent-hidden")).toBe(true);
    expect(toolbar.closeIntelligentTool("stickers")).toBe(false);
  });
  it("hides the toolkit when drawing resumes", () => {
    vi.stubGlobal("window", globalThis);
    const { root, toolbar } = make();
    toolbar.optionsVisible = true;
    toolbar.openPopover("widths", new FakeEl());
    toolbar.dismissDrawingPopouts();
    expect(toolbar.optionsVisible).toBe(false);
    expect(root.hasClass("is-intelligent-hidden")).toBe(true);
    expect(root.hasClass("is-collapsed")).toBe(false);
    expect(toolbar.popover).toBeNull();
  });
});
