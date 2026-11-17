import { describe, expect, it, vi } from "vitest";
import { FakeEl } from "../fakes/obsidian";

vi.mock("obsidian", () => import("./fake-obsidian"));

const { FloatingPenMenu } = await import("../../src/view/floating-pen-menu");

describe("the floating pen menu after an action", () => {
  function menu(hide: boolean) {
    const classes = new Set<string>();
    const calls: string[] = [];
    const value = Object.assign(Object.create(FloatingPenMenu.prototype) as object, {
      root: { addClass: (name: string) => classes.add(name) },
      callbacks: { hideAfterSelection: () => hide },
      collapse: () => calls.push("collapse"),
    }) as unknown as {
      finishSelection(): void;
    };
    return { value, classes, calls };
  }

  it("removes the whole control when the setting is on", () => {
    const { value, classes, calls } = menu(true);
    value.finishSelection();
    expect(calls).toEqual(["collapse"]);
    expect(classes.has("is-hidden")).toBe(true);
  });

  it("only collapses to the centre button when the setting is off", () => {
    const { value, classes, calls } = menu(false);
    value.finishSelection();
    expect(calls).toEqual(["collapse"]);
    expect(classes.has("is-hidden")).toBe(false);
  });
});

describe("the floating pen menu appearance", () => {
  it("keeps both writing toggles available with customised shortcuts and reflects their state", () => {
    const ring = new FakeEl();
    const run = vi.fn();
    const value = Object.assign(Object.create(FloatingPenMenu.prototype) as object, {
      root: new FakeEl(),
      ring,
      actions: ["pen"],
      modeButtons: new Map(),
      callbacks: { run, isActive: (action: string) => action === "prevent-scrolling" },
      finishSelection: vi.fn(),
    }) as unknown as { render(): void };
    value.render();
    expect(ring.children).toHaveLength(3);
    const lock = ring.find("finenotes-x-pen-companion-action-prevent-scrolling")!;
    expect(lock.attrs["aria-pressed"]).toBe("true");
    expect(lock.hasClass("is-active")).toBe(true);
    const focus = ring.find("finenotes-x-pen-companion-action-distraction-free")!;
    expect(focus.attrs["aria-pressed"]).toBe("false");
    focus.dispatch("click");
    expect(run).toHaveBeenCalledWith("distraction-free");
  });

  it("puts the current toolbar colour into the pen gradient", () => {
    const setProperty = vi.fn();
    const value = Object.assign(Object.create(FloatingPenMenu.prototype) as object, {
      root: { style: { setProperty } },
      callbacks: { activeColor: () => "#12abef" },
    }) as unknown as { syncAppearance(): void };
    value.syncAppearance();
    expect(setProperty).toHaveBeenCalledWith("--finenotes-pen-color", "#12abef");
  });
});
