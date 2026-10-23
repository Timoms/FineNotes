/** Modal for creating and editing native `.finepaper` templates. */

import { type App, Modal, setIcon } from "obsidian";
import { LIGHT_PAPER, drawSynthetic } from "../canvas/backdrop";
import {
  type GeneratedPaperFile,
  type PaperSide,
  type PaperTexture,
  insetsInMm,
} from "../model/generated-paper";
import { PAGE_SIZES, sizeGeometry, sizeOf } from "../model/templates";
import { mmToPage, pageToMm } from "../model/units";

interface GeneratorState {
  name: string;
  sizeId: string;
  landscape: boolean;
  paper: string;
  texture: PaperTexture;
  ruling: "blank" | "ruled-wide" | "squared" | "dotted";
  spacingMm: number;
  rule: string;
  margins: { top: number; right: number; bottom: number; left: number };
  blankSide: PaperSide | "none";
  blankMm: number;
  dividerSide: "none" | "left" | "right" | "both";
  dividerLeftInsetMm: number;
  dividerRightInsetMm: number;
  dividerColor: string;
}

export class PaperGeneratorModal extends Modal {
  private state: GeneratorState;
  private preview: HTMLCanvasElement | null = null;
  private previewZoom = 1;
  private previewX = 0;
  private previewY = 0;
  private zoomLabel: HTMLElement | null = null;

  constructor(
    app: App,
    initial: { name: string; paper: GeneratedPaperFile } | null,
    private readonly save: (name: string, paper: GeneratedPaperFile) => Promise<boolean>,
  ) {
    super(app);
    this.state = stateOf(initial);
  }

  override onOpen(): void {
    this.modalEl.addClass("goodobsidian-paper-generator-modal", "goodobsidian-dialog");
    this.titleEl.setText("Paper generator");
    this.contentEl.empty();
    const layout = this.contentEl.createDiv({ cls: "goodobsidian-paper-generator" });
    const previewWrap = layout.createDiv({ cls: "goodobsidian-paper-generator-preview" });
    const previewTools = previewWrap.createDiv({ cls: "goodobsidian-paper-generator-preview-tools" });
    this.previewButton(previewTools, "minus", "Zoom out", () => this.zoomBy(-0.25));
    this.zoomLabel = previewTools.createSpan({ cls: "goodobsidian-paper-generator-zoom" });
    this.previewButton(previewTools, "plus", "Zoom in", () => this.zoomBy(0.25));
    this.previewButton(previewTools, "maximize-2", "Reset preview", () => this.resetPreview());
    const previewStage = previewWrap.createDiv({ cls: "goodobsidian-paper-generator-preview-stage" });
    this.preview = previewStage.createEl("canvas");
    this.bindPreview(previewStage);
    const controls = layout.createDiv({ cls: "goodobsidian-paper-generator-controls" });

    this.text(controls, "Name", this.state.name, (value) => (this.state.name = value));
    const page = this.group(controls, "Page");
    this.select(
      page,
      "Size",
      PAGE_SIZES.map((size) => [size.id, size.label]),
      this.state.sizeId,
      (value) => (this.state.sizeId = value),
    );
    this.select(
      page,
      "Orientation",
      [
        ["portrait", "Portrait"],
        ["landscape", "Landscape"],
      ],
      this.state.landscape ? "landscape" : "portrait",
      (value) => (this.state.landscape = value === "landscape"),
    );

    const paper = this.group(controls, "Paper");
    this.color(paper, "Color", this.state.paper, (value) => (this.state.paper = value));
    this.select(
      paper,
      "Texture",
      [
        ["plain", "Plain"],
        ["fine", "Structured paper"],
        ["heavy", "Heavy structured"],
      ],
      this.state.texture,
      (value) => (this.state.texture = value as PaperTexture),
    );

    const ruling = this.group(controls, "Grid or lines");
    this.select(
      ruling,
      "Style",
      [
        ["blank", "None"],
        ["ruled-wide", "Lines"],
        ["squared", "Grid"],
        ["dotted", "Dots"],
      ],
      this.state.ruling,
      (value) => (this.state.ruling = value as GeneratorState["ruling"]),
    );
    this.number(ruling, "Spacing (mm)", this.state.spacingMm, 2, 50, 0.5, (value) => {
      this.state.spacingMm = value;
    });
    this.color(ruling, "Line color", this.state.rule, (value) => (this.state.rule = value));

    const margins = this.group(controls, "Margins (mm)");
    for (const side of ["top", "right", "bottom", "left"] as const) {
      this.number(margins, side[0].toUpperCase() + side.slice(1), this.state.margins[side], 0, 100, 1, (value) => {
        this.state.margins[side] = value;
      });
    }

    const sections = this.group(controls, "Comment section");
    this.select(
      sections,
      "Blank side",
      [
        ["none", "None"],
        ["left", "Left"],
        ["right", "Right"],
        ["top", "Top"],
        ["bottom", "Bottom"],
      ],
      this.state.blankSide,
      (value) => (this.state.blankSide = value as GeneratorState["blankSide"]),
    );
    this.number(sections, "Section size (mm)", this.state.blankMm, 5, 150, 1, (value) => {
      this.state.blankMm = value;
    });
    this.select(
      sections,
      "Border lines",
      [
        ["none", "None"],
        ["left", "Left"],
        ["right", "Right"],
        ["both", "Both sides"],
      ],
      this.state.dividerSide,
      (value) => (this.state.dividerSide = value as GeneratorState["dividerSide"]),
    );
    this.numberPair(
      sections,
      "Line positions (mm)",
      ["Left", this.state.dividerLeftInsetMm],
      ["Right", this.state.dividerRightInsetMm],
      (left, right) => {
        this.state.dividerLeftInsetMm = left;
        this.state.dividerRightInsetMm = right;
      },
    );
    this.color(sections, "Border color", this.state.dividerColor, (value) => {
      this.state.dividerColor = value;
    });

    const footer = controls.createDiv({
      cls: "goodobsidian-templates-footer goodobsidian-paper-generator-footer",
    });
    footer.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    const save = footer.createEl("button", { cls: "mod-cta", text: "Save paper" });
    save.addEventListener("click", () => {
      save.disabled = true;
      void this.save(this.state.name.trim() || "Generated paper", this.paper()).then((saved) => {
        save.disabled = false;
        if (saved) this.close();
      });
    });
    this.repaint();
  }

  override onClose(): void {
    this.preview = null;
    this.zoomLabel = null;
    this.contentEl.empty();
  }

  private paper(): GeneratedPaperFile {
    const geometry = sizeGeometry(this.state.sizeId, this.state.landscape);
    const backdrop: GeneratedPaperFile["backdrop"] = {
      kind: this.state.ruling,
      spacing: mmToPage(this.state.spacingMm),
      color: this.state.rule,
      margins: {
        top: mmToPage(this.state.margins.top),
        right: mmToPage(this.state.margins.right),
        bottom: mmToPage(this.state.margins.bottom),
        left: mmToPage(this.state.margins.left),
      },
    };
    if (this.state.paper !== "#ffffff") backdrop.paperColor = this.state.paper;
    if (this.state.texture !== "plain") backdrop.texture = this.state.texture;
    if (this.state.blankSide !== "none") {
      backdrop.blankZones = [{ side: this.state.blankSide, size: mmToPage(this.state.blankMm) }];
    }
    const sides =
      this.state.dividerSide === "both"
        ? (["left", "right"] as const)
        : this.state.dividerSide === "none"
          ? []
          : [this.state.dividerSide];
    if (sides.length) {
      backdrop.dividers = sides.map((side) => ({
        side,
        inset: mmToPage(
          side === "left" ? this.state.dividerLeftInsetMm : this.state.dividerRightInsetMm,
        ),
        color: this.state.dividerColor,
        width: 1,
      }));
    }
    return { format: 1, geometry, backdrop };
  }

  private repaint(): void {
    const canvas = this.preview;
    if (!canvas) return;
    const paper = this.paper();
    const cssWidth = 260;
    const dpr = window.devicePixelRatio || 1;
    const k = (cssWidth / paper.geometry.width) * dpr;
    canvas.width = Math.round(paper.geometry.width * k);
    canvas.height = Math.round(paper.geometry.height * k);
    canvas.setCssStyles({ aspectRatio: `${paper.geometry.width} / ${paper.geometry.height}` });
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawSynthetic(ctx, paper.backdrop, paper.geometry, LIGHT_PAPER, Math.max(1, 0.5 / (cssWidth / paper.geometry.width)));
    this.placePreview();
  }

  private previewButton(
    parent: HTMLElement,
    icon: string,
    label: string,
    run: () => void,
  ): void {
    const button = parent.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": label, title: label },
    });
    setIcon(button, icon);
    button.addEventListener("click", run);
  }

  private zoomBy(delta: number): void {
    this.previewZoom = Math.min(4, Math.max(0.5, this.previewZoom + delta));
    this.placePreview();
  }

  private resetPreview(): void {
    this.previewZoom = 1;
    this.previewX = 0;
    this.previewY = 0;
    this.placePreview();
  }

  private placePreview(): void {
    this.preview?.setCssStyles({
      transform: `translate(${this.previewX}px, ${this.previewY}px) scale(${this.previewZoom})`,
    });
    this.zoomLabel?.setText(`${Math.round(this.previewZoom * 100)}%`);
  }

  private bindPreview(stage: HTMLElement): void {
    let drag: { id: number; x: number; y: number } | null = null;
    stage.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      stage.addClass("is-panning");
      stage.setPointerCapture(event.pointerId);
    });
    stage.addEventListener("pointermove", (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      this.previewX += event.clientX - drag.x;
      this.previewY += event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
      this.placePreview();
    });
    const end = (event: PointerEvent): void => {
      if (!drag || drag.id !== event.pointerId) return;
      drag = null;
      stage.removeClass("is-panning");
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    stage.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.zoomBy(event.deltaY < 0 ? 0.25 : -0.25);
      },
      { passive: false },
    );
    stage.addEventListener("dblclick", () => this.resetPreview());
  }

  private group(parent: HTMLElement, title: string): HTMLElement {
    const details = parent.createEl("details", { cls: "goodobsidian-paper-generator-group" });
    details.open = true;
    details.createEl("summary", { text: title });
    return details.createDiv();
  }

  private row(parent: HTMLElement, label: string): HTMLElement {
    const row = parent.createDiv({ cls: "goodobsidian-paper-generator-row" });
    row.createSpan({ text: label });
    return row;
  }

  private text(parent: HTMLElement, label: string, value: string, change: (value: string) => void): void {
    const input = this.row(parent, label).createEl("input", { type: "text", value });
    input.addEventListener("input", () => change(input.value));
  }

  private color(parent: HTMLElement, label: string, value: string, change: (value: string) => void): void {
    const input = this.row(parent, label).createEl("input", { type: "color", value });
    input.addEventListener("input", () => {
      change(input.value);
      this.repaint();
    });
  }

  private number(parent: HTMLElement, label: string, value: number, min: number, max: number, step: number, change: (value: number) => void): void {
    const input = this.row(parent, label).createEl("input", {
      type: "number",
      attr: { value: String(value), min: String(min), max: String(max), step: String(step) },
    });
    input.addEventListener("input", () => {
      const next = Number(input.value);
      if (Number.isFinite(next)) change(Math.min(max, Math.max(min, next)));
      this.repaint();
    });
  }

  private numberPair(
    parent: HTMLElement,
    label: string,
    left: readonly [string, number],
    right: readonly [string, number],
    change: (left: number, right: number) => void,
  ): void {
    const pair = this.row(parent, label).createDiv({ cls: "goodobsidian-paper-generator-pair" });
    const input = ([name, value]: readonly [string, number]): HTMLInputElement =>
      pair.createEl("input", {
        type: "number",
        attr: {
          value: String(value),
          min: "0",
          max: "150",
          step: "1",
          placeholder: name,
          "aria-label": `${name} line position in millimetres`,
          title: name,
        },
      });
    const leftInput = input(left);
    const rightInput = input(right);
    const update = (): void => {
      const leftValue = Math.min(150, Math.max(0, Number(leftInput.value) || 0));
      const rightValue = Math.min(150, Math.max(0, Number(rightInput.value) || 0));
      change(leftValue, rightValue);
      this.repaint();
    };
    leftInput.addEventListener("input", update);
    rightInput.addEventListener("input", update);
  }

  private select(parent: HTMLElement, label: string, options: string[][], value: string, change: (value: string) => void): void {
    const select = this.row(parent, label).createEl("select");
    for (const [id, name] of options) {
      const option = select.createEl("option", { value: id, text: name });
      option.selected = id === value;
    }
    select.addEventListener("change", () => {
      change(select.value);
      this.repaint();
    });
  }
}

function stateOf(initial: { name: string; paper: GeneratedPaperFile } | null): GeneratorState {
  const paper = initial?.paper;
  const backdrop = paper?.backdrop;
  const size = paper ? sizeOf(paper.geometry) : null;
  const margins = insetsInMm(backdrop?.margins);
  const zone = backdrop?.blankZones?.[0];
  const sides = new Set(backdrop?.dividers?.map((divider) => divider.side));
  const dividerSide = sides.has("left") && sides.has("right") ? "both" : sides.has("left") ? "left" : sides.has("right") ? "right" : "none";
  const leftDivider = backdrop?.dividers?.find((divider) => divider.side === "left");
  const rightDivider = backdrop?.dividers?.find((divider) => divider.side === "right");
  return {
    name: initial?.name ?? "My paper",
    sizeId: size?.sizeId ?? "standard",
    landscape: size?.landscape ?? false,
    paper: backdrop?.paperColor ?? "#ffffff",
    texture: backdrop?.texture ?? "plain",
    ruling: backdrop?.kind === "squared" || backdrop?.kind === "dotted" || backdrop?.kind === "blank" ? backdrop.kind : "ruled-wide",
    spacingMm: pageToMm(backdrop?.spacing ?? mmToPage(8)),
    rule: backdrop?.color ?? "#b8cde8",
    margins,
    blankSide: zone?.side ?? "none",
    blankMm: pageToMm(zone?.size ?? mmToPage(40)),
    dividerSide,
    dividerLeftInsetMm: pageToMm(leftDivider?.inset ?? mmToPage(25)),
    dividerRightInsetMm: pageToMm(rightDivider?.inset ?? mmToPage(25)),
    dividerColor: backdrop?.dividers?.[0]?.color ?? "#df7777",
  };
}
