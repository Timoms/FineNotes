import { setIcon } from "obsidian";
import { onTap } from "./selection-bar";

export type ScrollDirection = "up" | "down" | "left" | "right";

/** Per-notebook writing modes, with an exit available even when chrome is hidden. */
export class WritingControls {
  private readonly arrows: HTMLElement;
  private readonly exit: HTMLButtonElement;
  private readonly menuToggle: HTMLButtonElement;
  private readonly previous: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private direction: "vertical" | "horizontal" = "vertical";
  menuVisible = false;
  private ownsFullscreen = false;
  private armed: HTMLButtonElement | null = null;
  private armTimer: ReturnType<typeof setTimeout> | null = null;
  private confirmTimer: ReturnType<typeof setTimeout> | null = null;
  distractionFree = false;
  scrollLocked = false;

  constructor(
    private readonly view: HTMLElement,
    overlay: HTMLElement,
    private showArrows: boolean,
    private readonly callbacks: {
      lockTouch: (locked: boolean) => void;
      scroll: (direction: ScrollDirection) => void;
      fitPage: () => void;
      changed: (fitSheet?: boolean) => void;
    },
    private readonly menuBar?: HTMLElement,
  ) {
    this.exit = view.createEl("button", {
      cls: "finenotes-x-writing-exit clickable-icon is-hidden",
      attr: {
        "aria-label": "Exit distraction free mode",
        title: "Exit distraction free mode (Esc)",
      },
    });
    setIcon(this.exit, "minimize");
    this.exit.addEventListener("click", () => this.setDistractionFree(false));
    this.menuToggle = view.createEl("button", {
      cls: "finenotes-x-writing-menu-toggle clickable-icon is-hidden",
      attr: {
        "aria-label": "Show menu strip",
        title: "Toggle menu strip",
        "aria-expanded": "false",
      },
    });
    setIcon(this.menuToggle, "panel-top");
    this.menuToggle.addEventListener("click", () => this.setMenuVisible(!this.menuVisible));
    this.arrows = overlay.createDiv({
      cls: "finenotes-x-scroll-controls is-hidden",
      attr: { role: "group", "aria-label": "Page scrolling controls" },
    });
    this.arrows.addEventListener("pointerdown", (event) => event.stopPropagation());
    const buttons: HTMLButtonElement[] = [];
    for (const action of [
      {
        id: "up",
        label: "Up",
        icon: "arrow-up",
        run: () => this.callbacks.scroll(this.direction === "horizontal" ? "left" : "up"),
      },
      { id: "unlock", label: "Unlock", icon: "unlock", run: () => this.setScrollLocked(false) },
      { id: "fit", label: "Fit page", icon: "scan", run: () => this.callbacks.fitPage() },
      {
        id: "down",
        label: "Down",
        icon: "arrow-down",
        run: () => this.callbacks.scroll(this.direction === "horizontal" ? "right" : "down"),
      },
    ]) {
      const button = this.arrows.createEl("button", {
        cls: `finenotes-x-scroll-control is-${action.id} clickable-icon`,
        attr: {
          "aria-label": `${action.label} — double tap to activate`,
          title: `${action.label} (double tap)`,
        },
      });
      buttons.push(button);
      setIcon(button, action.icon);
      onTap(button, () => this.confirmAction(button, action.run));
    }
    this.previous = buttons[0];
    this.next = buttons[3];
    view.ownerDocument.addEventListener("fullscreenchange", this.fullscreenChanged);
    view.ownerDocument.addEventListener("keydown", this.keyDown);
  }

  setScrollDirection(direction: "vertical" | "horizontal"): void {
    if (direction === this.direction) return;
    this.resetConfirmation();
    this.direction = direction;
    const horizontal = direction === "horizontal";
    for (const [button, label, icon] of [
      [this.previous, horizontal ? "Left" : "Up", horizontal ? "arrow-left" : "arrow-up"],
      [this.next, horizontal ? "Right" : "Down", horizontal ? "arrow-right" : "arrow-down"],
    ] as const) {
      setIcon(button, icon);
      button.setAttribute("aria-label", `${label} — double tap to activate`);
      button.setAttribute("title", `${label} (double tap)`);
    }
  }

  private resetConfirmation(): void {
    if (this.armTimer !== null) clearTimeout(this.armTimer);
    if (this.confirmTimer !== null) clearTimeout(this.confirmTimer);
    this.armTimer = this.confirmTimer = null;
    this.armed?.removeClass("is-armed", "is-confirmed");
    this.armed?.setAttribute("aria-description", "");
    this.armed = null;
  }

  private confirmAction(button: HTMLButtonElement, run: () => void): void {
    if (!this.scrollLocked || !this.showArrows || this.confirmTimer !== null) return;
    if (this.armed === button) {
      if (this.armTimer !== null) clearTimeout(this.armTimer);
      this.armTimer = null;
      button.removeClass("is-armed");
      button.addClass("is-confirmed");
      button.setAttribute("aria-description", "Confirmed");
      this.confirmTimer = setTimeout(() => {
        this.confirmTimer = null;
        this.resetConfirmation();
        run();
      }, 160);
      return;
    }
    this.resetConfirmation();
    this.armed = button;
    button.addClass("is-armed");
    button.setAttribute("aria-description", "Tap again to confirm");
    this.armTimer = setTimeout(() => this.resetConfirmation(), 1500);
  }

  setShowArrows(show: boolean): void {
    this.resetConfirmation();
    this.showArrows = show;
    this.arrows.toggleClass("is-hidden", !show || !this.scrollLocked);
  }

  setScrollLocked(locked: boolean): void {
    this.resetConfirmation();
    this.scrollLocked = locked;
    this.callbacks.lockTouch(locked);
    this.arrows.toggleClass("is-hidden", !this.showArrows || !locked);
    this.callbacks.changed();
  }

  setMenuVisible(visible: boolean): void {
    this.menuVisible = this.distractionFree && visible;
    this.view.toggleClass("is-fullscreen-menu-visible", this.menuVisible);
    const docked = this.menuVisible && this.menuBar !== undefined;
    const parent = docked ? this.menuBar! : this.view;
    for (const button of [this.menuToggle, this.exit]) {
      button.remove();
      parent.append(button);
      button.toggleClass("is-docked", docked);
    }
    setIcon(this.menuToggle, this.menuVisible ? "chevron-up" : "panel-top");
    this.menuToggle.setAttribute(
      "title",
      this.menuVisible ? "Collapse menu strip" : "Show menu strip",
    );
    this.menuToggle.setAttribute("aria-expanded", String(this.menuVisible));
    this.menuToggle.setAttribute("aria-pressed", String(this.menuVisible));
    this.menuToggle.toggleClass("is-active", this.menuVisible);
    this.menuToggle.setAttribute(
      "aria-label",
      this.menuVisible ? "Hide menu strip" : "Show menu strip",
    );
    const railWidth = this.menuVisible ? (this.menuBar?.getBoundingClientRect?.().width ?? 68) + 20 : 0;
    this.view.setCssProps({ "--finenotes-menu-reserve": `${railWidth}px` });
    this.callbacks.changed(true);
  }

  setDistractionFree(enabled: boolean): void {
    if (enabled === this.distractionFree) return;
    this.distractionFree = enabled;
    this.view.toggleClass("is-distraction-free", enabled);
    this.exit.toggleClass("is-hidden", !enabled);
    this.menuToggle.toggleClass("is-hidden", !enabled);
    this.setMenuVisible(enabled);
    const doc = this.view.ownerDocument;
    if (enabled && doc.fullscreenElement !== this.view && this.view.requestFullscreen) {
      // Keep the full-window layout on platforms without native fullscreen.
      void this.view
        .requestFullscreen()
        .then(() => {
          this.ownsFullscreen = doc.fullscreenElement === this.view;
          if (!this.distractionFree && this.ownsFullscreen) {
            void doc.exitFullscreen().catch(() => {});
          }
        })
        .catch(() => {});
    } else if (!enabled && doc.fullscreenElement === this.view) {
      void doc.exitFullscreen().catch(() => {});
    }
    this.callbacks.changed();
  }

  destroy(): void {
    this.resetConfirmation();
    this.setDistractionFree(false);
    this.view.ownerDocument.removeEventListener("fullscreenchange", this.fullscreenChanged);
    this.view.ownerDocument.removeEventListener("keydown", this.keyDown);
    this.exit.remove();
    this.menuToggle.remove();
    this.arrows.remove();
  }

  private readonly fullscreenChanged = (): void => {
    if (this.view.ownerDocument.fullscreenElement === this.view) {
      this.ownsFullscreen = true;
    } else if (this.ownsFullscreen) {
      this.ownsFullscreen = false;
      this.setDistractionFree(false);
    }
    this.callbacks.changed(true);
  };

  private readonly keyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !this.distractionFree) return;
    event.preventDefault();
    this.setDistractionFree(false);
  };
}
