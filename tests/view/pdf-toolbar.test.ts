import { describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("./fake-obsidian"));
const { Toolbar } = await import("../../src/view/toolbar");
describe("PDF toolbar button", () => {
  it("places PDF after the media tools and wires the import action", () => {
    const importPdf = vi.fn();
    const buttons: Array<{
      label: string;
      parent: unknown;
      handler?: (button: unknown) => void;
      addClass: ReturnType<typeof vi.fn>;
    }> = [];
    const state = Object.assign(Object.create(Toolbar.prototype) as object, {
      callbacks: { onInsertImage: vi.fn(), onInsertPdf: importPdf },
      // A group makes the tool indicator as its first child.
      barEl: { createDiv: () => ({ createDiv: () => ({}) }) },
      addToolButton: vi.fn(() => ({ addClass: vi.fn(), dataset: {} })),
      itemButtons: new Map(),
      foldable: [],
      watchCrowding: vi.fn(),
      applyToolbarItems: vi.fn(),
      barButton: (
        parent: unknown,
        _icon: string,
        label: string,
        handler?: (button: unknown) => void,
      ) => {
        const button = {
          label,
          parent,
          handler,
          addClass: vi.fn(),
          setAttribute: vi.fn(),
          addEventListener: vi.fn(),
          dataset: {},
        };
        buttons.push(button);
        return button;
      },
    });
    (state as unknown as { buildBar(): void }).buildBar();
    const image = buttons.findIndex((button) => button.label === "Insert image");
    const sticker = buttons[image + 1];
    expect(sticker.label).toBe("Stickers");
    const pdf = buttons[image + 2];
    expect(pdf.label).toBe("Insert PDF");
    expect(pdf.parent).toBe(buttons[image].parent);
    expect(pdf.addClass).not.toHaveBeenCalledWith("clickable-icon");
    pdf.handler?.(pdf);
    expect(importPdf).toHaveBeenCalledWith(pdf);
  });
});

describe("Toolbar action state", () => {
  it("marks the active tool action", () => {
    const toggleClass = vi.fn(),
      setAttribute = vi.fn();
    const toolbar = Object.assign(Object.create(Toolbar.prototype) as object, {
      itemButtons: new Map([["pen", { toggleClass, setAttribute }]]),
    }) as unknown as InstanceType<typeof Toolbar>;
    toolbar.setActionActive("pen", true);
    expect(toggleClass).toHaveBeenLastCalledWith("is-active", true);
    expect(setAttribute).toHaveBeenLastCalledWith("aria-pressed", "true");
    toolbar.setActionActive("pen", false);
    expect(toggleClass).toHaveBeenLastCalledWith("is-active", false);
    expect(setAttribute).toHaveBeenLastCalledWith("aria-pressed", "false");
  });
});

describe("calculator and pencil-menu active state", () => {
  it("sets and clears both highlights and accessible pressed states", () => {
    const calculator = { toggleClass: vi.fn(), setAttribute: vi.fn() };
    const pencil = { toggleClass: vi.fn(), setAttribute: vi.fn() };
    const toolbar = Object.assign(Object.create(Toolbar.prototype) as object, {
      itemButtons: new Map([["calculator", calculator]]),
      penMenuButton: pencil,
    }) as unknown as InstanceType<typeof Toolbar>;
    for (const active of [true, false]) {
      toolbar.setCalculatorActive(active);
      toolbar.setPenMenuActive(active);
      for (const button of [calculator, pencil]) {
        expect(button.toggleClass).toHaveBeenLastCalledWith("is-active", active);
        expect(button.setAttribute).toHaveBeenLastCalledWith("aria-pressed", String(active));
      }
    }
  });
});

describe("math symbols and writing-mode buttons", () => {
  it("reflects active states for each action, including controls placed in More", () => {
    const ids = ["math-symbols", "no-touch", "fullscreen"] as const;
    const buttons = new Map(ids.map((id) => [id, { toggleClass: vi.fn(), setAttribute: vi.fn() }]));
    const toolbar = Object.assign(Object.create(Toolbar.prototype) as object, {
      itemButtons: buttons,
    }) as unknown as InstanceType<typeof Toolbar>;
    for (const id of ids) {
      for (const active of [true, false]) {
        toolbar.setActionActive(id, active);
        expect(buttons.get(id)!.toggleClass).toHaveBeenLastCalledWith("is-active", active);
        expect(buttons.get(id)!.setAttribute).toHaveBeenLastCalledWith(
          "aria-pressed",
          String(active),
        );
      }
    }
  });
});
