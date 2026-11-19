import { STICKY_NOTE_COLORS, type StickyNoteType, stickyNoteSvg } from "../model/sticky-notes";

export class StickyNotePicker {
  private type: StickyNoteType = "note";
  private color: string = STICKY_NOTE_COLORS[0];
  private opacity = 0.9;

  constructor(
    private readonly contentEl: HTMLElement,
    private readonly pick: (type: StickyNoteType, color: string, opacity: number) => void,
  ) {
    this.render();
  }

  destroy(): void {
    this.contentEl.empty();
  }

  private render(): void {
    this.contentEl.empty();
    const tabs = this.contentEl.createDiv({ cls: "finenotes-x-sticker-tabs" });
    for (const [type, label] of [
      ["note", "Note"],
      ["index-tab", "Index Tab"],
    ] as const) {
      const button = tabs.createEl("button", {
        cls: "finenotes-x-sticker-tab clickable-icon",
        text: label,
        attr: { "aria-pressed": String(type === this.type) },
      });
      button.toggleClass("is-active", type === this.type);
      button.addEventListener("click", () => {
        this.type = type;
        this.render();
      });
    }
    const colors = this.contentEl.createDiv({ cls: "finenotes-x-sticker-colors" });
    for (const color of STICKY_NOTE_COLORS) {
      const swatch = colors.createEl("button", {
        cls: "finenotes-x-sticker-swatch clickable-icon",
        attr: { "aria-label": `Colour ${color}`, "aria-pressed": String(color === this.color) },
      });
      swatch
        .createSpan({ cls: "finenotes-x-sticker-swatch-disc" })
        .setCssStyles({ backgroundColor: color });
      swatch.toggleClass("is-active", color === this.color);
      swatch.addEventListener("click", () => {
        this.color = color;
        this.render();
      });
    }
    const opacity = this.contentEl.createDiv({ cls: "finenotes-x-sticky-opacity" });
    opacity.createSpan({ text: `Opacity ${Math.round(this.opacity * 100)}%` });
    const slider = opacity.createEl("input", {
      type: "range",
      attr: { min: "10", max: "100", step: "5", value: String(this.opacity * 100) },
    });
    slider.addEventListener("input", () => {
      this.opacity = Number(slider.value) / 100;
      this.render();
    });
    const grid = this.contentEl.createDiv({ cls: "finenotes-x-sticker-grid" });
    const choice = grid.createEl("button", {
      cls: "finenotes-x-sticker-cell clickable-icon",
      attr: { "aria-label": `Insert ${this.type === "note" ? "note" : "index tab"}` },
    });
    choice.createEl("img", {
      attr: {
        src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(stickyNoteSvg(this.color, this.type, this.opacity))}`,
        alt: "",
      },
    });
    choice.addEventListener("click", () => this.pick(this.type, this.color, this.opacity));
  }
}
