import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("../fakes/obsidian"));
import { FakeEl } from "../fakes/obsidian";
import { installPencilHover, isPencilHover } from "../../src/view/pencil-hover";
import { Toolbar } from "../../src/view/toolbar";
afterEach(() => vi.useRealTimers());

describe("Toolbar hover", () => {
  it("shows a name tooltip without changing tools or opening options", () => {
    vi.useFakeTimers();
    const bar = new FakeEl(), host = new FakeEl();
    Object.assign(host, { getBoundingClientRect: () => ({ left:0, top:0, width:800, height:600 }) });
    const button = new FakeEl("button");
    Object.assign(button, { getAttribute: () => "Shapes", getBoundingClientRect: () => ({ left:100, right:144, top:0, bottom:44 }) });
    const toolbar = Object.assign(Object.create(Toolbar.prototype), { barEl:bar, host, disposers:[], buildOptions:vi.fn(), state:{ tool:"pen" } });
    vi.stubGlobal("getComputedStyle", () => ({ flexDirection:"row" }));
    toolbar.installToolHover();
    bar.dispatch("pointerover", { pointerType:"pen", buttons:0, pressure:0, target:{ closest:() => button } });
    vi.advanceTimersByTime(500);
    expect(host.find("finenotes-x-tool-tooltip")?.text).toBe("Shapes");
    expect(toolbar.buildOptions).not.toHaveBeenCalled();
    expect(toolbar.state.tool).toBe("pen");
    bar.dispatch("pointerout", { relatedTarget:null });
    expect(host.children).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});

describe("Pencil range feedback", () => {
  it("requires a pen with zero pressure and no pressed buttons", () => {
    expect(isPencilHover({ pointerType: "pen", pressure: 0, buttons: 0 })).toBe(true);
    for (const event of [
      { pointerType: "mouse", pressure: 0, buttons: 0 },
      { pointerType: "touch", pressure: 0, buttons: 0 },
      { pointerType: "pen", pressure: 0.1, buttons: 0 },
      { pointerType: "pen", pressure: 0, buttons: 1 },
    ])
      expect(isPencilHover(event)).toBe(false);
  });
  it("shows a stationary Pencil on entry and clears it when lifted out of range", () => {
    const host = new FakeEl();
    Object.assign(host, {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800 }),
      removeEventListener: vi.fn(),
    });
    const dispose = installPencilHover(
      host as unknown as HTMLElement,
      () => ({ tool: "pen", color: "#123456" }) as any,
    );
    const target = {
      closest: (selector: string) => (selector === ".finenotes-x-surface" ? host : null),
      matches: () => false,
    };
    const event = {
      target,
      pointerType: "pen",
      pressure: 0,
      buttons: 0,
      clientX: 100,
      clientY: 100,
    };
    host.dispatch("pointerover", event);
    const tip = host.find("finenotes-x-pencil-hover")!;
    expect(tip.hasClass("is-hidden")).toBe(false);
    host.dispatch("pointerout", { ...event, relatedTarget: null });
    expect(tip.hasClass("is-hidden")).toBe(true);
    host.dispatch("pointerover", event);
    host.dispatch("pointerdown", { ...event, buttons: 1 });
    expect(tip.hasClass("is-hidden")).toBe(true);
    vi.useFakeTimers();
    for (let i = 0; i < 21; i++) {
      host.dispatch("pointermove", event);
      if (i < 20) expect(tip.hasClass("is-hidden")).toBe(true);
      vi.advanceTimersByTime(100);
    }
    expect(tip.hasClass("is-hidden")).toBe(false);
    dispose();
    expect(host.children).toHaveLength(0);
  });
});
