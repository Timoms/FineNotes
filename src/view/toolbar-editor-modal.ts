import { type App, Modal, Notice, setIcon } from "obsidian";
import {
  stripSlots,
  stripItemSlots,
  DEFAULT_TOOLBAR_ITEMS,
  TOOLBAR_ITEMS,
  TOOLBAR_LAYOUT_ITEMS,
  isToolbarLayoutItem,
  moveStripItem,
  savedPenToolbarIndex,
  stripLayoutOf,
  type ToolbarItemChoice,
} from "../model/toolbar-items";
import { savedPenLabel, type SavedPen } from "../model/saved-pens";
import { penGlyph } from "./pen-glyph-svg";
const specs = new Map([...TOOLBAR_ITEMS, ...TOOLBAR_LAYOUT_ITEMS].map((s) => [s.id, s]));
type Destination = "strip" | "more" | "library";

/** Apple's catalogue/preview pattern, with explicit group containers. */
export class ToolbarEditorModal extends Modal {
  private items: ToolbarItemChoice[];
  private sequence = 0;
  private ghost: HTMLElement | null = null;
  private editingSubmenu: string | null = null;
  constructor(
    app: App,
    value: unknown,
    private readonly save: (items: ToolbarItemChoice[]) => void,
    private readonly reveal?: (visible: boolean) => void,
    private readonly savedPens?: () => readonly SavedPen[],
    private readonly editPens?: () => void,
  ) {
    super(app);
    this.items = stripLayoutOf(value);
  }
  override onOpen(): void {
    this.modalEl.addClass("finenotes-x-toolbar-editor-modal", "is-strip-preview-editor");
    this.render();
  }
  override onClose(): void {
    this.reveal?.(false);
    this.modalEl.parentElement?.removeClass("is-previewing-toolbar");
    this.ghost?.remove();
  }
  private render(): void {
    const root = this.contentEl;
    root.empty();
    this.save(this.items);
    const header = root.createDiv({ cls: "finenotes-x-customize-header" });
    header.createEl("h2", { text: "Customize menu strip" });
    const eye = header.createEl("button", {
      attr: { "aria-label": "Hold to preview toolbar", title: "Hold to preview toolbar" },
    });
    setIcon(eye, "eye");
    eye.addEventListener("pointerdown", (event) => {
      eye.setPointerCapture(event.pointerId);
      this.reveal?.(true);
      this.modalEl.parentElement?.addClass("is-previewing-toolbar");
    });
    const release = () => {
      this.reveal?.(false);
      this.modalEl.parentElement?.removeClass("is-previewing-toolbar");
    };
    eye.addEventListener("pointerup", release);
    eye.addEventListener("pointercancel", release);
    eye.addEventListener("keydown", (event) => {
      if (event.key === " ") {
        event.preventDefault();
        this.reveal?.(true);
        this.modalEl.parentElement?.addClass("is-previewing-toolbar");
      }
    });
    eye.addEventListener("keyup", release);
    header.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
    root.createDiv({
      cls: "finenotes-x-toolbar-editor-hint",
      text: "Drag to arrange · 22 slots · Changes apply instantly · Hold the eye to preview.",
    });
    const preview = root.createDiv({ cls: "finenotes-x-strip-preview-row" });
    this.area(preview, "strip", "Menu strip");
    this.area(preview, "more", "… More (hidden strip)");
    for (const strip of this.items.filter((item) => item.id === "menu-strip" && item.visible)) {
      const editor = root.createDiv({ cls: "finenotes-x-added-strip-editor" });
      const controls = editor.createDiv({ cls: "finenotes-x-added-strip-controls" });
      controls.createEl("strong", { text: "Added menu strip" });
      this.stripChoice(
        controls,
        "Position",
        strip.position ?? "top",
        ["top", "bottom", "left", "right"],
        (value) => {
          strip.position = value as ToolbarItemChoice["position"];
        },
      );
      this.stripChoice(
        controls,
        "Alignment",
        strip.alignment ?? "center",
        ["left", "right", "center", "stretch"],
        (value) => {
          strip.alignment = value as ToolbarItemChoice["alignment"];
        },
      );
      controls.createEl("button", { text: "Remove" }).addEventListener("click", () => {
        this.items = this.items
          .map((item) =>
            item.container === strip.key ? { ...item, visible: false, container: undefined } : item,
          )
          .filter((item) => item !== strip);
        this.render();
      });
      this.area(
        editor,
        "strip",
        `${strip.position ?? "top"} · ${strip.alignment ?? "center"}`,
        strip.key,
      );
    }
    const submenu = this.items.find(
      (item) => item.key === this.editingSubmenu && item.id === "submenu" && item.visible,
    );
    if (submenu) {
      const editor = root.createDiv({ cls: "finenotes-x-submenu-editor" });
      const label = editor.createEl("label", { text: "Submenu name" });
      const name = label.createEl("input", {
        type: "text",
        value: submenu.name ?? "Submenu",
        attr: { maxlength: "60" },
      });
      name.addEventListener("input", () => {
        submenu.name = name.value;
        this.save(this.items);
        for (const tile of root.querySelectorAll<HTMLElement>("[data-index]")) {
          if (this.items[Number(tile.dataset.index)]?.key === submenu.key) {
            const caption = tile.querySelector(".finenotes-x-strip-tile-label");
            if (caption) caption.textContent = name.value || "Submenu";
          }
        }
      });
      const icons = editor.createEl("select", { attr: { "aria-label": "Submenu icon" } });
      for (const icon of [
        "panel-left-open",
        "pen-tool",
        "palette",
        "eraser",
        "sigma",
        "shapes",
        "ruler",
        "star",
        "more-horizontal",
      ])
        icons.createEl("option", { value: icon, text: icon });
      icons.value = submenu.icon ?? "panel-left-open";
      icons.addEventListener("change", () => {
        submenu.icon = icons.value;
        this.render();
      });
      this.area(
        editor,
        submenu.group === "more" ? "more" : "strip",
        `${submenu.name ?? "Submenu"} contents`,
        submenu.key,
      );
      editor.createEl("button", { text: "Close submenu preview" }).addEventListener("click", () => {
        this.editingSubmenu = null;
        this.render();
      });
    }
    root.createEl("h3", { text: "Available actions and layout pieces" });
    const library = root.createDiv({ cls: "finenotes-x-strip-catalogue" });
    library.dataset.destination = "library";
    for (const spec of TOOLBAR_LAYOUT_ITEMS)
      this.tile(library, { id: spec.id, visible: false, group: "strip" }, -1);
    this.items.forEach((item, index) => {
      if (!isToolbarLayoutItem(item.id)) this.tile(library, item, index, true);
    });
    const foot = root.createDiv({ cls: "finenotes-x-toolbar-editor-footer" });
    foot.createEl("button", { text: "Add menu strip" }).addEventListener("click", () => {
      this.items.push({
        id: "menu-strip",
        key: `strip-${Date.now()}-${++this.sequence}`,
        visible: true,
        group: "strip",
        position: "top",
        alignment: "center",
      });
      this.render();
    });
    if (this.editPens)
      foot
        .createEl("button", { text: "Edit favorite pens" })
        .addEventListener("click", () => this.editPens?.());
    foot.createEl("button", { text: "Restore defaults" }).addEventListener("click", () => {
      this.items = stripLayoutOf(DEFAULT_TOOLBAR_ITEMS);
      this.render();
    });
  }
  private stripChoice(
    host: HTMLElement,
    label: string,
    value: string,
    choices: readonly string[],
    changed: (value: string) => void,
  ): void {
    const field = host.createEl("label", { text: label });
    const select = field.createEl("select");
    for (const choice of choices)
      select.createEl("option", { value: choice, text: choice[0].toUpperCase() + choice.slice(1) });
    select.value = value;
    select.addEventListener("change", () => {
      changed(select.value);
      this.render();
    });
  }
  private area(
    host: HTMLElement,
    destination: Destination,
    label: string,
    container?: string,
  ): void {
    const section = host.createDiv({ cls: `finenotes-x-strip-preview-section is-${destination}` });
    section.createDiv({ cls: "finenotes-x-strip-preview-label", text: label });
    const list = section.createDiv({
      cls: "finenotes-x-strip-preview",
      attr: { role: "group", "aria-label": label },
    });
    list.dataset.destination = destination;
    if (container) list.dataset.container = container;
    this.items.forEach((item, index) => {
      if (!item.visible || item.group !== destination || item.container !== container) return;
      if (item.id === "menu-strip" && !container) return;
      if (item.id === "group") {
        const pill = list.createDiv({ cls: "finenotes-x-strip-preview-pill" });
        pill.setCssProps({ "--preview-slots": String(stripItemSlots(item, this.items)) });
        const handle = this.tile(pill, item, index);
        handle.addClass("is-group-handle");
        const inside = pill.createDiv({
          cls: "finenotes-x-strip-preview-group-items",
          attr: { role: "group", "aria-label": "Group contents" },
        });
        inside.dataset.destination = destination;
        inside.dataset.container = item.key;
        this.items.forEach((child, at) => {
          if (child.visible && child.container === item.key) this.tile(inside, child, at);
        });
      } else this.tile(list, item, index);
    });
    if (
      destination === "strip" &&
      !container &&
      !this.items.some(
        (item) => item.id === "more" && item.visible && item.group === "strip" && !item.container,
      )
    ) {
      const more = list.createDiv({ cls: "finenotes-x-strip-tile is-more" });
      setIcon(more.createSpan({ cls: "finenotes-x-strip-tile-icon" }), "more-horizontal");
      more.createSpan({ cls: "finenotes-x-strip-tile-label", text: "More" });
      more.setAttribute("title", "More remains available for overflow actions");
    }
    if (destination === "strip" || container) {
      const used = stripSlots(this.items, container);
      section.createDiv({
        cls: "finenotes-x-strip-slot-count",
        text: `${used} / 22 slots`,
      });
      for (let i = used; i < 22; i++)
        list.createDiv({ cls: "finenotes-x-strip-empty-slot", attr: { "aria-hidden": "true" } });
    }
  }
  private tile(
    host: HTMLElement,
    item: ToolbarItemChoice,
    index: number,
    catalogue = false,
  ): HTMLElement {
    const spec = specs.get(item.id)!;
    const savedPen = this.savedPens?.()[savedPenToolbarIndex(item.id)];
    const label = savedPen
      ? `${spec.label}: ${savedPenLabel(savedPen)}`
      : (item.name ?? spec.label);
    const tile = host.createEl("button", {
      cls: `finenotes-x-strip-tile is-${item.id}`,
      attr: {
        title: label,
        "aria-label": `${spec.label}: drag to place; Enter moves to strip; Delete removes`,
        type: "button",
      },
    });
    if (index >= 0 && !catalogue) tile.dataset.index = String(index);
    tile.toggleClass("is-placed", catalogue && item.visible);
    tile.setCssProps({ "--preview-slots": String(stripItemSlots(item, this.items)) });
    const icon = tile.createSpan({ cls: "finenotes-x-strip-tile-icon" });
    if (savedPen) {
      icon.append(penGlyph(savedPen.type, savedPen.color, tile.ownerDocument));
      icon.createSpan({
        cls: "finenotes-x-favorite-pen-number",
        text: String(savedPenToolbarIndex(item.id) + 1),
      });
    } else setIcon(icon, item.icon ?? spec.icon);
    tile.createSpan({ cls: "finenotes-x-strip-tile-label", text: label });
    tile.addEventListener("keydown", (event) => {
      let destination: Destination | null = null;
      if (event.key === "Enter" && item.id === "submenu" && index >= 0) {
        event.preventDefault();
        this.editingSubmenu = item.key!;
        this.render();
        return;
      }
      if (event.key === "Enter") destination = "strip";
      if (event.key === "Delete" || event.key === "Backspace") destination = "library";
      if (event.key.toLowerCase() === "m") destination = "more";
      if (destination) {
        event.preventDefault();
        this.move(item, index, destination);
      }
      if (index >= 0 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        const peers = this.items
          .map((v, i) => ({ v, i }))
          .filter(
            ({ v }) =>
              v.visible === item.visible &&
              v.group === item.group &&
              v.container === item.container,
          );
        const at = peers.findIndex((p) => p.i === index),
          other = peers[at + (event.key === "ArrowLeft" ? -1 : 1)];
        if (other) {
          this.items = moveStripItem(
            this.items,
            index,
            item.group === "more" ? "more" : "strip",
            item.container,
            event.key === "ArrowLeft" ? other.i : peers[at + 2]?.i,
          );
          this.render();
        }
      }
    });
    let pointer: number | null = null,
      moved = false,
      x = 0,
      y = 0;
    tile.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      pointer = event.pointerId;
      moved = false;
      x = event.clientX;
      y = event.clientY;
      tile.setPointerCapture(pointer);
    });
    tile.addEventListener("pointermove", (event) => {
      if (pointer !== event.pointerId) return;
      moved ||= Math.hypot(event.clientX - x, event.clientY - y) > 5;
      if (!moved) return;
      if (!this.ghost) {
        this.ghost = this.contentEl.createDiv({
          cls: "finenotes-x-strip-drag-ghost",
          text: spec.label,
        });
      }
      this.ghost.setCssStyles({ left: `${event.clientX + 12}px`, top: `${event.clientY + 12}px` });
      this.contentEl.querySelector(".finenotes-x-drag-insertion")?.remove();
      const hit = this.contentEl.ownerDocument.elementFromPoint(event.clientX, event.clientY);
      const target = hit?.closest<HTMLElement>("[data-index]");
      const zone = hit?.closest<HTMLElement>("[data-destination]");
      if (zone && zone.dataset.destination !== "library") {
        const placeholder = zone.createDiv({ cls: "finenotes-x-drag-insertion" });
        placeholder.setCssProps({ "--preview-slots": String(stripItemSlots(item, this.items)) });
        if (target && target.parentElement === zone)
          zone.insertBefore(
            placeholder,
            event.clientX <
              target.getBoundingClientRect().left + target.getBoundingClientRect().width / 2
              ? target
              : target.nextSibling,
          );
      }
      for (const area of this.contentEl.querySelectorAll(".is-drop-target"))
        area.removeClass("is-drop-target");
      this.contentEl.ownerDocument
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-destination]")
        ?.addClass("is-drop-target");
    });
    const end = (event: PointerEvent): void => {
      if (pointer !== event.pointerId) return;
      pointer = null;
      this.contentEl.querySelector(".finenotes-x-drag-insertion")?.remove();
      this.ghost?.remove();
      this.ghost = null;
      if (event.type !== "pointercancel" && moved) {
        const hit = this.contentEl.ownerDocument.elementFromPoint(event.clientX, event.clientY);
        const area = hit?.closest<HTMLElement>("[data-destination]");
        if (area) {
          const target = hit?.closest<HTMLElement>("[data-index]");
          let before = target ? Number(target.dataset.index) : undefined;
          if (
            target &&
            event.clientX >
              target.getBoundingClientRect().left + target.getBoundingClientRect().width / 2
          )
            before = before! + 1;
          this.move(
            item,
            index,
            area.dataset.destination as Destination,
            area.dataset.container,
            before,
          );
          return;
        }
      }
      if (!moved && event.type !== "pointercancel" && item.id === "submenu" && index >= 0)
        this.editingSubmenu = item.key!;
      this.render();
    };
    tile.addEventListener("pointerup", end);
    tile.addEventListener("pointercancel", end);
    return tile;
  }
  private move(
    item: ToolbarItemChoice,
    index: number,
    destination: Destination,
    container?: string,
    before?: number,
  ): void {
    const created = index < 0;
    if (index < 0) {
      if (destination === "library") return;
      this.items.push({ ...item, key: `piece-${Date.now()}-${++this.sequence}` });
      index = this.items.length - 1;
    }
    const next = moveStripItem(this.items, index, destination, container, before);
    if (JSON.stringify(next) === JSON.stringify(this.items) && destination !== "library") {
      if (created) this.items.splice(index, 1);
      new Notice(
        "This placement is unavailable. The strip and each submenu have 22 slots; groups cannot nest inside groups.",
      );
    } else this.items = next;
    this.render();
  }
}
