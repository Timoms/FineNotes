import type { Command } from "./commands";
import type { Bounds, InkDocument, ProtectionZone, Stroke } from "./document";

/** Split at rectangle edges, protecting only the ink inside the rectangle. */
export function lockStrokeInRect(
  stroke: Stroke,
  rect: Bounds,
  nextId: () => string,
): Stroke[] | null {
  if (stroke.locked) return null;
  const inside = (x: number, y: number): boolean =>
    x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY;
  if (stroke.pts.length === 3) {
    return inside(stroke.pts[0], stroke.pts[1]) ? [{ ...stroke, locked: true }] : null;
  }
  const runs: Array<{ locked: boolean; pts: number[]; pose: number[] }> = [];
  for (let i = 0; i + 5 < stroke.pts.length; i += 3) {
    const x = stroke.pts[i],
      y = stroke.pts[i + 1];
    const dx = stroke.pts[i + 3] - x,
      dy = stroke.pts[i + 4] - y;
    const cuts = [0, 1];
    if (dx !== 0) cuts.push((rect.minX - x) / dx, (rect.maxX - x) / dx);
    if (dy !== 0) cuts.push((rect.minY - y) / dy, (rect.maxY - y) / dy);
    const ts = [...new Set(cuts.filter((t) => t >= 0 && t <= 1))].sort((a, b) => a - b);
    for (let j = 0; j + 1 < ts.length; j++) {
      const a = ts[j],
        b = ts[j + 1],
        mid = (a + b) / 2;
      const locked = inside(x + dx * mid, y + dy * mid);
      let run = runs[runs.length - 1];
      const append = (t: number): void => {
        for (let k = 0; k < 3; k++) {
          run.pts.push(stroke.pts[i + k] + (stroke.pts[i + 3 + k] - stroke.pts[i + k]) * t);
          if (stroke.pose)
            run.pose.push(stroke.pose[i + k] + (stroke.pose[i + 3 + k] - stroke.pose[i + k]) * t);
        }
      };
      if (!run || run.locked !== locked) {
        run = { locked, pts: [], pose: [] };
        runs.push(run);
        append(a);
      }
      append(b);
    }
  }
  if (!runs.some((run) => run.locked)) return null;
  if (runs.length === 1) return [{ ...stroke, locked: true }];
  return runs.map((run) => ({
    ...stroke,
    id: nextId(),
    pts: run.pts,
    ...(stroke.pose ? { pose: run.pose } : {}),
    ...(run.locked ? { locked: true } : {}),
  }));
}

/** Validate persisted foil frames without inventing replacement coordinates. */
export function readProtectionZones(raw: unknown): ProtectionZone[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((zone): zone is ProtectionZone => {
      if (!zone || typeof zone !== "object") return false;
      const z = zone as Record<string, unknown>;
      return (
        [z.minX, z.minY, z.maxX, z.maxY].every(
          (v) => typeof v === "number" && Number.isFinite(v),
        ) &&
        (z.maxX as number) > (z.minX as number) &&
        (z.maxY as number) > (z.minY as number) &&
        Array.isArray(z.strokes) &&
        z.strokes.every((id) => typeof id === "string")
      );
    })
    .map((z) => ({
      minX: z.minX,
      minY: z.minY,
      maxX: z.maxX,
      maxY: z.maxY,
      strokes: [...z.strokes],
    }));
}

/** Foils live outside stroke ink, so no eraser can remove their frames. */
export class AddProtectionZone implements Command {
  readonly label = "Add protection foil";
  private before: ProtectionZone[] | undefined;
  constructor(
    readonly pageId: string,
    private readonly zone: ProtectionZone,
  ) {}
  apply(doc: InkDocument): void {
    const page = doc.pages.find((p) => p.id === this.pageId);
    if (!page) return;
    this.before = page.protectionZones;
    page.protectionZones = [...(this.before ?? []), this.zone];
  }
  invert(doc: InkDocument): void {
    const page = doc.pages.find((p) => p.id === this.pageId);
    if (!page) return;
    if (this.before === undefined) delete page.protectionZones;
    else page.protectionZones = this.before;
  }
}

/** Update a foil's frame and protected stroke IDs as one undoable change. */
export class UpdateProtectionZone implements Command {
  readonly label = "Update protection foil";
  private before: ProtectionZone | null = null;
  constructor(
    readonly pageId: string,
    private readonly zone: ProtectionZone,
    private readonly next: ProtectionZone,
  ) {}
  apply(doc: InkDocument): void {
    const page = doc.pages.find((p) => p.id === this.pageId);
    if (!page?.protectionZones?.includes(this.zone)) return;
    this.before = { ...this.zone, strokes: [...this.zone.strokes] };
    Object.assign(this.zone, this.next, { strokes: [...this.next.strokes] });
  }
  invert(doc: InkDocument): void {
    const page = doc.pages.find((p) => p.id === this.pageId);
    if (this.before && page?.protectionZones?.includes(this.zone))
      Object.assign(this.zone, this.before, { strokes: [...this.before.strokes] });
  }
}

/** Removing the foil leaves its contents intact and can be undone. */
export class RemoveProtectionZone implements Command {
  readonly label = "Delete protection foil";
  private before: ProtectionZone[] | undefined;
  constructor(
    readonly pageId: string,
    private readonly zone: ProtectionZone,
  ) {}
  apply(doc: InkDocument): void {
    const page = doc.pages.find((p) => p.id === this.pageId);
    if (!page) return;
    this.before = page.protectionZones;
    page.protectionZones = page.protectionZones?.filter((zone) => zone !== this.zone);
  }
  invert(doc: InkDocument): void {
    const page = doc.pages.find((p) => p.id === this.pageId);
    if (page) page.protectionZones = this.before;
  }
}
