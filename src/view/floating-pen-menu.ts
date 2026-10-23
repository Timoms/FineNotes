import { setIcon } from "obsidian";
import {
  COMPANION_ACTIONS,
  type CompanionAction,
  companionActionsOf,
} from "../model/companion-menu";

export interface QuickSticker {
  id: string;
  label: string;
  svg: string;
}

export interface FloatingPenMenuCallbacks {
  run: (action: CompanionAction) => void;
  stickers: () => readonly QuickSticker[];
  pickSticker: (id: string) => void;
  stickyNotes: () => readonly { color: string; svg: string }[];
  placeSticky: (color: string, at: { x: number; y: number } | null) => void;
}

/** A draggable, always-available button whose shortcuts fan around a circle. */
export class FloatingPenMenu {
  private readonly root: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly ring: HTMLElement;
  private readonly stickerMenu: HTMLElement;
  private actions: CompanionAction[];
  private open = false;
  private x = 72;
  private y = 180;
  private drag: { id: number; x: number; y: number; moved: boolean } | null = null;

  constructor(
    private readonly host: HTMLElement,
    actions: unknown,
    private readonly callbacks: FloatingPenMenuCallbacks,
  ) {
    this.actions = companionActionsOf(actions);
    this.root = host.createDiv({ cls: "goodobsidian-pen-companion" });
    this.ring = this.root.createDiv({ cls: "goodobsidian-pen-companion-ring" });
    this.stickerMenu = this.root.createDiv({
      cls: "goodobsidian-pen-companion-stickers is-hidden",
    });
    this.button = this.root.createEl("button", {
      cls: "goodobsidian-pen-companion-button clickable-icon",
      attr: { "aria-label": "Quick tools", "aria-expanded": "false" },
    });
    setIcon(this.button, "pen-tool");
    this.bindButton();
    this.render();
    this.place();
  }

  destroy(): void {
    this.root.remove();
  }

  setActions(actions: unknown): void {
    this.actions = companionActionsOf(actions);
    this.render();
  }

  collapse(): void {
    this.open = false;
    this.root.removeClass("is-open");
    this.button.setAttribute("aria-expanded", "false");
    this.stickerMenu.addClass("is-hidden");
  }

  private toggle(): void {
    this.open = !this.open;
    this.root.toggleClass("is-open", this.open);
    this.button.setAttribute("aria-expanded", String(this.open));
    if (!this.open) this.stickerMenu.addClass("is-hidden");
  }

  private render(): void {
    this.ring.empty();
    const radius = companionRadius(this.actions.length);
    this.actions.forEach((id, index) => {
      const spec = COMPANION_ACTIONS.find((item) => item.id === id);
      if (!spec) return;
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / this.actions.length;
      const button = this.ring.createEl("button", {
        cls: "goodobsidian-pen-companion-item clickable-icon",
        attr: { "aria-label": spec.label, title: spec.label },
      });
      setIcon(button, spec.icon);
      button.setCssStyles({
        transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
      });
      button.addEventListener("click", () => {
        if (id === "stickers") this.toggleStickers();
        else if (id === "sticky") this.toggleStickyNotes();
        else {
          this.callbacks.run(id);
          this.collapse();
        }
      });
    });
  }

  private toggleStickers(): void {
    const hidden = this.stickerMenu.hasClass("is-hidden");
    this.stickerMenu.empty();
    this.stickerMenu.removeClass("is-sticky-notes");
    if (!hidden) {
      this.stickerMenu.addClass("is-hidden");
      return;
    }
    for (const sticker of this.callbacks.stickers()) {
      const button = this.stickerMenu.createEl("button", {
        cls: "goodobsidian-pen-companion-sticker clickable-icon",
        attr: { "aria-label": sticker.label, title: sticker.label },
      });
      const parsed = new DOMParser().parseFromString(sticker.svg, "image/svg+xml").documentElement;
      button.append(button.ownerDocument.importNode(parsed, true));
      button.addEventListener("click", () => {
        this.callbacks.pickSticker(sticker.id);
        this.collapse();
      });
    }
    this.stickerMenu.removeClass("is-hidden");
  }

  private toggleStickyNotes(): void {
    const hidden = this.stickerMenu.hasClass("is-hidden");
    this.stickerMenu.empty();
    if (!hidden) {
      this.stickerMenu.addClass("is-hidden");
      return;
    }
    this.stickerMenu.addClass("is-sticky-notes");
    for (const note of this.callbacks.stickyNotes()) {
      const button = this.stickerMenu.createEl("button", {
        cls: "goodobsidian-pen-companion-sticker goodobsidian-sticky-choice",
        attr: { "aria-label": "Peel off sticky note", title: "Drag onto the page" },
      });
      button.style.setProperty("--sticky-color", note.color);
      const parsed = new DOMParser().parseFromString(note.svg, "image/svg+xml").documentElement;
      button.append(button.ownerDocument.importNode(parsed, true));
      button.createSpan({ cls: "goodobsidian-sticky-peel is-left" });
      button.createSpan({ cls: "goodobsidian-sticky-peel is-right" });
      this.bindSticky(button, note.color);
    }
    this.stickerMenu.removeClass("is-hidden");
  }

  private bindSticky(button: HTMLButtonElement, color: string): void {
    let drag: {
      id: number;
      x: number;
      y: number;
      moved: boolean;
      side: "left" | "right";
      ghost: HTMLElement;
    } | null = null;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const rect = button.getBoundingClientRect();
      const side = event.clientX < rect.left + rect.width / 2 ? "left" : "right";
      const ghost = button.cloneNode(true) as HTMLElement;
      ghost.addClass("goodobsidian-sticky-ghost");
      ghost.addClass(`is-peeling-${side}`);
      this.host.append(ghost);
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, side, ghost };
      button.addClass("is-peeling");
      button.addClass(`is-peeling-${side}`);
      button.setPointerCapture(event.pointerId);
      this.placeStickyGhost(ghost, event.clientX, event.clientY);
    });
    button.addEventListener("pointermove", (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
      if (distance > 8) drag.moved = true;
      const peel = String(Math.min(1, distance / 64));
      button.style.setProperty("--peel", peel);
      drag.ghost.style.setProperty("--peel", peel);
      button.style.setProperty("--peel-size", `${Number(peel) * 18}%`);
      button.style.setProperty("--peel-lift", `${Number(peel) * 17}px`);
      drag.ghost.style.setProperty("--peel-size", `${Number(peel) * 18}%`);
      drag.ghost.style.setProperty("--peel-lift", `${Number(peel) * 17}px`);
      this.placeStickyGhost(drag.ghost, event.clientX, event.clientY);
    });
    const end = (event: PointerEvent): void => {
      if (!drag || drag.id !== event.pointerId) return;
      const placed = drag;
      drag = null;
      button.removeClass("is-peeling");
      button.removeClass(`is-peeling-${placed.side}`);
      button.style.removeProperty("--peel");
      button.style.removeProperty("--peel-size");
      button.style.removeProperty("--peel-lift");
      placed.ghost.remove();
      this.callbacks.placeSticky(
        color,
        placed.moved ? { x: event.clientX, y: event.clientY } : null,
      );
      this.collapse();
    };
    const cancel = (event: PointerEvent): void => {
      if (!drag || drag.id !== event.pointerId) return;
      const side = drag.side;
      drag.ghost.remove();
      drag = null;
      button.removeClass("is-peeling");
      button.removeClass(`is-peeling-${side}`);
      button.style.removeProperty("--peel");
      button.style.removeProperty("--peel-size");
      button.style.removeProperty("--peel-lift");
    };
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", cancel);
  }

  private placeStickyGhost(ghost: HTMLElement, clientX: number, clientY: number): void {
    const rect = this.host.getBoundingClientRect();
    ghost.setCssStyles({ left: `${clientX - rect.left}px`, top: `${clientY - rect.top}px` });
  }

  private bindButton(): void {
    this.button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      this.button.setPointerCapture(event.pointerId);
    });
    this.button.addEventListener("pointermove", (event) => {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 2) drag.moved = true;
      this.x += dx;
      this.y += dy;
      drag.x = event.clientX;
      drag.y = event.clientY;
      this.place();
    });
    const end = (event: PointerEvent): void => {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId) return;
      this.drag = null;
      if (!drag.moved) this.toggle();
    };
    this.button.addEventListener("pointerup", end);
    this.button.addEventListener("pointercancel", end);
  }

  private place(): void {
    const inset = 30;
    this.x = Math.min(Math.max(inset, this.x), Math.max(inset, this.host.clientWidth - inset));
    this.y = Math.min(Math.max(inset, this.y), Math.max(inset, this.host.clientHeight - inset));
    this.root.setCssStyles({ left: `${this.x}px`, top: `${this.y}px` });
  }
}

/** Keep shortcuts close to the centre while leaving full touch targets apart. */
export function companionRadius(items: number): number {
  return items <= 5 ? 64 : 74;
}
