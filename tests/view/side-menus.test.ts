import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("./fake-obsidian"));
const { Toolbar } = await import("../../src/view/toolbar");
afterEach(() => vi.unstubAllGlobals());

describe("right-hand toolbar panels", () => {
  it("places a submenu left of the rail and clamps a low anchor above the bottom", () => {
    vi.stubGlobal("getComputedStyle", () => ({ flexDirection: "column" }));
    const styles = vi.fn();
    const popover = {
      getBoundingClientRect: () => ({ left: 900, right: 1120 }),
      offsetWidth: 220,
      offsetHeight: 300,
      addClass: vi.fn(),
      hasClass: () => false,
      setCssStyles: styles,
    };
    const toolbar = Object.assign(Object.create(Toolbar.prototype), {
      popover,
      host: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }) },
      barEl: { getBoundingClientRect: () => ({ left: 920 }) },
    });
    toolbar.keepPopoverInside({ getBoundingClientRect: () => ({ top: 570 }) });
    expect(styles).toHaveBeenCalledWith(
      expect.objectContaining({ left: "696px", top: "290px", maxHeight: "580px" }),
    );
  });
  it("attaches nested controls to the left of their options bar", () => {
    vi.stubGlobal("getComputedStyle", () => ({ flexDirection: "column" }));
    const styles = vi.fn();
    const toolbar = Object.assign(Object.create(Toolbar.prototype), {
      popover: {
        getBoundingClientRect: () => ({ left: 0, right: 200 }),
        offsetWidth: 200,
        offsetHeight: 220,
        addClass: vi.fn(),
        hasClass: () => false,
        setCssStyles: styles,
      },
      host: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800 }) },
      barEl: { getBoundingClientRect: () => ({ left: 920 }) },
    });
    toolbar.keepPopoverInside({
      getBoundingClientRect: () => ({ top: 100 }),
      closest: () => ({ getBoundingClientRect: () => ({ left: 840 }) }),
    });
    expect(styles).toHaveBeenCalledWith(expect.objectContaining({ left: "636px", top: "100px" }));
  });
  it("hides open options when drawing resumes", () => {
    const toolbar = Object.assign(Object.create(Toolbar.prototype), {
      optionsVisible: true,
      popover: {},
      stripMore: {},
      showOptions: vi.fn(),
      closePopover: vi.fn(),
      closeStripMore: vi.fn(),
    });
    toolbar.dismissDrawingPopouts();
    expect(toolbar.optionsVisible).toBe(false);
    expect(toolbar.showOptions).toHaveBeenCalledWith(false);
    expect(toolbar.closePopover).toHaveBeenCalledOnce();
    expect(toolbar.closeStripMore).toHaveBeenCalledOnce();
  });
  it("selects each eraser mode and keeps its options tucked until tapped again", () => {
    const callbacks = { onEraserChange: vi.fn(), onToolChange: vi.fn() };
    const toolbar = Object.assign(Object.create(Toolbar.prototype), {
      state: { tool: "pen" },
      callbacks,
      buildOptions: vi.fn(),
      syncActive: vi.fn(),
    });
    for (const mode of ["standard", "stroke", "ruled"]) {
      toolbar.activateEraser(mode);
      expect(toolbar.state.tool).toBe("eraser");
      expect(toolbar.state.eraserMode).toBe(mode);
      expect(toolbar.optionsVisible).toBe(false);
      expect(callbacks.onToolChange).toHaveBeenLastCalledWith("eraser");
    }
    expect(toolbar.buildOptions).toHaveBeenCalledTimes(3);
  });
});

describe("custom submenu actions", () => {
  it("runs a stored action from the stable submenu anchor and toggles the submenu closed", () => {
    const nodes: Array<{ click?: () => void }> = [];
    const make = (): any => ({
      children: [],
      querySelector: () => ({ childElementCount: 1 }),
      addClass: vi.fn(),
      removeClass: vi.fn(),
      setAttribute: vi.fn(),
      toggleClass: vi.fn(),
      createEl: (_tag: string, _options: unknown) => {
        const child = make();
        nodes.push(child);
        return child;
      },
      createDiv: () => make(),
      addEventListener: (event: string, handler: () => void) => {
        if (event === "click") nodes.at(-1)!.click = handler;
      },
    });
    const source = { disabled: false, hasClass: () => true, click: vi.fn() };
    const run = vi.fn(),
      anchor = make(),
      body = make();
    const toolbar = Object.assign(Object.create(Toolbar.prototype), {
      stripItems: [{ id: "pen", visible: true, group: "strip", container: "sub" }],
      itemButtons: new Map([["pen", source]]),
      foldable: [{ button: source, run }],
      closePopover: vi.fn(),
      openPopover: vi.fn(() => body),
      keepPopoverInside: vi.fn(),
    });
    const choice = {
      id: "submenu",
      key: "sub",
      name: "Drawing",
      icon: "palette",
      visible: true,
      group: "strip",
    };
    toolbar.toggleCustomSubmenu(choice, anchor);
    expect(anchor.setAttribute).toHaveBeenCalledWith("aria-expanded", "true");
    nodes[0].click?.();
    expect(run).toHaveBeenCalledWith(anchor);
    expect(source.click).not.toHaveBeenCalled();
    toolbar.popoverKind = "submenu-sub";
    toolbar.toggleCustomSubmenu(choice, anchor);
    expect(toolbar.openPopover).toHaveBeenCalledTimes(1);
    expect(toolbar.closePopover).toHaveBeenCalledTimes(2);
  });
});
