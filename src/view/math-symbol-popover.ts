import { setIcon } from "obsidian";
import type { WindowPlace } from "../model/calculator-store";
import { MATH_SYMBOL_GROUPS } from "../model/math-symbols";
import { FloatingWindow } from "./floating-window";

export interface MathSymbolHost {
  place(symbol: string, at: { x: number; y: number } | null): void;
  practice(): void;
  loadPlace(): WindowPlace | null;
  savePlace(place: WindowPlace): void;
}

const MIN = { w: 280, h: 310 };

/** A movable symbol table whose cells can be tapped or dragged onto the paper. */
export class MathSymbolPopover {
  private readonly frame: FloatingWindow;
  private closed = false;

  constructor(
    container: HTMLElement,
    private readonly host: MathSymbolHost,
  ) {
    this.frame = new FloatingWindow({
      container,
      cls: "goodobsidian-math-window",
      title: "Math symbols",
      label: "Math symbols",
      closeLabel: "Close math symbols",
      minimise: true,
      min: MIN,
      firstPlace: (bounds) => ({
        x: Math.max(12, bounds.w - 332),
        y: 76,
        w: 310,
        h: Math.min(520, Math.max(MIN.h, bounds.h - 110)),
      }),
      place: () => host.loadPlace(),
      savePlace: (place) => host.savePlace(place),
      onClose: () => this.close(),
    });
    const table = this.frame.body.createDiv({ cls: "goodobsidian-math-symbols" });
    for (const group of MATH_SYMBOL_GROUPS) {
      const section = table.createDiv({ cls: "goodobsidian-math-symbol-group" });
      section.createDiv({ cls: "goodobsidian-math-symbol-heading", text: group.label });
      const grid = section.createDiv({ cls: "goodobsidian-math-symbol-grid" });
      for (const symbol of group.symbols) this.symbolButton(grid, symbol, container);
    }
    const practice = this.frame.body.createEl("button", {
      cls: "goodobsidian-math-practice clickable-icon",
      text: "Teach FineNotes my symbols",
    });
    setIcon(practice.createSpan({ cls: "goodobsidian-math-practice-icon" }), "pen-line");
    practice.addEventListener("click", () => host.practice());
  }

  get isOpen(): boolean {
    return !this.closed;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.frame.destroy();
  }

  private symbolButton(grid: HTMLElement, symbol: string, container: HTMLElement): void {
    const button = grid.createEl("button", {
      cls: "goodobsidian-math-symbol clickable-icon",
      text: symbol,
      attr: { "aria-label": `Insert ${symbol}`, title: "Tap to insert or drag onto the page" },
    });
    let drag: { id: number; x: number; y: number; moved: boolean; ghost: HTMLElement } | null =
      null;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const ghost = container.createDiv({ cls: "goodobsidian-math-symbol-ghost", text: symbol });
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, ghost };
      button.setPointerCapture(event.pointerId);
      this.placeGhost(ghost, container, event.clientX, event.clientY);
    });
    button.addEventListener("pointermove", (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 7) drag.moved = true;
      this.placeGhost(drag.ghost, container, event.clientX, event.clientY);
    });
    const end = (event: PointerEvent): void => {
      if (!drag || drag.id !== event.pointerId) return;
      const placed = drag;
      drag = null;
      placed.ghost.remove();
      this.host.place(symbol, placed.moved ? { x: event.clientX, y: event.clientY } : null);
    };
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      drag.ghost.remove();
      drag = null;
    });
  }

  private placeGhost(
    ghost: HTMLElement,
    container: HTMLElement,
    clientX: number,
    clientY: number,
  ): void {
    const rect = container.getBoundingClientRect();
    ghost.setCssStyles({ left: `${clientX - rect.left}px`, top: `${clientY - rect.top}px` });
  }
}
