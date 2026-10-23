import type { Pt } from "../ink/shape-geometry";
import { PAGE_PX_PER_MM } from "../model/units";

export interface RulerLine {
  kind?: "line";
  origin: Pt;
  direction: Pt;
}

export interface RulerArc {
  kind: "arc";
  center: Pt;
  radius: number;
}

export type RulerGuide = RulerLine | RulerArc;

export type RulerTheme = "clear" | "light" | "dark" | "school";
export type RulerUnit = "cm" | "inch";
export type RulerKind = "ruler" | "triangle" | "protractor";
export type RulerDegreeSnap = "off" | 5 | 15 | 30 | 45;

export interface RulerSettings {
  theme: RulerTheme;
  unit: RulerUnit;
  /** A straight ruler, geometry triangle or semicircular protractor. */
  kind: RulerKind;
  /** Physical width/diameter expressed in the selected unit. */
  baseLength: number;
  /** Rotation grid in degrees; cardinal directions receive a stronger magnet. */
  degreeSnap: RulerDegreeSnap;
  /** Legacy appearance value; physical tool dimensions no longer resize. */
  scale: number;
}

export const DEFAULT_RULER_SETTINGS: RulerSettings = {
  theme: "clear",
  unit: "cm",
  kind: "ruler",
  baseLength: 12,
  degreeSnap: 15,
  scale: 1,
};

export function parseRulerSettings(value: unknown): RulerSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_RULER_SETTINGS };
  const raw = value as Partial<RulerSettings>;
  return {
    theme:
      raw.theme === "light" || raw.theme === "dark" || raw.theme === "school"
        ? raw.theme
        : "clear",
    unit: raw.unit === "inch" ? "inch" : "cm",
    kind: raw.kind === "triangle" || raw.kind === "protractor" ? raw.kind : "ruler",
    baseLength: rulerBaseLength(raw.baseLength, raw.unit === "inch" ? "inch" : "cm"),
    degreeSnap:
      raw.degreeSnap === "off" ||
      raw.degreeSnap === 5 ||
      raw.degreeSnap === 15 ||
      raw.degreeSnap === 30 ||
      raw.degreeSnap === 45
        ? raw.degreeSnap
        : 15,
    scale:
      typeof raw.scale === "number" && Number.isFinite(raw.scale)
        ? Math.min(1.5, Math.max(0.5, raw.scale))
        : 1,
  };
}

export function rulerBaseLength(value: unknown, unit: RulerUnit): number {
  const fallback = unit === "inch" ? 12 / 2.54 : 12;
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const mm = value * (unit === "inch" ? 25.4 : 10);
  const clamped = Math.min(500, Math.max(50, mm));
  return clamped / (unit === "inch" ? 25.4 : 10);
}

/** Smallest marked interval at the current calibrated screen scale. */
export function rulerStepMm(pxPerMm: number, unit: RulerUnit): number {
  if (unit === "inch") {
    if (pxPerMm >= 400) return 25.4 / 1024;
    if (pxPerMm >= 80) return 25.4 / 256;
    return pxPerMm >= 8 ? 25.4 / 32 : pxPerMm >= 2 ? 25.4 / 8 : 25.4;
  }
  // One micrometre is the hard floor: zooming further never creates more UI.
  if (pxPerMm >= 800) return 0.001;
  if (pxPerMm >= 120) return 0.01;
  return pxPerMm >= 12 ? 0.1 : pxPerMm >= 3 ? 1 : 10;
}

/** Project a point onto an infinite line. Kept pure for geometry tests. */
export function projectToLine(point: Pt, line: RulerLine): Pt {
  const dx = point.x - line.origin.x;
  const dy = point.y - line.origin.y;
  const along = dx * line.direction.x + dy * line.direction.y;
  return {
    x: line.origin.x + along * line.direction.x,
    y: line.origin.y + along * line.direction.y,
  };
}

export function projectToGuide(point: Pt, guide: RulerGuide): Pt {
  if (guide.kind !== "arc") return projectToLine(point, guide);
  const dx = point.x - guide.center.x;
  const dy = point.y - guide.center.y;
  const distance = Math.max(0.0001, Math.hypot(dx, dy));
  return {
    x: guide.center.x + (dx / distance) * guide.radius,
    y: guide.center.y + (dy / distance) * guide.radius,
  };
}

/** A screen-space ruler: fingers move it; a Pencil writes against either long edge. */
export class RulerOverlay {
  private readonly el: HTMLElement;
  private x = 0;
  private y = 0;
  private angle = -8;
  private rawAngle = -8;
  /** Fixed physical span for the selected real-world tool. */
  private lengthMm = 120;
  /** CSS px per millimetre at the canvas zoom now. */
  private pxPerMm = 4;
  private heightMm = 18;
  private shown = false;
  private settings: RulerSettings = { ...DEFAULT_RULER_SETTINGS };
  private readonly ticks: HTMLElement;

  constructor(private readonly host: HTMLElement) {
    this.el = host.createDiv({ cls: "goodobsidian-ruler is-hidden" });
    this.el.setAttribute("aria-hidden", "true");
    this.ticks = this.el.createDiv({ cls: "goodobsidian-ruler-ticks" });
    const move = this.el.createDiv({ cls: "goodobsidian-ruler-handle is-move" });
    move.setAttribute("aria-label", "Move ruler");
    const transform = this.el.createDiv({ cls: "goodobsidian-ruler-handle is-transform" });
    transform.setAttribute("aria-label", "Rotate ruler");
    this.bindHandle(move, "move");
    this.bindHandle(transform, "transform");
    this.renderTicks();
  }

  setVisible(visible: boolean): void {
    this.shown = visible;
    this.el.toggleClass("is-hidden", !visible);
    if (visible && this.x === 0 && this.y === 0) {
      this.x = this.host.clientWidth / 2;
      this.y = Math.max(150, this.host.clientHeight / 2);
    }
    this.place();
  }

  get visible(): boolean {
    return this.shown;
  }

  hit(clientX: number, clientY: number): boolean {
    if (!this.shown) return false;
    const p = this.local(clientX, clientY);
    if (Math.abs(p.x) > this.lengthPx / 2 || Math.abs(p.y) > this.toolHeight / 2 + 12) return false;
    if (this.settings.kind === "ruler") return true;
    if (this.settings.kind === "protractor") {
      const radius = this.lengthPx / 2;
      const centre = { x: 0, y: this.toolHeight / 2 };
      const distance = Math.hypot(p.x - centre.x, p.y - centre.y);
      const base = p.y > this.toolHeight / 2 - this.heightMm * this.pxPerMm * 0.16;
      return p.y <= centre.y && distance <= radius + 12 && (distance >= radius * 0.52 || base);
    }
    // The geometry triangle is a symmetric 45-degree set square.
    const left = -this.lengthPx / 2;
    const top = -this.toolHeight / 2;
    const u = (p.x - left) / this.lengthPx;
    const v = (p.y - top) / this.toolHeight;
    return Math.abs(u - 0.5) <= (1 - v) / 2 + 0.06;
  }

  moveBy(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
    this.place();
  }

  transformBy(scaleFactor: number, rotation: number): void {
    void scaleFactor;
    this.rawAngle += rotation;
    this.angle = snapRotation(this.rawAngle, this.settings.degreeSnap);
    this.place();
  }

  /** Keep every marking calibrated to the page while its zoom changes. */
  setPageScale(cssPxPerPagePx: number): void {
    const pxPerMm = cssPxPerPagePx * PAGE_PX_PER_MM;
    if (!(pxPerMm > 0) || !Number.isFinite(pxPerMm)) return;
    if (Math.abs(pxPerMm - this.pxPerMm) < 0.001) return;
    this.pxPerMm = pxPerMm;
    this.renderTicks();
    this.place();
  }

  setSettings(settings: RulerSettings): void {
    this.settings = parseRulerSettings(settings);
    this.angle = snapRotation(this.rawAngle, this.settings.degreeSnap);
    const dimensions = physicalDimensions(this.settings.kind, this.settings);
    this.lengthMm = dimensions.width;
    this.heightMm = dimensions.height;
    this.el.setAttribute("data-theme", this.settings.theme);
    this.el.setAttribute("data-kind", this.settings.kind);
    this.renderTicks();
    this.place();
  }

  get configuration(): RulerSettings {
    return { ...this.settings };
  }

  /** The nearer long edge when the Pencil lands close enough to use it. */
  guideAt(clientX: number, clientY: number): RulerGuide | null {
    if (!this.shown) return null;
    const p = this.local(clientX, clientY);
    if (Math.abs(p.x) > this.lengthPx / 2 + 24) return null;
    if (this.settings.kind === "protractor") return this.protractorGuide(p);
    const edges = this.localEdges();
    let best: { a: Pt; b: Pt; distance: number } | null = null;
    for (const edge of edges) {
      const projected = projectToSegment(p, edge.a, edge.b);
      const distance = Math.hypot(p.x - projected.x, p.y - projected.y);
      if (!best || distance < best.distance) best = { ...edge, distance };
    }
    if (!best || best.distance > 30) return null;
    const rect = this.host.getBoundingClientRect();
    const radians = (this.angle * Math.PI) / 180;
    const localDx = best.b.x - best.a.x;
    const localDy = best.b.y - best.a.y;
    const magnitude = Math.max(1, Math.hypot(localDx, localDy));
    const ux = localDx / magnitude;
    const uy = localDy / magnitude;
    const direction = {
      x: ux * Math.cos(radians) - uy * Math.sin(radians),
      y: ux * Math.sin(radians) + uy * Math.cos(radians),
    };
    const originLocal = best.a;
    return {
      origin: {
        x:
          rect.left +
          this.x +
          originLocal.x * Math.cos(radians) -
          originLocal.y * Math.sin(radians),
        y:
          rect.top +
          this.y +
          originLocal.x * Math.sin(radians) +
          originLocal.y * Math.cos(radians),
      },
      direction,
    };
  }

  private local(clientX: number, clientY: number): Pt {
    const rect = this.host.getBoundingClientRect();
    const dx = clientX - rect.left - this.x;
    const dy = clientY - rect.top - this.y;
    const radians = (-this.angle * Math.PI) / 180;
    return {
      x: dx * Math.cos(radians) - dy * Math.sin(radians),
      y: dx * Math.sin(radians) + dy * Math.cos(radians),
    };
  }

  private place(): void {
    const length = this.lengthPx;
    const height = this.toolHeight;
    this.el.setCssStyles({
      width: `${length}px`,
      height: `${height}px`,
      transform: `translate(${this.x - length / 2}px, ${this.y - height / 2}px) rotate(${this.angle}deg)`,
    });
  }

  private renderTicks(): void {
    this.ticks.empty();
    if (this.settings.kind === "protractor") {
      this.renderDegrees();
      this.renderProtractorScale();
      return;
    }
    const inch = this.settings.unit === "inch";
    // More detail appears only when it has room: cm → mm → 0.1 mm (100 µm),
    // or inches → eighths → thirty-seconds. The distance itself never changes.
    const stepMm = rulerStepMm(this.pxPerMm, this.settings.unit);
    const majorMm = inch ? 25.4 : 10;
    const halfMm = inch ? 25.4 / 2 : 5;
    // CSS repeats the potentially microscopic ticks without creating tens of
    // thousands of elements. Only the numbered major marks need DOM nodes.
    this.ticks.setCssProps({
      "--gob-ruler-minor": `${Math.max(0.5, stepMm * this.pxPerMm)}px`,
      "--gob-ruler-half": `${Math.max(0.5, halfMm * this.pxPerMm)}px`,
      "--gob-ruler-major": `${Math.max(0.5, majorMm * this.pxPerMm)}px`,
    });
    const majors = Math.floor(this.lengthMm / majorMm);
    for (let i = 1; i <= majors; i++) {
      const label = this.ticks.createSpan({
        cls: "goodobsidian-ruler-number",
        text: String(i),
      });
      label.setCssStyles({ left: `${i * majorMm * this.pxPerMm}px` });
    }
    if (this.settings.kind === "triangle") this.renderTriangleDegrees();
  }

  private bindHandle(handle: HTMLElement, kind: "move" | "transform"): void {
    let drag: { id: number; x: number; y: number; angle: number } | null = null;
    const down = (event: PointerEvent): void => {
      if (event.pointerType === "touch") return;
      event.preventDefault();
      event.stopPropagation();
      const rect = this.host.getBoundingClientRect();
      const dx = event.clientX - rect.left - this.x;
      const dy = event.clientY - rect.top - this.y;
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        angle: Math.atan2(dy, dx),
      };
      handle.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent): void => {
      if (!drag || event.pointerId !== drag.id) return;
      event.preventDefault();
      const rect = this.host.getBoundingClientRect();
      if (kind === "move") {
        this.moveBy(event.clientX - drag.x, event.clientY - drag.y);
      } else {
        const dx = event.clientX - rect.left - this.x;
        const dy = event.clientY - rect.top - this.y;
        const angle = Math.atan2(dy, dx);
        this.transformBy(1, ((angle - drag.angle) * 180) / Math.PI);
        drag.angle = angle;
      }
      drag.x = event.clientX;
      drag.y = event.clientY;
    };
    const up = (event: PointerEvent): void => {
      if (!drag || event.pointerId !== drag.id) return;
      drag = null;
    };
    handle.addEventListener("pointerdown", down);
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  }

  private get lengthPx(): number {
    return this.lengthMm * this.pxPerMm;
  }

  private get toolHeight(): number {
    return this.heightMm * this.pxPerMm;
  }

  private localEdges(): Array<{ a: Pt; b: Pt }> {
    const halfW = this.lengthPx / 2;
    const halfH = this.toolHeight / 2;
    if (this.settings.kind === "triangle") {
      const leftTop = { x: -halfW, y: -halfH };
      const rightTop = { x: halfW, y: -halfH };
      const bottom = { x: 0, y: halfH };
      return [
        { a: leftTop, b: rightTop },
        { a: rightTop, b: bottom },
        { a: bottom, b: leftTop },
      ];
    }
    return [
      { a: { x: -halfW, y: -halfH }, b: { x: halfW, y: -halfH } },
      { a: { x: -halfW, y: halfH }, b: { x: halfW, y: halfH } },
    ];
  }

  private renderDegrees(): void {
    const radius = this.lengthPx / 2;
    const centreX = radius;
    const centreY = this.toolHeight;
    for (let degree = 0; degree <= 180; degree += 5) {
      const radians = (Math.PI * (180 - degree)) / 180;
      const inset = degree % 10 === 0 ? 13 : 7;
      const tick = this.ticks.createSpan({
        cls: degree % 10 === 0 ? "goodobsidian-degree is-major" : "goodobsidian-degree",
      });
      tick.setCssStyles({
        left: `${centreX + (radius - inset) * Math.cos(radians)}px`,
        top: `${centreY - (radius - inset) * Math.sin(radians)}px`,
        transform: `translate(-50%, -50%) rotate(${degree - 90}deg)`,
      });
      if (degree % 10 === 0) {
        const labelRadius = radius - 27;
        const label = this.ticks.createSpan({
          cls: "goodobsidian-degree-number",
          text: String(degree),
        });
        label.setCssStyles({
          left: `${centreX + labelRadius * Math.cos(radians)}px`,
          top: `${centreY - labelRadius * Math.sin(radians)}px`,
        });
      }
    }
  }

  private renderProtractorScale(): void {
    const scale = this.ticks.createDiv({ cls: "goodobsidian-protractor-linear-scale" });
    const inch = this.settings.unit === "inch";
    const stepMm = rulerStepMm(this.pxPerMm, this.settings.unit);
    const majorMm = inch ? 25.4 : 10;
    const halfMm = inch ? 25.4 / 2 : 5;
    scale.setCssProps({
      "--gob-ruler-minor": `${Math.max(0.5, stepMm * this.pxPerMm)}px`,
      "--gob-ruler-half": `${Math.max(0.5, halfMm * this.pxPerMm)}px`,
      "--gob-ruler-major": `${Math.max(0.5, majorMm * this.pxPerMm)}px`,
    });
    const majors = Math.floor(this.lengthMm / majorMm);
    for (let i = 1; i <= majors; i++) {
      const label = scale.createSpan({ cls: "goodobsidian-protractor-scale-number", text: String(i) });
      label.setCssStyles({ left: `${i * majorMm * this.pxPerMm}px` });
    }
  }

  private renderTriangleDegrees(): void {
    const band = this.ticks.createDiv({ cls: "goodobsidian-triangle-degree-band" });
    const centreX = this.lengthPx / 2;
    const centreY = this.toolHeight;
    const radius = this.toolHeight * 0.64;
    for (let degree = 0; degree <= 90; degree += 10) {
      const radians = ((-135 + degree) * Math.PI) / 180;
      const tick = band.createSpan({ cls: "goodobsidian-triangle-degree" });
      tick.setCssStyles({
        left: `${centreX + radius * Math.cos(radians)}px`,
        top: `${centreY + radius * Math.sin(radians)}px`,
        transform: `translate(-50%, -50%) rotate(${degree - 45}deg)`,
      });
      const labelRadius = radius - 13;
      const label = band.createSpan({
        cls: "goodobsidian-triangle-degree-number",
        text: String(degree <= 45 ? degree : 90 - degree),
      });
      label.setCssStyles({
        left: `${centreX + labelRadius * Math.cos(radians)}px`,
        top: `${centreY + labelRadius * Math.sin(radians)}px`,
      });
    }
  }

  private protractorGuide(point: Pt): RulerGuide | null {
    const halfW = this.lengthPx / 2;
    const halfH = this.toolHeight / 2;
    const centerLocal = { x: 0, y: halfH };
    const arcDistance = Math.abs(Math.hypot(point.x, point.y - halfH) - halfW);
    const baseDistance = Math.abs(point.y - halfH);
    if (Math.min(arcDistance, baseDistance) > 30) return null;
    const radians = (this.angle * Math.PI) / 180;
    const rect = this.host.getBoundingClientRect();
    if (arcDistance < baseDistance && point.y <= halfH) {
      return {
        kind: "arc",
        center: {
          x: rect.left + this.x - centerLocal.y * Math.sin(radians),
          y: rect.top + this.y + centerLocal.y * Math.cos(radians),
        },
        radius: halfW,
      };
    }
    return {
      kind: "line",
      origin: {
        x: rect.left + this.x - halfW * Math.cos(radians) - halfH * Math.sin(radians),
        y: rect.top + this.y - halfW * Math.sin(radians) + halfH * Math.cos(radians),
      },
      direction: { x: Math.cos(radians), y: Math.sin(radians) },
    };
  }
}

export function physicalDimensions(
  kind: RulerKind,
  settings: Pick<RulerSettings, "baseLength" | "unit">,
): { width: number; height: number } {
  const width = settings.baseLength * (settings.unit === "inch" ? 25.4 : 10);
  // Base length stretches only the measured edge. Tool depth remains the
  // physical size of the original 12 cm instrument.
  if (kind === "triangle" || kind === "protractor") return { width, height: 60 };
  return { width, height: 18 };
}

export function snapRotation(angle: number, snap: RulerDegreeSnap): number {
  if (snap === "off") return angle;
  const cardinal = Math.round(angle / 90) * 90;
  if (Math.abs(angle - cardinal) <= 6) return cardinal;
  const step = Math.round(angle / snap) * snap;
  return Math.abs(angle - step) <= Math.min(3, snap * 0.22) ? step : angle;
}

function projectToSegment(point: Pt, a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) return a;
  const t = Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}
