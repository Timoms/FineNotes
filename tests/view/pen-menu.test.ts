/**
 * The pen-type menu is the only way to the highlighter without a keyboard:
 * the toolbar has no highlighter button, as in GoodNotes, where the
 * highlighter is a pen type. From 0.1.2 to 1.0.0 the menu showed only the
 * three pens, and the highlighter could not be picked on an iPad.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => import("./fake-obsidian"));

const { PEN_MENU_TYPES, penTypeFor } = await import("../../src/view/toolbar");

describe("the pen-type menu", () => {
  it("offers the highlighter as well as the four pens", () => {
    expect(PEN_MENU_TYPES.map((spec) => spec.id)).toEqual([
      "fountain",
      "ball",
      "brush",
      "calligraphy",
      "highlighter",
    ]);
  });

  it("switches to the highlighter tool when the highlighter is chosen", () => {
    const highlighter = PEN_MENU_TYPES.find((spec) => spec.id === "highlighter");
    expect(highlighter).toMatchObject({ tool: "highlighter", label: "Highlighter" });
  });

  it("keeps the pen button's type in step with the highlighter tool", () => {
    expect(penTypeFor({ tool: "highlighter" } as never).id).toBe("highlighter");
    expect(penTypeFor({ tool: "pen" } as never).id).toBe("fountain");
  });
});

describe("saved pens on the toolbar (FineNotes#24, #25)", () => {
  async function toolbar(tool: string, practice = false) {
    const { Toolbar } = await import("../../src/view/toolbar");
    const calls: string[] = [];
    const state = { tool, color: "#000000", size: 3, pressureEnabled: false } as Record<
      string,
      unknown
    >;
    const bar = Object.assign(Object.create(Toolbar.prototype) as object, {
      state,
      practice,
      mainPen: { type: "fountain", color: "#000000", size: 3 },
      drawingTool: "pen",
      optionsTool: tool,
      optionsVisible: true,
      tuckedTools: new Set(),
      callbacks: {
        onColorChange: (c: string) => calls.push(`color(${c})`),
        onSizeChange: (s: number) => calls.push(`size(${s})`),
        onToolChange: (t: string) => calls.push(`tool(${t})`),
        onPressureToggle: (on: boolean) => calls.push(`pressure(${on})`),
        onPenTypeChange: (spec: { id: string }) => calls.push(`type(${spec.id})`),
        pressureAllowed: () => true,
      },
      buildOptions: () => calls.push("build"),
      syncActive: () => undefined,
    }) as unknown as InstanceType<typeof Toolbar>;
    return { bar, state, calls };
  }

  it("writes with a saved pen: its type, colour and width, leaving the eraser for it", async () => {
    const { bar, state, calls } = await toolbar("eraser");
    bar.applySavedPen({ type: "highlighter", color: "#fab005", size: 5 });
    expect(state).toMatchObject({
      tool: "highlighter",
      penType: "highlighter",
      color: "#fab005",
      size: 5,
      pressureEnabled: false,
    });
    expect(calls).toContain("color(#fab005)");
    expect(calls).toContain("size(5)");
    expect(calls).toContain("tool(highlighter)");
  });

  it("keeps the main pen and favorite pens independent", async () => {
    const { bar, state } = await toolbar("pen");
    state.penType = "fountain";
    state.penInks = {
      fountain: { color: "#1971c2", size: 5 },
    };

    bar.applySavedPen({ type: "ball", color: "#e03131", size: 2 });
    expect(state.penInks).toEqual({
      fountain: { color: "#1971c2", size: 5 },
    });

    bar.applySavedPen({ type: "brush", color: "#9c36b5", size: 3 });
    expect(state.penInks).toEqual({
      fountain: { color: "#1971c2", size: 5 },
    });
  });

  it.each([
    { favorite: { type: "ball" as const, color: "#e03131", size: 2 }, viaEraser: false },
    { favorite: { type: "ball" as const, color: "#e03131", size: 2 }, viaEraser: true },
    { favorite: { type: "highlighter" as const, color: "#fab005", size: 5 }, viaEraser: false },
    { favorite: { type: "highlighter" as const, color: "#fab005", size: 5 }, viaEraser: true },
  ])(
    "selects $favorite.type on the first pick and restores the main pen",
    async ({ favorite, viaEraser }) => {
      const { Toolbar } = await import("../../src/view/toolbar");
      const { bar, state } = await toolbar("pen");
      const mainPen = { type: "fountain" as const, color: "#1971c2", size: 3 };
      state.color = mainPen.color;
      state.penType = mainPen.type;
      const element = () => {
        const classes = new Set<string>();
        const attrs: Record<string, string> = {};
        const style: Record<string, string> = {};
        return {
          classes,
          attrs,
          style,
          disabled: false,
          empty: () => undefined,
          createSpan: () => ({
            setCssStyles: (values: Record<string, string>) => Object.assign(style, values),
            querySelector: () => null,
            empty: () => undefined,
            setText: () => undefined,
            addClass: () => undefined,
          }),
          toggleClass: (name: string, on: boolean) =>
            on ? classes.add(name) : classes.delete(name),
          removeClass: (name: string) => classes.delete(name),
          setAttribute: (name: string, value: string) => {
            attrs[name] = value;
          },
        };
      };
      const pen = element();
      const saved = element();
      const saved2 = element();
      const color = element();
      const closeColor = vi.fn(() => Object.assign(bar, { quickColorClose: null }));
      const build = vi.fn();
      const show = vi.fn();
      Object.assign(bar, {
        activeSavedPen: -1,
        mainPen,
        intelligentCollapsed: false,
        quickColorClose: closeColor,
        indicatorTool: "pen",
        toolButtons: new Map([["pen", pen]]),
        itemButtons: new Map([
          ["saved-pen-1", saved],
          ["saved-pen-2", saved2],
          ["colorwheel", color],
        ]),
        colorSwatches: new Map(),
        widthButtons: new Map(),
        eraserSizeButtons: new Map(),
        penTypeButtons: new Map(),
        shapeButtons: new Map(),
        callbacks: {
          savedPens: () => [favorite, favorite],
          onColorChange: vi.fn(),
          onSizeChange: vi.fn(),
          onToolChange: vi.fn(),
          onPressureToggle: vi.fn(),
          onPenTypeChange: () => bar.syncActive(),
          pressureAllowed: () => true,
        },
        syncActive: () => Toolbar.prototype.syncActive.call(bar),
        buildOptions: build,
        showOptions: show,
        closePopover: vi.fn(),
        fitBar: vi.fn(),
        placeIndicator: vi.fn(),
        toolPlaces: () => null,
        drawPenPreview: vi.fn(),
        drawLassoIcon: vi.fn(),
        drawEraserIcon: vi.fn(),
      });

      bar.applySavedPen(favorite, 1);
      expect(saved2.attrs["aria-pressed"]).toBe("true");
      expect(saved.attrs["aria-pressed"]).toBe("false");
      expect(color.disabled).toBe(true);
      expect(color.style.backgroundColor).toBe(mainPen.color);
      expect(pen.attrs["aria-pressed"]).toBe("false");
      expect(state).toMatchObject({ color: favorite.color, size: favorite.size });
      bar.applySavedPen(favorite, 0);
      bar.applySavedPen(favorite, 0);
      expect(saved.classes.has("is-active")).toBe(true);
      expect(saved.attrs["aria-pressed"]).toBe("true");
      expect(pen.classes.has("is-active")).toBe(false);
      expect(pen.attrs["aria-pressed"]).toBe("false");
      expect(color.disabled).toBe(true);
      expect(color.attrs["aria-label"]).toBe("Colorwheel locked by favorite pen");
      expect((bar as unknown as { intelligentCollapsed: boolean }).intelligentCollapsed).toBe(true);
      expect(show).not.toHaveBeenCalled();
      expect(closeColor).toHaveBeenCalled();

      const internal = bar as unknown as {
        setPenColor(color: string): void;
        setWidth(width: number): void;
        tapTool(tool: string, button: unknown): void;
      };
      internal.setPenColor("#000000");
      internal.setWidth(9);
      expect(state).toMatchObject({ color: favorite.color, size: favorite.size });

      if (viaEraser) {
        internal.tapTool("eraser", pen);
        state.tool = favorite.type === "highlighter" ? "highlighter" : "pen";
        bar.syncActive();
        expect(saved.attrs["aria-pressed"]).toBe("true");
        expect(color.disabled).toBe(true);
        expect(color.style.backgroundColor).toBe(mainPen.color);
      }
      internal.tapTool("pen", pen);
      expect(saved.attrs["aria-pressed"]).toBe("false");
      expect(pen.attrs["aria-pressed"]).toBe("true");
      expect(color.disabled).toBe(false);
      expect(state).toMatchObject({
        color: mainPen.color,
        size: mainPen.size,
        penType: mainPen.type,
      });
      expect(color.style.backgroundColor).toBe(mainPen.color);
      expect(show).not.toHaveBeenCalled();
    },
  );

  it("does not build pen options for a selected favorite", async () => {
    const { Toolbar } = await import("../../src/view/toolbar");
    const { bar } = await toolbar("pen");
    const buildPenOptions = vi.fn();
    const classes = new Set<string>();
    Object.assign(bar, {
      activeSavedPen: 0,
      intelligentCollapsed: true,
      favoriteHoldTimer: null,
      textTarget: null,
      textAnchor: null,
      optionsEl: {
        empty: vi.fn(),
        createDiv: () => ({ setAttribute: vi.fn() }),
        toggleClass: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
        removeClass: (name: string) => classes.delete(name),
      },
      colorSwatches: new Map(),
      widthButtons: new Map(),
      eraserSizeButtons: new Map(),
      penTypeButtons: new Map(),
      shapeButtons: new Map(),
      pillBox: () => null,
      stopPillMorph: vi.fn(),
      closePopover: vi.fn(),
      closeStripMore: vi.fn(),
      buildPenOptions,
      applyPosition: vi.fn(),
      morphPill: vi.fn(),
    });

    (Toolbar.prototype as unknown as { buildOptions(this: unknown): void }).buildOptions.call(bar);
    expect(buildPenOptions).not.toHaveBeenCalled();
    expect(classes.has("is-intelligent-hidden")).toBe(true);
  });

  it("gives each pen type its own colour and row, and brings them back", async () => {
    const { bar, state } = await toolbar("pen");
    const { PEN_TYPES } = await import("../../src/view/toolbar");
    const spec = (id: string) => PEN_TYPES.find((type) => type.id === id)!;
    const choose = (id: string) =>
      (bar as unknown as { choosePenType: (s: unknown) => void }).choosePenType(spec(id));
    state.penType = "fountain";
    state.color = "#1971c2";
    state.penColors = ["#1971c2", "#e03131"];
    choose("brush");
    // Never used, the brush starts with the fountain pen's ink.
    expect(state.color).toBe("#1971c2");
    state.color = "#9c36b5";
    state.penColors = ["#9c36b5"];
    choose("fountain");
    expect(state).toMatchObject({ color: "#1971c2", penColors: ["#1971c2", "#e03131"] });
    choose("brush");
    expect(state).toMatchObject({ color: "#9c36b5", penColors: ["#9c36b5"] });
    // The highlighter starts yellow and keeps its own from then on.
    choose("highlighter");
    expect(state.color).toBe("#fab005");
  });

  it("repaints the open pen menu's icons in each pen's colour", async () => {
    const { bar, state } = await toolbar("pen");
    const replaced: string[] = [];
    const row = (id: string) => ({
      isConnected: true,
      querySelector: () => ({ replaceWith: () => replaced.push(id) }),
      toggleClass: () => undefined,
    });
    Object.assign(bar, {
      popoverKind: "pens",
      penMenuRows: new Map([
        ["fountain", row("fountain")],
        ["highlighter", row("highlighter")],
      ]),
      toolButtons: new Map(),
      itemButtons: new Map(),
      colorSwatches: new Map(),
      widthButtons: new Map(),
      eraserSizeButtons: new Map(),
      penTypeButtons: new Map(),
      shapeButtons: new Map(),
      // A bar with no width yet: the tool change has nothing to fit (fitBar).
      barEl: { getBoundingClientRect: () => ({ width: 0 }) },
    });
    state.penType = "fountain";
    // Just enough of a document to build the icons.
    const element = (): unknown => ({ setAttribute: () => undefined, append: () => undefined });
    vi.stubGlobal("activeDocument", {
      createElementNS: element,
      body: { hasClass: () => false },
    });
    const { Toolbar } = await import("../../src/view/toolbar");
    Toolbar.prototype.syncActive.call(bar);
    vi.unstubAllGlobals();
    expect(replaced).toEqual(["fountain", "highlighter"]);
  });

  it("keeps the pressure for a pressure pen, and refuses the highlighter in a practice file", async () => {
    const { bar, state } = await toolbar("pen");
    bar.applySavedPen({ type: "fountain", color: "#1971c2", size: 5 });
    expect(state).toMatchObject({ tool: "pen", penType: "fountain", pressureEnabled: true });
    const practice = await toolbar("pen", true);
    practice.bar.applySavedPen({ type: "highlighter", color: "#fab005", size: 5 });
    expect(practice.calls).toEqual([]);
  });

  it("names the pen in hand as a saved pen would hold it", async () => {
    const { penOfState } = await import("../../src/view/toolbar");
    expect(penOfState({ tool: "highlighter", color: "#ff0000", size: 8 } as never)).toEqual({
      type: "highlighter",
      color: "#ff0000",
      size: 8,
    });
  });
});
