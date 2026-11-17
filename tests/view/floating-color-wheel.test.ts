import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeEl } from "../fakes/obsidian";
vi.mock("obsidian", () => import("../fakes/obsidian"));
const { FloatingColorWheel } = await import("../../src/view/floating-color-wheel");

class WheelEl extends FakeEl {
  clientWidth = 800;
  clientHeight = 600;
  offsetWidth = 300;
  offsetHeight = 380;
  offsetLeft = 8;
  offsetTop = 8;
  focus(): void {}
  setPointerCapture(_id: number): void {}
  releasePointerCapture(_id: number): void {}
  override createEl(tag: string, info?: Parameters<FakeEl["createEl"]>[1]): WheelEl {
    const child = new WheelEl(tag, info);
    child.parent = this;
    this.children.push(child);
    return child;
  }
  override getBoundingClientRect() {
    return { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 };
  }
}
function setup() {
  const host = new WheelEl();
  let color = "#000000";
  let recent = ["#ff0000", "#00ff00"];
  let pins: (string | null)[] = [];
  const callbacks = {
    onOpenChange: vi.fn(),
    pins: () => pins,
    savePins: vi.fn((value: (string | null)[]) => {
      pins = value;
    }),
    current: () => color,
    recent: () => recent,
    pick: vi.fn((c: string) => {
      color = c;
      recent = [c, ...recent.filter((v) => v !== c)];
    }),
    moved: vi.fn(),
  };
  const wheel = new FloatingColorWheel(host as unknown as HTMLElement, callbacks);
  return { host, wheel, callbacks, root: host.find("finenotes-x-floating-color-wheel")! };
}
afterEach(() => vi.useRealTimers());
describe("floating color wheel", () => {
  it("reports open, close, and destruction so the toolbar reflects visibility", () => {
    const { wheel, callbacks } = setup();
    wheel.toggle();
    expect(callbacks.onOpenChange).toHaveBeenLastCalledWith(true);
    wheel.toggle(false);
    expect(callbacks.onOpenChange).toHaveBeenLastCalledWith(false);
    wheel.toggle();
    wheel.destroy();
    expect(callbacks.onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("pins a held swatch without selecting it and keeps its slot as recent colors change", () => {
    vi.useFakeTimers();
    const { wheel, root, callbacks } = setup();
    wheel.toggle();
    const red = root.findAll("finenotes-x-wheel-swatch")[1];
    red.dispatch("pointerdown", { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    vi.advanceTimersByTime(650);
    red.dispatch("pointerup");
    red.dispatch("click");
    expect(callbacks.pick).not.toHaveBeenCalled();
    expect(callbacks.savePins).toHaveBeenCalledTimes(1);
    expect(callbacks.pins()[1]).toBe("#ff0000");
    callbacks.pick("#123456");
    wheel.refresh();
    const pinned = root.find("is-locked")!;
    expect(pinned.attrs["aria-label"]).toContain("#ff0000");
    expect(pinned.style.left).toBe(red.style.left);
    pinned.dispatch("keydown", { key: "l" });
    expect(callbacks.pins()[1]).toBeNull();
    wheel.destroy();
  });
  it("cancels locking on movement, cancellation, closing, and destruction", () => {
    vi.useFakeTimers();
    const { wheel, root, callbacks } = setup();
    wheel.toggle();
    let swatch = root.findAll("finenotes-x-wheel-swatch")[0];
    const down = () =>
      swatch.dispatch("pointerdown", { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    down();
    swatch.dispatch("pointermove", { pointerId: 1, clientX: 30, clientY: 0 });
    vi.advanceTimersByTime(700);
    down();
    swatch.dispatch("pointercancel");
    vi.advanceTimersByTime(700);
    down();
    wheel.toggle(false);
    vi.advanceTimersByTime(700);
    wheel.toggle();
    swatch = root.findAll("finenotes-x-wheel-swatch")[0];
    down();
    wheel.destroy();
    vi.advanceTimersByTime(700);
    expect(callbacks.savePins).not.toHaveBeenCalled();
  });
  it("applies a recent color with one click and stays open", () => {
    const { wheel, root, callbacks } = setup();
    wheel.toggle();
    root.findAll("finenotes-x-wheel-swatch")[1].dispatch("click");
    expect(callbacks.pick).toHaveBeenCalledWith("#ff0000");
    expect(root.hasClass("is-hidden")).toBe(false);
    expect(root.findAll("finenotes-x-wheel-swatch")).toHaveLength(2);
  });
  it("previews a wheel drag and commits once on release, without starting page input", () => {
    const { wheel, host, root, callbacks } = setup();
    wheel.toggle();
    const pageDown = vi.fn();
    host.addEventListener("pointerdown", pageDown);
    const disk = root.find("finenotes-x-wheel-disk")!;
    disk.dispatch("pointerdown", { pointerId: 1, clientX: 100, clientY: 50 });
    disk.dispatch("pointermove", { pointerId: 1, clientX: 50, clientY: 100 });
    expect(pageDown).not.toHaveBeenCalled();
    expect(callbacks.pick).not.toHaveBeenCalled();
    disk.dispatch("pointerup", { pointerId: 1, clientX: 100, clientY: 50 });
    expect(callbacks.pick).toHaveBeenCalledExactlyOnceWith("#ff0000");
  });
  it("cancels a preview, supports keyboard color selection, and saves keyboard moves", () => {
    const { wheel, root, callbacks } = setup();
    wheel.toggle();
    const disk = root.find("finenotes-x-wheel-disk")!;
    disk.dispatch("pointerdown", { pointerId: 1, clientX: 100, clientY: 50 });
    disk.dispatch("pointercancel");
    expect(callbacks.pick).not.toHaveBeenCalled();
    disk.dispatch("keydown", { key: "ArrowRight" });
    expect(callbacks.pick).toHaveBeenCalledTimes(1);
    root.find("finenotes-x-wheel-grip")!.dispatch("keydown", { key: "ArrowLeft" });
    expect(callbacks.moved).toHaveBeenCalledWith({ x: 0.96, y: 0.3 });
    wheel.destroy();
    expect(root.parent).toBeNull();
  });
});
