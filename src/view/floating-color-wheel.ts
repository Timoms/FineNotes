import { setIcon } from "obsidian";
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, type Hsv } from "../model/colors";
import { wheelColor, wheelPosition, wheelPins, wheelSwatches } from "../model/color-wheel";

/** A persistent, movable picker; only its handle moves it, and it never takes page input. */
export class FloatingColorWheel {
  private readonly root: HTMLElement;
  private readonly disk: HTMLElement;
  private readonly marker: HTMLElement;
  private readonly orbit: HTMLElement;
  private readonly swatches: HTMLElement[] = [];
  private readonly brightness: HTMLInputElement;
  private readonly hex: HTMLElement;
  private hsv: Hsv;
  private active: string;
  private position: { x: number; y: number };
  private shown = false;
  private picking = false;
  private holdTimer: number | null = null;
  private readonly resize: ResizeObserver | null;

  constructor(
    private readonly host: HTMLElement,
    private readonly callbacks: {
      onOpenChange?: (open: boolean) => void;
      current: () => string;
      recent: () => readonly string[];
      pins?: () => unknown;
      savePins?: (pins: (string | null)[]) => void;
      pick: (color: string) => void;
      moved: (position: { x: number; y: number }) => void;
    },
    position?: unknown,
  ) {
    this.active = callbacks.current();
    this.hsv = rgbToHsv(hexToRgb(this.active) ?? { r: 0, g: 0, b: 0 });
    this.position = wheelPosition(position);
    this.root = host.createDiv({
      cls: "finenotes-x-floating-color-wheel is-hidden",
      attr: { role: "region", "aria-label": "Movable pen color wheel" },
    });
    this.root.addEventListener("pointerdown", (event) => event.stopPropagation());
    this.root.addEventListener("keydown", (event) => event.stopPropagation());
    const head = this.root.createDiv({ cls: "finenotes-x-wheel-head" });
    const grip = head.createEl("button", {
      cls: "finenotes-x-wheel-grip clickable-icon",
      attr: {
        "aria-label": "Move color wheel; arrow keys move it",
        title: "Drag to move color wheel",
      },
    });
    setIcon(grip, "grip-horizontal");
    head.createSpan({ text: "Pen color" });
    const close = head.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": "Close color wheel" },
    });
    setIcon(close, "x");
    close.addEventListener("click", () => this.toggle(false));
    this.orbit = this.root.createDiv({ cls: "finenotes-x-wheel-orbit" });
    this.disk = this.orbit.createDiv({
      cls: "finenotes-x-wheel-disk",
      attr: {
        role: "slider",
        tabindex: "0",
        "aria-label": "Hue and saturation: left/right changes hue, up/down changes saturation",
        "aria-valuemin": "0",
        "aria-valuemax": "360",
      },
    });
    this.marker = this.disk.createDiv({ cls: "finenotes-x-wheel-marker" });
    const footer = this.root.createDiv({ cls: "finenotes-x-wheel-footer" });
    const label = footer.createEl("label", { text: "Brightness" });
    this.brightness = label.createEl("input", {
      type: "range",
      attr: { min: "0", max: "100", "aria-label": "Color brightness" },
    });
    this.brightness.addEventListener("input", () => {
      this.hsv.v = Number(this.brightness.value) / 100;
      this.paint();
    });
    this.brightness.addEventListener("change", () => this.commit());
    this.hex = footer.createEl("output", { attr: { "aria-label": "Selected pen color" } });
    this.bindDisk();
    this.bindGrip(grip);
    this.resize =
      typeof ResizeObserver === "function" ? new ResizeObserver(() => this.place()) : null;
    this.resize?.observe(host);
    this.refresh();
  }
  toggle(shown = !this.shown): void {
    this.clearHold();
    this.shown = shown;
    this.callbacks.onOpenChange?.(shown);
    this.root.toggleClass("is-hidden", !shown);
    if (shown) {
      this.refresh();
      this.place();
    }
  }
  refresh(): void {
    this.clearHold();
    const color = this.callbacks.current();
    if (color !== this.active && !this.picking) {
      this.active = color;
      this.hsv = rgbToHsv(hexToRgb(color) ?? { r: 0, g: 0, b: 0 });
    }
    for (const swatch of this.swatches) swatch.remove();
    this.swatches.length = 0;
    const recent = wheelSwatches(
      [this.active, ...this.callbacks.recent()],
      this.callbacks.pins?.(),
    );
    recent.forEach(({ color, slot, locked }) => {
      const angle = -Math.PI / 2 + (slot * Math.PI * 2) / 8;
      const swatch = this.orbit.createEl("button", {
        cls: "finenotes-x-wheel-swatch clickable-icon",
        attr: {
          "aria-label": `Use recent pen color ${color}`,
          title: `${color} — hold to ${locked ? "unlock" : "lock"}; press L when focused`,
          "aria-pressed": String(color === this.active),
        },
      });
      this.swatches.push(swatch);
      swatch.setCssStyles({
        left: `${50 + 40 * Math.cos(angle)}%`,
        top: `${50 + 40 * Math.sin(angle)}%`,
      });
      swatch.createSpan().setCssStyles({ backgroundColor: color });
      swatch.toggleClass("is-locked", locked);
      swatch.setAttribute(
        "aria-label",
        `${locked ? "Locked" : "Recent"} pen color ${color}; hold or press L to ${locked ? "unlock" : "lock"}`,
      );
      if (locked) setIcon(swatch.createSpan({ cls: "finenotes-x-wheel-swatch-lock" }), "lock");
      let held = false;
      let start: { id: number; x: number; y: number } | null = null;
      const toggleLock = (): void => {
        const pins = wheelPins(this.callbacks.pins?.());
        pins[slot] = locked ? null : color;
        this.callbacks.savePins?.(pins);
        this.refresh();
      };
      swatch.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        this.clearHold();
        held = false;
        start = { id: event.pointerId, x: event.clientX, y: event.clientY };
        swatch.setPointerCapture(event.pointerId);
        this.holdTimer = window.setTimeout(() => {
          this.holdTimer = null;
          held = true;
          toggleLock();
        }, 650);
      });
      swatch.addEventListener("pointermove", (event) => {
        if (
          start?.id === event.pointerId &&
          Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
        ) {
          this.clearHold();
          held = true;
        }
      });
      swatch.addEventListener("pointerup", () => {
        this.clearHold();
        start = null;
      });
      swatch.addEventListener("pointercancel", () => {
        this.clearHold();
        start = null;
        held = true;
      });
      swatch.addEventListener("contextmenu", (event) => event.preventDefault());
      swatch.addEventListener("keydown", (event) => {
        if (event.key.toLowerCase() === "l") {
          event.preventDefault();
          toggleLock();
        }
      });
      swatch.addEventListener("click", () => {
        if (held) return;
        this.hsv = rgbToHsv(hexToRgb(color)!);
        this.commit();
      });
    });
    this.paint();
  }
  private clearHold(): void {
    if (this.holdTimer !== null) window.clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }
  destroy(): void {
    this.callbacks.onOpenChange?.(false);
    this.clearHold();
    this.resize?.disconnect();
    this.root.remove();
  }
  private paint(): void {
    const hex = rgbToHex(hsvToRgb(this.hsv));
    this.disk.setCssProps({ "--wheel-darkness": String(1 - this.hsv.v) });
    const angle = (this.hsv.h * Math.PI) / 180;
    this.marker.setCssStyles({
      left: `${50 + 50 * this.hsv.s * Math.cos(angle)}%`,
      top: `${50 + 50 * this.hsv.s * Math.sin(angle)}%`,
      backgroundColor: hex,
    });
    this.disk.setAttribute("aria-valuenow", String(Math.round(this.hsv.h)));
    this.disk.setAttribute("aria-valuetext", `${hex}, saturation ${Math.round(this.hsv.s * 100)}%`);
    this.brightness.value = String(Math.round(this.hsv.v * 100));
    this.hex.setText(hex);
    this.hex.setCssStyles({ borderColor: hex });
  }
  private commit(): void {
    this.active = rgbToHex(hsvToRgb(this.hsv));
    this.callbacks.pick(this.active);
    this.refresh();
  }
  private bindDisk(): void {
    let pointer: number | null = null;
    const read = (event: PointerEvent): void => {
      const box = this.disk.getBoundingClientRect();
      // Black has no visible hue; the first colorful pick raises its brightness.
      this.hsv = wheelColor(
        (event.clientX - box.left - box.width / 2) / (box.width / 2),
        (event.clientY - box.top - box.height / 2) / (box.height / 2),
        this.hsv.v || 1,
      );
      this.paint();
    };
    const before = (): void => {
      this.hsv = rgbToHsv(hexToRgb(this.active)!);
      this.paint();
    };
    this.disk.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.disk.focus({ preventScroll: true });
      pointer = event.pointerId;
      this.picking = true;
      this.disk.setPointerCapture(pointer);
      read(event);
    });
    this.disk.addEventListener("pointermove", (event) => {
      if (pointer === event.pointerId) read(event);
    });
    this.disk.addEventListener("pointerup", (event) => {
      if (pointer !== event.pointerId) return;
      read(event);
      pointer = null;
      this.picking = false;
      this.commit();
    });
    this.disk.addEventListener("pointercancel", () => {
      pointer = null;
      this.picking = false;
      before();
    });
    this.disk.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "ArrowLeft" || event.key === "ArrowRight")
        this.hsv.h = (this.hsv.h + (event.key === "ArrowRight" ? 3 : 357)) % 360;
      else
        this.hsv.s = Math.max(
          0,
          Math.min(1, this.hsv.s + (event.key === "ArrowUp" ? 0.05 : -0.05)),
        );
      this.hsv.v ||= 1;
      this.commit();
    });
  }
  private place(): void {
    if (!this.shown) return;
    const width = Math.max(0, this.host.clientWidth - this.root.offsetWidth - 16);
    const height = Math.max(0, this.host.clientHeight - this.root.offsetHeight - 16);
    this.root.setCssStyles({
      left: `${8 + this.position.x * width}px`,
      top: `${8 + this.position.y * height}px`,
    });
  }
  private bindGrip(grip: HTMLElement): void {
    let drag: {
      id: number;
      x: number;
      y: number;
      left: number;
      top: number;
      before: { x: number; y: number };
    } | null = null;
    grip.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      grip.setPointerCapture(event.pointerId);
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: this.root.offsetLeft - 8,
        top: this.root.offsetTop - 8,
        before: { ...this.position },
      };
    });
    grip.addEventListener("pointermove", (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      this.position = wheelPosition({
        x:
          (drag.left + event.clientX - drag.x) /
          Math.max(1, this.host.clientWidth - this.root.offsetWidth - 16),
        y:
          (drag.top + event.clientY - drag.y) /
          Math.max(1, this.host.clientHeight - this.root.offsetHeight - 16),
      });
      this.place();
    });
    grip.addEventListener("pointerup", (event) => {
      if (drag?.id === event.pointerId) {
        drag = null;
        this.callbacks.moved(this.position);
      }
    });
    grip.addEventListener("pointercancel", () => {
      if (drag) this.position = drag.before;
      drag = null;
      this.place();
    });
    grip.addEventListener("keydown", (event) => {
      const delta = {
        ArrowLeft: [-0.04, 0],
        ArrowRight: [0.04, 0],
        ArrowUp: [0, -0.04],
        ArrowDown: [0, 0.04],
      }[event.key];
      if (!delta) return;
      event.preventDefault();
      this.position = wheelPosition({
        x: this.position.x + delta[0],
        y: this.position.y + delta[1],
      });
      this.place();
      this.callbacks.moved(this.position);
    });
  }
}
