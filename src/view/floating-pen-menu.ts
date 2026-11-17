import { setIcon } from "obsidian";
import {
  COMPANION_ACTIONS,
  COMPANION_MODES,
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
  hideAfterSelection?: () => boolean;
  /** The ink colour currently selected in the toolbar. */
  activeColor?: () => string;
  /** Start the page eyedropper with a pointer already held on the pipette. */
  dragColor?: (pointerId: number, clientX: number, clientY: number, done: () => void) => void;
  onOpenChange?: (open: boolean) => void;
  isActive?: (action: CompanionAction) => boolean | undefined;
}

/** A draggable, always-available button whose shortcuts fan around a circle. */
export class FloatingPenMenu {
  private readonly root: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly ring: HTMLElement;
  private readonly stickerMenu: HTMLElement;
  private actions: CompanionAction[];
  private open = false;
  private readonly modeButtons = new Map<CompanionAction, HTMLButtonElement>();
  private x = 72;
  private y = 180;
  private drag: { id: number; x: number; y: number; moved: boolean } | null = null;

  constructor(
    private readonly host: HTMLElement,
    actions: unknown,
    private readonly callbacks: FloatingPenMenuCallbacks,
  ) {
    this.actions = companionActionsOf(actions);
    this.root = host.createDiv({ cls: "finenotes-x-pen-companion" });
    this.ring = this.root.createDiv({ cls: "finenotes-x-pen-companion-ring" });
    this.stickerMenu = this.root.createDiv({
      cls: "finenotes-x-pen-companion-stickers is-hidden",
    });
    this.button = this.root.createEl("button", {
      cls: "finenotes-x-pen-companion-button clickable-icon",
      attr: { "aria-label": "Quick tools", "aria-expanded": "false" },
    });
    setIcon(this.button, "pen-tool");
    this.bindButton();
    this.render();
    this.place();
  }

  destroy(): void {
    this.callbacks.onOpenChange?.(false);
    this.root.remove();
  }

  setActions(actions: unknown): void {
    this.actions = companionActionsOf(actions);
    this.render();
  }

  refresh(): void {
    this.syncAppearance();
  }

  collapse(): void {
    this.open = false;
    this.root.removeClass("is-open");
    this.button.setAttribute("aria-expanded", "false");
    this.stickerMenu.addClass("is-hidden");
    this.callbacks.onOpenChange?.(false);
  }

  /** A Pencil squeeze: move to its latest tip position and toggle the ring. */
  toggleAt(client: { x: number; y: number } | null): boolean {
    if (client) {
      const rect = this.host.getBoundingClientRect();
      this.x = client.x - rect.left;
      this.y = client.y - rect.top;
      this.place(true);
    }
    this.root.removeClass("is-hidden");
    this.toggle();
    return this.open;
  }

  private toggle(): void {
    this.open = !this.open;
    if (this.open) this.syncAppearance();
    this.root.toggleClass("is-open", this.open);
    this.button.setAttribute("aria-expanded", String(this.open));
    if (!this.open) this.stickerMenu.addClass("is-hidden");
    this.callbacks.onOpenChange?.(this.open);
  }

  private finishSelection(): void {
    this.collapse();
    if (this.callbacks.hideAfterSelection?.() === true) this.root.addClass("is-hidden");
  }

  private render(): void {
    this.ring.empty();
    this.modeButtons.clear();
    const actions: CompanionAction[] = [...this.actions, ...COMPANION_MODES.map((mode) => mode.id)];
    const radius = companionRadius(actions.length);
    actions.forEach((id, index) => {
      const spec = [...COMPANION_ACTIONS, ...COMPANION_MODES].find((item) => item.id === id);
      if (!spec) return;
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / actions.length;
      const button = this.ring.createEl("button", {
        cls: `finenotes-x-pen-companion-item finenotes-x-pen-companion-action-${id} clickable-icon`,
        attr: { "aria-label": spec.label, title: spec.label },
      });
      setIcon(button, spec.icon);
      if (id === "distraction-free" || id === "prevent-scrolling") this.modeButtons.set(id, button);
      button.setCssStyles({
        transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
      });
      button.addEventListener("click", () => {
        if (id === "color") return;
        if (id === "stickers") this.toggleStickers();
        else if (id === "sticky") this.toggleStickyNotes();
        else {
          this.callbacks.run(id);
          this.finishSelection();
        }
      });
      if (id === "color") {
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          button.setPointerCapture(event.pointerId);
          this.callbacks.dragColor?.(event.pointerId, event.clientX, event.clientY, () =>
            this.finishSelection(),
          );
          this.collapse();
        });
      }
    });
    this.syncAppearance();
  }

  /** Refresh colours that can change while the menu stays mounted. */
  private syncAppearance(): void {
    const color = this.callbacks.activeColor?.();
    if (color) this.root.style.setProperty("--finenotes-pen-color", color);
    this.modeButtons?.forEach((button, action) => {
      const active = this.callbacks.isActive?.(action) === true;
      button.toggleClass("is-active", active);
      button.setAttribute("aria-pressed", String(active));
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
        cls: "finenotes-x-pen-companion-sticker clickable-icon",
        attr: { "aria-label": sticker.label, title: sticker.label },
      });
      const parsed = new DOMParser().parseFromString(sticker.svg, "image/svg+xml").documentElement;
      button.append(button.ownerDocument.importNode(parsed, true));
      button.addEventListener("click", () => {
        this.callbacks.pickSticker(sticker.id);
        this.finishSelection();
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
        cls: "finenotes-x-pen-companion-sticker finenotes-x-sticky-choice",
        attr: { "aria-label": "Peel off sticky note", title: "Drag onto the page" },
      });
      button.style.setProperty("--sticky-color", note.color);
      const parsed = new DOMParser().parseFromString(note.svg, "image/svg+xml").documentElement;
      button.append(button.ownerDocument.importNode(parsed, true));
      button.createSpan({ cls: "finenotes-x-sticky-peel is-left" });
      button.createSpan({ cls: "finenotes-x-sticky-peel is-right" });
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
      ghost.addClass("finenotes-x-sticky-ghost");
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
      this.finishSelection();
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

  private place(roomForRing = this.open): void {
    const inset = roomForRing
      ? companionRadius(this.actions.length + COMPANION_MODES.length) + 26
      : 30;
    this.x = Math.min(Math.max(inset, this.x), Math.max(inset, this.host.clientWidth - inset));
    this.y = Math.min(Math.max(inset, this.y), Math.max(inset, this.host.clientHeight - inset));
    this.root.setCssStyles({ left: `${this.x}px`, top: `${this.y}px` });
  }
}

/** Keep shortcuts close to the centre while leaving full touch targets apart. */
export function companionRadius(items: number): number {
  // Keep 44 px buttons separated as more shortcuts join the ring.
  return Math.max(items <= 5 ? 64 : 74, 48 / (2 * Math.sin(Math.PI / Math.max(2, items))));
}
