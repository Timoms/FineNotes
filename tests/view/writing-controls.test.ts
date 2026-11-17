import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("../fakes/obsidian"));
import { FakeEl } from "../fakes/obsidian";
const { WritingControls } = await import("../../src/view/writing-controls");

class FullscreenDocument extends EventTarget {
  fullscreenElement: HTMLElement | null = null;
  exitFullscreen = vi.fn(async () => {
    this.fullscreenElement = null;
    this.dispatchEvent(new Event("fullscreenchange"));
  });
}

function controls(showArrows = true, native = true, dock = false) {
  const doc = new FullscreenDocument();
  const root = Object.assign(new FakeEl(), {
    ownerDocument: doc,
    requestFullscreen: native
      ? vi.fn(async () => {
          doc.fullscreenElement = root as unknown as HTMLElement;
          doc.dispatchEvent(new Event("fullscreenchange"));
        })
      : undefined,
  });
  const overlay = new FakeEl();
  const bar = root.createDiv({ cls: "test-menu-bar" });
  const callbacks = { lockTouch: vi.fn(), scroll: vi.fn(), fitPage: vi.fn(), changed: vi.fn() };
  const modes = new WritingControls(
    root as unknown as HTMLElement,
    overlay as unknown as HTMLElement,
    showArrows,
    callbacks,
    dock ? (bar as unknown as HTMLElement) : undefined,
  );
  return { root, overlay, doc, callbacks, modes, bar };
}

afterEach(() => vi.useRealTimers());

describe("writing modes", () => {
  it("keeps an exit available if native fullscreen is rejected", async () => {
    const { modes, root } = controls();
    root.requestFullscreen!.mockRejectedValueOnce(new Error("Fullscreen unavailable"));
    modes.setDistractionFree(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(root.hasClass("is-distraction-free")).toBe(true);
    root.find("finenotes-x-writing-exit")!.dispatch("click");
    expect(root.hasClass("is-distraction-free")).toBe(false);
    modes.destroy();
  });

  it("orders Up, Unlock, Fit page, Down and requires two taps per action", () => {
    vi.useFakeTimers();
    const { modes, overlay, callbacks } = controls();
    modes.setScrollLocked(true);
    const pad = overlay.find("finenotes-x-scroll-controls")!;
    expect(pad.children.map((el) => [...el.classes].find((cls) => cls.startsWith("is-")))).toEqual([
      "is-up",
      "is-unlock",
      "is-fit",
      "is-down",
    ]);
    const tap = (button: FakeEl) => button.dispatch("click", { detail: 0 });
    for (const direction of ["up", "down"]) {
      const button = pad.find(`is-${direction}`)!;
      callbacks.scroll.mockClear();
      tap(button);
      expect(button.hasClass("is-armed")).toBe(true);
      expect(callbacks.scroll).not.toHaveBeenCalled();
      tap(button);
      expect(button.hasClass("is-confirmed")).toBe(true);
      vi.advanceTimersByTime(160);
      expect(callbacks.scroll).toHaveBeenCalledExactlyOnceWith(direction);
      expect(button.hasClass("is-confirmed")).toBe(false);
    }
    const fit = pad.find("is-fit")!;
    tap(fit);
    tap(fit);
    vi.advanceTimersByTime(160);
    expect(callbacks.fitPage).toHaveBeenCalledTimes(1);
    const unlock = pad.find("is-unlock")!;
    tap(unlock);
    expect(modes.scrollLocked).toBe(true);
    tap(unlock);
    vi.advanceTimersByTime(160);
    expect(modes.scrollLocked).toBe(false);
    expect(pad.hasClass("is-hidden")).toBe(true);
    modes.destroy();
  });

  it("switches arrow directions with notebook orientation", () => {
    vi.useFakeTimers();
    const { modes, overlay, callbacks } = controls();
    modes.setScrollLocked(true);
    modes.setScrollDirection("horizontal");
    const up = overlay.find("is-up")!,
      down = overlay.find("is-down")!;
    expect(up.attrs["aria-label"]).toContain("Left");
    expect(down.attrs["aria-label"]).toContain("Right");
    for (const [button, direction] of [
      [up, "left"],
      [down, "right"],
    ] as const) {
      button.dispatch("click", { detail: 0 });
      button.dispatch("click", { detail: 0 });
      vi.advanceTimersByTime(160);
      expect(callbacks.scroll).toHaveBeenLastCalledWith(direction);
    }
    modes.setScrollDirection("vertical");
    expect(up.attrs["aria-label"]).toContain("Up");
    modes.destroy();
  });

  it("expires the first tap and never combines taps on different controls", () => {
    vi.useFakeTimers();
    const { modes, overlay, callbacks } = controls();
    modes.setScrollLocked(true);
    const pad = overlay.find("finenotes-x-scroll-controls")!;
    const up = pad.find("is-up")!,
      down = pad.find("is-down")!;
    const tap = (button: FakeEl) => button.dispatch("click", { detail: 0 });
    tap(up);
    vi.advanceTimersByTime(1500);
    expect(up.hasClass("is-armed")).toBe(false);
    tap(up);
    tap(down);
    expect(up.hasClass("is-armed")).toBe(false);
    expect(callbacks.scroll).not.toHaveBeenCalled();
    tap(down);
    modes.setShowArrows(false);
    vi.advanceTimersByTime(200);
    expect(callbacks.scroll).not.toHaveBeenCalled();
    modes.destroy();
  });

  it("can hide the crosshair without turning off scroll prevention", () => {
    const { modes, overlay } = controls(false);
    modes.setScrollLocked(true);
    const pad = overlay.find("finenotes-x-scroll-controls")!;
    expect(modes.scrollLocked).toBe(true);
    expect(pad.hasClass("is-hidden")).toBe(true);
    modes.setShowArrows(true);
    expect(pad.hasClass("is-hidden")).toBe(false);
    modes.setShowArrows(false);
    modes.setScrollLocked(false);
    expect(modes.scrollLocked).toBe(false);
    modes.destroy();
  });

  it("enters fullscreen and restores navigation after native Escape exits", async () => {
    const { modes, doc, root } = controls();
    modes.setDistractionFree(true);
    await Promise.resolve();
    expect(root.hasClass("is-distraction-free")).toBe(true);
    expect(doc.fullscreenElement).toBe(root);
    expect(root.find("finenotes-x-writing-exit")!.hasClass("is-hidden")).toBe(false);
    await doc.exitFullscreen();
    expect(modes.distractionFree).toBe(false);
    expect(root.hasClass("is-distraction-free")).toBe(false);
    modes.destroy();
  });

  it("has working exits when only full-window mode is available", () => {
    const { modes, root, doc } = controls(true, false);
    modes.setDistractionFree(true);
    root.find("finenotes-x-writing-exit")!.dispatch("click");
    expect(modes.distractionFree).toBe(false);
    modes.setDistractionFree(true);
    doc.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "Escape" }));
    expect(modes.distractionFree).toBe(false);
    modes.destroy();
  });

  it("cleans up fullscreen and restores navigation when a notebook closes", async () => {
    const { modes, root, doc } = controls();
    modes.setDistractionFree(true);
    await Promise.resolve();
    modes.destroy();
    expect(doc.exitFullscreen).toHaveBeenCalledOnce();
    expect(root.hasClass("is-distraction-free")).toBe(false);
    expect(root.find("finenotes-x-writing-exit")).toBeUndefined();
  });
});

describe("fullscreen menu strip", () => {
  it("toggles the menu without leaving fullscreen, requests a sheet fit, and resets on exit", () => {
    const { modes, root, callbacks } = controls(true, false);
    modes.setDistractionFree(true);
    const toggle = root.find("finenotes-x-writing-menu-toggle")!;
    expect(toggle.hasClass("is-hidden")).toBe(false);
    expect(root.hasClass("is-fullscreen-menu-visible")).toBe(true);
    toggle.dispatch("click");
    expect(modes.distractionFree).toBe(true);
    expect(root.hasClass("is-fullscreen-menu-visible")).toBe(false);
    expect(callbacks.changed).toHaveBeenLastCalledWith(true);
    toggle.dispatch("click");
    expect(root.hasClass("is-fullscreen-menu-visible")).toBe(true);
    modes.setMenuVisible(true);
    modes.setDistractionFree(false);
    expect(root.hasClass("is-fullscreen-menu-visible")).toBe(false);
    expect(toggle.hasClass("is-hidden")).toBe(true);
    modes.destroy();
  });
});

describe("fullscreen controls dock", () => {
  it("moves restore and collapse into the visible bar and returns them to the corner when hidden", () => {
    const { root, modes, bar } = controls(true, false, true);
    modes.setDistractionFree(true);
    const restore = root.find("finenotes-x-writing-exit")!;
    const toggle = root.find("finenotes-x-writing-menu-toggle")!;
    expect(restore.parent).toBe(bar);
    modes.setMenuVisible(true);
    expect(restore.parent).toBe(bar);
    expect(toggle.parent).toBe(bar);
    expect(toggle.hasClass("is-docked")).toBe(true);
    toggle.dispatch("click");
    expect(modes.menuVisible).toBe(false);
    expect(restore.parent).toBe(root);
    expect(toggle.parent).toBe(root);
    expect(toggle.hasClass("is-docked")).toBe(false);
    modes.setMenuVisible(true);
    restore.dispatch("click");
    expect(modes.distractionFree).toBe(false);
    expect(restore.hasClass("is-hidden")).toBe(true);
    expect(bar.children).toHaveLength(0);
    modes.destroy();
  });
});
