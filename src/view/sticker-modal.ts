import { type App, Modal, TFile, TFolder } from "obsidian";
import { PALETTE } from "../constants";
import { isImagePath } from "../canvas/image-raster";
import { STICKERS, STICKER_CATEGORIES, type Sticker, stickerSvg } from "../model/stickers";

/** What the user picked: a built-in sticker in a colour, or a file of theirs. */
export type StickerChoice =
  { kind: "builtin"; sticker: Sticker; color: string } | { kind: "file"; file: TFile };

/** The collection stickers saved from a selection go into. */
export const SAVED_STICKERS_COLLECTION = "My stickers";

/** The colour the picker opens with, remembered for the session. */
let lastColor: string = PALETTE[3];

export class StickerPicker {
  private readonly cleanups: Array<() => void> = [];
  private color = lastColor;

  constructor(
    private readonly app: App,
    private readonly folder: string,
    private readonly contentEl: HTMLElement,
    private readonly pick: (choice: StickerChoice) => void,
    private readonly favorites: string[],
    private readonly saveFavorites: (ids: string[]) => void,
  ) {
    this.render();
  }

  destroy(): void {
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.contentEl.empty();
  }

  /** The user's collections: one per subfolder, then loose files as "My stickers". */
  private collections(): Array<{ name: string; files: TFile[] }> {
    const root = this.app.vault.getFolderByPath(this.folder);
    if (!(root instanceof TFolder)) return [];
    const images = (folder: TFolder): TFile[] =>
      folder.children
        .filter((c): c is TFile => c instanceof TFile && isImagePath(c.path))
        .sort((a, b) => a.basename.localeCompare(b.basename));
    const out: Array<{ name: string; files: TFile[] }> = [];
    const loose = images(root);
    for (const child of root.children) {
      if (child instanceof TFolder) out.push({ name: child.name, files: images(child) });
    }
    if (loose.length > 0 && !out.some((c) => c.name === SAVED_STICKERS_COLLECTION)) {
      out.push({ name: SAVED_STICKERS_COLLECTION, files: loose });
    }
    return out.filter((c) => c.files.length > 0).sort((a, b) => a.name.localeCompare(b.name));
  }

  private render(): void {
    const body = this.contentEl;
    const scrollTop = body.querySelector(".finenotes-x-sticker-scroll")?.scrollTop ?? 0;
    this.destroy();
    const collections = this.collections();
    this.renderColors(body);
    const groups: Array<{
      name: string;
      items: Array<{ id: string; label: string; src: string; choice: StickerChoice }>;
    }> = [
      ...STICKER_CATEGORIES.map((category) => ({
        name: category.label,
        items: STICKERS.filter((sticker) => sticker.category === category.id).map((sticker) => ({
          id: `builtin:${sticker.id}`,
          label: sticker.name,
          src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(stickerSvg(sticker, this.color))}`,
          choice: { kind: "builtin", sticker, color: this.color } satisfies StickerChoice,
        })),
      })),
      ...collections.map((collection) => ({
        name: collection.name,
        items: collection.files.map((file) => ({
          id: `file:${file.path}`,
          label: file.basename,
          src: this.app.vault.getResourcePath(file),
          choice: { kind: "file", file } satisfies StickerChoice,
        })),
      })),
    ];
    const scroll = body.createDiv({ cls: "finenotes-x-sticker-scroll" });
    const all = groups.flatMap((group) => group.items);
    const favorites = this.favorites.flatMap((id) => all.filter((item) => item.id === id));
    for (const group of [{ name: "Favourites", items: favorites }, ...groups]) {
      if (!group.items.length) continue;
      const section = scroll.createDiv({ cls: "finenotes-x-sticker-group" });
      section.createEl("h3", { text: group.name });
      const grid = section.createDiv({ cls: "finenotes-x-sticker-grid" });
      for (const item of group.items) {
        this.cell(grid, item.id, item.label, item.src, () => this.pick(item.choice));
      }
    }
    scroll.scrollTop = scrollTop;
    body.createDiv({
      cls: "finenotes-x-sticker-hint",
      text: collections.length
        ? `Your own stickers live in “${this.folder}”: one folder per collection.`
        : `Lasso anything and choose “Save as sticker” to start your own collection in “${this.folder}”.`,
    });
  }

  private renderColors(body: HTMLElement): void {
    const row = body.createDiv({ cls: "finenotes-x-sticker-colors" });
    for (const color of PALETTE) {
      if (color === "#ffffff") continue;
      const swatch = row.createEl("button", {
        cls: "finenotes-x-sticker-swatch clickable-icon",
        attr: { "aria-label": `Colour ${color}`, "aria-pressed": String(color === this.color) },
      });
      swatch
        .createSpan({ cls: "finenotes-x-sticker-swatch-disc" })
        .setCssStyles({ backgroundColor: color });
      swatch.toggleClass("is-active", color === this.color);
      swatch.addEventListener("click", () => {
        this.color = color;
        lastColor = color;
        this.render();
      });
    }
  }

  private cell(
    grid: HTMLElement,
    id: string,
    label: string,
    src: string,
    onPick: () => void,
  ): void {
    const favorite = this.favorites.includes(id);
    const button = grid.createEl("button", {
      cls: "finenotes-x-sticker-cell clickable-icon",
      attr: {
        "aria-label": `${label}${favorite ? ", favourite" : ""}`,
        title: `${label} — hold to toggle favourite`,
      },
    });
    button.toggleClass("is-favorite", favorite);
    button.createEl("img", { attr: { src, alt: "", draggable: "false" } });
    let timer: number | undefined;
    let held = false;
    let refresh: number | undefined;
    this.cleanups.push(() => window.clearTimeout(refresh));
    let origin: { x: number; y: number } | undefined;
    const cancel = (): void => {
      window.clearTimeout(timer);
      timer = undefined;
    };
    this.cleanups.push(cancel);
    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "pen" || event.pointerType === "mouse")
        button.addClass("is-previewing");
    });
    button.addEventListener("pointerleave", () => {
      cancel();
      button.removeClass("is-previewing");
    });
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      cancel();
      held = false;
      origin = { x: event.clientX, y: event.clientY };
      timer = window.setTimeout(() => {
        held = true;
        const index = this.favorites.indexOf(id);
        if (index < 0) this.favorites.push(id);
        else this.favorites.splice(index, 1);
        this.saveFavorites([...this.favorites]);
        // Keep the pressed element until release, so a hold cannot insert.
        button.toggleClass("is-favorite", index < 0);
      }, 550);
    });
    button.addEventListener("pointermove", (event) => {
      if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 8) cancel();
    });
    button.addEventListener("pointerup", () => {
      cancel();
      if (held) refresh = window.setTimeout(() => this.render(), 0);
    });
    button.addEventListener("pointercancel", cancel);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
    button.addEventListener("click", (event) => {
      if (held) {
        event.preventDefault();
        return;
      }
      onPick();
    });
  }
}

/** Standalone picker retained for callers outside the toolbar. */
export class StickerModal extends Modal {
  private picker?: StickerPicker;
  constructor(
    app: App,
    private readonly folder: string,
    private readonly pick: (choice: StickerChoice) => void,
  ) {
    super(app);
  }
  override onOpen(): void {
    this.modalEl.addClass("finenotes-x-dialog", "finenotes-x-sticker-modal");
    this.titleEl.setText("Stickers");
    this.picker = new StickerPicker(
      this.app,
      this.folder,
      this.contentEl,
      (choice) => {
        this.close();
        this.pick(choice);
      },
      [],
      () => {},
    );
  }
  override onClose(): void {
    this.picker?.destroy();
  }
}
