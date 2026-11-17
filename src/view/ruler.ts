import type { Pt } from "../ink/shape-geometry";
import { PAGE_PX_PER_MM } from "../model/units";
import { triangleMarkings, TRIANGLE_WIDTH_MM, TRIANGLE_HEIGHT_MM } from "./triangle-markings";
import { protractorGeometry, protractorMarkings } from "./protractor-markings";

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
  /** Rotation grid in degrees; cardinal directions receive a stronger magnet. */
  degreeSnap: RulerDegreeSnap;
  /** Uniform tool size; markings remain calibrated to the page. */
  scale: number;
}

export const DEFAULT_RULER_SETTINGS: RulerSettings = {
  theme: "clear",
  unit: "cm",
  kind: "ruler",
  degreeSnap: 15,
  scale: 1,
};

export function parseRulerSettings(value: unknown): RulerSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_RULER_SETTINGS };
  const raw = value as Partial<RulerSettings>;
  return {
    theme:
      raw.theme === "light" || raw.theme === "dark" || raw.theme === "school" ? raw.theme : "clear",
    unit: raw.unit === "inch" ? "inch" : "cm",
    kind: raw.kind === "triangle" || raw.kind === "protractor" ? raw.kind : "ruler",
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
        ? Math.min(4, Math.max(0.5, raw.scale))
        : 1,
  };
}

/** Zoom magnifies existing divisions; it never adds sub-millimetre ticks. */
export function rulerStepMm(_pxPerMm: number, unit: RulerUnit): number {
  return unit === "inch" ? 25.4 / 16 : 1;
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
  /** Physical span, resized proportionally by a pinch. */
  private lengthMm = 120;
  /** CSS px per millimetre at the canvas zoom now. */
  private pxPerMm = 4;
  private heightMm = 18;
  private shown = false;
  private settings: RulerSettings = { ...DEFAULT_RULER_SETTINGS };
  private readonly ticks: HTMLElement;

  constructor(private readonly host: HTMLElement) {
    this.el = host.createDiv({ cls: "finenotes-x-ruler is-hidden" });
    this.el.setAttribute("aria-hidden", "true");
    this.installGlassFilter();
    this.ticks = this.el.createDiv({ cls: "finenotes-x-ruler-ticks" });
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
    if (Math.abs(p.x) > this.lengthPx / 2 || Math.abs(p.y) > this.toolHeight / 2) return false;
    if (this.settings.kind === "ruler") return true;
    if (this.settings.kind === "protractor") {
      const shape = protractorGeometry(this.settings.scale);
      const x = p.x / this.pxPerMm + shape.width / 2;
      const y = p.y / this.pxPerMm + shape.height / 2;
      if (y < 0 || y > shape.height) return false;
      if (y >= shape.center.y) return true;
      const distance = Math.hypot(x - shape.center.x, y - shape.center.y);
      return (
        (distance >= shape.innerRadius && distance <= shape.radius) || distance <= shape.tabRadius
      );
    }
    // The geometry triangle is a symmetric 45-degree set square.
    const left = -this.lengthPx / 2;
    const top = -this.toolHeight / 2;
    const u = (p.x - left) / this.lengthPx;
    const v = (p.y - top) / this.toolHeight;
    return v >= 0 && v <= 1 && Math.abs(u - 0.5) <= (1 - v) / 2;
  }

  moveBy(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
    this.place();
  }

  /** Detect a fast stroke crossing the material between pointer samples. */
  crossesMaterial(from: Pt, to: Pt): boolean {
    if (!this.shown) return false;
    if (this.hit(from.x, from.y) || this.hit(to.x, to.y)) return true;
    const a = this.local(from.x, from.y);
    const b = this.local(to.x, to.y);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const halfW = this.lengthPx / 2;
    const halfH = this.toolHeight / 2;
    if (
      Math.min(a.x, b.x) > halfW ||
      Math.max(a.x, b.x) < -halfW ||
      Math.min(a.y, b.y) > halfH ||
      Math.max(a.y, b.y) < -halfH
    )
      return false;
    const candidates: number[] = [];
    let edges = this.localEdges();
    if (this.settings.kind === "ruler") {
      edges = [
        ...edges,
        { a: { x: -halfW, y: -halfH }, b: { x: -halfW, y: halfH } },
        { a: { x: halfW, y: -halfH }, b: { x: halfW, y: halfH } },
      ];
    } else if (this.settings.kind === "protractor") {
      const shape = protractorGeometry(this.settings.scale);
      const cy = shape.center.y * this.pxPerMm - halfH;
      edges = [
        { a: { x: -halfW, y: cy }, b: { x: halfW, y: cy } },
        { a: { x: -halfW, y: halfH }, b: { x: halfW, y: halfH } },
        { a: { x: -halfW, y: cy }, b: { x: -halfW, y: halfH } },
        { a: { x: halfW, y: cy }, b: { x: halfW, y: halfH } },
      ];
      const aa = dx * dx + dy * dy;
      if (aa > 0)
        for (const radius of [shape.radius, shape.innerRadius, shape.tabRadius]) {
          const bb = 2 * (a.x * dx + (a.y - cy) * dy);
          const cc = a.x * a.x + (a.y - cy) ** 2 - (radius * this.pxPerMm) ** 2;
          const discriminant = bb * bb - 4 * aa * cc;
          if (discriminant >= 0) {
            candidates.push(
              (-bb - Math.sqrt(discriminant)) / (2 * aa),
              (-bb + Math.sqrt(discriminant)) / (2 * aa),
            );
          }
        }
    }
    for (const edge of edges) {
      const ex = edge.b.x - edge.a.x;
      const ey = edge.b.y - edge.a.y;
      const denominator = dx * ey - dy * ex;
      if (Math.abs(denominator) < 1e-8) continue;
      const ax = edge.a.x - a.x;
      const ay = edge.a.y - a.y;
      const t = (ax * ey - ay * ex) / denominator;
      const u = (ax * dy - ay * dx) / denominator;
      if (u >= 0 && u <= 1) candidates.push(t);
    }
    return candidates.some((t) => {
      if (t < 0 || t >= 1) return false;
      const inside = Math.min(1, t + 1e-5);
      return this.hit(from.x + (to.x - from.x) * inside, from.y + (to.y - from.y) * inside);
    });
  }

  transformBy(scaleFactor: number, rotation: number, focus?: Pt): void {
    const oldScale = this.settings.scale;
    const oldAngle = this.angle;
    if (Number.isFinite(scaleFactor) && scaleFactor > 0) {
      this.settings.scale = Math.min(4, Math.max(0.5, oldScale * scaleFactor));
    }
    if (Number.isFinite(rotation)) this.rawAngle += rotation;
    this.angle = snapRotation(this.rawAngle, this.settings.degreeSnap);
    // Keep the same point beneath the fingers while resizing and rotating.
    if (focus) {
      const rect = this.host.getBoundingClientRect();
      const fx = focus.x - rect.left;
      const fy = focus.y - rect.top;
      const dx = this.x - fx;
      const dy = this.y - fy;
      const factor = this.settings.scale / oldScale;
      const radians = ((this.angle - oldAngle) * Math.PI) / 180;
      this.x = fx + factor * (dx * Math.cos(radians) - dy * Math.sin(radians));
      this.y = fy + factor * (dx * Math.sin(radians) + dy * Math.cos(radians));
    }
    if (oldScale !== this.settings.scale) {
      this.updateDimensions();
      this.renderTicks();
    }
    this.place();
  }

  /** Keep every marking calibrated to the page while its zoom changes. */
  setPageScale(cssPxPerPagePx: number): void {
    const pxPerMm = cssPxPerPagePx * PAGE_PX_PER_MM;
    if (!(pxPerMm > 0) || !Number.isFinite(pxPerMm)) return;
    if (Math.abs(pxPerMm - this.pxPerMm) < 0.001) return;
    this.pxPerMm = pxPerMm;
    if (this.settings.kind === "ruler") this.renderTicks();
    this.place();
  }

  setSettings(settings: RulerSettings): void {
    this.settings = parseRulerSettings(settings);
    this.angle = snapRotation(this.rawAngle, this.settings.degreeSnap);
    this.updateDimensions();
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
          rect.top + this.y + originLocal.x * Math.sin(radians) + originLocal.y * Math.cos(radians),
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
    this.ticks.setCssStyles({ left: "", width: "", fontSize: "" });
    if (this.settings.kind === "triangle") {
      this.renderTriangle();
      return;
    }
    if (this.settings.kind === "protractor") {
      this.renderProtractor();
      return;
    }
    const inch = this.settings.unit === "inch";
    const stepMm = rulerStepMm(this.pxPerMm, this.settings.unit);
    const stroke = Math.min(1, stepMm * this.pxPerMm * 0.5);
    const majorMm = inch ? 25.4 : 10;
    const halfMm = inch ? 25.4 / 2 : 5;
    const markedLengthMm = this.lengthMm - 10;
    // The body includes 5 mm of unprinted material at both ends. Include the
    // last tick's stroke so the endpoint is not clipped.
    this.ticks.setCssStyles({
      left: `${5 * this.pxPerMm}px`,
      width: `${markedLengthMm * this.pxPerMm + stroke}px`,
      fontSize: `${this.toolHeight * 0.12}px`,
    });
    // Repeated divisions keep the element count independent of page zoom.
    this.ticks.setCssProps({
      "--gob-ruler-minor": `${stepMm * this.pxPerMm}px`,
      "--gob-ruler-half": `${halfMm * this.pxPerMm}px`,
      "--gob-ruler-major": `${majorMm * this.pxPerMm}px`,
      "--gob-ruler-stroke": `${stroke}px`,
    });
    const majors = Math.floor(markedLengthMm / majorMm);
    for (let i = 0; i <= majors; i++) {
      const label = this.ticks.createSpan({
        cls: "finenotes-x-ruler-number",
        text: String(i),
      });
      label.setCssStyles({ left: `${i * majorMm * this.pxPerMm + stroke / 2}px` });
    }
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

  private renderProtractor(): void {
    const markings = protractorMarkings(this.settings.scale, this.settings.unit);
    const svg = this.ticks.createSvg("svg");
    svg.setAttribute("viewBox", `0 0 ${markings.width} ${markings.height}`);
    svg.setAttribute("class", "finenotes-x-protractor-markings");
    svg.setAttribute("aria-hidden", "true");
    // Share the exact silhouette with the transparent backdrop, so the opening
    // reveals the page and the base extends beyond the 10 cm measuring arc.
    const mask = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${markings.width} ${markings.height}"><path fill="white" fill-rule="evenodd" d="${markings.outline}${markings.opening}"/><circle fill="white" cx="${markings.center.x}" cy="${markings.center.y}" r="${markings.tabRadius}"/></svg>`;
    this.el.setCssProps({
      "--gob-protractor-mask": `url("data:image/svg+xml,${encodeURIComponent(mask)}")`,
    });
    for (const band of markings.bands) {
      const path = svg.createSvg("path");
      path.setAttribute("class", `finenotes-x-protractor-band is-${band.direction}`);
      path.setAttribute("d", band.path);
      path.setAttribute("stroke-width", String(band.width));
    }
    for (const [cls, d] of [
      ["outline", markings.outline + markings.opening],
      ["degree-ticks", markings.degreeTicks],
      ["linear-ticks", markings.linearTicks],
      ["center-mark", markings.centerMark],
    ]) {
      const path = svg.createSvg("path");
      path.setAttribute("class", `finenotes-x-protractor-${cls}`);
      path.setAttribute("d", d);
    }
    for (const { x, y, text, rotation, fontSize, kind, direction, textLength } of markings.labels) {
      const label = svg.createSvg("text");
      label.setAttribute("x", String(x));
      label.setAttribute("y", String(y));
      label.setAttribute(
        "class",
        `finenotes-x-protractor-label is-${kind}${direction ? ` is-${direction}` : ""}`,
      );
      label.setAttribute("font-size", String(fontSize));
      if (textLength !== undefined) {
        label.setAttribute("textLength", String(textLength));
        label.setAttribute("lengthAdjust", "spacingAndGlyphs");
      }
      if (rotation) label.setAttribute("transform", `rotate(${rotation} ${x} ${y})`);
      label.textContent = text;
    }
  }

  private updateDimensions(): void {
    const dimensions = physicalDimensions(this.settings.kind, this.settings.scale);
    this.lengthMm = dimensions.width;
    this.heightMm = dimensions.height;
  }

  private renderTriangle(): void {
    const svg = this.ticks.createSvg("svg");
    svg.setAttribute("viewBox", `0 0 ${this.lengthMm} ${this.heightMm}`);
    svg.setAttribute("class", "finenotes-x-triangle-markings");
    svg.setAttribute("aria-hidden", "true");
    const markings = triangleMarkings(this.lengthMm);
    for (const [cls, d] of [
      ["outline", markings.outline],
      ["degree-band", markings.degreeBand],
      ["grid", markings.grid],
      ["edge-ticks", markings.edgeTicks],
      ["degree-ticks", markings.degreeTicks],
    ]) {
      const path = svg.createSvg("path");
      path.setAttribute("class", `finenotes-x-triangle-${cls}`);
      path.setAttribute("d", d);
    }
    for (const { x, y, text, rotation, kind, fontSize, textLength } of markings.labels) {
      const label = svg.createSvg("text");
      label.setAttribute("x", String(x));
      label.setAttribute("y", String(y));
      label.setAttribute("class", `finenotes-x-triangle-label is-${kind}`);
      if (fontSize !== undefined) label.setAttribute("font-size", String(fontSize));
      if (textLength !== undefined) {
        label.setAttribute("textLength", String(textLength));
        label.setAttribute("lengthAdjust", "spacingAndGlyphs");
      }
      if (rotation) label.setAttribute("transform", `rotate(${rotation} ${x} ${y})`);
      label.textContent = text;
    }
  }

  private installGlassFilter(): void {
    const svg = this.el.createSvg("svg");
    svg.setAttribute("class", "finenotes-x-ruler-filter");
    svg.setAttribute("aria-hidden", "true");
    const filter = svg.createSvg("filter");
    const id = `finenotes-x-ruler-glass-${++glassFilterId}`;
    filter.setAttribute("id", id);
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const noise = filter.createSvg("feTurbulence");
    noise.setAttribute("type", "fractalNoise");
    noise.setAttribute("baseFrequency", "0.012 0.045");
    noise.setAttribute("numOctaves", "2");
    noise.setAttribute("seed", "8");
    noise.setAttribute("result", "glass");
    const displacement = filter.createSvg("feDisplacementMap");
    displacement.setAttribute("in", "SourceGraphic");
    displacement.setAttribute("in2", "glass");
    displacement.setAttribute("scale", "4");
    displacement.setAttribute("xChannelSelector", "R");
    displacement.setAttribute("yChannelSelector", "G");
    this.el.setCssProps({ "--gob-ruler-refraction": `url("#${id}")` });
  }

  private protractorGuide(point: Pt): RulerGuide | null {
    const shape = protractorGeometry(this.settings.scale);
    const halfW = this.lengthPx / 2;
    const halfH = this.toolHeight / 2;
    const centerY = shape.center.y * this.pxPerMm - halfH;
    const distance = Math.hypot(point.x, point.y - centerY);
    const outerRadius = shape.radius * this.pxPerMm;
    const innerRadius = shape.innerRadius * this.pxPerMm;
    const radius =
      Math.abs(distance - outerRadius) < Math.abs(distance - innerRadius)
        ? outerRadius
        : innerRadius;
    const arcDistance = point.y <= centerY ? Math.abs(distance - radius) : Infinity;
    const baseProjection = projectToSegment(point, { x: -halfW, y: halfH }, { x: halfW, y: halfH });
    const baseDistance = Math.hypot(point.x - baseProjection.x, point.y - baseProjection.y);
    if (Math.min(arcDistance, baseDistance) > 30) return null;
    const radians = (this.angle * Math.PI) / 180;
    const rect = this.host.getBoundingClientRect();
    if (arcDistance < baseDistance) {
      return {
        kind: "arc",
        center: {
          x: rect.left + this.x - centerY * Math.sin(radians),
          y: rect.top + this.y + centerY * Math.cos(radians),
        },
        radius,
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

export function physicalDimensions(kind: RulerKind, scale = 1): { width: number; height: number } {
  if (kind === "triangle") {
    return { width: TRIANGLE_WIDTH_MM * scale, height: TRIANGLE_HEIGHT_MM * scale };
  }
  if (kind === "protractor") {
    const { width, height } = protractorGeometry(scale);
    return { width, height };
  }
  return { width: 120 * scale, height: 18 * scale };
}

let glassFilterId = 0;

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
